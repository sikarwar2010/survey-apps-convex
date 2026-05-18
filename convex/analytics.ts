/**
 * Survey analytics — district, ULB, and surveyor breakdowns for admin & supervisor panels.
 *
 * All counts respect `resolveTenantScope`: supervisors see only their district/ULB;
 * admins see the full catalog. Optional filters narrow the summary and child tables.
 */
import { v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { query, type QueryCtx } from './_generated/server';
import { clientError, requireRole, requireUser } from './helpers';
import { assertMunicipalityInScope, resolveTenantScope, tenantDistrictIds, tenantMunicipalityIds } from './tenancy';

export const surveyCountsShape = {
  total: v.number(),
  today: v.number(),
  drafts: v.number(),
  submitted: v.number(),
  approved: v.number(),
  rejected: v.number(),
};

const breakdownRow = {
  ...surveyCountsShape,
};

function startOfTodayMs(): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.getTime();
}

export type SurveyCounts = {
  total: number;
  today: number;
  drafts: number;
  submitted: number;
  approved: number;
  rejected: number;
};

function countRows(rows: Doc<'surveys'>[]): SurveyCounts {
  const todayMs = startOfTodayMs();
  return {
    total: rows.length,
    today: rows.filter((r) => r._creationTime >= todayMs).length,
    drafts: rows.filter((r) => r.status === 'draft').length,
    submitted: rows.filter((r) => r.status === 'submitted').length,
    approved: rows.filter((r) => r.qcStatus === 'approved').length,
    rejected: rows.filter((r) => r.qcStatus === 'rejected').length,
  };
}

/** Load every survey row visible to admin or supervisor within tenant scope. */
async function loadScopedSurveys(ctx: QueryCtx, me: Doc<'users'>): Promise<Doc<'surveys'>[]> {
  const scope = await resolveTenantScope(ctx, me);
  const muniIds = tenantMunicipalityIds(scope);

  if (me.role === 'admin') {
    const rows = await ctx.db.query('surveys').collect();
    return rows.filter((r) => muniIds.has(r.municipalityId));
  }

  if (me.role === 'supervisor') {
    if (scope.districts.length === 1) {
      const rows = await ctx.db
        .query('surveys')
        .withIndex('by_district', (q) => q.eq('districtId', scope.districts[0]!._id))
        .collect();
      return rows.filter((r) => muniIds.has(r.municipalityId));
    }
    if (me.municipalityId) {
      return await ctx.db
        .query('surveys')
        .withIndex('by_municipality_status', (q) => q.eq('municipalityId', me.municipalityId!))
        .collect();
    }
    return [];
  }

  return [];
}

async function assertDistrictInScope(
  me: Doc<'users'>,
  districtId: Id<'districts'>,
  allowedDistrictIds: Set<Id<'districts'>>,
) {
  if (me.role === 'admin') return;
  if (!allowedDistrictIds.has(districtId)) {
    clientError('FORBIDDEN', 'This district is outside your assigned scope');
  }
}

async function assertSurveyorInScope(
  ctx: QueryCtx,
  me: Doc<'users'>,
  surveyor: Doc<'users'>,
  muniIds: Set<Id<'municipalities'>>,
  districtIds: Set<Id<'districts'>>,
) {
  if (me.role === 'admin') return;
  if (surveyor.municipalityId && muniIds.has(surveyor.municipalityId)) return;
  if (surveyor.districtId && districtIds.has(surveyor.districtId)) return;
  clientError('FORBIDDEN', 'This surveyor is outside your assigned scope');
}

function groupCounts(rows: Doc<'surveys'>[], keyFn: (row: Doc<'surveys'>) => string): Map<string, Doc<'surveys'>[]> {
  const groups = new Map<string, Doc<'surveys'>[]>();
  for (const row of rows) {
    const key = keyFn(row);
    const bucket = groups.get(key);
    if (bucket) bucket.push(row);
    else groups.set(key, [row]);
  }
  return groups;
}

/**
 * Aggregated survey KPIs with district / ULB / surveyor breakdown tables.
 * Drives admin Reports and supervisor dashboard analytics.
 */
export const surveyStatsBreakdown = query({
  args: {
    districtId: v.optional(v.id('districts')),
    municipalityId: v.optional(v.id('municipalities')),
    surveyorId: v.optional(v.id('users')),
  },
  returns: v.object({
    summary: v.object(surveyCountsShape),
    byDistrict: v.array(
      v.object({
        districtId: v.id('districts'),
        code: v.string(),
        name: v.string(),
        ...breakdownRow,
      }),
    ),
    byUlb: v.array(
      v.object({
        municipalityId: v.id('municipalities'),
        code: v.string(),
        name: v.string(),
        districtId: v.id('districts'),
        districtName: v.string(),
        ...breakdownRow,
      }),
    ),
    bySurveyor: v.array(
      v.object({
        surveyorId: v.id('users'),
        name: v.string(),
        email: v.string(),
        municipalityName: v.union(v.string(), v.null()),
        districtName: v.union(v.string(), v.null()),
        ...breakdownRow,
      }),
    ),
    filterOptions: v.object({
      districts: v.array(
        v.object({
          _id: v.id('districts'),
          code: v.string(),
          name: v.string(),
        }),
      ),
      municipalities: v.array(
        v.object({
          _id: v.id('municipalities'),
          code: v.string(),
          name: v.string(),
          districtId: v.id('districts'),
        }),
      ),
      surveyors: v.array(
        v.object({
          _id: v.id('users'),
          name: v.string(),
          email: v.string(),
        }),
      ),
    }),
  }),
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    requireRole(me, 'admin', 'supervisor');

    const scope = await resolveTenantScope(ctx, me);
    const districtIds = tenantDistrictIds(scope);
    const muniIds = tenantMunicipalityIds(scope);

    let rows = await loadScopedSurveys(ctx, me);

    if (args.districtId) {
      await assertDistrictInScope(me, args.districtId, districtIds);
      rows = rows.filter((r) => r.districtId === args.districtId);
    }
    if (args.municipalityId) {
      await assertMunicipalityInScope(ctx, me, args.municipalityId);
      rows = rows.filter((r) => r.municipalityId === args.municipalityId);
    }
    if (args.surveyorId) {
      const surveyor = await ctx.db.get(args.surveyorId);
      if (!surveyor || surveyor.role !== 'surveyor') {
        clientError('BAD_REQUEST', 'Unknown surveyor');
      }
      await assertSurveyorInScope(ctx, me, surveyor, muniIds, districtIds);
      rows = rows.filter((r) => r.surveyorId === args.surveyorId);
    }

    const districtMap = new Map(scope.districts.map((d) => [d._id, d]));
    const muniMap = new Map(scope.municipalities.map((m) => [m._id, m]));

    const byDistrictGroups = groupCounts(rows, (r) => r.districtId);
    const byDistrict = [...byDistrictGroups.entries()]
      .map(([districtId, group]) => {
        const d = districtMap.get(districtId as Id<'districts'>);
        return {
          districtId: districtId as Id<'districts'>,
          code: d?.code ?? '—',
          name: d?.name ?? 'Unknown district',
          ...countRows(group),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const byUlbGroups = groupCounts(rows, (r) => r.municipalityId);
    const byUlb = [...byUlbGroups.entries()]
      .map(([municipalityId, group]) => {
        const m = muniMap.get(municipalityId as Id<'municipalities'>);
        const d = m ? districtMap.get(m.districtId) : undefined;
        return {
          municipalityId: municipalityId as Id<'municipalities'>,
          code: m?.code ?? '—',
          name: m?.name ?? 'Unknown ULB',
          districtId: m?.districtId ?? group[0]!.districtId,
          districtName: d?.name ?? '—',
          ...countRows(group),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const bySurveyorGroups = groupCounts(rows, (r) => r.surveyorId);
    const surveyorIds = [...bySurveyorGroups.keys()] as Id<'users'>[];
    const surveyorDocs = new Map<Id<'users'>, Doc<'users'>>();
    for (const id of surveyorIds) {
      const u = await ctx.db.get(id);
      if (u) surveyorDocs.set(id, u);
    }

    const bySurveyor = surveyorIds
      .map((surveyorId) => {
        const u = surveyorDocs.get(surveyorId);
        const group = bySurveyorGroups.get(surveyorId)!;
        const muni = u?.municipalityId ? muniMap.get(u.municipalityId) : undefined;
        const dist = u?.districtId
          ? districtMap.get(u.districtId)
          : muni
            ? districtMap.get(muni.districtId)
            : undefined;
        return {
          surveyorId,
          name: u?.name ?? 'Unknown',
          email: u?.email ?? '',
          municipalityName: muni?.name ?? null,
          districtName: dist?.name ?? null,
          ...countRows(group),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const surveyorFilterDistrict = args.districtId;
    const surveyorFilterMuni = args.municipalityId;

    const activeSurveyors = (
      await ctx.db
        .query('users')
        .withIndex('by_role_status', (q) => q.eq('role', 'surveyor').eq('status', 'active'))
        .collect()
    ).filter((u) => {
      if (u.municipalityId && !muniIds.has(u.municipalityId)) return false;
      if (u.districtId && !districtIds.has(u.districtId)) return false;
      if (surveyorFilterMuni && u.municipalityId !== surveyorFilterMuni) return false;
      if (surveyorFilterDistrict && u.districtId !== surveyorFilterDistrict) {
        if (u.municipalityId) {
          const m = muniMap.get(u.municipalityId);
          if (m?.districtId !== surveyorFilterDistrict) return false;
        } else return false;
      }
      return true;
    });

    const filterMunicipalities = scope.municipalities.filter(
      (m) => !args.districtId || m.districtId === args.districtId,
    );

    return {
      summary: countRows(rows),
      byDistrict,
      byUlb,
      bySurveyor,
      filterOptions: {
        districts: scope.districts.map((d) => ({ _id: d._id, code: d.code, name: d.name })),
        municipalities: filterMunicipalities.map((m) => ({
          _id: m._id,
          code: m.code,
          name: m.name,
          districtId: m.districtId,
        })),
        surveyors: activeSurveyors.map((u) => ({
          _id: u._id,
          name: u.name,
          email: u.email,
        })),
      },
    };
  },
});

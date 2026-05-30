/**
 * audit.ts — READ surface over the existing `auditLogs` table.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS (and why it does not break the "reuse, don't fork" rule)
 * ─────────────────────────────────────────────────────────────────────────
 * The mobile backend writes audit rows through `helpers.writeAudit` from every
 * mutation, but it never exposed a *read* query — the mobile app has no audit
 * screen. The web Audit module needs one. Per the brief:
 *
 *     "Reuse existing Convex functions. Create server-side mutations and
 *      queries only when missing. All permissions must be enforced on the
 *      server."
 *
 * This module ADDS a read query only. It:
 *   • introduces no new table and changes no field name,
 *   • writes nothing (append-only invariant of `auditLogs` is preserved),
 *   • reuses the exact same `requireUser` / `requireRole` helpers,
 *   • uses the indexes already declared on `auditLogs` (by_entity, by_actor).
 *
 * It is therefore an interface-only addition over the source-of-truth schema.
 */
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { requireRole, requireUser } from "./helpers";

/**
 * Paginated, filterable audit feed. Admin-only — matches the role matrix
 * (only ADMIN has "View audit logs").
 *
 * Filters mirror the index shapes so we never force a table scan when a
 * caller narrows by entity or actor.
 */
export const list = query({
  args: {
    entity: v.optional(v.string()),
    entityId: v.optional(v.string()),
    actorId: v.optional(v.id("users")),
    action: v.optional(v.string()), // exact match on action verb, e.g. "survey.approved"
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    requireRole(me, "admin");

    const limit = Math.min(args.limit ?? 100, 500);

    let rows: Doc<"auditLogs">[];
    if (args.entity) {
      rows = await ctx.db
        .query("auditLogs")
        .withIndex("by_entity", (q) =>
          args.entityId ? q.eq("entity", args.entity!).eq("entityId", args.entityId) : q.eq("entity", args.entity!),
        )
        .order("desc")
        .take(limit * 2);
    } else if (args.actorId) {
      rows = await ctx.db
        .query("auditLogs")
        .withIndex("by_actor", (q) => q.eq("actorId", args.actorId!))
        .order("desc")
        .take(limit * 2);
    } else {
      rows = await ctx.db
        .query("auditLogs")
        .order("desc")
        .take(limit * 2);
    }

    if (args.action) {
      rows = rows.filter((r) => r.action === args.action);
    }
    rows = rows.slice(0, limit);

    // Hydrate actor display names for the table.
    const actorIds = Array.from(new Set(rows.map((r) => r.actorId).filter(Boolean))) as Id<"users">[];
    const actors = await Promise.all(actorIds.map((id) => ctx.db.get(id)));
    const byId = new Map(actors.filter(Boolean).map((u) => [u!._id, u!]));

    return rows.map((r) => ({
      _id: r._id,
      _creationTime: r._creationTime,
      action: r.action,
      entity: r.entity,
      entityId: r.entityId ?? null,
      metadata: r.metadata ?? null,
      actor: r.actorId
        ? byId.get(r.actorId)
          ? { _id: r.actorId, name: byId.get(r.actorId)!.name, email: byId.get(r.actorId)!.email }
          : { _id: r.actorId, name: "Unknown", email: "" }
        : null,
    }));
  },
});

/** Distinct action verbs present in the log — drives the filter dropdown. */
export const actionFacets = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    requireRole(me, "admin");
    const rows = await ctx.db.query("auditLogs").order("desc").take(1000);
    return Array.from(new Set(rows.map((r) => r.action))).sort();
  },
});

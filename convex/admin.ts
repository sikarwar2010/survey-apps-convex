/**
 * Admin-only operations.
 *
 * Every function in this file calls `requireRole(me, "admin")` so the
 * mobile app can call these directly without an additional auth check.
 * Supervisors get a curated subset via `supervisor.ts` (created in a
 * later phase).
 */
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  clientError,
  requireRole,
  requireUser,
  writeAudit,
} from "./helpers";
import { userRole } from "./schema";

/* ────────────────────────── approval workflow ────────────────────────── */

/**
 * Returns every user awaiting approval, newest first. Drives the admin
 * "Pending approvals" inbox.
 */
export const listPendingApprovals = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    requireRole(me, "admin");

    const rows = await ctx.db
      .query("users")
      .withIndex("by_status", (q) => q.eq("status", "pending_approval"))
      .order("desc")
      .collect();

    return rows.map((u) => ({
      _id: u._id,
      email: u.email,
      name: u.name,
      avatarUrl: u.avatarUrl,
      requestedRole: u.requestedRole,
      requestedReason: u.requestedReason,
      createdAt: u._creationTime,
    }));
  },
});

/**
 * Approve a pending user, granting role + tenant scope in one atomic step.
 *
 * - role must be surveyor | supervisor | admin (not "pending")
 * - surveyor & supervisor require municipalityId
 * - surveyor requires at least one ward assignment
 */
export const approveUser = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(
      v.literal("surveyor"),
      v.literal("supervisor"),
      v.literal("admin"),
    ),
    municipalityId: v.optional(v.id("municipalities")),
    wardAssignments: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    requireRole(me, "admin");

    const target = await ctx.db.get(args.userId);
    if (!target) clientError("NOT_FOUND", "User not found");
    if (target.status === "active" && target.role !== "pending") {
      clientError("ALREADY_APPROVED", "This user is already active");
    }

    // Validate role-specific requirements
    const wards = args.wardAssignments ?? [];
    if (args.role !== "admin") {
      if (!args.municipalityId) {
        clientError("BAD_REQUEST", "municipalityId required for surveyor/supervisor", {
          municipalityId: ["select a municipality"],
        });
      }
      const muni = await ctx.db.get(args.municipalityId!);
      if (!muni) clientError("BAD_REQUEST", "Unknown municipality");
    }
    if (args.role === "surveyor" && wards.length === 0) {
      clientError("BAD_REQUEST", "Surveyor needs at least one ward", {
        wardAssignments: ["assign at least one ward"],
      });
    }

    await ctx.db.patch(args.userId, {
      role: args.role,
      status: "active",
      municipalityId: args.municipalityId,
      wardAssignments: wards,
      approvedBy: me._id,
      approvedAt: Date.now(),
    });

    await writeAudit(ctx, {
      actorId: me._id,
      action: "user.approved",
      entity: "user",
      entityId: args.userId,
      metadata: {
        role: args.role,
        municipalityId: args.municipalityId,
        wardAssignments: wards,
      },
    });

    // Drop a notification so the user sees "approved!" next time they open the app.
    await ctx.db.insert("notifications", {
      userId: args.userId,
      type: "account_approved",
      title: "Account approved",
      body: `You've been granted ${args.role} access. Pull-to-refresh to start.`,
    });
  },
});

/** Reject a pending user — keeps the row (audit trail) but disables it. */
export const rejectUser = mutation({
  args: {
    userId: v.id("users"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    requireRole(me, "admin");

    const target = await ctx.db.get(args.userId);
    if (!target) clientError("NOT_FOUND", "User not found");

    await ctx.db.patch(args.userId, {
      status: "disabled",
      disabledBy: me._id,
      disabledAt: Date.now(),
    });

    await writeAudit(ctx, {
      actorId: me._id,
      action: "user.rejected",
      entity: "user",
      entityId: args.userId,
      metadata: { reason: args.reason },
    });

    await ctx.db.insert("notifications", {
      userId: args.userId,
      type: "account_rejected",
      title: "Account request denied",
      body: args.reason ?? "Contact your administrator for more information.",
    });
  },
});

/* ────────────────────────── user management ────────────────────────── */

export const listUsers = query({
  args: {
    role: v.optional(userRole),
    status: v.optional(v.union(
      v.literal("pending_approval"),
      v.literal("active"),
      v.literal("disabled"),
    )),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    requireRole(me, "admin", "supervisor");

    // Choose the cheapest index for the supplied filter combination.
    let rows;
    if (args.role && args.status) {
      rows = await ctx.db
        .query("users")
        .withIndex("by_role_status", (q) =>
          q.eq("role", args.role!).eq("status", args.status!))
        .collect();
    } else if (args.status) {
      rows = await ctx.db
        .query("users")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .collect();
    } else {
      rows = await ctx.db.query("users").collect();
    }

    // Hydrate municipality names for the admin table.
    const munis = new Map<string, string>();
    for (const u of rows) {
      if (u.municipalityId && !munis.has(u.municipalityId)) {
        const m = await ctx.db.get(u.municipalityId);
        if (m) munis.set(u.municipalityId, m.name);
      }
    }
    return rows.map((u) => ({
      _id: u._id,
      email: u.email,
      name: u.name,
      role: u.role,
      status: u.status,
      wardAssignments: u.wardAssignments,
      municipalityName: u.municipalityId ? munis.get(u.municipalityId) ?? null : null,
      lastSeenAt: u.lastSeenAt,
      createdAt: u._creationTime,
    }));
  },
});

export const updateUser = mutation({
  args: {
    userId: v.id("users"),
    role: v.optional(userRole),
    municipalityId: v.optional(v.id("municipalities")),
    wardAssignments: v.optional(v.array(v.string())),
    status: v.optional(v.union(
      v.literal("active"),
      v.literal("disabled"),
    )),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    requireRole(me, "admin");

    const target = await ctx.db.get(args.userId);
    if (!target) clientError("NOT_FOUND", "User not found");

    const patch: Record<string, unknown> = {};
    if (args.role !== undefined) patch.role = args.role;
    if (args.municipalityId !== undefined) patch.municipalityId = args.municipalityId;
    if (args.wardAssignments !== undefined) patch.wardAssignments = args.wardAssignments;
    if (args.status !== undefined) {
      patch.status = args.status;
      if (args.status === "disabled") {
        patch.disabledBy = me._id;
        patch.disabledAt = Date.now();
      }
    }
    if (Object.keys(patch).length === 0) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Nothing to update" });
    }
    await ctx.db.patch(args.userId, patch);
    await writeAudit(ctx, {
      actorId: me._id,
      action: "user.updated",
      entity: "user",
      entityId: args.userId,
      metadata: patch,
    });
  },
});

/* ────────────────────────── master data CRUD ────────────────────────── */

export const upsertMaster = mutation({
  args: {
    category: v.string(),
    value: v.string(),
    label: v.string(),
    position: v.number(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    requireRole(me, "admin");

    const existing = await ctx.db
      .query("masters")
      .withIndex("by_category_value", (q) =>
        q.eq("category", args.category).eq("value", args.value))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        label: args.label,
        position: args.position,
        isActive: args.isActive,
      });
      return existing._id;
    }
    return await ctx.db.insert("masters", args);
  },
});

export const deleteMaster = mutation({
  args: { id: v.id("masters") },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    requireRole(me, "admin");
    await ctx.db.delete(args.id);
  },
});

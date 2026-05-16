/**
 * User provisioning — called only from the Clerk webhook (`convex/http.ts`).
 * These are internal mutations so they cannot be invoked from the client.
 */
import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { writeAudit } from "./helpers";

/** Current signed-in user's domain row, or null while the webhook provisions it. */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const ident = await ctx.auth.getUserIdentity();
    if (!ident) return null;

    return await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", ident.subject))
      .unique();
  },
});

export const upsertFromClerk = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
    requestedRole: v.optional(v.string()),
    requestedReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        name: args.name,
        avatarUrl: args.avatarUrl,
        requestedRole: args.requestedRole,
        requestedReason: args.requestedReason,
      });
      return existing._id;
    }

    const userId = await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email,
      name: args.name,
      avatarUrl: args.avatarUrl,
      role: "pending",
      status: "pending_approval",
      wardAssignments: [],
      requestedRole: args.requestedRole,
      requestedReason: args.requestedReason,
    });

    await writeAudit(ctx, {
      action: "user.created",
      entity: "user",
      entityId: userId,
      metadata: { clerkId: args.clerkId, email: args.email },
    });

    return userId;
  },
});

export const softDeleteFromClerk = internalMutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) return;

    await ctx.db.patch(user._id, {
      status: "disabled",
      disabledAt: Date.now(),
    });

    await writeAudit(ctx, {
      action: "user.deleted",
      entity: "user",
      entityId: user._id,
      metadata: { clerkId: args.clerkId },
    });
  },
});

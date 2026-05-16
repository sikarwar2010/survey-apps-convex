/**
 * QC workflow.
 *
 *  - `decide`        — supervisor/admin approves or rejects; cascades to survey.qcStatus
 *  - `addRemark`     — append-only thread; supervisor and the assigned surveyor
 *                       can both write. Notifies the other party.
 *  - `listRemarks`   — full thread, ordered desc
 *  - `resolveRemark` — flips a single remark to "resolved" once addressed
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  assertCanReadWard,
  clientError,
  requireRole,
  requireUser,
  writeAudit,
} from "./helpers";

export const listRemarks = query({
  args: { surveyId: v.id("surveys") },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const survey = await ctx.db.get(args.surveyId);
    if (!survey) return [];
    assertCanReadWard(me, survey.municipalityId, survey.wardNo);

    const rows = await ctx.db
      .query("qcRemarks")
      .withIndex("by_survey", (q) => q.eq("surveyId", args.surveyId))
      .order("desc")
      .collect();

    // Hydrate author display
    const authorIds = Array.from(new Set(rows.map((r) => r.authorId)));
    const authors = await Promise.all(authorIds.map((id) => ctx.db.get(id)));
    const byId = new Map(authors.filter(Boolean).map((u) => [u!._id, u!]));

    return rows.map((r) => ({
      ...r,
      author: byId.get(r.authorId)
        ? { _id: r.authorId, name: byId.get(r.authorId)!.name, role: byId.get(r.authorId)!.role }
        : null,
    }));
  },
});

export const addRemark = mutation({
  args: {
    surveyId: v.id("surveys"),
    message: v.string(),
    taggedSections: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    if (args.message.trim().length === 0) {
      clientError("VALIDATION", "Message cannot be empty");
    }
    const survey = await ctx.db.get(args.surveyId);
    if (!survey) clientError("NOT_FOUND", "Survey not found");

    // Surveyors can only write on their own surveys; supervisors/admins on any
    if (me.role === "surveyor" && survey.surveyorId !== me._id) {
      clientError("FORBIDDEN", "Not your survey");
    }
    if (me.role !== "surveyor") {
      assertCanReadWard(me, survey.municipalityId, survey.wardNo);
    }

    const remarkId = await ctx.db.insert("qcRemarks", {
      surveyId: args.surveyId,
      authorId: me._id,
      authorRole: me.role,
      message: args.message.trim(),
      taggedSections: args.taggedSections ?? [],
      status: "open",
    });

    // Notify the other party
    const recipientId = me.role === "surveyor" ? null : survey.surveyorId;
    if (recipientId) {
      await ctx.db.insert("notifications", {
        userId: recipientId,
        type: "qc_remark_received",
        title: "QC remark received",
        body: args.message.slice(0, 120),
        relatedEntity: "survey",
        relatedId: args.surveyId,
      });
    }

    await writeAudit(ctx, {
      actorId: me._id,
      action: "qc.remark_added",
      entity: "survey",
      entityId: args.surveyId,
      metadata: { remarkId, taggedSections: args.taggedSections },
    });
    return remarkId;
  },
});

export const resolveRemark = mutation({
  args: { id: v.id("qcRemarks") },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const remark = await ctx.db.get(args.id);
    if (!remark) clientError("NOT_FOUND", "Remark not found");
    await ctx.db.patch(args.id, { status: "resolved" });
    await writeAudit(ctx, {
      actorId: me._id,
      action: "qc.remark_resolved",
      entity: "qcRemark",
      entityId: args.id,
      metadata: { surveyId: remark.surveyId },
    });
  },
});

/**
 * Supervisor decision — approve or reject. Cascades to survey:
 *  - approve → survey.qcStatus='approved', status='approved'
 *  - reject  → survey.qcStatus='rejected', status='rejected'
 *
 * Either way the surveyor is notified.
 */
export const decide = mutation({
  args: {
    surveyId: v.id("surveys"),
    decision: v.union(v.literal("approve"), v.literal("reject")),
    comment: v.optional(v.string()),
    taggedSections: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    requireRole(me, "supervisor", "admin");

    const survey = await ctx.db.get(args.surveyId);
    if (!survey) clientError("NOT_FOUND", "Survey not found");
    if (me.role === "supervisor") {
      // Supervisor can only act inside their own municipality
      if (me.municipalityId !== survey.municipalityId) {
        clientError("FORBIDDEN", "Cross-municipality QC denied");
      }
    }
    if (survey.status === "draft") {
      clientError("BAD_STATE", "Draft surveys cannot be reviewed");
    }

    const now = Date.now();
    await ctx.db.insert("qcDecisions", {
      surveyId: args.surveyId,
      reviewerId: me._id,
      decision: args.decision,
      comment: args.comment,
      taggedSections: args.taggedSections ?? [],
      decidedAt: now,
    });

    await ctx.db.patch(args.surveyId, {
      qcStatus: args.decision === "approve" ? "approved" : "rejected",
      status: args.decision === "approve" ? "approved" : "rejected",
      serverVersion: survey.serverVersion + 1,
    });

    // If there's a comment, persist it as a remark too so the thread is complete.
    if (args.comment && args.comment.trim().length > 0) {
      await ctx.db.insert("qcRemarks", {
        surveyId: args.surveyId,
        authorId: me._id,
        authorRole: me.role,
        message: args.comment.trim(),
        taggedSections: args.taggedSections ?? [],
        status: args.decision === "approve" ? "resolved" : "open",
      });
    }

    await ctx.db.insert("notifications", {
      userId: survey.surveyorId,
      type: args.decision === "approve" ? "qc_approved" : "qc_rejected",
      title: args.decision === "approve" ? "Survey approved" : "Survey returned for revision",
      body: args.comment?.slice(0, 120)
        ?? (args.decision === "approve"
          ? "Your survey has been approved."
          : "Open the survey to see what needs revising."),
      relatedEntity: "survey",
      relatedId: args.surveyId,
    });

    await writeAudit(ctx, {
      actorId: me._id,
      action: `qc.${args.decision}`,
      entity: "survey",
      entityId: args.surveyId,
      metadata: { taggedSections: args.taggedSections, comment: args.comment },
    });
  },
});

/** Reopen an approved survey for further editing — admin or supervisor only. */
export const reopen = mutation({
  args: { surveyId: v.id("surveys"), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    requireRole(me, "supervisor", "admin");
    const survey = await ctx.db.get(args.surveyId);
    if (!survey) clientError("NOT_FOUND", "Survey not found");
    if (survey.qcStatus !== "approved") {
      clientError("BAD_STATE", "Only approved surveys can be reopened");
    }
    await ctx.db.patch(args.surveyId, {
      qcStatus: "pending",
      status: "submitted",
      serverVersion: survey.serverVersion + 1,
    });
    await writeAudit(ctx, {
      actorId: me._id,
      action: "qc.reopened",
      entity: "survey",
      entityId: args.surveyId,
      metadata: { reason: args.reason },
    });
  },
});

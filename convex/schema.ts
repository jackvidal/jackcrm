import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,
  branding: defineTable({
    ownerId: v.string(),
    preferences: v.object({ name: v.string(), primaryColor: v.string(), sidebarColor: v.union(v.string(), v.null()), statusColors: v.record(v.string(), v.string()), metricColors: v.record(v.string(), v.string()) }),
    logoStorageId: v.optional(v.id("_storage")),
    updatedAt: v.number(),
  }).index("by_ownerId", ["ownerId"]),
  leadWebhooks: defineTable({
    ownerId: v.string(),
    token: v.string(),
    enabled: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastReceivedAt: v.optional(v.number()),
    receivedCount: v.number(),
  }).index("by_ownerId", ["ownerId"]).index("by_token", ["token"]),
  audioFiles: defineTable({ ownerId: v.string(), callId: v.string(), storageId: v.id("_storage"), filename: v.string(), createdAt: v.number() }).index("by_call", ["callId"]),
  profile: defineTable({
    id: v.string(),
    email: v.string(),
    fullName: v.union(v.string(), v.null()),
    calOrganizerEmail: v.union(v.string(), v.null()),
    whatsappNumber: v.union(v.string(), v.null()),
    wassenderToken: v.union(v.string(), v.null()),
    createdAt: v.number(),
  }).index("by_legacy_id", ["id"])
    .index("by_email", ["email"])
    .index("by_calOrganizerEmail", ["calOrganizerEmail"])
    .index("by_wassenderToken", ["wassenderToken"]),
  lead: defineTable({
    id: v.string(),
    ownerId: v.string(),
    fullName: v.string(),
    email: v.union(v.string(), v.null()),
    phone: v.union(v.string(), v.null()),
    company: v.union(v.string(), v.null()),
    websiteUrl: v.union(v.string(), v.null()),
    source: v.union(v.string(), v.null()),
    status: v.union(v.literal("NEW"), v.literal("CONTACTED"), v.literal("FOLLOW_UP"), v.literal("MEETING_SCHEDULED"), v.literal("MEETING_COMPLETED"), v.literal("PROPOSAL_SENT"), v.literal("NEGOTIATION"), v.literal("DEAL_CLOSED"), v.literal("DEAL_LOST")),
    notes: v.union(v.string(), v.null()),
    followUpDate: v.optional(v.union(v.string(), v.null())),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_legacy_id", ["id"])
    .index("by_ownerId", ["ownerId", "createdAt"])
    .index("by_owner_email", ["ownerId", "email", "createdAt"])
    .index("by_owner_phone", ["ownerId", "phone", "createdAt"])
    .index("by_owner_status", ["ownerId", "status", "createdAt"]),
  leadNote: defineTable({
    id: v.string(),
    leadId: v.string(),
    authorId: v.string(),
    content: v.string(),
    createdAt: v.number(),
  }).index("by_legacy_id", ["id"])
    .index("by_leadId", ["leadId", "createdAt"])
    .index("by_authorId", ["authorId", "createdAt"]),
  meeting: defineTable({
    id: v.string(),
    leadId: v.string(),
    ownerId: v.string(),
    scheduledAt: v.number(),
    durationMinutes: v.number(),
    status: v.union(v.literal("SCHEDULED"), v.literal("COMPLETED"), v.literal("CANCELED"), v.literal("NO_SHOW")),
    notes: v.union(v.string(), v.null()),
    calEventId: v.union(v.string(), v.null()),
    meetingUrl: v.union(v.string(), v.null()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_legacy_id", ["id"])
    .index("by_ownerId", ["ownerId", "createdAt"])
    .index("by_leadId", ["leadId", "createdAt"])
    .index("by_calEventId", ["calEventId"]),
  task: defineTable({
    id: v.string(),
    ownerId: v.string(),
    leadId: v.string(),
    title: v.string(),
    description: v.union(v.string(), v.null()),
    dueDate: v.union(v.number(), v.null()),
    status: v.union(v.literal("PENDING"), v.literal("IN_PROGRESS"), v.literal("DONE"), v.literal("CANCELED")),
    priority: v.union(v.literal("LOW"), v.literal("MEDIUM"), v.literal("HIGH")),
    completedAt: v.union(v.number(), v.null()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_legacy_id", ["id"])
    .index("by_ownerId", ["ownerId", "createdAt"])
    .index("by_leadId", ["leadId", "createdAt"]),
  call: defineTable({
    id: v.string(),
    ownerId: v.string(),
    leadId: v.string(),
    direction: v.union(v.literal("INBOUND"), v.literal("OUTBOUND")),
    occurredAt: v.number(),
    durationSeconds: v.union(v.number(), v.null()),
    notes: v.union(v.string(), v.null()),
    transcript: v.union(v.string(), v.null()),
    audioUrl: v.union(v.string(), v.null()),
    summary: v.union(v.string(), v.null()),
    keyTopics: v.union(v.any(), v.null()),
    sentiment: v.union(v.union(v.literal("POSITIVE"), v.literal("NEUTRAL"), v.literal("NEGATIVE")), v.null()),
    sentimentReason: v.union(v.string(), v.null()),
    prospectCommitments: v.union(v.any(), v.null()),
    myCommitments: v.union(v.any(), v.null()),
    recommendedNextSteps: v.union(v.any(), v.null()),
    redFlags: v.union(v.any(), v.null()),
    analyzedAt: v.union(v.number(), v.null()),
    modelUsed: v.union(v.string(), v.null()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_legacy_id", ["id"])
    .index("by_ownerId", ["ownerId", "createdAt"])
    .index("by_leadId", ["leadId", "createdAt"]),
  websiteAnalysis: defineTable({
    id: v.string(),
    leadId: v.string(),
    url: v.string(),
    summary: v.string(),
    issues: v.any(),
    opportunities: v.any(),
    recommendedServices: v.any(),
    recommendedNextSteps: v.any(),
    modelUsed: v.string(),
    rawResponse: v.any(),
    createdAt: v.number(),
  }).index("by_legacy_id", ["id"])
    .index("by_leadId", ["leadId", "createdAt"]),
  whatsappMessage: defineTable({
    id: v.string(),
    ownerId: v.string(),
    leadId: v.string(),
    direction: v.union(v.literal("INBOUND"), v.literal("OUTBOUND")),
    messageType: v.union(v.literal("TEXT"), v.literal("IMAGE"), v.literal("VIDEO"), v.literal("AUDIO"), v.literal("DOCUMENT"), v.literal("OTHER")),
    body: v.union(v.string(), v.null()),
    mediaUrl: v.union(v.string(), v.null()),
    fromNumber: v.string(),
    toNumber: v.string(),
    status: v.union(v.literal("PENDING"), v.literal("SENT"), v.literal("DELIVERED"), v.literal("READ"), v.literal("FAILED")),
    externalId: v.union(v.string(), v.null()),
    sentAt: v.number(),
    errorMessage: v.union(v.string(), v.null()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_legacy_id", ["id"])
    .index("by_ownerId", ["ownerId", "createdAt"])
    .index("by_leadId", ["leadId", "createdAt"])
    .index("by_externalId", ["externalId"]),
  webhookEvent: defineTable({
    id: v.string(),
    source: v.string(),
    externalId: v.string(),
    payload: v.any(),
    processedAt: v.union(v.number(), v.null()),
    error: v.union(v.string(), v.null()),
    createdAt: v.number(),
  }).index("by_legacy_id", ["id"])
    .index("by_source_externalId", ["source", "externalId"]),
});

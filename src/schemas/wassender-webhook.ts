import { z } from "zod";

/**
 * Wassender webhook payload shape (subset we use).
 * Reference: https://wasenderapi.com/docs/webhooks
 *
 * Wassender fires events like:
 *   - messages.received  (inbound message from a contact)
 *   - messages.sent      (outbound delivery confirmation)
 *   - messages.delivered / messages.read / messages.failed
 *
 * Different event types share a common shape but contain different fields.
 * We're permissive (.passthrough()) so new fields don't break us.
 */

export const wassenderMessageSchema = z
  .object({
    id: z.string().optional(),
    msgId: z.string().optional(),
    messageId: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    fromMe: z.boolean().optional(),
    body: z.string().optional(),
    text: z.string().optional(),
    type: z.string().optional(),
    mediaUrl: z.string().optional(),
    media_url: z.string().optional(),
    timestamp: z.union([z.number(), z.string()]).optional(),
    sessionPhone: z.string().optional(),
    session_phone: z.string().optional(),
  })
  .passthrough();

export const wassenderWebhookSchema = z
  .object({
    event: z.string(),
    timestamp: z.union([z.number(), z.string()]).optional(),
    sessionId: z.string().optional(),
    session_id: z.string().optional(),
    sessionPhone: z.string().optional(),
    session_phone: z.string().optional(),
    data: z.union([wassenderMessageSchema, z.record(z.string(), z.unknown())]),
  })
  .passthrough();

export type WassenderWebhookPayload = z.infer<typeof wassenderWebhookSchema>;
export type WassenderMessageData = z.infer<typeof wassenderMessageSchema>;

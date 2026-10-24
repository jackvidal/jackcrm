export const defaults = {
  "profile": {
    "fullName": null,
    "calOrganizerEmail": null,
    "whatsappNumber": null,
    "wassenderToken": null
  },
  "lead": {
    "email": null,
    "phone": null,
    "company": null,
    "websiteUrl": null,
    "source": "manual",
    "status": "NEW",
    "notes": null
  },
  "leadNote": {},
  "meeting": {
    "durationMinutes": 30,
    "status": "SCHEDULED",
    "notes": null,
    "calEventId": null,
    "meetingUrl": null
  },
  "task": {
    "description": null,
    "dueDate": null,
    "status": "PENDING",
    "priority": "MEDIUM",
    "completedAt": null
  },
  "call": {
    "durationSeconds": null,
    "notes": null,
    "transcript": null,
    "audioUrl": null,
    "summary": null,
    "keyTopics": null,
    "sentiment": null,
    "sentimentReason": null,
    "prospectCommitments": null,
    "myCommitments": null,
    "recommendedNextSteps": null,
    "redFlags": null,
    "analyzedAt": null,
    "modelUsed": null
  },
  "websiteAnalysis": {},
  "whatsappMessage": {
    "messageType": "TEXT",
    "body": null,
    "mediaUrl": null,
    "status": "SENT",
    "externalId": null,
    "errorMessage": null
  },
  "webhookEvent": {
    "processedAt": null,
    "error": null
  }
} as const;

export const dateFields = {
  "profile": [
    "createdAt"
  ],
  "lead": [
    "createdAt",
    "updatedAt"
  ],
  "leadNote": [
    "createdAt"
  ],
  "meeting": [
    "scheduledAt",
    "createdAt",
    "updatedAt"
  ],
  "task": [
    "dueDate",
    "completedAt",
    "createdAt",
    "updatedAt"
  ],
  "call": [
    "occurredAt",
    "analyzedAt",
    "createdAt",
    "updatedAt"
  ],
  "websiteAnalysis": [
    "createdAt"
  ],
  "whatsappMessage": [
    "sentAt",
    "createdAt",
    "updatedAt"
  ],
  "webhookEvent": [
    "processedAt",
    "createdAt"
  ]
} as const;

export const fields = {
  "profile": [
    "id",
    "email",
    "fullName",
    "calOrganizerEmail",
    "whatsappNumber",
    "wassenderToken",
    "createdAt"
  ],
  "lead": [
    "id",
    "ownerId",
    "fullName",
    "email",
    "phone",
    "company",
    "websiteUrl",
    "source",
    "status",
    "notes",
    "createdAt",
    "updatedAt"
  ],
  "leadNote": [
    "id",
    "leadId",
    "authorId",
    "content",
    "createdAt"
  ],
  "meeting": [
    "id",
    "leadId",
    "ownerId",
    "scheduledAt",
    "durationMinutes",
    "status",
    "notes",
    "calEventId",
    "meetingUrl",
    "createdAt",
    "updatedAt"
  ],
  "task": [
    "id",
    "ownerId",
    "leadId",
    "title",
    "description",
    "dueDate",
    "status",
    "priority",
    "completedAt",
    "createdAt",
    "updatedAt"
  ],
  "call": [
    "id",
    "ownerId",
    "leadId",
    "direction",
    "occurredAt",
    "durationSeconds",
    "notes",
    "transcript",
    "audioUrl",
    "summary",
    "keyTopics",
    "sentiment",
    "sentimentReason",
    "prospectCommitments",
    "myCommitments",
    "recommendedNextSteps",
    "redFlags",
    "analyzedAt",
    "modelUsed",
    "createdAt",
    "updatedAt"
  ],
  "websiteAnalysis": [
    "id",
    "leadId",
    "url",
    "summary",
    "issues",
    "opportunities",
    "recommendedServices",
    "recommendedNextSteps",
    "modelUsed",
    "rawResponse",
    "createdAt"
  ],
  "whatsappMessage": [
    "id",
    "ownerId",
    "leadId",
    "direction",
    "messageType",
    "body",
    "mediaUrl",
    "fromNumber",
    "toNumber",
    "status",
    "externalId",
    "sentAt",
    "errorMessage",
    "createdAt",
    "updatedAt"
  ],
  "webhookEvent": [
    "id",
    "source",
    "externalId",
    "payload",
    "processedAt",
    "error",
    "createdAt"
  ]
} as const;
export type Table = keyof typeof fields;

const { z } = require('zod');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'must be a valid id');
const nullableObjectId = z.union([objectId, z.literal(''), z.null()]).transform((value) => value || null);

const newPassword = z.string().min(8, 'must be at least 8 characters').max(128);
const name = z.string().trim().min(1, 'is required').max(120);

const EVENT_CATEGORIES = ['Special Events Category', 'Literary Events Category', 'Sports Events Category'];

const criterion = z.object({
  label: z.string().trim().max(100).optional(),
  description: z.string().trim().max(500).optional(),
  maxScore: z.number().min(1).max(1000).optional(),
  weight: z.number().min(0).max(100).optional()
});

const eventFields = {
  name,
  category: z.enum(EVENT_CATEGORIES),
  scoringMode: z.enum(['criteria', 'sets']).optional(),
  setCount: z.number().int().min(0).max(50).nullable().optional(),
  criteria: z.array(criterion).max(50).optional(),
  requiredTalliers: z.number().int().min(1).max(50).optional(),
  status: z.enum(['locked', 'unlocked']).optional(),
  eventStatus: z.enum(['scheduled', 'live', 'finalized']).optional(),
  communityVisible: z.boolean().optional(),
  tabulatorId: nullableObjectId.optional(),
  assignedTallierIds: z.array(objectId).max(50).optional()
};

// Score payloads vary by event type (criteria, sets, sports pairs); keep item shapes loose
// but bound their sizes and the top-level fields.
const scoreItem = z.looseObject({ value: z.union([z.number(), z.string().max(20)]).optional() });

module.exports = {
  login: z.object({
    username: z.string().trim().min(1, 'is required').max(100),
    password: z.string().min(1, 'is required').max(200)
  }),
  setupPassword: z
    .object({ password: newPassword, confirmPassword: z.string().max(128) })
    .refine((data) => data.password === data.confirmPassword, {
      message: 'Passwords do not match.',
      path: ['confirmPassword']
    }),
  assignRole: z.object({ role: z.enum(['tabulator', 'grievance', 'admin']) }),
  userStatus: z.object({ disabled: z.boolean() }),
  resetPassword: z.object({ password: newPassword }),

  createEvent: z.object(eventFields),
  updateEvent: z.object(eventFields).partial(),
  eventStatus: z.object({ eventStatus: z.enum(['scheduled', 'live', 'finalized']) }),

  createContestant: z.object({
    name,
    eventId: objectId,
    contestantNumber: z.number().int().min(0).max(100000).optional()
  }),
  updateContestant: z.object({
    name: name.optional(),
    contestantNumber: z.number().int().min(0).max(100000).nullable().optional()
  }),
  bulkContestants: z.object({
    eventId: objectId,
    contestants: z
      .array(
        z.object({
          name: z.string().trim().max(120),
          contestantNumber: z.number().int().min(0).max(100000).optional()
        })
      )
      .min(1)
      .max(500)
  }),
  deduction: z.object({
    reason: z.string().trim().min(1, 'is required').max(500),
    deductionPoints: z.number().positive().max(1000)
  }),

  recordScore: z.object({
    eventId: objectId,
    contestantId: nullableObjectId.optional(),
    physicalJudgeName: z.string().trim().max(120).optional(),
    scores: z.array(scoreItem).max(200).optional(),
    contestantScores: z
      .array(z.looseObject({ contestantId: objectId.optional(), scores: z.array(scoreItem).max(200).optional() }))
      .max(10)
      .optional(),
    sportsStage: z.string().trim().max(40).nullable().optional(),
    sportsMatchNumber: z.union([z.number().int().min(0).max(1000), z.string().max(10), z.null()]).optional()
  }),

  assignTabulator: z.object({ tabulatorId: nullableObjectId }),
  assignTalliers: z.object({ assignedTallierIds: z.array(objectId).max(50) }),

  communityAccess: z.object({
    categoryRankingsEnabled: z.boolean().optional(),
    overallRankingsEnabled: z.boolean().optional()
  }),
  eventCommunityAccess: z.object({
    communityVisible: z.boolean().optional(),
    eventStatus: z.enum(['scheduled', 'live', 'finalized']).optional()
  }),
  pdfDownload: z.object({
    reportType: z.string().trim().min(1).max(100),
    eventId: objectId.optional()
  })
};

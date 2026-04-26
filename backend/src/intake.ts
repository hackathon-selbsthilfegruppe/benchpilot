import { z } from "zod";

import { benchIdSchema } from "./bench.js";
import { componentInstanceIdSchema } from "./component.js";

export const intakeBriefIdSchema = z.string().regex(/^brief-[a-z0-9]+(?:-[a-z0-9]+)*$/, {
  message: "Intake brief IDs must start with `brief-` and use lowercase kebab-case segments.",
});
export type IntakeBriefId = z.infer<typeof intakeBriefIdSchema>;

export const intakeBriefStatusSchema = z.enum(["draft", "finalized", "error"]);
export type IntakeBriefStatus = z.infer<typeof intakeBriefStatusSchema>;

const isoDateTimeSchema = z.string().datetime({ offset: true });

export const intakeBriefSchema = z.object({
  id: intakeBriefIdSchema,
  benchId: benchIdSchema,
  orchestratorComponentInstanceId: componentInstanceIdSchema,
  orchestratorSessionId: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1),
  question: z.string().trim().min(1),
  normalizedQuestion: z.string().trim().min(1).optional(),
  status: intakeBriefStatusSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  finalizedAt: isoDateTimeSchema.optional(),
}).superRefine((brief, ctx) => {
  const createdAt = Date.parse(brief.createdAt);
  const updatedAt = Date.parse(brief.updatedAt);
  const finalizedAt = brief.finalizedAt ? Date.parse(brief.finalizedAt) : undefined;

  if (!Number.isNaN(createdAt) && !Number.isNaN(updatedAt) && updatedAt < createdAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["updatedAt"],
      message: "updatedAt must be greater than or equal to createdAt",
    });
  }

  if (brief.status === "finalized" && !brief.finalizedAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["finalizedAt"],
      message: "finalized briefs must set finalizedAt",
    });
  }

  if (brief.status !== "finalized" && brief.finalizedAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["finalizedAt"],
      message: "finalizedAt may only be set for finalized briefs",
    });
  }

  if (!Number.isNaN(createdAt) && finalizedAt !== undefined && !Number.isNaN(finalizedAt) && finalizedAt < createdAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["finalizedAt"],
      message: "finalizedAt must be greater than or equal to createdAt",
    });
  }
});
export type IntakeBrief = z.infer<typeof intakeBriefSchema>;

export const createIntakeBriefInputSchema = z.object({
  benchId: benchIdSchema,
  orchestratorComponentInstanceId: componentInstanceIdSchema,
  orchestratorSessionId: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1),
  question: z.string().trim().min(1),
  normalizedQuestion: z.string().trim().min(1).optional(),
}).strict();
export type CreateIntakeBriefInput = z.infer<typeof createIntakeBriefInputSchema>;

export function createIntakeBrief(input: CreateIntakeBriefInput, now: Date = new Date()): IntakeBrief {
  const parsed = createIntakeBriefInputSchema.parse(input);
  const timestamp = now.toISOString();
  const slug = normalizeIntakeBriefSlug(parsed.benchId.replace(/^bench-/, ""));

  return intakeBriefSchema.parse({
    id: `brief-${slug}`,
    benchId: parsed.benchId,
    orchestratorComponentInstanceId: parsed.orchestratorComponentInstanceId,
    orchestratorSessionId: parsed.orchestratorSessionId,
    title: parsed.title,
    question: parsed.question,
    normalizedQuestion: parsed.normalizedQuestion,
    status: "draft",
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export function normalizeIntakeBriefSlug(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return normalized || "untitled";
}

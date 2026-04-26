import { z } from "zod";

import { benchIdSchema } from "./bench.js";

export const REQUIREMENT_STORAGE_MODE = "first-class" as const;

export const requirementIdSchema = z.string().regex(/^req-[a-z0-9]+(?:-[a-z0-9]+)*$/, {
  message: "Requirement IDs must start with `req-` and use lowercase kebab-case segments.",
});

export type RequirementId = z.infer<typeof requirementIdSchema>;

export const requirementStatusSchema = z.enum(["open", "in_progress", "blocked", "resolved", "dropped"]);
export type RequirementStatus = z.infer<typeof requirementStatusSchema>;

const isoDateTimeSchema = z.string().datetime({ offset: true });

const requirementMetadataBaseSchema = z.object({
  id: requirementIdSchema,
  benchId: benchIdSchema,
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  status: requirementStatusSchema,
  componentInstanceIds: z.array(z.string().trim().min(1)).default([]),
  resourceIds: z.array(z.string().trim().min(1)).default([]),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  resolvedAt: isoDateTimeSchema.optional(),
});

export const requirementMetadataSchema = requirementMetadataBaseSchema.superRefine((requirement, ctx) => {
  const createdAt = Date.parse(requirement.createdAt);
  const updatedAt = Date.parse(requirement.updatedAt);
  const resolvedAt = requirement.resolvedAt ? Date.parse(requirement.resolvedAt) : undefined;

  if (!Number.isNaN(createdAt) && !Number.isNaN(updatedAt) && updatedAt < createdAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["updatedAt"],
      message: "updatedAt must be greater than or equal to createdAt",
    });
  }

  if (requirement.status === "resolved" && !requirement.resolvedAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["resolvedAt"],
      message: "resolved requirements must set resolvedAt",
    });
  }

  if (requirement.status !== "resolved" && requirement.resolvedAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["resolvedAt"],
      message: "resolvedAt may only be set for resolved requirements",
    });
  }

  if (
    resolvedAt !== undefined
    && !Number.isNaN(createdAt)
    && !Number.isNaN(resolvedAt)
    && resolvedAt < createdAt
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["resolvedAt"],
      message: "resolvedAt must be greater than or equal to createdAt",
    });
  }
});

export type RequirementMetadata = z.infer<typeof requirementMetadataSchema>;

export const createRequirementInputSchema = z.object({
  slug: z.string().trim().min(1).optional(),
  benchId: benchIdSchema,
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  componentInstanceIds: z.array(z.string().trim().min(1)).optional(),
  resourceIds: z.array(z.string().trim().min(1)).optional(),
  status: requirementStatusSchema.optional(),
}).strict();

export type CreateRequirementInput = z.infer<typeof createRequirementInputSchema>;

export interface CreateRequirementOptions {
  now?: Date;
  existingRequirementIds?: Iterable<string>;
}

export function normalizeRequirementSlug(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return normalized || "requirement";
}

export function createRequirementId(source: string): RequirementId {
  return requirementIdSchema.parse(`req-${normalizeRequirementSlug(source)}`);
}

export function allocateRequirementId(source: string, existingRequirementIds: Iterable<string> = []): RequirementId {
  const baseId = createRequirementId(source);
  const usedIds = new Set(existingRequirementIds);
  if (!usedIds.has(baseId)) {
    return baseId;
  }

  let counter = 2;
  while (true) {
    const candidate = requirementIdSchema.parse(`${baseId}-${counter}`);
    if (!usedIds.has(candidate)) {
      return candidate;
    }
    counter += 1;
  }
}

export function createRequirement(
  input: CreateRequirementInput,
  options: CreateRequirementOptions = {},
): RequirementMetadata {
  const parsedInput = createRequirementInputSchema.parse(input);
  const timestamp = (options.now ?? new Date()).toISOString();
  const status = parsedInput.status ?? "open";

  return requirementMetadataSchema.parse({
    id: allocateRequirementId(parsedInput.slug ?? parsedInput.title, options.existingRequirementIds),
    benchId: parsedInput.benchId,
    title: parsedInput.title,
    summary: parsedInput.summary,
    status,
    componentInstanceIds: parsedInput.componentInstanceIds ?? [],
    resourceIds: parsedInput.resourceIds ?? [],
    createdAt: timestamp,
    updatedAt: timestamp,
    resolvedAt: status === "resolved" ? timestamp : undefined,
  });
}

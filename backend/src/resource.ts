import { z } from "zod";

import { benchIdSchema } from "./bench.js";
import { componentInstanceIdSchema } from "./component.js";
import { requirementIdSchema } from "./requirement.js";

export const resourceIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
  message: "Resource IDs must use lowercase kebab-case.",
});

export type ResourceId = z.infer<typeof resourceIdSchema>;

export const resourceFileRoleSchema = z.enum(["primary", "attachment", "extracted-text"]);
export type ResourceFileRole = z.infer<typeof resourceFileRoleSchema>;

export const resourceFileSchema = z.object({
  filename: z.string().trim().min(1),
  mediaType: z.string().trim().min(1),
  description: z.string().trim().min(1),
  role: resourceFileRoleSchema.default("attachment"),
  sourceFilename: z.string().trim().min(1).optional(),
}).superRefine((file, ctx) => {
  if (file.role === "extracted-text" && !file.sourceFilename) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["sourceFilename"],
      message: "Extracted-text files must reference the source filename they were derived from",
    });
  }
});

export type ResourceFile = z.infer<typeof resourceFileSchema>;

export const resourceStatusSchema = z.enum(["draft", "ready", "error"]);
export type ResourceStatus = z.infer<typeof resourceStatusSchema>;

export const resourceConfidenceSchema = z.enum(["low", "medium", "high"]);
export type ResourceConfidence = z.infer<typeof resourceConfidenceSchema>;

const isoDateTimeSchema = z.string().datetime({ offset: true });

const resourceMetadataBaseSchema = z.object({
  id: resourceIdSchema,
  benchId: benchIdSchema,
  componentInstanceId: componentInstanceIdSchema,
  producedByComponentInstanceId: componentInstanceIdSchema,
  title: z.string().trim().min(1),
  kind: z.string().trim().min(1),
  description: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  tags: z.array(z.string().trim().min(1)).default([]),
  files: z.array(resourceFileSchema).default([]),
  primaryFile: z.string().trim().min(1).optional(),
  contentType: z.string().trim().min(1).optional(),
  supportsRequirementIds: z.array(requirementIdSchema).default([]),
  derivedFromResourceIds: z.array(resourceIdSchema).default([]),
  status: resourceStatusSchema.default("ready"),
  confidence: resourceConfidenceSchema.optional(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const resourceMetadataSchema = resourceMetadataBaseSchema.superRefine((resource, ctx) => {
  const createdAt = Date.parse(resource.createdAt);
  const updatedAt = Date.parse(resource.updatedAt);
  if (!Number.isNaN(createdAt) && !Number.isNaN(updatedAt) && updatedAt < createdAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["updatedAt"],
      message: "updatedAt must be greater than or equal to createdAt",
    });
  }

  if (resource.producedByComponentInstanceId !== resource.componentInstanceId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["producedByComponentInstanceId"],
      message: "Resources are owned by the same component instance that produced them",
    });
  }

  if (resource.primaryFile && !resource.files.some((file) => file.filename === resource.primaryFile)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["primaryFile"],
      message: "primaryFile must reference a filename present in files[]",
    });
  }
});

export type ResourceMetadata = z.infer<typeof resourceMetadataSchema>;

export const resourceTocEntrySchema = resourceMetadataBaseSchema.pick({
  id: true,
  benchId: true,
  componentInstanceId: true,
  title: true,
  kind: true,
  description: true,
  summary: true,
  tags: true,
  updatedAt: true,
});

export type ResourceTocEntry = z.infer<typeof resourceTocEntrySchema>;

export const resourceDetailSchema = resourceMetadataBaseSchema.extend({
  content: z.string().optional(),
});

export type ResourceDetail = z.infer<typeof resourceDetailSchema>;

export const createResourceInputSchema = z.object({
  slug: z.string().trim().min(1).optional(),
  benchId: benchIdSchema,
  componentInstanceId: componentInstanceIdSchema,
  title: z.string().trim().min(1),
  kind: z.string().trim().min(1),
  description: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  tags: z.array(z.string().trim().min(1)).optional(),
  files: z.array(resourceFileSchema).optional(),
  primaryFile: z.string().trim().min(1).optional(),
  contentType: z.string().trim().min(1).optional(),
  supportsRequirementIds: z.array(requirementIdSchema).optional(),
  derivedFromResourceIds: z.array(resourceIdSchema).optional(),
  status: resourceStatusSchema.optional(),
  confidence: resourceConfidenceSchema.optional(),
}).strict();

export type CreateResourceInput = z.infer<typeof createResourceInputSchema>;

export interface CreateResourceOptions {
  now?: Date;
  existingResourceIds?: Iterable<string>;
}

export function normalizeResourceSlug(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return normalized || "resource";
}

export function createResourceId(source: string): ResourceId {
  return resourceIdSchema.parse(normalizeResourceSlug(source));
}

export function allocateResourceId(source: string, existingResourceIds: Iterable<string> = []): ResourceId {
  const baseId = createResourceId(source);
  const usedIds = new Set(existingResourceIds);
  if (!usedIds.has(baseId)) {
    return baseId;
  }

  let counter = 2;
  while (true) {
    const candidate = resourceIdSchema.parse(`${baseId}-${counter}`);
    if (!usedIds.has(candidate)) {
      return candidate;
    }
    counter += 1;
  }
}

export function createResource(
  input: CreateResourceInput,
  options: CreateResourceOptions = {},
): ResourceMetadata {
  const parsedInput = createResourceInputSchema.parse(input);
  const timestamp = (options.now ?? new Date()).toISOString();

  return resourceMetadataSchema.parse({
    id: allocateResourceId(parsedInput.slug ?? parsedInput.title, options.existingResourceIds),
    benchId: parsedInput.benchId,
    componentInstanceId: parsedInput.componentInstanceId,
    producedByComponentInstanceId: parsedInput.componentInstanceId,
    title: parsedInput.title,
    kind: parsedInput.kind,
    description: parsedInput.description,
    summary: parsedInput.summary,
    tags: parsedInput.tags ?? [],
    files: parsedInput.files ?? [],
    primaryFile: parsedInput.primaryFile,
    contentType: parsedInput.contentType,
    supportsRequirementIds: parsedInput.supportsRequirementIds ?? [],
    derivedFromResourceIds: parsedInput.derivedFromResourceIds ?? [],
    status: parsedInput.status ?? "ready",
    confidence: parsedInput.confidence,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export function toResourceTocEntry(resource: ResourceMetadata): ResourceTocEntry {
  return resourceTocEntrySchema.parse({
    id: resource.id,
    benchId: resource.benchId,
    componentInstanceId: resource.componentInstanceId,
    title: resource.title,
    kind: resource.kind,
    description: resource.description,
    summary: resource.summary,
    tags: resource.tags,
    updatedAt: resource.updatedAt,
  });
}

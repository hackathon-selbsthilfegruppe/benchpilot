import { z } from "zod";

import { BENCH_ID_PREFIX, benchIdSchema } from "./bench.js";
import { requirementIdSchema } from "./requirement.js";
import { type ToolMode } from "./types.js";

export const INITIAL_COMPONENT_PRESET_IDS = [
  "orchestrator",
  "protocols",
  "budget",
  "timeline",
  "literature",
] as const;

export const componentPresetIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
  message: "Component preset IDs must use lowercase kebab-case.",
});

export type ComponentPresetId = z.infer<typeof componentPresetIdSchema>;

export const componentInstanceIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
  message: "Component instance IDs must use lowercase kebab-case.",
});

export type ComponentInstanceId = z.infer<typeof componentInstanceIdSchema>;

export const componentToolModeSchema = z.enum(["full", "read-only"]);
export type ComponentToolMode = z.infer<typeof componentToolModeSchema>;

export const componentPresetSchema = z.object({
  id: componentPresetIdSchema,
  name: z.string().trim().min(1),
  shortDescription: z.string().trim().min(1),
  detailedDescription: z.string().trim().min(1),
  preprompt: z.string().trim().min(1),
  defaultToolMode: componentToolModeSchema.optional(),
}).strict();

export type ComponentPreset = z.infer<typeof componentPresetSchema>;

export const componentInstanceStatusSchema = z.enum(["active", "archived", "error"]);
export type ComponentInstanceStatus = z.infer<typeof componentInstanceStatusSchema>;

const isoDateTimeSchema = z.string().datetime({ offset: true });

const componentInstanceBaseSchema = z.object({
  id: componentInstanceIdSchema,
  benchId: benchIdSchema,
  presetId: componentPresetIdSchema.optional(),
  name: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  requirementIds: z.array(requirementIdSchema).default([]),
  toolMode: componentToolModeSchema.optional(),
  resourceCount: z.number().int().nonnegative().default(0),
  status: componentInstanceStatusSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const componentInstanceSchema = componentInstanceBaseSchema.superRefine((component, ctx) => {
  const createdAt = Date.parse(component.createdAt);
  const updatedAt = Date.parse(component.updatedAt);
  if (!Number.isNaN(createdAt) && !Number.isNaN(updatedAt) && updatedAt < createdAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["updatedAt"],
      message: "updatedAt must be greater than or equal to createdAt",
    });
  }
});

export type ComponentInstance = z.infer<typeof componentInstanceSchema>;

export const createComponentInstanceInputSchema = z.object({
  slug: z.string().trim().min(1).optional(),
  benchId: benchIdSchema,
  presetId: componentPresetIdSchema.optional(),
  name: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  requirementIds: z.array(requirementIdSchema).optional(),
  toolMode: componentToolModeSchema.optional(),
  status: componentInstanceStatusSchema.optional(),
}).strict();

export type CreateComponentInstanceInput = z.infer<typeof createComponentInstanceInputSchema>;

export interface CreateComponentInstanceOptions {
  now?: Date;
  existingComponentIds?: Iterable<string>;
}

export function normalizeComponentSlug(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return normalized || "component";
}

export function benchIdToInstanceSuffix(benchId: string): string {
  return normalizeComponentSlug(benchId.replace(new RegExp(`^${BENCH_ID_PREFIX}`), ""));
}

export function createComponentInstanceId(source: string, benchId: string): ComponentInstanceId {
  return componentInstanceIdSchema.parse(
    `${normalizeComponentSlug(source)}-${benchIdToInstanceSuffix(benchId)}`,
  );
}

export function allocateComponentInstanceId(
  source: string,
  benchId: string,
  existingComponentIds: Iterable<string> = [],
): ComponentInstanceId {
  const baseId = createComponentInstanceId(source, benchId);
  const usedIds = new Set(existingComponentIds);
  if (!usedIds.has(baseId)) {
    return baseId;
  }

  let counter = 2;
  while (true) {
    const candidate = componentInstanceIdSchema.parse(`${baseId}-${counter}`);
    if (!usedIds.has(candidate)) {
      return candidate;
    }
    counter += 1;
  }
}

export function createComponentInstance(
  input: CreateComponentInstanceInput,
  options: CreateComponentInstanceOptions = {},
): ComponentInstance {
  const parsedInput = createComponentInstanceInputSchema.parse(input);
  const timestamp = (options.now ?? new Date()).toISOString();
  const idSource = parsedInput.slug ?? parsedInput.presetId ?? parsedInput.name;

  return componentInstanceSchema.parse({
    id: allocateComponentInstanceId(idSource, parsedInput.benchId, options.existingComponentIds),
    benchId: parsedInput.benchId,
    presetId: parsedInput.presetId,
    name: parsedInput.name,
    summary: parsedInput.summary,
    requirementIds: parsedInput.requirementIds ?? [],
    toolMode: parsedInput.toolMode as ToolMode | undefined,
    resourceCount: 0,
    status: parsedInput.status ?? "active",
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

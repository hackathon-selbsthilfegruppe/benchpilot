import { z } from "zod";

import { benchIdSchema } from "./bench.js";
import { componentInstanceIdSchema } from "./component.js";
import { resourceIdSchema } from "./resource.js";

export const taskIdSchema = z.string().regex(/^task-[a-z0-9]+(?:-[a-z0-9]+)*$/, {
  message: "Task IDs must start with `task-` and use lowercase kebab-case segments.",
});
export type TaskId = z.infer<typeof taskIdSchema>;

export const taskStatusSchema = z.enum(["pending", "running", "completed", "error"]);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

const isoDateTimeSchema = z.string().datetime({ offset: true });

export const taskMetadataSchema = z.object({
  id: taskIdSchema,
  benchId: benchIdSchema,
  fromComponentInstanceId: componentInstanceIdSchema,
  toComponentInstanceId: componentInstanceIdSchema,
  title: z.string().trim().min(1),
  request: z.string().trim().min(1),
  status: taskStatusSchema,
  taskSessionId: z.string().trim().min(1).optional(),
  resultText: z.string().trim().min(1).optional(),
  createdResourceIds: z.array(resourceIdSchema).default([]),
  modifiedResourceIds: z.array(resourceIdSchema).default([]),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  completedAt: isoDateTimeSchema.optional(),
}).superRefine((task, ctx) => {
  const createdAt = Date.parse(task.createdAt);
  const updatedAt = Date.parse(task.updatedAt);
  const completedAt = task.completedAt ? Date.parse(task.completedAt) : undefined;

  if (!Number.isNaN(createdAt) && !Number.isNaN(updatedAt) && updatedAt < createdAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["updatedAt"],
      message: "updatedAt must be greater than or equal to createdAt",
    });
  }

  if (task.status === "completed" && !task.completedAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["completedAt"],
      message: "completed tasks must set completedAt",
    });
  }

  if (task.status !== "completed" && task.completedAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["completedAt"],
      message: "completedAt may only be set for completed tasks",
    });
  }

  if (
    completedAt !== undefined
    && !Number.isNaN(createdAt)
    && !Number.isNaN(completedAt)
    && completedAt < createdAt
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["completedAt"],
      message: "completedAt must be greater than or equal to createdAt",
    });
  }
});

export type TaskMetadata = z.infer<typeof taskMetadataSchema>;

export const createTaskInputSchema = z.object({
  slug: z.string().trim().min(1).optional(),
  benchId: benchIdSchema,
  fromComponentInstanceId: componentInstanceIdSchema,
  toComponentInstanceId: componentInstanceIdSchema,
  title: z.string().trim().min(1),
  request: z.string().trim().min(1),
}).strict();
export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;

export interface CreateTaskOptions {
  now?: Date;
  existingTaskIds?: Iterable<string>;
}

export function normalizeTaskSlug(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return normalized || "task";
}

export function createTaskId(source: string): TaskId {
  return taskIdSchema.parse(`task-${normalizeTaskSlug(source)}`);
}

export function allocateTaskId(source: string, existingTaskIds: Iterable<string> = []): TaskId {
  const baseId = createTaskId(source);
  const usedIds = new Set(existingTaskIds);
  if (!usedIds.has(baseId)) {
    return baseId;
  }

  let counter = 2;
  while (true) {
    const candidate = taskIdSchema.parse(`${baseId}-${counter}`);
    if (!usedIds.has(candidate)) {
      return candidate;
    }
    counter += 1;
  }
}

export function createTask(input: CreateTaskInput, options: CreateTaskOptions = {}): TaskMetadata {
  const parsedInput = createTaskInputSchema.parse(input);
  const timestamp = (options.now ?? new Date()).toISOString();

  return taskMetadataSchema.parse({
    id: allocateTaskId(parsedInput.slug ?? parsedInput.title, options.existingTaskIds),
    benchId: parsedInput.benchId,
    fromComponentInstanceId: parsedInput.fromComponentInstanceId,
    toComponentInstanceId: parsedInput.toComponentInstanceId,
    title: parsedInput.title,
    request: parsedInput.request,
    status: "pending",
    createdResourceIds: [],
    modifiedResourceIds: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

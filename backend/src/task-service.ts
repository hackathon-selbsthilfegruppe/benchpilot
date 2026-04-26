import { z } from "zod";

import { benchIdSchema } from "./bench.js";
import { componentInstanceIdSchema } from "./component.js";
import { createTask, taskMetadataSchema, taskStatusSchema, type TaskMetadata, type TaskStatus } from "./task.js";
import type { ComponentSessionService } from "./component-session-service.js";
import { parseComponentWriteActor } from "./write-actor.js";
import { WorkspaceNotFoundError, WorkspaceStore, WorkspaceValidationError } from "./workspace-store.js";

export const createTaskRequestSchema = z.object({
  actor: z.object({
    benchId: benchIdSchema,
    componentInstanceId: componentInstanceIdSchema,
    presetId: z.string().trim().min(1).optional(),
  }).strict(),
  fromComponentInstanceId: componentInstanceIdSchema,
  toComponentInstanceId: componentInstanceIdSchema,
  title: z.string().trim().min(1),
  request: z.string().trim().min(1),
}).strict();

export interface ListTasksOptions {
  benchId: string;
  componentInstanceId?: string;
  status?: TaskStatus;
}

export const completeTaskRequestSchema = z.object({
  benchId: benchIdSchema,
  actor: z.object({
    benchId: benchIdSchema,
    componentInstanceId: componentInstanceIdSchema,
    presetId: z.string().trim().min(1).optional(),
  }).strict(),
  resultText: z.string().trim().min(1),
  resultResourceId: z.string().trim().min(1).optional(),
  createdResourceIds: z.array(z.string().trim().min(1)).default([]),
  modifiedResourceIds: z.array(z.string().trim().min(1)).default([]),
}).strict();

export class TaskService {
  constructor(
    private readonly store: WorkspaceStore,
    private readonly componentSessionService?: ComponentSessionService,
  ) {}

  async createTask(input: unknown): Promise<TaskMetadata> {
    const request = createTaskRequestSchema.parse(input);
    const actor = parseComponentWriteActor(request.actor);

    if (actor.benchId !== request.actor.benchId) {
      throw new WorkspaceValidationError("Task actor benchId mismatch");
    }
    if (actor.componentInstanceId !== request.fromComponentInstanceId) {
      throw new WorkspaceValidationError("Task actor must match fromComponentInstanceId");
    }
    if (request.fromComponentInstanceId === request.toComponentInstanceId) {
      throw new WorkspaceValidationError("Tasks must target another component instance");
    }

    await this.store.readComponent(request.actor.benchId, request.fromComponentInstanceId);
    await this.store.readComponent(request.actor.benchId, request.toComponentInstanceId);

    const existingTasks = await this.store.listTasks(request.actor.benchId, request.toComponentInstanceId);
    const task = createTask(
      {
        benchId: request.actor.benchId,
        fromComponentInstanceId: request.fromComponentInstanceId,
        toComponentInstanceId: request.toComponentInstanceId,
        title: request.title,
        request: request.request,
      },
      {
        existingTaskIds: existingTasks.map((item) => item.id),
      },
    );

    await this.store.writeTask(task);

    if (!this.componentSessionService) {
      return task;
    }

    const taskSession = await this.componentSessionService.createTaskRunSession(task);
    const runningTask = taskMetadataSchema.parse({
      ...task,
      status: "running",
      taskSessionId: taskSession.id,
      updatedAt: new Date().toISOString(),
    });
    await this.store.writeTask(runningTask);
    return runningTask;
  }

  async listTasks(options: ListTasksOptions): Promise<TaskMetadata[]> {
    const benchId = benchIdSchema.parse(options.benchId);
    const status = options.status ? taskStatusSchema.parse(options.status) : undefined;

    if (options.componentInstanceId) {
      return this.store.listTasks(benchId, componentInstanceIdSchema.parse(options.componentInstanceId), status);
    }

    const components = await this.store.listComponents(benchId);
    const tasks = await Promise.all(
      components.map((component) => this.store.listTasks(benchId, component.id, status)),
    );
    return tasks.flat().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async getTask(taskId: string, benchId: string): Promise<TaskMetadata> {
    const tasks = await this.listTasks({ benchId });
    const task = tasks.find((entry) => entry.id === taskId);
    if (!task) {
      throw new WorkspaceNotFoundError(`Task not found: ${taskId}`);
    }
    return taskMetadataSchema.parse(task);
  }

  async completeTask(taskId: string, input: unknown): Promise<TaskMetadata> {
    const request = completeTaskRequestSchema.parse(input);
    const actor = parseComponentWriteActor(request.actor);
    if (actor.benchId !== request.benchId) {
      throw new WorkspaceValidationError("Task completion actor benchId mismatch");
    }

    const task = await this.getTask(taskId, request.benchId);
    if (task.toComponentInstanceId !== actor.componentInstanceId) {
      throw new WorkspaceValidationError("Only the target component instance may complete the task");
    }

    const timestamp = new Date().toISOString();
    const completed = taskMetadataSchema.parse({
      ...task,
      status: "completed",
      resultText: request.resultText,
      resultResourceId: request.resultResourceId,
      createdResourceIds: request.createdResourceIds,
      modifiedResourceIds: request.modifiedResourceIds,
      updatedAt: timestamp,
      completedAt: timestamp,
    });
    await this.store.writeTask(completed);
    return completed;
  }

  async getTaskResult(taskId: string, benchId: string) {
    const task = await this.getTask(taskId, benchId);
    return {
      taskId: task.id,
      status: task.status,
      resultText: task.resultText ?? null,
      resultResourceId: task.resultResourceId ?? null,
      createdResourceIds: task.createdResourceIds,
      modifiedResourceIds: task.modifiedResourceIds,
      completedAt: task.completedAt ?? null,
    };
  }
}

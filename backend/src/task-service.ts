import { z } from "zod";

import { benchIdSchema } from "./bench.js";
import { componentInstanceIdSchema } from "./component.js";
import { logger as rootLogger } from "./logger.js";
import {
  createTask,
  taskMetadataSchema,
  taskStatusSchema,
  type TaskFailureKind,
  type TaskMetadata,
  type TaskStatus,
} from "./task.js";
import {
  DEFAULT_TASK_TIMEOUT_POLICY,
  type TaskTimeoutPolicy,
} from "./task-timeout-policy.js";
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

export const retryTaskRequestSchema = z.object({
  benchId: benchIdSchema,
  actor: z.object({
    benchId: benchIdSchema,
    componentInstanceId: componentInstanceIdSchema,
    presetId: z.string().trim().min(1).optional(),
  }).strict(),
}).strict();

export interface TaskServiceOptions {
  policy?: TaskTimeoutPolicy;
}

export class TaskService {
  private readonly logger = rootLogger.child({ scope: "task_service" });
  private readonly policy: TaskTimeoutPolicy;

  constructor(
    private readonly store: WorkspaceStore,
    private readonly componentSessionService?: ComponentSessionService,
    options: TaskServiceOptions = {},
  ) {
    this.policy = options.policy ?? DEFAULT_TASK_TIMEOUT_POLICY;
  }

  async createTask(input: unknown): Promise<TaskMetadata> {
    const request = createTaskRequestSchema.parse(input);
    const actor = parseComponentWriteActor(request.actor);
    this.logger.info("task.create.requested", {
      benchId: request.actor.benchId,
      fromComponentInstanceId: request.fromComponentInstanceId,
      toComponentInstanceId: request.toComponentInstanceId,
      title: request.title,
      request: request.request,
    });

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
    this.logger.info("task.created", {
      taskId: task.id,
      benchId: task.benchId,
      fromComponentInstanceId: task.fromComponentInstanceId,
      toComponentInstanceId: task.toComponentInstanceId,
      status: task.status,
      title: task.title,
    });

    if (!this.componentSessionService) {
      this.logger.info("task.awaiting_manual_dispatch", {
        taskId: task.id,
        benchId: task.benchId,
        toComponentInstanceId: task.toComponentInstanceId,
      });
      return task;
    }

    const taskSession = await this.componentSessionService.createTaskRunSession(task);
    this.logger.info("task.session_created", {
      taskId: task.id,
      benchId: task.benchId,
      taskSessionId: taskSession.id,
      toComponentInstanceId: task.toComponentInstanceId,
    });
    const transitionTimestamp = new Date().toISOString();
    const runningTask = taskMetadataSchema.parse({
      ...task,
      status: "running",
      taskSessionId: taskSession.id,
      lastActivityAt: transitionTimestamp,
      updatedAt: transitionTimestamp,
    });
    await this.store.writeTask(runningTask);
    this.logger.info("task.state_changed", {
      taskId: runningTask.id,
      benchId: runningTask.benchId,
      fromStatus: task.status,
      toStatus: runningTask.status,
      taskSessionId: runningTask.taskSessionId,
    });
    return runningTask;
  }

  async listTasks(options: ListTasksOptions): Promise<TaskMetadata[]> {
    const benchId = benchIdSchema.parse(options.benchId);
    const status = options.status ? taskStatusSchema.parse(options.status) : undefined;

    if (options.componentInstanceId) {
      const componentInstanceId = componentInstanceIdSchema.parse(options.componentInstanceId);
      const tasks = await this.store.listTasks(benchId, componentInstanceId, status);
      this.logger.info("task.list.completed", {
        benchId,
        componentInstanceId,
        status: status ?? null,
        count: tasks.length,
      });
      return tasks;
    }

    const components = await this.store.listComponents(benchId);
    const tasks = await Promise.all(
      components.map((component) => this.store.listTasks(benchId, component.id, status)),
    );
    const flattened = tasks.flat().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    this.logger.info("task.list.completed", {
      benchId,
      componentInstanceId: null,
      status: status ?? null,
      count: flattened.length,
    });
    return flattened;
  }

  async getTask(taskId: string, benchId: string): Promise<TaskMetadata> {
    const tasks = await this.listTasks({ benchId });
    const task = tasks.find((entry) => entry.id === taskId);
    if (!task) {
      this.logger.warn("task.get.not_found", {
        taskId,
        benchId,
      });
      throw new WorkspaceNotFoundError(`Task not found: ${taskId}`);
    }
    this.logger.info("task.get.found", {
      taskId,
      benchId,
      toComponentInstanceId: task.toComponentInstanceId,
      status: task.status,
    });
    return taskMetadataSchema.parse(task);
  }

  async startTaskExecution(taskId: string, benchId: string): Promise<TaskMetadata> {
    const task = await this.getTask(taskId, benchId);
    if (task.status !== "running") {
      throw new WorkspaceValidationError(`Only running tasks may start execution automatically (got ${task.status})`);
    }
    if (!task.taskSessionId) {
      throw new WorkspaceValidationError(`Cannot start task execution without taskSessionId for ${task.id}`);
    }
    if (task.executionStartedAt) {
      return task;
    }

    const timestamp = new Date().toISOString();
    const started = taskMetadataSchema.parse({
      ...task,
      executionStartedAt: timestamp,
      lastActivityAt: timestamp,
      updatedAt: timestamp,
    });
    await this.store.writeTask(started);
    this.logger.info("task.execution_started", {
      taskId: started.id,
      benchId: started.benchId,
      taskSessionId: started.taskSessionId,
      executionStartedAt: started.executionStartedAt,
    });
    return started;
  }

  async recordTaskActivity(taskId: string, benchId: string): Promise<TaskMetadata> {
    const task = await this.getTask(taskId, benchId);
    if (task.status !== "running") {
      return task;
    }
    const timestamp = new Date().toISOString();
    const updated = taskMetadataSchema.parse({
      ...task,
      lastActivityAt: timestamp,
      updatedAt: timestamp,
    });
    await this.store.writeTask(updated);
    return updated;
  }

  async failTask(
    taskId: string,
    benchId: string,
    failureKind: TaskFailureKind,
    failureMessage: string,
  ): Promise<TaskMetadata> {
    const task = await this.getTask(taskId, benchId);
    const timestamp = new Date().toISOString();
    const failed = taskMetadataSchema.parse({
      ...task,
      status: "error",
      failureKind,
      failureMessage,
      resultText: undefined,
      lastActivityAt: timestamp,
      updatedAt: timestamp,
    });
    await this.store.writeTask(failed);
    this.logger.error("task.state_changed", {
      taskId: failed.id,
      benchId: failed.benchId,
      fromStatus: task.status,
      toStatus: failed.status,
      failureKind,
      failureMessage,
    });
    return failed;
  }

  async retryTask(taskId: string, input: unknown): Promise<TaskMetadata> {
    const request = retryTaskRequestSchema.parse(input);
    const actor = parseComponentWriteActor(request.actor);
    if (actor.benchId !== request.benchId) {
      throw new WorkspaceValidationError("Task retry actor benchId mismatch");
    }

    const task = await this.getTask(taskId, request.benchId);
    if (task.status !== "error") {
      throw new WorkspaceValidationError(
        `Only failed tasks can be retried (got status ${task.status})`,
      );
    }
    if (actor.componentInstanceId !== task.fromComponentInstanceId) {
      throw new WorkspaceValidationError(
        "Only the requesting component (fromComponentInstanceId) may retry the task",
      );
    }
    if (task.attemptCount >= this.policy.maxAttempts) {
      throw new WorkspaceValidationError(
        `Task ${task.id} has reached the retry cap (${this.policy.maxAttempts} attempts)`,
      );
    }
    if (!this.componentSessionService) {
      throw new WorkspaceValidationError(
        "Retry requires a component session service to allocate a fresh task-run session",
      );
    }

    this.logger.info("task.retry.requested", {
      taskId: task.id,
      benchId: task.benchId,
      previousFailureKind: task.failureKind ?? null,
      attemptCount: task.attemptCount,
    });

    const taskSession = await this.componentSessionService.createTaskRunSession(task);
    const timestamp = new Date().toISOString();
    const retried = taskMetadataSchema.parse({
      ...task,
      status: "running",
      taskSessionId: taskSession.id,
      attemptCount: task.attemptCount + 1,
      executionStartedAt: undefined,
      lastActivityAt: timestamp,
      failureKind: undefined,
      failureMessage: undefined,
      resultText: undefined,
      updatedAt: timestamp,
    });
    await this.store.writeTask(retried);
    this.logger.info("task.state_changed", {
      taskId: retried.id,
      benchId: retried.benchId,
      fromStatus: task.status,
      toStatus: retried.status,
      attemptCount: retried.attemptCount,
      taskSessionId: retried.taskSessionId,
    });
    return retried;
  }

  async completeTask(taskId: string, input: unknown): Promise<TaskMetadata> {
    const request = completeTaskRequestSchema.parse(input);
    const actor = parseComponentWriteActor(request.actor);
    this.logger.info("task.complete.requested", {
      taskId,
      benchId: request.benchId,
      actorComponentInstanceId: actor.componentInstanceId,
      resultResourceId: request.resultResourceId ?? null,
      createdResourceIds: request.createdResourceIds,
      modifiedResourceIds: request.modifiedResourceIds,
    });
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
      lastActivityAt: timestamp,
      updatedAt: timestamp,
      completedAt: timestamp,
    });
    await this.store.writeTask(completed);
    this.logger.info("task.state_changed", {
      taskId: completed.id,
      benchId: completed.benchId,
      fromStatus: task.status,
      toStatus: completed.status,
      resultResourceId: completed.resultResourceId ?? null,
      createdResourceIds: completed.createdResourceIds,
      modifiedResourceIds: completed.modifiedResourceIds,
    });
    return completed;
  }

  async getTaskResult(taskId: string, benchId: string) {
    const task = await this.getTask(taskId, benchId);
    this.logger.info("task.result.read", {
      taskId: task.id,
      benchId,
      status: task.status,
      resultResourceId: task.resultResourceId ?? null,
      failureKind: task.failureKind ?? null,
    });
    return {
      taskId: task.id,
      status: task.status,
      resultText: task.resultText ?? null,
      resultResourceId: task.resultResourceId ?? null,
      createdResourceIds: task.createdResourceIds,
      modifiedResourceIds: task.modifiedResourceIds,
      completedAt: task.completedAt ?? null,
      failureKind: task.failureKind ?? null,
      failureMessage: task.failureMessage ?? null,
      lastActivityAt: task.lastActivityAt ?? null,
      attemptCount: task.attemptCount,
    };
  }
}

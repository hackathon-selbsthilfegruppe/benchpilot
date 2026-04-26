import { createResource } from "./resource.js";
import { logger as rootLogger } from "./logger.js";
import { getRunnableTaskCandidate } from "./task-dispatch.js";
import { type TaskMetadata } from "./task.js";
import { type StreamEnvelope } from "./types.js";
import { TaskService } from "./task-service.js";
import { WorkspaceStore } from "./workspace-store.js";

export interface TaskPromptService {
  prompt(sessionId: string, message: string, onEvent: (chunk: StreamEnvelope) => void): Promise<void>;
}

export class TaskDispatcher {
  private readonly logger = rootLogger.child({ scope: "task_dispatcher" });
  private readonly inFlightTaskIds = new Set<string>();
  private scanInProgress = false;

  constructor(
    private readonly store: WorkspaceStore,
    private readonly taskService: TaskService,
    private readonly promptService: TaskPromptService,
  ) {}

  async dispatchRunnableTasksOnce(): Promise<string[]> {
    if (this.scanInProgress) {
      this.logger.debug("task.dispatch.scan.skipped", {
        reason: "scan_already_in_progress",
      });
      return [];
    }

    this.scanInProgress = true;
    try {
      const benches = await this.store.listBenches();
    const runningTasks = await Promise.all(benches.map((bench) => this.taskService.listTasks({ benchId: bench.id, status: "running" })));
    const runnable = runningTasks
      .flat()
      .map((task) => ({ task, candidate: getRunnableTaskCandidate(task) }))
      .filter((entry): entry is { task: Awaited<ReturnType<TaskService["listTasks"]>>[number]; candidate: NonNullable<ReturnType<typeof getRunnableTaskCandidate>> } => Boolean(entry.candidate));

      this.logger.info("task.dispatch.scan.completed", {
        benchCount: benches.length,
        runningTaskCount: runningTasks.flat().length,
        runnableTaskCount: runnable.length,
        inFlightTaskCount: this.inFlightTaskIds.size,
      });

      const dispatchedTaskIds: string[] = [];
      for (const entry of runnable) {
        if (this.inFlightTaskIds.has(entry.task.id)) {
          continue;
        }
        this.inFlightTaskIds.add(entry.task.id);
        dispatchedTaskIds.push(entry.task.id);
        void this.dispatchTask(entry.task.benchId, entry.task.id).finally(() => {
          this.inFlightTaskIds.delete(entry.task.id);
        });
      }

      return dispatchedTaskIds;
    } finally {
      this.scanInProgress = false;
    }
  }

  private async dispatchTask(benchId: string, taskId: string): Promise<void> {
    const startedTask = await this.taskService.startTaskExecution(taskId, benchId);
    const promptMessage = buildTaskDispatchMessage(startedTask);
    this.logger.info("task.dispatch.started", {
      taskId: startedTask.id,
      benchId,
      taskSessionId: startedTask.taskSessionId,
    });

    let finalAssistantText = "";

    try {
      await this.promptService.prompt(startedTask.taskSessionId!, promptMessage, (chunk) => {
        if (chunk.type === "message_completed") {
          finalAssistantText = chunk.assistantText ?? "";
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.taskService.failTask(startedTask.id, benchId, "prompt_error", errorMessage);
      this.logger.error("task.dispatch.failed", {
        taskId: startedTask.id,
        benchId,
        taskSessionId: startedTask.taskSessionId,
        error,
      });
      return;
    }

    this.logger.info("task.dispatch.prompt_completed", {
      taskId: startedTask.id,
      benchId,
      taskSessionId: startedTask.taskSessionId,
      assistantText: finalAssistantText,
    });

    const latestTask = await this.taskService.getTask(startedTask.id, benchId);
    if (latestTask.status !== "running") {
      this.logger.info("task.dispatch.skipped_auto_completion", {
        taskId: latestTask.id,
        benchId,
        status: latestTask.status,
      });
      return;
    }

    const resultText = finalAssistantText.trim().length > 0
      ? finalAssistantText.trim()
      : "Task execution completed without an explicit assistant result.";
    const resultResource = await this.createAutoResultResource(latestTask, resultText);
    await this.taskService.completeTask(latestTask.id, {
      benchId,
      actor: {
        benchId,
        componentInstanceId: latestTask.toComponentInstanceId,
      },
      resultText,
      resultResourceId: resultResource.id,
      createdResourceIds: [resultResource.id],
      modifiedResourceIds: [],
    });
    this.logger.info("task.dispatch.auto_completed", {
      taskId: latestTask.id,
      benchId,
      resultResourceId: resultResource.id,
    });
  }

  private async createAutoResultResource(task: TaskMetadata, resultText: string) {
    const existingResourceIds = (await this.store.listResources(task.benchId, task.toComponentInstanceId)).map((entry) => entry.id);
    const targetComponent = await this.store.readComponent(task.benchId, task.toComponentInstanceId);
    const descriptor = deriveTaskResultDescriptor(targetComponent.presetId, task.title, resultText);
    const body = buildTaskResultMarkdown(task, resultText);
    const resource = createResource({
      benchId: task.benchId,
      componentInstanceId: task.toComponentInstanceId,
      title: descriptor.title,
      kind: descriptor.kind,
      description: descriptor.description,
      summary: resultText.length <= 240 ? resultText : `${resultText.slice(0, 237)}...`,
      tags: ["task-result"],
      primaryFile: "result.md",
      contentType: "text/markdown",
      files: [
        {
          filename: "result.md",
          mediaType: "text/markdown",
          description: `${task.title} auto-recorded result`,
          role: "primary",
        },
      ],
      status: "ready",
    }, {
      existingResourceIds,
    });

    await this.store.writeResource(resource);
    await this.store.writeResourceFile(task.benchId, task.toComponentInstanceId, resource.id, "result.md", Buffer.from(body, "utf8"));
    return resource;
  }
}

function buildTaskDispatchMessage(task: { id: string; title: string; request: string }): string {
  return [
    `Execute delegated task ${task.id}.`,
    `Title: ${task.title}`,
    `Request: ${task.request}`,
    "Carry out the work now. Create durable artifacts if needed. If you explicitly complete the task via BenchPilot CLI, use a concise result summary.",
  ].join("\n");
}

function deriveTaskResultDescriptor(presetId: string | undefined, taskTitle: string, resultText: string) {
  if (presetId === "reviewer") {
    return {
      title: `${taskTitle} Review`,
      kind: "review-report",
      description: `Auto-recorded review report for task ${taskTitle}`,
    };
  }

  if (presetId === "experiment-planner") {
    const isGapReport = /\bgap\b|\bmissing\b/i.test(resultText);
    return {
      title: isGapReport ? `${taskTitle} Gap Report` : `${taskTitle} Experiment Plan`,
      kind: isGapReport ? "gap-report" : "experiment-plan",
      description: isGapReport
        ? `Auto-recorded gap report for task ${taskTitle}`
        : `Auto-recorded experiment plan for task ${taskTitle}`,
    };
  }

  return {
    title: `${taskTitle} Result`,
    kind: "task-result",
    description: `Auto-recorded result for task ${taskTitle}`,
  };
}

function buildTaskResultMarkdown(task: TaskMetadata, resultText: string): string {
  return [
    `# ${task.title}`,
    "",
    `Task ID: ${task.id}`,
    `From: ${task.fromComponentInstanceId}`,
    `To: ${task.toComponentInstanceId}`,
    "",
    "## Request",
    task.request,
    "",
    "## Result",
    resultText,
  ].join("\n");
}

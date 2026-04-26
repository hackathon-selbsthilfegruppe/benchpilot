import path from "node:path";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { Buffer } from "node:buffer";

import { z } from "zod";

import { benchMetadataSchema, type BenchMetadata } from "./bench.js";
import { componentInstanceSchema, type ComponentInstance } from "./component.js";
import { requirementMetadataSchema, type RequirementMetadata } from "./requirement.js";
import { taskMetadataSchema, taskStatusSchema, type TaskMetadata, type TaskStatus } from "./task.js";
import {
  resourceMetadataSchema,
  resourceTocEntrySchema,
  toResourceTocEntry,
  type ResourceMetadata,
  type ResourceTocEntry,
} from "./resource.js";
import {
  getBenchDir,
  getBenchMetadataPath,
  getBenchRequirementsDir,
  getBenchesDir,
  getBenchComponentsDir,
  getComponentDir,
  getComponentMetadataPath,
  getComponentResourcesDir,
  getComponentSummaryPath,
  getComponentTaskStateDir,
  getComponentTocPath,
  getRequirementMetadataPath,
  getResourceDir,
  getTaskMetadataPath,
  getResourceFilePath,
  getResourceFilesDir,
  getResourceMetadataPath,
  resolveWorkspaceRoot,
} from "./workspace-layout.js";

export class WorkspaceValidationError extends Error {
  constructor(message: string, readonly causeValue?: unknown) {
    super(message);
    this.name = "WorkspaceValidationError";
  }
}

export class WorkspaceNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceNotFoundError";
  }
}

export class WorkspaceStore {
  readonly workspaceRoot: string;

  constructor(baseDir: string) {
    this.workspaceRoot = resolveWorkspaceRoot(baseDir);
  }

  async writeBench(bench: BenchMetadata): Promise<void> {
    const parsed = benchMetadataSchema.parse(bench);
    await mkdir(getBenchDir(this.workspaceRoot, parsed.id), { recursive: true });
    await writeJsonFile(getBenchMetadataPath(this.workspaceRoot, parsed.id), parsed);
    await mkdir(getBenchRequirementsDir(this.workspaceRoot, parsed.id), { recursive: true });
  }

  async readBench(benchId: string): Promise<BenchMetadata> {
    return readJsonFile(getBenchMetadataPath(this.workspaceRoot, benchId), benchMetadataSchema, "bench");
  }

  async listBenches(): Promise<BenchMetadata[]> {
    return listJsonChildren(
      getBenchesDirSafe(this.workspaceRoot),
      async (benchId) => this.readBench(benchId),
    );
  }

  async writeRequirement(requirement: RequirementMetadata): Promise<void> {
    const parsed = requirementMetadataSchema.parse(requirement);
    await this.ensureBenchExists(parsed.benchId);
    await mkdir(getBenchRequirementsDir(this.workspaceRoot, parsed.benchId), { recursive: true });
    await writeJsonFile(
      getRequirementMetadataPath(this.workspaceRoot, parsed.benchId, parsed.id),
      parsed,
    );
  }

  async readRequirement(benchId: string, requirementId: string): Promise<RequirementMetadata> {
    return readJsonFile(
      getRequirementMetadataPath(this.workspaceRoot, benchId, requirementId),
      requirementMetadataSchema,
      "requirement",
    );
  }

  async listRequirements(benchId: string): Promise<RequirementMetadata[]> {
    return listJsonFiles(
      getBenchRequirementsDir(this.workspaceRoot, benchId),
      async (filename) => this.readRequirement(benchId, filename.replace(/\.json$/, "")),
    );
  }

  async writeComponent(component: ComponentInstance): Promise<void> {
    const parsed = componentInstanceSchema.parse(component);
    await this.ensureBenchExists(parsed.benchId);
    await mkdir(getComponentDir(this.workspaceRoot, parsed.benchId, parsed.id), { recursive: true });
    await mkdir(getComponentResourcesDir(this.workspaceRoot, parsed.benchId, parsed.id), { recursive: true });
    await writeJsonFile(getComponentMetadataPath(this.workspaceRoot, parsed.benchId, parsed.id), parsed);
    await writeFile(getComponentSummaryPath(this.workspaceRoot, parsed.benchId, parsed.id), `${parsed.summary}\n`, "utf8");
    await this.refreshComponentToc(parsed.benchId, parsed.id);
  }

  async updateComponentSummary(
    benchId: string,
    componentInstanceId: string,
    summary: string,
    updatedAt: string = new Date().toISOString(),
  ): Promise<ComponentInstance> {
    const existing = await this.readComponent(benchId, componentInstanceId);
    const updated = componentInstanceSchema.parse({
      ...existing,
      summary,
      updatedAt,
    });
    await writeJsonFile(getComponentMetadataPath(this.workspaceRoot, benchId, componentInstanceId), updated);
    await writeFile(getComponentSummaryPath(this.workspaceRoot, benchId, componentInstanceId), `${summary}\n`, "utf8");
    return updated;
  }

  async readComponent(benchId: string, componentInstanceId: string): Promise<ComponentInstance> {
    return readJsonFile(
      getComponentMetadataPath(this.workspaceRoot, benchId, componentInstanceId),
      componentInstanceSchema,
      "component",
    );
  }

  async listComponents(benchId: string): Promise<ComponentInstance[]> {
    return listJsonChildren(
      getBenchComponentsDirSafe(this.workspaceRoot, benchId),
      async (componentInstanceId) => this.readComponent(benchId, componentInstanceId),
    );
  }

  async writeTask(task: TaskMetadata): Promise<void> {
    const parsed = taskMetadataSchema.parse(task);
    await this.ensureComponentExists(parsed.benchId, parsed.toComponentInstanceId);
    await mkdir(getComponentTaskStateDir(this.workspaceRoot, parsed.benchId, parsed.toComponentInstanceId, parsed.status), { recursive: true });

    for (const status of taskStatusSchema.options) {
      await rm(
        getTaskMetadataPath(this.workspaceRoot, parsed.benchId, parsed.toComponentInstanceId, status, parsed.id),
        { force: true },
      );
    }

    await writeJsonFile(
      getTaskMetadataPath(this.workspaceRoot, parsed.benchId, parsed.toComponentInstanceId, parsed.status, parsed.id),
      parsed,
    );
  }

  async readTask(benchId: string, componentInstanceId: string, taskId: string): Promise<TaskMetadata> {
    for (const status of taskStatusSchema.options) {
      const filePath = getTaskMetadataPath(this.workspaceRoot, benchId, componentInstanceId, status, taskId);
      try {
        return await readJsonFile(filePath, taskMetadataSchema, "task");
      } catch (error) {
        if (error instanceof WorkspaceNotFoundError) {
          continue;
        }
        throw error;
      }
    }

    throw new WorkspaceNotFoundError(`task file not found for ${taskId}`);
  }

  async listTasks(benchId: string, componentInstanceId: string, status?: TaskStatus): Promise<TaskMetadata[]> {
    const statuses = status ? [status] : taskStatusSchema.options;
    const tasks = await Promise.all(statuses.map(async (currentStatus) => listJsonFiles(
      getComponentTaskStateDir(this.workspaceRoot, benchId, componentInstanceId, currentStatus),
      async (filename) => this.readTask(benchId, componentInstanceId, filename.replace(/\.json$/, "")),
    )));
    return tasks.flat().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async readComponentSummary(benchId: string, componentInstanceId: string): Promise<string> {
    const filePath = getComponentSummaryPath(this.workspaceRoot, benchId, componentInstanceId);
    return readUtf8(filePath, "component summary");
  }

  async readComponentToc(benchId: string, componentInstanceId: string): Promise<ResourceTocEntry[]> {
    return readJsonFile(
      getComponentTocPath(this.workspaceRoot, benchId, componentInstanceId),
      resourceTocEntrySchema.array(),
      "component TOC",
    );
  }

  async writeResource(resource: ResourceMetadata): Promise<void> {
    const parsed = resourceMetadataSchema.parse(resource);
    await this.ensureComponentExists(parsed.benchId, parsed.componentInstanceId);
    await mkdir(getResourceFilesDir(this.workspaceRoot, parsed.benchId, parsed.componentInstanceId, parsed.id), {
      recursive: true,
    });
    await writeJsonFile(
      getResourceMetadataPath(this.workspaceRoot, parsed.benchId, parsed.componentInstanceId, parsed.id),
      parsed,
    );
    await this.refreshComponentToc(parsed.benchId, parsed.componentInstanceId);
  }

  async writeResourceFile(
    benchId: string,
    componentInstanceId: string,
    resourceId: string,
    filename: string,
    content: Uint8Array,
  ): Promise<void> {
    await this.ensureResourceExists(benchId, componentInstanceId, resourceId);
    const filePath = getResourceFilePath(this.workspaceRoot, benchId, componentInstanceId, resourceId, filename);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content);
  }

  async readResourceFile(
    benchId: string,
    componentInstanceId: string,
    resourceId: string,
    filename: string,
  ): Promise<Buffer> {
    await this.ensureResourceExists(benchId, componentInstanceId, resourceId);
    const filePath = getResourceFilePath(this.workspaceRoot, benchId, componentInstanceId, resourceId, filename);
    try {
      return await readFile(filePath);
    } catch (error) {
      if (isMissingFileError(error)) {
        throw new WorkspaceNotFoundError(`resource file not found: ${filePath}`);
      }
      throw error;
    }
  }

  async listResourceFiles(
    benchId: string,
    componentInstanceId: string,
    resourceId: string,
  ): Promise<string[]> {
    await this.ensureResourceExists(benchId, componentInstanceId, resourceId);
    try {
      const entries = await readdir(
        getResourceFilesDir(this.workspaceRoot, benchId, componentInstanceId, resourceId),
        { withFileTypes: true },
      );
      return entries.filter((entry) => entry.isFile()).map((entry) => entry.name).sort();
    } catch (error) {
      if (isMissingFileError(error)) {
        return [];
      }
      throw error;
    }
  }

  async replaceResourceFiles(
    benchId: string,
    componentInstanceId: string,
    resourceId: string,
    files: Array<{ filename: string; content: Uint8Array }>,
  ): Promise<void> {
    await this.ensureResourceExists(benchId, componentInstanceId, resourceId);
    const filesDir = getResourceFilesDir(this.workspaceRoot, benchId, componentInstanceId, resourceId);
    await rm(filesDir, { recursive: true, force: true });
    await mkdir(filesDir, { recursive: true });
    for (const file of files) {
      await this.writeResourceFile(benchId, componentInstanceId, resourceId, file.filename, file.content);
    }
  }

  async deleteResource(benchId: string, componentInstanceId: string, resourceId: string): Promise<void> {
    await rm(getResourceDir(this.workspaceRoot, benchId, componentInstanceId, resourceId), {
      recursive: true,
      force: true,
    });
    await this.refreshComponentToc(benchId, componentInstanceId);
  }

  async readResource(
    benchId: string,
    componentInstanceId: string,
    resourceId: string,
  ): Promise<ResourceMetadata> {
    return readJsonFile(
      getResourceMetadataPath(this.workspaceRoot, benchId, componentInstanceId, resourceId),
      resourceMetadataSchema,
      "resource",
    );
  }

  async listResources(benchId: string, componentInstanceId: string): Promise<ResourceMetadata[]> {
    return listJsonChildren(
      getComponentResourcesDir(this.workspaceRoot, benchId, componentInstanceId),
      async (resourceId) => this.readResource(benchId, componentInstanceId, resourceId),
    );
  }

  async refreshComponentToc(benchId: string, componentInstanceId: string): Promise<ResourceTocEntry[]> {
    const resources = await this.listResourcesOrEmpty(benchId, componentInstanceId);
    const toc = resources
      .map((resource) => toResourceTocEntry(resource))
      .map((entry) => resourceTocEntrySchema.parse(entry));
    await mkdir(getComponentDir(this.workspaceRoot, benchId, componentInstanceId), { recursive: true });
    await writeJsonFile(getComponentTocPath(this.workspaceRoot, benchId, componentInstanceId), toc);
    return toc;
  }

  private async listResourcesOrEmpty(benchId: string, componentInstanceId: string): Promise<ResourceMetadata[]> {
    try {
      return await this.listResources(benchId, componentInstanceId);
    } catch (error) {
      if (error instanceof WorkspaceNotFoundError) {
        return [];
      }
      throw error;
    }
  }

  private async ensureBenchExists(benchId: string): Promise<void> {
    try {
      await this.readBench(benchId);
    } catch (error) {
      if (error instanceof WorkspaceNotFoundError) {
        throw new WorkspaceValidationError(`Cannot write nested data for missing bench ${benchId}`);
      }
      throw error;
    }
  }

  private async ensureComponentExists(benchId: string, componentInstanceId: string): Promise<void> {
    try {
      await this.readComponent(benchId, componentInstanceId);
    } catch (error) {
      if (error instanceof WorkspaceNotFoundError) {
        throw new WorkspaceValidationError(
          `Cannot write resource for missing component ${componentInstanceId} in bench ${benchId}`,
        );
      }
      throw error;
    }
  }

  private async ensureResourceExists(benchId: string, componentInstanceId: string, resourceId: string): Promise<void> {
    try {
      await this.readResource(benchId, componentInstanceId, resourceId);
    } catch (error) {
      if (error instanceof WorkspaceNotFoundError) {
        throw new WorkspaceValidationError(
          `Cannot write resource files for missing resource ${resourceId} in component ${componentInstanceId}`,
        );
      }
      throw error;
    }
  }
}

function getBenchesDirSafe(workspaceRoot: string): string {
  return getBenchesDir(workspaceRoot);
}

function getBenchComponentsDirSafe(workspaceRoot: string, benchId: string): string {
  return getBenchComponentsDir(workspaceRoot, benchId);
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readJsonFile<TSchema extends z.ZodTypeAny>(
  filePath: string,
  schema: TSchema,
  label: string,
): Promise<z.output<TSchema>> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (error) {
    if (isMissingFileError(error)) {
      throw new WorkspaceNotFoundError(`${label} file not found: ${filePath}`);
    }
    throw error;
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch (error) {
    throw new WorkspaceValidationError(`${label} file contains invalid JSON: ${filePath}`, error);
  }

  const parsed = schema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new WorkspaceValidationError(`${label} file failed schema validation: ${filePath}`, parsed.error);
  }

  return parsed.data;
}

async function listJsonChildren<T>(
  dirPath: string,
  reader: (entryName: string) => Promise<T>,
): Promise<T[]> {
  let entries;
  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    if (isMissingFileError(error)) {
      return [];
    }
    throw error;
  }

  const items = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  return Promise.all(items.map((item) => reader(item)));
}

async function listJsonFiles<T>(
  dirPath: string,
  reader: (filename: string) => Promise<T>,
): Promise<T[]> {
  let entries;
  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    if (isMissingFileError(error)) {
      return [];
    }
    throw error;
  }

  const items = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort();

  return Promise.all(items.map((item) => reader(item)));
}

async function readUtf8(filePath: string, label: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (isMissingFileError(error)) {
      throw new WorkspaceNotFoundError(`${label} file not found: ${filePath}`);
    }
    throw error;
  }
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

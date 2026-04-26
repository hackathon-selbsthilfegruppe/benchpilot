import path from "node:path";
import { z } from "zod";

import { benchIdSchema } from "./bench.js";
import { componentInstanceIdSchema } from "./component.js";
import { requirementIdSchema } from "./requirement.js";
import { resourceIdSchema } from "./resource.js";

export const WORKSPACE_DIRNAME = "workspace";
export const BENCHES_DIRNAME = "benches";
export const REQUIREMENTS_DIRNAME = "requirements";
export const COMPONENTS_DIRNAME = "components";
export const RESOURCES_DIRNAME = "resources";
export const RESOURCE_FILES_DIRNAME = "files";
export const TASKS_DIRNAME = "tasks";

export const BENCH_METADATA_FILENAME = "bench.json";
export const COMPONENT_METADATA_FILENAME = "component.json";
export const COMPONENT_SUMMARY_FILENAME = "summary.md";
export const COMPONENT_TOC_FILENAME = "toc.json";
export const RESOURCE_METADATA_FILENAME = "resource.json";

export const taskStateSchema = z.enum(["pending", "running", "completed"]);
export type TaskState = z.infer<typeof taskStateSchema>;

export function resolveWorkspaceRoot(baseDir: string): string {
  return path.resolve(baseDir, WORKSPACE_DIRNAME);
}

export function getBenchesDir(workspaceRoot: string): string {
  return path.join(workspaceRoot, BENCHES_DIRNAME);
}

export function getBenchDir(workspaceRoot: string, benchId: string): string {
  return path.join(getBenchesDir(workspaceRoot), benchIdSchema.parse(benchId));
}

export function getBenchMetadataPath(workspaceRoot: string, benchId: string): string {
  return path.join(getBenchDir(workspaceRoot, benchId), BENCH_METADATA_FILENAME);
}

export function getBenchRequirementsDir(workspaceRoot: string, benchId: string): string {
  return path.join(getBenchDir(workspaceRoot, benchId), REQUIREMENTS_DIRNAME);
}

export function getRequirementMetadataPath(workspaceRoot: string, benchId: string, requirementId: string): string {
  return path.join(
    getBenchRequirementsDir(workspaceRoot, benchId),
    `${requirementIdSchema.parse(requirementId)}.json`,
  );
}

export function getBenchComponentsDir(workspaceRoot: string, benchId: string): string {
  return path.join(getBenchDir(workspaceRoot, benchId), COMPONENTS_DIRNAME);
}

export function getComponentDir(workspaceRoot: string, benchId: string, componentInstanceId: string): string {
  return path.join(
    getBenchComponentsDir(workspaceRoot, benchId),
    componentInstanceIdSchema.parse(componentInstanceId),
  );
}

export function getComponentMetadataPath(workspaceRoot: string, benchId: string, componentInstanceId: string): string {
  return path.join(getComponentDir(workspaceRoot, benchId, componentInstanceId), COMPONENT_METADATA_FILENAME);
}

export function getComponentSummaryPath(workspaceRoot: string, benchId: string, componentInstanceId: string): string {
  return path.join(getComponentDir(workspaceRoot, benchId, componentInstanceId), COMPONENT_SUMMARY_FILENAME);
}

export function getComponentTocPath(workspaceRoot: string, benchId: string, componentInstanceId: string): string {
  return path.join(getComponentDir(workspaceRoot, benchId, componentInstanceId), COMPONENT_TOC_FILENAME);
}

export function getComponentResourcesDir(workspaceRoot: string, benchId: string, componentInstanceId: string): string {
  return path.join(getComponentDir(workspaceRoot, benchId, componentInstanceId), RESOURCES_DIRNAME);
}

export function getResourceDir(
  workspaceRoot: string,
  benchId: string,
  componentInstanceId: string,
  resourceId: string,
): string {
  return path.join(
    getComponentResourcesDir(workspaceRoot, benchId, componentInstanceId),
    resourceIdSchema.parse(resourceId),
  );
}

export function getResourceMetadataPath(
  workspaceRoot: string,
  benchId: string,
  componentInstanceId: string,
  resourceId: string,
): string {
  return path.join(getResourceDir(workspaceRoot, benchId, componentInstanceId, resourceId), RESOURCE_METADATA_FILENAME);
}

export function getResourceFilesDir(
  workspaceRoot: string,
  benchId: string,
  componentInstanceId: string,
  resourceId: string,
): string {
  return path.join(getResourceDir(workspaceRoot, benchId, componentInstanceId, resourceId), RESOURCE_FILES_DIRNAME);
}

export function getComponentTasksDir(workspaceRoot: string, benchId: string, componentInstanceId: string): string {
  return path.join(getComponentDir(workspaceRoot, benchId, componentInstanceId), TASKS_DIRNAME);
}

export function getComponentTaskStateDir(
  workspaceRoot: string,
  benchId: string,
  componentInstanceId: string,
  state: TaskState,
): string {
  return path.join(
    getComponentTasksDir(workspaceRoot, benchId, componentInstanceId),
    taskStateSchema.parse(state),
  );
}

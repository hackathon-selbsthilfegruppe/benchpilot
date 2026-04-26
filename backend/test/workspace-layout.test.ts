import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  BENCHES_DIRNAME,
  BENCH_METADATA_FILENAME,
  COMPONENT_METADATA_FILENAME,
  COMPONENT_SUMMARY_FILENAME,
  COMPONENT_TOC_FILENAME,
  RESOURCE_FILES_DIRNAME,
  RESOURCE_METADATA_FILENAME,
  WORKSPACE_DIRNAME,
  getBenchComponentsDir,
  getBenchDir,
  getBenchMetadataPath,
  getBenchRequirementsDir,
  getBenchesDir,
  getComponentDir,
  getComponentMetadataPath,
  getComponentResourcesDir,
  getComponentSummaryPath,
  getComponentTaskStateDir,
  getComponentTasksDir,
  getComponentTocPath,
  getTaskMetadataPath,
  getRequirementMetadataPath,
  getResourceDir,
  getResourceFilePath,
  getResourceFilesDir,
  getResourceMetadataPath,
  resolveWorkspaceRoot,
} from "../src/workspace-layout.js";

describe("workspace layout", () => {
  it("resolves the workspace root and benches directory under a project base path", () => {
    const workspaceRoot = resolveWorkspaceRoot("/tmp/benchpilot");

    expect(workspaceRoot).toBe(path.join("/tmp/benchpilot", WORKSPACE_DIRNAME));
    expect(getBenchesDir(workspaceRoot)).toBe(path.join(workspaceRoot, BENCHES_DIRNAME));
  });

  it("derives stable bench and requirement paths from scoped identifiers", () => {
    const workspaceRoot = "/tmp/benchpilot/workspace";

    expect(getBenchDir(workspaceRoot, "bench-crp-biosensor")).toBe(
      path.join(workspaceRoot, "benches", "bench-crp-biosensor"),
    );
    expect(getBenchMetadataPath(workspaceRoot, "bench-crp-biosensor")).toBe(
      path.join(workspaceRoot, "benches", "bench-crp-biosensor", BENCH_METADATA_FILENAME),
    );
    expect(getBenchRequirementsDir(workspaceRoot, "bench-crp-biosensor")).toBe(
      path.join(workspaceRoot, "benches", "bench-crp-biosensor", "requirements"),
    );
    expect(getRequirementMetadataPath(workspaceRoot, "bench-crp-biosensor", "req-assess-novelty")).toBe(
      path.join(workspaceRoot, "benches", "bench-crp-biosensor", "requirements", "req-assess-novelty.json"),
    );
  });

  it("derives component metadata, summary, TOC, and task paths", () => {
    const workspaceRoot = "/tmp/benchpilot/workspace";

    expect(getBenchComponentsDir(workspaceRoot, "bench-crp-biosensor")).toBe(
      path.join(workspaceRoot, "benches", "bench-crp-biosensor", "components"),
    );
    expect(getComponentDir(workspaceRoot, "bench-crp-biosensor", "literature-crp-biosensor")).toBe(
      path.join(workspaceRoot, "benches", "bench-crp-biosensor", "components", "literature-crp-biosensor"),
    );
    expect(getComponentMetadataPath(workspaceRoot, "bench-crp-biosensor", "literature-crp-biosensor")).toBe(
      path.join(
        workspaceRoot,
        "benches",
        "bench-crp-biosensor",
        "components",
        "literature-crp-biosensor",
        COMPONENT_METADATA_FILENAME,
      ),
    );
    expect(getComponentSummaryPath(workspaceRoot, "bench-crp-biosensor", "literature-crp-biosensor")).toBe(
      path.join(
        workspaceRoot,
        "benches",
        "bench-crp-biosensor",
        "components",
        "literature-crp-biosensor",
        COMPONENT_SUMMARY_FILENAME,
      ),
    );
    expect(getComponentTocPath(workspaceRoot, "bench-crp-biosensor", "literature-crp-biosensor")).toBe(
      path.join(
        workspaceRoot,
        "benches",
        "bench-crp-biosensor",
        "components",
        "literature-crp-biosensor",
        COMPONENT_TOC_FILENAME,
      ),
    );
    expect(getComponentTasksDir(workspaceRoot, "bench-crp-biosensor", "literature-crp-biosensor")).toBe(
      path.join(workspaceRoot, "benches", "bench-crp-biosensor", "components", "literature-crp-biosensor", "tasks"),
    );
    expect(getComponentTaskStateDir(workspaceRoot, "bench-crp-biosensor", "literature-crp-biosensor", "pending")).toBe(
      path.join(
        workspaceRoot,
        "benches",
        "bench-crp-biosensor",
        "components",
        "literature-crp-biosensor",
        "tasks",
        "pending",
      ),
    );
    expect(getTaskMetadataPath(workspaceRoot, "bench-crp-biosensor", "literature-crp-biosensor", "pending", "task-001")).toBe(
      path.join(
        workspaceRoot,
        "benches",
        "bench-crp-biosensor",
        "components",
        "literature-crp-biosensor",
        "tasks",
        "pending",
        "task-001.json",
      ),
    );
  });

  it("uses a per-resource directory with resource.json plus a files directory", () => {
    const workspaceRoot = "/tmp/benchpilot/workspace";

    expect(getComponentResourcesDir(workspaceRoot, "bench-crp-biosensor", "literature-crp-biosensor")).toBe(
      path.join(workspaceRoot, "benches", "bench-crp-biosensor", "components", "literature-crp-biosensor", "resources"),
    );
    expect(getResourceDir(workspaceRoot, "bench-crp-biosensor", "literature-crp-biosensor", "lit-0007")).toBe(
      path.join(
        workspaceRoot,
        "benches",
        "bench-crp-biosensor",
        "components",
        "literature-crp-biosensor",
        "resources",
        "lit-0007",
      ),
    );
    expect(getResourceMetadataPath(workspaceRoot, "bench-crp-biosensor", "literature-crp-biosensor", "lit-0007")).toBe(
      path.join(
        workspaceRoot,
        "benches",
        "bench-crp-biosensor",
        "components",
        "literature-crp-biosensor",
        "resources",
        "lit-0007",
        RESOURCE_METADATA_FILENAME,
      ),
    );
    expect(getResourceFilesDir(workspaceRoot, "bench-crp-biosensor", "literature-crp-biosensor", "lit-0007")).toBe(
      path.join(
        workspaceRoot,
        "benches",
        "bench-crp-biosensor",
        "components",
        "literature-crp-biosensor",
        "resources",
        "lit-0007",
        RESOURCE_FILES_DIRNAME,
      ),
    );
    expect(getResourceFilePath(workspaceRoot, "bench-crp-biosensor", "literature-crp-biosensor", "lit-0007", "prior-art.pdf")).toBe(
      path.join(
        workspaceRoot,
        "benches",
        "bench-crp-biosensor",
        "components",
        "literature-crp-biosensor",
        "resources",
        "lit-0007",
        RESOURCE_FILES_DIRNAME,
        "prior-art.pdf",
      ),
    );
    expect(() =>
      getResourceFilePath(workspaceRoot, "bench-crp-biosensor", "literature-crp-biosensor", "lit-0007", "nested/prior-art.pdf"),
    ).toThrow(/basename/);
  });
});

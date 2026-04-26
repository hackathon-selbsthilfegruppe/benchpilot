import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createBench } from "../src/bench.js";
import { createComponentInstance } from "../src/component.js";
import { createRequirement } from "../src/requirement.js";
import { createResource } from "../src/resource.js";
import {
  WorkspaceNotFoundError,
  WorkspaceStore,
  WorkspaceValidationError,
} from "../src/workspace-store.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("workspace store", () => {
  it("roundtrips bench, requirement, component, and resource metadata and refreshes summary/toc files", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "benchpilot-workspace-store-"));
    tempDirs.push(baseDir);

    const store = new WorkspaceStore(baseDir);
    const bench = createBench(
      {
        title: "CRP biosensor",
        question: "Can we build a paper-based electrochemical biosensor for CRP?",
      },
      { now: new Date("2026-04-25T19:00:00.000Z") },
    );
    const requirement = createRequirement(
      {
        benchId: bench.id,
        title: "Assess novelty",
        summary: "Check whether similar work already exists.",
      },
      { now: new Date("2026-04-25T19:05:00.000Z") },
    );
    const component = createComponentInstance(
      {
        benchId: bench.id,
        presetId: "literature",
        name: "Literature — CRP biosensor",
        summary: "Tracks prior work and novelty.",
        requirementIds: [requirement.id],
      },
      { now: new Date("2026-04-25T19:10:00.000Z") },
    );
    const resource = createResource(
      {
        benchId: bench.id,
        componentInstanceId: component.id,
        title: "CRP paper sensor prior art",
        kind: "paper-note",
        description: "Prior-art note",
        summary: "Summary of prior work on CRP paper sensors.",
        supportsRequirementIds: [requirement.id],
        files: [
          {
            filename: "prior-art.md",
            mediaType: "text/markdown",
            description: "Primary markdown note",
            role: "primary",
          },
        ],
        primaryFile: "prior-art.md",
        contentType: "text/markdown",
      },
      { now: new Date("2026-04-25T19:15:00.000Z") },
    );

    await store.writeBench(bench);
    await store.writeRequirement(requirement);
    await store.writeComponent(component);
    await store.writeResource(resource);

    await expect(store.readBench(bench.id)).resolves.toEqual(bench);
    await expect(store.listBenches()).resolves.toEqual([bench]);
    await expect(store.readRequirement(bench.id, requirement.id)).resolves.toEqual(requirement);
    await expect(store.listRequirements(bench.id)).resolves.toEqual([requirement]);
    await expect(store.readComponent(bench.id, component.id)).resolves.toEqual(component);
    await expect(store.listComponents(bench.id)).resolves.toEqual([component]);
    await expect(store.readResource(bench.id, component.id, resource.id)).resolves.toEqual(resource);
    await expect(store.listResources(bench.id, component.id)).resolves.toEqual([resource]);
    await expect(store.readComponentSummary(bench.id, component.id)).resolves.toBe("Tracks prior work and novelty.\n");
    await expect(store.readComponentToc(bench.id, component.id)).resolves.toEqual([
      {
        id: resource.id,
        benchId: bench.id,
        componentInstanceId: component.id,
        title: resource.title,
        kind: resource.kind,
        description: resource.description,
        summary: resource.summary,
        tags: [],
        updatedAt: resource.updatedAt,
      },
    ]);
  });

  it("rejects nested writes when the parent bench or component does not exist", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "benchpilot-workspace-store-"));
    tempDirs.push(baseDir);

    const store = new WorkspaceStore(baseDir);
    const requirement = createRequirement({
      benchId: "bench-crp-biosensor",
      title: "Assess novelty",
      summary: "Check whether similar work already exists.",
    });

    await expect(store.writeRequirement(requirement)).rejects.toBeInstanceOf(WorkspaceValidationError);

    const resource = createResource({
      benchId: "bench-crp-biosensor",
      componentInstanceId: "literature-crp-biosensor",
      title: "CRP paper sensor prior art",
      kind: "paper-note",
      description: "Prior-art note",
      summary: "Summary of prior work on CRP paper sensors.",
    });

    await expect(store.writeResource(resource)).rejects.toBeInstanceOf(WorkspaceValidationError);
  });

  it("surfaces invalid JSON and missing files as explicit workspace errors", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "benchpilot-workspace-store-"));
    tempDirs.push(baseDir);

    const store = new WorkspaceStore(baseDir);

    await expect(store.readBench("bench-missing")).rejects.toBeInstanceOf(WorkspaceNotFoundError);

    const bench = createBench({
      title: "CRP biosensor",
      question: "Can we build a paper-based electrochemical biosensor for CRP?",
    });
    await store.writeBench(bench);

    const benchFile = path.join(baseDir, "workspace", "benches", bench.id, "bench.json");
    await writeFile(benchFile, "{not-json}\n", "utf8");

    await expect(store.readBench(bench.id)).rejects.toBeInstanceOf(WorkspaceValidationError);
  });
});

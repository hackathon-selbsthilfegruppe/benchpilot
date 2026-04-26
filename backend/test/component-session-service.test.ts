import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { BenchReadService } from "../src/bench-read-service.js";
import { createBench } from "../src/bench.js";
import { createComponentInstance } from "../src/component.js";
import { ComponentSessionService, type SessionBootstrapService } from "../src/component-session-service.js";
import { WorkspaceStore } from "../src/workspace-store.js";
import type { RoleDefinition, SessionSummary } from "../src/types.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("component session service", () => {
  it("bootstraps a component-aware session and reuses it on repeated lookup", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "benchpilot-component-session-"));
    tempDirs.push(baseDir);

    const store = new WorkspaceStore(baseDir);
    const bench = createBench({
      title: "CRP biosensor",
      question: "Can we build a paper-based electrochemical biosensor for CRP?",
    });
    const component = createComponentInstance({
      benchId: bench.id,
      presetId: "protocols",
      name: "Protocols — CRP biosensor",
      summary: "Tracks protocol candidates.",
      toolMode: "read-only",
    });
    const reviewer = createComponentInstance({
      benchId: bench.id,
      presetId: "reviewer",
      name: "Reviewer — CRP biosensor",
      summary: "Reviews specialist output.",
    });
    const planner = createComponentInstance({
      benchId: bench.id,
      presetId: "experiment-planner",
      name: "Experiment Planner — CRP biosensor",
      summary: "Integrates specialist output into the final plan.",
    });

    await store.writeBench(bench);
    await store.writeComponent(component);
    await store.writeComponent(reviewer);
    await store.writeComponent(planner);

    const createdRoles: RoleDefinition[] = [];
    const pool = createFakeBootstrapService((role) => {
      createdRoles.push(role);
      return {
        id: `session-${createdRoles.length}`,
        role: {
          id: role.id ?? "generated-role",
          name: role.name,
          description: role.description,
          instructions: role.instructions ?? "",
          cwd: role.cwd,
          toolMode: role.toolMode ?? "full",
        },
        cwd: role.cwd ?? "/tmp/benchpilot",
        status: "idle",
        createdAt: "2026-04-25T19:15:00.000Z",
      };
    });

    const service = new ComponentSessionService(
      pool,
      new BenchReadService(store),
      store,
      path.join(process.cwd(), ".."),
    );

    const session = await service.ensureComponentSession(bench.id, component.id);
    expect(session.role.id).toBe(component.id);
    expect(session.role.name).toBe(component.name);
    expect(session.role.toolMode).toBe("read-only");
    expect(session.role.instructions).toContain("## Component pre-prompt");
    expect(session.role.instructions).toContain("Tracks protocol candidates");
    expect(session.role.instructions).toContain("## BenchPilot backend operations");
    expect(session.role.instructions).toContain(`tasks create --bench ${bench.id} --from ${component.id}`);
    expect(session.role.instructions).toContain("reviewer: ask it to critique concrete outputs");
    expect(session.role.instructions).toContain("experiment-planner: ask it to integrate specialist outputs");
    expect(session.cwd).toBe(path.join(store.workspaceRoot, "benches", bench.id, "components", component.id));

    const reused = await service.ensureComponentSession(bench.id, component.id);
    expect(reused.id).toBe(session.id);
    expect(createdRoles).toHaveLength(1);
    expect(service.lookupComponentSession(bench.id, component.id)?.id).toBe(session.id);
  });

  it("frames reviewer task-run sessions as review work", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "benchpilot-reviewer-task-session-"));
    tempDirs.push(baseDir);

    const store = new WorkspaceStore(baseDir);
    const bench = createBench({
      title: "CRP biosensor",
      question: "Can we build a paper-based electrochemical biosensor for CRP?",
    });
    const reviewer = createComponentInstance({
      benchId: bench.id,
      presetId: "reviewer",
      name: "Reviewer — CRP biosensor",
      summary: "Reviews specialist output.",
    });
    const protocols = createComponentInstance({
      benchId: bench.id,
      presetId: "protocols",
      name: "Protocols — CRP biosensor",
      summary: "Tracks protocol candidates.",
      toolMode: "read-only",
    });

    await store.writeBench(bench);
    await store.writeComponent(reviewer);
    await store.writeComponent(protocols);

    const pool = createFakeBootstrapService((role) => ({
      id: "task-run-1",
      role: {
        id: role.id ?? "generated-role",
        name: role.name,
        description: role.description,
        instructions: role.instructions ?? "",
        cwd: role.cwd,
        toolMode: role.toolMode ?? "full",
      },
      cwd: role.cwd ?? "/tmp/benchpilot",
      status: "idle",
      createdAt: "2026-04-25T19:15:00.000Z",
    }));

    const service = new ComponentSessionService(
      pool,
      new BenchReadService(store),
      store,
      path.join(process.cwd(), ".."),
    );

    const session = await service.createTaskRunSession({
      id: "task-review-protocol",
      benchId: bench.id,
      fromComponentInstanceId: protocols.id,
      toComponentInstanceId: reviewer.id,
      title: "Review protocol draft",
      request: "Review the protocol draft for missing controls.",
      status: "running",
      taskSessionId: "task-run-1",
      createdResourceIds: [],
      modifiedResourceIds: [],
      createdAt: "2026-04-25T19:20:00.000Z",
      updatedAt: "2026-04-25T19:20:00.000Z",
    });

    expect(session.role.instructions).toContain("Reviewer task-run framing:");
    expect(session.role.instructions).toContain("This is review-of-X work");
  });

  it("frames experiment-planner task-run sessions as gather-and-integrate work", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "benchpilot-planner-task-session-"));
    tempDirs.push(baseDir);

    const store = new WorkspaceStore(baseDir);
    const bench = createBench({
      title: "CRP biosensor",
      question: "Can we build a paper-based electrochemical biosensor for CRP?",
    });
    const planner = createComponentInstance({
      benchId: bench.id,
      presetId: "experiment-planner",
      name: "Experiment Planner — CRP biosensor",
      summary: "Integrates specialist output into the final plan.",
    });
    const protocols = createComponentInstance({
      benchId: bench.id,
      presetId: "protocols",
      name: "Protocols — CRP biosensor",
      summary: "Tracks protocol candidates.",
      toolMode: "read-only",
    });

    await store.writeBench(bench);
    await store.writeComponent(planner);
    await store.writeComponent(protocols);

    const pool = createFakeBootstrapService((role) => ({
      id: "task-run-1",
      role: {
        id: role.id ?? "generated-role",
        name: role.name,
        description: role.description,
        instructions: role.instructions ?? "",
        cwd: role.cwd,
        toolMode: role.toolMode ?? "full",
      },
      cwd: role.cwd ?? "/tmp/benchpilot",
      status: "idle",
      createdAt: "2026-04-25T19:15:00.000Z",
    }));

    const service = new ComponentSessionService(
      pool,
      new BenchReadService(store),
      store,
      path.join(process.cwd(), ".."),
    );

    const session = await service.createTaskRunSession({
      id: "task-build-plan",
      benchId: bench.id,
      fromComponentInstanceId: protocols.id,
      toComponentInstanceId: planner.id,
      title: "Assemble plan",
      request: "Integrate the protocol and missing inputs into a consolidated plan.",
      status: "running",
      taskSessionId: "task-run-1",
      createdResourceIds: [],
      modifiedResourceIds: [],
      createdAt: "2026-04-25T19:20:00.000Z",
      updatedAt: "2026-04-25T19:20:00.000Z",
    });

    expect(session.role.instructions).toContain("Experiment-planner task-run framing:");
    expect(session.role.instructions).toContain("Gather and integrate current specialist outputs");
  });
});

function createFakeBootstrapService(create: (role: RoleDefinition) => SessionSummary): SessionBootstrapService {
  const sessions = new Map<string, SessionSummary>();
  return {
    list: () => Array.from(sessions.values()),
    createStandbySession: async (role) => {
      const session = create(role);
      sessions.set(session.id, session);
      return session;
    },
  };
}

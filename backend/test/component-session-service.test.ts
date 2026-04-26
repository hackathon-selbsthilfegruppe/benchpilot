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

    await store.writeBench(bench);
    await store.writeComponent(component);

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
    expect(session.cwd).toBe(path.join(store.workspaceRoot, "benches", bench.id, "components", component.id));

    const reused = await service.ensureComponentSession(bench.id, component.id);
    expect(reused.id).toBe(session.id);
    expect(createdRoles).toHaveLength(1);
    expect(service.lookupComponentSession(bench.id, component.id)?.id).toBe(session.id);
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

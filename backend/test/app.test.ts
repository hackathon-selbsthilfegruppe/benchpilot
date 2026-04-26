import { Buffer } from "node:buffer";
import type { Server } from "node:http";

import { afterEach, describe, expect, it } from "vitest";

import { createApp, type SessionService } from "../src/app.js";
import type { BenchReadService } from "../src/bench-read-service.js";
import type { BenchWriteService } from "../src/bench-write-service.js";
import type { ComponentSessionService } from "../src/component-session-service.js";
import type { TaskService } from "../src/task-service.js";
import type { RoleDefinition, SessionSummary, StreamEnvelope } from "../src/types.js";

const createdServers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    createdServers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) reject(error);
            else resolve();
          });
        }),
    ),
  );
});

describe("createApp", () => {
  it("streams normalized prompt events from the session service", async () => {
    const fakePool = createFakePool({
      prompt: async (_sessionId, _message, onEvent) => {
        onEvent({ type: "session_started", sessionId: "session-1", roleId: "orchestrator" });
        onEvent({ type: "message_delta", sessionId: "session-1", roleId: "orchestrator", text: "Hello" });
        onEvent({ type: "message_completed", sessionId: "session-1", roleId: "orchestrator", assistantText: "Hello" });
      },
    });

    const response = await request(
      createApp(fakePool),
      "/api/agent-sessions/session-1/prompt",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "Say hello" }),
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/x-ndjson");
    expect(parseNdjson(await response.text())).toEqual([
      { type: "session_started", sessionId: "session-1", roleId: "orchestrator" },
      { type: "message_delta", sessionId: "session-1", roleId: "orchestrator", text: "Hello" },
      { type: "message_completed", sessionId: "session-1", roleId: "orchestrator", assistantText: "Hello" },
    ]);
  });

  it("returns a streamed session_error when prompting fails before any chunks", async () => {
    const fakePool = createFakePool({
      prompt: async () => {
        throw new Error("boom");
      },
    });

    const response = await request(
      createApp(fakePool),
      "/api/agent-sessions/session-1/prompt",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "Fail please" }),
      },
    );

    expect(response.status).toBe(200);
    expect(parseNdjson(await response.text())).toEqual([
      { type: "session_error", sessionId: "session-1", roleId: "unknown", error: "boom" },
    ]);
  });

  it("creates sessions through the injected session service", async () => {
    const createdRoles: RoleDefinition[] = [];
    const fakePool = createFakePool({
      createStandbySession: async (role) => {
        createdRoles.push(role);
        return createSessionSummary(role);
      },
    });

    const response = await request(createApp(fakePool), "/api/agent-sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: { id: "literature", name: "Literature Research" } }),
    });

    expect(response.status).toBe(201);
    expect(createdRoles).toEqual([{ id: "literature", name: "Literature Research" }]);
    expect(await response.json()).toEqual({
      session: createSessionSummary({ id: "literature", name: "Literature Research" }),
    });
  });

  it("serves bench, requirement, and component reads through the bench read service", async () => {
    const benchReadService = createFakeBenchReadService({
      listBenches: async () => [
        {
          id: "bench-crp-biosensor",
          title: "CRP biosensor",
          question: "Can we build a paper-based electrochemical biosensor for CRP?",
          status: "active",
          updatedAt: "2026-04-25T19:12:00.000Z",
        },
      ],
      getBench: async () => ({
        id: "bench-crp-biosensor",
        title: "CRP biosensor",
        question: "Can we build a paper-based electrochemical biosensor for CRP?",
        normalizedQuestion: "A paper-based electrochemical biosensor will detect CRP in whole blood.",
        status: "active",
        createdAt: "2026-04-25T19:10:00.000Z",
        updatedAt: "2026-04-25T19:12:00.000Z",
      }),
      listRequirements: async () => [
        {
          id: "req-assess-novelty",
          benchId: "bench-crp-biosensor",
          title: "Assess novelty and prior art",
          summary: "Determine whether closely similar work already exists.",
          status: "open",
          componentInstanceIds: ["literature-crp-biosensor"],
          resourceIds: [],
          createdAt: "2026-04-25T19:11:00.000Z",
          updatedAt: "2026-04-25T19:12:00.000Z",
        },
      ],
      listComponents: async () => [
        {
          id: "literature-crp-biosensor",
          benchId: "bench-crp-biosensor",
          presetId: "literature",
          name: "Literature — CRP biosensor",
          summary: "Tracks prior work, novelty signal, and references relevant to the CRP biosensor hypothesis.",
          requirementIds: ["req-assess-novelty"],
          toolMode: "read-only",
          resourceCount: 1,
          status: "active",
          createdAt: "2026-04-25T19:10:00.000Z",
          updatedAt: "2026-04-25T19:12:00.000Z",
        },
      ],
      getComponent: async () => ({
        id: "literature-crp-biosensor",
        benchId: "bench-crp-biosensor",
        presetId: "literature",
        name: "Literature — CRP biosensor",
        summary: "Tracks prior work, novelty signal, and references relevant to the CRP biosensor hypothesis.",
        requirementIds: ["req-assess-novelty"],
        toolMode: "read-only",
        resourceCount: 1,
        status: "active",
        createdAt: "2026-04-25T19:10:00.000Z",
        updatedAt: "2026-04-25T19:12:00.000Z",
      }),
      listComponentResources: async () => [
        {
          id: "lit-0007",
          benchId: "bench-crp-biosensor",
          componentInstanceId: "literature-crp-biosensor",
          title: "CRP paper sensor prior art",
          kind: "paper-note",
          description: "Prior-art note",
          summary: "Summary of prior work on CRP paper sensors and likely overlap with the current hypothesis.",
          tags: ["diagnostics", "crp"],
          updatedAt: "2026-04-25T19:10:00.000Z",
        },
      ],
      getComponentResource: async () => ({
        id: "lit-0007",
        benchId: "bench-crp-biosensor",
        componentInstanceId: "literature-crp-biosensor",
        producedByComponentInstanceId: "literature-crp-biosensor",
        title: "CRP paper sensor prior art",
        kind: "paper-note",
        description: "Prior-art note",
        summary: "Summary of prior work on CRP paper sensors and likely overlap with the current hypothesis.",
        tags: ["diagnostics", "crp"],
        files: [
          {
            filename: "prior-art.md",
            mediaType: "text/markdown",
            description: "Markdown notes",
            role: "primary",
          },
        ],
        primaryFile: "prior-art.md",
        contentType: "text/markdown",
        supportsRequirementIds: ["req-assess-novelty"],
        derivedFromResourceIds: [],
        status: "ready",
        createdAt: "2026-04-25T19:10:00.000Z",
        updatedAt: "2026-04-25T19:10:00.000Z",
        content: "# Notes\n\nFull markdown body here...",
      }),
      getComponentContext: async () => ({
        bench: {
          id: "bench-crp-biosensor",
          title: "CRP biosensor",
          question: "Can we build a paper-based electrochemical biosensor for CRP?",
          status: "active",
          updatedAt: "2026-04-25T19:12:00.000Z",
        },
        self: {
          component: {
            id: "literature-crp-biosensor",
            benchId: "bench-crp-biosensor",
            presetId: "literature",
            name: "Literature — CRP biosensor",
            summary: "Tracks prior work, novelty signal, and references relevant to the CRP biosensor hypothesis.",
            requirementIds: ["req-assess-novelty"],
            toolMode: "read-only",
            resourceCount: 1,
            status: "active",
            createdAt: "2026-04-25T19:10:00.000Z",
            updatedAt: "2026-04-25T19:12:00.000Z",
          },
          summary: "Tracks prior work, novelty signal, and references relevant to the CRP biosensor hypothesis.\n",
          toc: [
            {
              id: "lit-0007",
              benchId: "bench-crp-biosensor",
              componentInstanceId: "literature-crp-biosensor",
              title: "CRP paper sensor prior art",
              kind: "paper-note",
              description: "Prior-art note",
              summary: "Summary of prior work on CRP paper sensors and likely overlap with the current hypothesis.",
              tags: ["diagnostics", "crp"],
              updatedAt: "2026-04-25T19:10:00.000Z",
            },
          ],
        },
        others: [
          {
            component: {
              id: "budget-crp-biosensor",
              benchId: "bench-crp-biosensor",
              presetId: "budget",
              name: "Budget — CRP biosensor",
              summary: "Tracks costs and assumptions.",
              requirementIds: [],
              toolMode: "read-only",
              resourceCount: 0,
              status: "active",
              createdAt: "2026-04-25T19:10:00.000Z",
              updatedAt: "2026-04-25T19:12:00.000Z",
            },
            summary: "Tracks costs and assumptions.\n",
            toc: [],
          },
        ],
      }),
    });

    const app = createApp(createFakePool({}), benchReadService);

    const benchesResponse = await request(app, "/api/benches", { method: "GET" });
    expect(benchesResponse.status).toBe(200);
    expect(await benchesResponse.json()).toEqual({
      benches: [
        {
          id: "bench-crp-biosensor",
          title: "CRP biosensor",
          question: "Can we build a paper-based electrochemical biosensor for CRP?",
          status: "active",
          updatedAt: "2026-04-25T19:12:00.000Z",
        },
      ],
    });

    const benchResponse = await request(app, "/api/benches/bench-crp-biosensor", { method: "GET" });
    expect(benchResponse.status).toBe(200);
    expect(await benchResponse.json()).toEqual({
      bench: {
        id: "bench-crp-biosensor",
        title: "CRP biosensor",
        question: "Can we build a paper-based electrochemical biosensor for CRP?",
        normalizedQuestion: "A paper-based electrochemical biosensor will detect CRP in whole blood.",
        status: "active",
        createdAt: "2026-04-25T19:10:00.000Z",
        updatedAt: "2026-04-25T19:12:00.000Z",
      },
    });

    const requirementsResponse = await request(app, "/api/benches/bench-crp-biosensor/requirements", { method: "GET" });
    expect(requirementsResponse.status).toBe(200);
    expect(await requirementsResponse.json()).toEqual({
      requirements: [
        {
          id: "req-assess-novelty",
          benchId: "bench-crp-biosensor",
          title: "Assess novelty and prior art",
          summary: "Determine whether closely similar work already exists.",
          status: "open",
          componentInstanceIds: ["literature-crp-biosensor"],
          resourceIds: [],
          createdAt: "2026-04-25T19:11:00.000Z",
          updatedAt: "2026-04-25T19:12:00.000Z",
        },
      ],
    });

    const componentsResponse = await request(app, "/api/benches/bench-crp-biosensor/components", { method: "GET" });
    expect(componentsResponse.status).toBe(200);
    expect(await componentsResponse.json()).toEqual({
      components: [
        {
          id: "literature-crp-biosensor",
          benchId: "bench-crp-biosensor",
          presetId: "literature",
          name: "Literature — CRP biosensor",
          summary: "Tracks prior work, novelty signal, and references relevant to the CRP biosensor hypothesis.",
          requirementIds: ["req-assess-novelty"],
          toolMode: "read-only",
          resourceCount: 1,
          status: "active",
          createdAt: "2026-04-25T19:10:00.000Z",
          updatedAt: "2026-04-25T19:12:00.000Z",
        },
      ],
    });

    const componentResponse = await request(app, "/api/benches/bench-crp-biosensor/components/literature-crp-biosensor", { method: "GET" });
    expect(componentResponse.status).toBe(200);
    expect(await componentResponse.json()).toEqual({
      component: {
        id: "literature-crp-biosensor",
        benchId: "bench-crp-biosensor",
        presetId: "literature",
        name: "Literature — CRP biosensor",
        summary: "Tracks prior work, novelty signal, and references relevant to the CRP biosensor hypothesis.",
        requirementIds: ["req-assess-novelty"],
        toolMode: "read-only",
        resourceCount: 1,
        status: "active",
        createdAt: "2026-04-25T19:10:00.000Z",
        updatedAt: "2026-04-25T19:12:00.000Z",
      },
    });

    const resourcesResponse = await request(app, "/api/benches/bench-crp-biosensor/components/literature-crp-biosensor/resources", { method: "GET" });
    expect(resourcesResponse.status).toBe(200);
    expect(await resourcesResponse.json()).toEqual({
      resources: [
        {
          id: "lit-0007",
          benchId: "bench-crp-biosensor",
          componentInstanceId: "literature-crp-biosensor",
          title: "CRP paper sensor prior art",
          kind: "paper-note",
          description: "Prior-art note",
          summary: "Summary of prior work on CRP paper sensors and likely overlap with the current hypothesis.",
          tags: ["diagnostics", "crp"],
          updatedAt: "2026-04-25T19:10:00.000Z",
        },
      ],
    });

    const resourceResponse = await request(app, "/api/benches/bench-crp-biosensor/components/literature-crp-biosensor/resources/lit-0007", { method: "GET" });
    expect(resourceResponse.status).toBe(200);
    expect(await resourceResponse.json()).toEqual({
      resource: {
        id: "lit-0007",
        benchId: "bench-crp-biosensor",
        componentInstanceId: "literature-crp-biosensor",
        producedByComponentInstanceId: "literature-crp-biosensor",
        title: "CRP paper sensor prior art",
        kind: "paper-note",
        description: "Prior-art note",
        summary: "Summary of prior work on CRP paper sensors and likely overlap with the current hypothesis.",
        tags: ["diagnostics", "crp"],
        files: [
          {
            filename: "prior-art.md",
            mediaType: "text/markdown",
            description: "Markdown notes",
            role: "primary",
          },
        ],
        primaryFile: "prior-art.md",
        contentType: "text/markdown",
        supportsRequirementIds: ["req-assess-novelty"],
        derivedFromResourceIds: [],
        status: "ready",
        createdAt: "2026-04-25T19:10:00.000Z",
        updatedAt: "2026-04-25T19:10:00.000Z",
        content: "# Notes\n\nFull markdown body here...",
      },
    });

    const contextResponse = await request(app, "/api/benches/bench-crp-biosensor/context/components/literature-crp-biosensor", { method: "GET" });
    expect(contextResponse.status).toBe(200);
    expect(await contextResponse.json()).toEqual({
      context: {
        bench: {
          id: "bench-crp-biosensor",
          title: "CRP biosensor",
          question: "Can we build a paper-based electrochemical biosensor for CRP?",
          status: "active",
          updatedAt: "2026-04-25T19:12:00.000Z",
        },
        self: {
          component: {
            id: "literature-crp-biosensor",
            benchId: "bench-crp-biosensor",
            presetId: "literature",
            name: "Literature — CRP biosensor",
            summary: "Tracks prior work, novelty signal, and references relevant to the CRP biosensor hypothesis.",
            requirementIds: ["req-assess-novelty"],
            toolMode: "read-only",
            resourceCount: 1,
            status: "active",
            createdAt: "2026-04-25T19:10:00.000Z",
            updatedAt: "2026-04-25T19:12:00.000Z",
          },
          summary: "Tracks prior work, novelty signal, and references relevant to the CRP biosensor hypothesis.\n",
          toc: [
            {
              id: "lit-0007",
              benchId: "bench-crp-biosensor",
              componentInstanceId: "literature-crp-biosensor",
              title: "CRP paper sensor prior art",
              kind: "paper-note",
              description: "Prior-art note",
              summary: "Summary of prior work on CRP paper sensors and likely overlap with the current hypothesis.",
              tags: ["diagnostics", "crp"],
              updatedAt: "2026-04-25T19:10:00.000Z",
            },
          ],
        },
        others: [
          {
            component: {
              id: "budget-crp-biosensor",
              benchId: "bench-crp-biosensor",
              presetId: "budget",
              name: "Budget — CRP biosensor",
              summary: "Tracks costs and assumptions.",
              requirementIds: [],
              toolMode: "read-only",
              resourceCount: 0,
              status: "active",
              createdAt: "2026-04-25T19:10:00.000Z",
              updatedAt: "2026-04-25T19:12:00.000Z",
            },
            summary: "Tracks costs and assumptions.\n",
            toc: [],
          },
        ],
      },
    });
  });

  it("creates resources through the bench write service", async () => {
    const benchWriteService = createFakeBenchWriteService({
      createResource: async () => ({
        id: "manual-notes",
        benchId: "bench-crp-biosensor",
        componentInstanceId: "literature-crp-biosensor",
        producedByComponentInstanceId: "literature-crp-biosensor",
        title: "Manual notes",
        kind: "lab-note",
        description: "Markdown notes for later browsing.",
        summary: "Notes about the experimental setup.",
        tags: [],
        files: [
          {
            filename: "notes.md",
            mediaType: "text/markdown",
            description: "Primary markdown notes",
            role: "primary",
          },
        ],
        primaryFile: "notes.md",
        contentType: "text/markdown",
        supportsRequirementIds: [],
        derivedFromResourceIds: [],
        status: "ready",
        createdAt: "2026-04-25T19:10:00.000Z",
        updatedAt: "2026-04-25T19:10:00.000Z",
      }),
      updateResource: async () => ({
        id: "manual-notes",
        benchId: "bench-crp-biosensor",
        componentInstanceId: "literature-crp-biosensor",
        producedByComponentInstanceId: "literature-crp-biosensor",
        title: "Manual notes",
        kind: "lab-note",
        description: "Markdown notes for later browsing.",
        summary: "Updated notes about the experimental setup.",
        tags: [],
        files: [
          {
            filename: "notes.md",
            mediaType: "text/markdown",
            description: "Updated markdown notes",
            role: "primary",
          },
        ],
        primaryFile: "notes.md",
        contentType: "text/markdown",
        supportsRequirementIds: [],
        derivedFromResourceIds: [],
        status: "ready",
        createdAt: "2026-04-25T19:10:00.000Z",
        updatedAt: "2026-04-25T19:11:00.000Z",
      }),
      updateComponentSummary: async () => ({
        id: "literature-crp-biosensor",
        benchId: "bench-crp-biosensor",
        presetId: "literature",
        name: "Literature — CRP biosensor",
        summary: "Updated public summary.",
        requirementIds: ["req-assess-novelty"],
        toolMode: "read-only",
        resourceCount: 1,
        status: "active",
        createdAt: "2026-04-25T19:10:00.000Z",
        updatedAt: "2026-04-25T19:12:00.000Z",
      }),
    });

    const componentSessionService = createFakeComponentSessionService({
      ensureComponentSession: async () => createSessionSummary({ id: "literature-crp-biosensor", name: "Literature" }),
    });
    const taskService = createFakeTaskService({
      createTask: async () => ({
        id: "task-review-prior-work-overlap",
        benchId: "bench-crp-biosensor",
        fromComponentInstanceId: "orchestrator-crp-biosensor",
        toComponentInstanceId: "literature-crp-biosensor",
        title: "Review prior work overlap",
        request: "Check whether closely related CRP protocols already exist.",
        status: "pending",
        createdResourceIds: [],
        modifiedResourceIds: [],
        createdAt: "2026-04-25T19:20:00.000Z",
        updatedAt: "2026-04-25T19:20:00.000Z",
      }),
      listTasks: async () => [
        {
          id: "task-review-prior-work-overlap",
          benchId: "bench-crp-biosensor",
          fromComponentInstanceId: "orchestrator-crp-biosensor",
          toComponentInstanceId: "literature-crp-biosensor",
          title: "Review prior work overlap",
          request: "Check whether closely related CRP protocols already exist.",
          status: "pending",
          createdResourceIds: [],
          modifiedResourceIds: [],
          createdAt: "2026-04-25T19:20:00.000Z",
          updatedAt: "2026-04-25T19:20:00.000Z",
        },
      ],
      getTask: async () => ({
        id: "task-review-prior-work-overlap",
        benchId: "bench-crp-biosensor",
        fromComponentInstanceId: "orchestrator-crp-biosensor",
        toComponentInstanceId: "literature-crp-biosensor",
        title: "Review prior work overlap",
        request: "Check whether closely related CRP protocols already exist.",
        status: "pending",
        createdResourceIds: [],
        modifiedResourceIds: [],
        createdAt: "2026-04-25T19:20:00.000Z",
        updatedAt: "2026-04-25T19:20:00.000Z",
      }),
      completeTask: async () => ({
        id: "task-review-prior-work-overlap",
        benchId: "bench-crp-biosensor",
        fromComponentInstanceId: "orchestrator-crp-biosensor",
        toComponentInstanceId: "literature-crp-biosensor",
        title: "Review prior work overlap",
        request: "Check whether closely related CRP protocols already exist.",
        status: "completed",
        resultText: "Similar work exists.",
        resultResourceId: "lit-0007",
        createdResourceIds: ["lit-0007"],
        modifiedResourceIds: [],
        createdAt: "2026-04-25T19:20:00.000Z",
        updatedAt: "2026-04-25T19:24:00.000Z",
        completedAt: "2026-04-25T19:24:00.000Z",
      }),
      getTaskResult: async () => ({
        taskId: "task-review-prior-work-overlap",
        status: "completed",
        resultText: "Similar work exists.",
        resultResourceId: "lit-0007",
        createdResourceIds: ["lit-0007"],
        modifiedResourceIds: [],
        completedAt: "2026-04-25T19:24:00.000Z",
      }),
    });

    const app = createApp(createFakePool({}), undefined, benchWriteService, componentSessionService, taskService);

    const response = await request(
      app,
      "/api/benches/bench-crp-biosensor/components/literature-crp-biosensor/resources",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          actor: {
            benchId: "bench-crp-biosensor",
            componentInstanceId: "literature-crp-biosensor",
            presetId: "literature",
          },
          resource: {
            benchId: "bench-crp-biosensor",
            componentInstanceId: "literature-crp-biosensor",
            title: "Manual notes",
            kind: "lab-note",
            description: "Markdown notes for later browsing.",
            summary: "Notes about the experimental setup.",
          },
          files: [
            {
              filename: "notes.md",
              mediaType: "text/markdown",
              description: "Primary markdown notes",
              role: "primary",
              contentBase64: Buffer.from("# Notes\nhello", "utf8").toString("base64"),
            },
          ],
          primaryFilename: "notes.md",
        }),
      },
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      resource: {
        id: "manual-notes",
        benchId: "bench-crp-biosensor",
        componentInstanceId: "literature-crp-biosensor",
        producedByComponentInstanceId: "literature-crp-biosensor",
        title: "Manual notes",
        kind: "lab-note",
        description: "Markdown notes for later browsing.",
        summary: "Notes about the experimental setup.",
        tags: [],
        files: [
          {
            filename: "notes.md",
            mediaType: "text/markdown",
            description: "Primary markdown notes",
            role: "primary",
          },
        ],
        primaryFile: "notes.md",
        contentType: "text/markdown",
        supportsRequirementIds: [],
        derivedFromResourceIds: [],
        status: "ready",
        createdAt: "2026-04-25T19:10:00.000Z",
        updatedAt: "2026-04-25T19:10:00.000Z",
      },
    });

    const patchResponse = await request(
      app,
      "/api/benches/bench-crp-biosensor/components/literature-crp-biosensor/resources/manual-notes",
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          actor: {
            benchId: "bench-crp-biosensor",
            componentInstanceId: "literature-crp-biosensor",
            presetId: "literature",
          },
          resource: {
            summary: "Updated notes about the experimental setup.",
          },
          files: [
            {
              filename: "notes.md",
              mediaType: "text/markdown",
              description: "Updated markdown notes",
              role: "primary",
              contentBase64: Buffer.from("# Notes\nupdated", "utf8").toString("base64"),
            },
          ],
        }),
      },
    );

    expect(patchResponse.status).toBe(200);
    expect(await patchResponse.json()).toEqual({
      resource: {
        id: "manual-notes",
        benchId: "bench-crp-biosensor",
        componentInstanceId: "literature-crp-biosensor",
        producedByComponentInstanceId: "literature-crp-biosensor",
        title: "Manual notes",
        kind: "lab-note",
        description: "Markdown notes for later browsing.",
        summary: "Updated notes about the experimental setup.",
        tags: [],
        files: [
          {
            filename: "notes.md",
            mediaType: "text/markdown",
            description: "Updated markdown notes",
            role: "primary",
          },
        ],
        primaryFile: "notes.md",
        contentType: "text/markdown",
        supportsRequirementIds: [],
        derivedFromResourceIds: [],
        status: "ready",
        createdAt: "2026-04-25T19:10:00.000Z",
        updatedAt: "2026-04-25T19:11:00.000Z",
      },
    });

    const summaryResponse = await request(
      app,
      "/api/benches/bench-crp-biosensor/components/literature-crp-biosensor/summary",
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          actor: {
            benchId: "bench-crp-biosensor",
            componentInstanceId: "literature-crp-biosensor",
            presetId: "literature",
          },
          summary: "Updated public summary.",
        }),
      },
    );

    expect(summaryResponse.status).toBe(200);
    expect(await summaryResponse.json()).toEqual({
      component: {
        id: "literature-crp-biosensor",
        benchId: "bench-crp-biosensor",
        presetId: "literature",
        name: "Literature — CRP biosensor",
        summary: "Updated public summary.",
        requirementIds: ["req-assess-novelty"],
        toolMode: "read-only",
        resourceCount: 1,
        status: "active",
        createdAt: "2026-04-25T19:10:00.000Z",
        updatedAt: "2026-04-25T19:12:00.000Z",
      },
    });

    const componentSessionResponse = await request(
      app,
      "/api/benches/bench-crp-biosensor/components/literature-crp-biosensor/session",
      { method: "POST", headers: { "content-type": "application/json" }, body: "{}" },
    );
    expect(componentSessionResponse.status).toBe(201);
    expect(await componentSessionResponse.json()).toEqual({
      session: createSessionSummary({ id: "literature-crp-biosensor", name: "Literature" }),
    });

    const prewarmResponse = await request(
      app,
      "/api/component-sessions/prewarm",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          components: [
            {
              benchId: "bench-crp-biosensor",
              componentInstanceId: "literature-crp-biosensor",
            },
          ],
        }),
      },
    );
    expect(prewarmResponse.status).toBe(201);
    expect(await prewarmResponse.json()).toEqual({
      sessions: [createSessionSummary({ id: "literature-crp-biosensor", name: "Literature" })],
    });

    const taskCreateResponse = await request(
      app,
      "/api/tasks",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          actor: {
            benchId: "bench-crp-biosensor",
            componentInstanceId: "orchestrator-crp-biosensor",
            presetId: "orchestrator",
          },
          fromComponentInstanceId: "orchestrator-crp-biosensor",
          toComponentInstanceId: "literature-crp-biosensor",
          title: "Review prior work overlap",
          request: "Check whether closely related CRP protocols already exist.",
        }),
      },
    );
    expect(taskCreateResponse.status).toBe(201);

    const tasksResponse = await request(app, "/api/tasks?benchId=bench-crp-biosensor", { method: "GET" });
    expect(tasksResponse.status).toBe(200);
    expect(await tasksResponse.json()).toEqual({
      tasks: [
        {
          id: "task-review-prior-work-overlap",
          benchId: "bench-crp-biosensor",
          fromComponentInstanceId: "orchestrator-crp-biosensor",
          toComponentInstanceId: "literature-crp-biosensor",
          title: "Review prior work overlap",
          request: "Check whether closely related CRP protocols already exist.",
          status: "pending",
          createdResourceIds: [],
          modifiedResourceIds: [],
          createdAt: "2026-04-25T19:20:00.000Z",
          updatedAt: "2026-04-25T19:20:00.000Z",
        },
      ],
    });

    const taskResponse = await request(app, "/api/tasks/task-review-prior-work-overlap?benchId=bench-crp-biosensor", { method: "GET" });
    expect(taskResponse.status).toBe(200);
    expect(await taskResponse.json()).toEqual({
      task: {
        id: "task-review-prior-work-overlap",
        benchId: "bench-crp-biosensor",
        fromComponentInstanceId: "orchestrator-crp-biosensor",
        toComponentInstanceId: "literature-crp-biosensor",
        title: "Review prior work overlap",
        request: "Check whether closely related CRP protocols already exist.",
        status: "pending",
        createdResourceIds: [],
        modifiedResourceIds: [],
        createdAt: "2026-04-25T19:20:00.000Z",
        updatedAt: "2026-04-25T19:20:00.000Z",
      },
    });

    const completeResponse = await request(
      app,
      "/api/tasks/task-review-prior-work-overlap/result",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          benchId: "bench-crp-biosensor",
          actor: {
            benchId: "bench-crp-biosensor",
            componentInstanceId: "literature-crp-biosensor",
            presetId: "literature",
          },
          resultText: "Similar work exists.",
          resultResourceId: "lit-0007",
          createdResourceIds: ["lit-0007"],
          modifiedResourceIds: [],
        }),
      },
    );
    expect(completeResponse.status).toBe(200);
    expect(await completeResponse.json()).toEqual({
      task: {
        id: "task-review-prior-work-overlap",
        benchId: "bench-crp-biosensor",
        fromComponentInstanceId: "orchestrator-crp-biosensor",
        toComponentInstanceId: "literature-crp-biosensor",
        title: "Review prior work overlap",
        request: "Check whether closely related CRP protocols already exist.",
        status: "completed",
        resultText: "Similar work exists.",
        resultResourceId: "lit-0007",
        createdResourceIds: ["lit-0007"],
        modifiedResourceIds: [],
        createdAt: "2026-04-25T19:20:00.000Z",
        updatedAt: "2026-04-25T19:24:00.000Z",
        completedAt: "2026-04-25T19:24:00.000Z",
      },
    });

    const resultResponse = await request(app, "/api/tasks/task-review-prior-work-overlap/result?benchId=bench-crp-biosensor", { method: "GET" });
    expect(resultResponse.status).toBe(200);
    expect(await resultResponse.json()).toEqual({
      result: {
        taskId: "task-review-prior-work-overlap",
        status: "completed",
        resultText: "Similar work exists.",
        resultResourceId: "lit-0007",
        createdResourceIds: ["lit-0007"],
        modifiedResourceIds: [],
        completedAt: "2026-04-25T19:24:00.000Z",
      },
    });
  });
});

function createFakePool(overrides: Partial<SessionService>): SessionService {
  return {
    list: () => [],
    createStandbySession: async (role) => createSessionSummary(role),
    prompt: async (_sessionId, _message, _onEvent) => undefined,
    dispose: async () => true,
    ...overrides,
  };
}

function createFakeBenchReadService(overrides: Partial<BenchReadService>): BenchReadService {
  return {
    listBenches: async () => [],
    getBench: async () => {
      throw new Error("missing bench");
    },
    listRequirements: async () => [],
    listComponents: async () => [],
    getComponent: async () => {
      throw new Error("missing component");
    },
    listComponentResources: async () => [],
    getComponentResource: async () => {
      throw new Error("missing resource");
    },
    getComponentContext: async () => {
      throw new Error("missing context");
    },
    ...overrides,
  } satisfies BenchReadService;
}

function createFakeBenchWriteService(overrides: Partial<BenchWriteService>): BenchWriteService {
  return {
    createResource: async () => {
      throw new Error("missing createResource");
    },
    updateResource: async () => {
      throw new Error("missing updateResource");
    },
    updateComponentSummary: async () => {
      throw new Error("missing updateComponentSummary");
    },
    ...overrides,
  } as BenchWriteService;
}

function createFakeComponentSessionService(overrides: Partial<ComponentSessionService>): ComponentSessionService {
  return {
    ensureComponentSession: async () => {
      throw new Error("missing ensureComponentSession");
    },
    lookupComponentSession: () => null,
    ...overrides,
  } as ComponentSessionService;
}

function createFakeTaskService(overrides: Partial<TaskService>): TaskService {
  return {
    createTask: async () => {
      throw new Error("missing createTask");
    },
    listTasks: async () => [],
    getTask: async () => {
      throw new Error("missing getTask");
    },
    completeTask: async () => {
      throw new Error("missing completeTask");
    },
    getTaskResult: async () => {
      throw new Error("missing getTaskResult");
    },
    ...overrides,
  } as TaskService;
}

function createSessionSummary(role: RoleDefinition): SessionSummary {
  return {
    id: "session-1",
    role: {
      id: role.id ?? "generated-role",
      name: role.name,
      description: role.description,
      instructions: role.instructions ?? "",
      cwd: role.cwd,
      toolMode: role.toolMode ?? "full",
    },
    cwd: "/tmp/benchpilot/literature",
    status: "idle",
    createdAt: "2026-04-25T00:00:00.000Z",
  };
}

async function request(app: ReturnType<typeof createApp>, pathname: string, init: RequestInit): Promise<Response> {
  const server = app.listen(0);
  createdServers.push(server);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind test server");
  }
  return fetch(`http://127.0.0.1:${address.port}${pathname}`, init);
}

function parseNdjson(input: string): StreamEnvelope[] {
  return input
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as StreamEnvelope);
}

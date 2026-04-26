import { Buffer } from "node:buffer";
import { mkdtemp, rm } from "node:fs/promises";
import type { Server } from "node:http";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createApp, type SessionService } from "../src/app.js";
import { BenchReadService } from "../src/bench-read-service.js";
import { createBench } from "../src/bench.js";
import { createComponentInstance } from "../src/component.js";
import { createRequirement } from "../src/requirement.js";
import { ResourceIngestionService } from "../src/resource-ingestion-service.js";
import { parseResourceIngestionRequest } from "../src/resource-ingestion.js";
import type { RoleDefinition, SessionSummary, StreamEnvelope } from "../src/types.js";
import { WorkspaceStore } from "../src/workspace-store.js";

const tempDirs: string[] = [];
const createdServers: Server[] = [];

afterEach(async () => {
  await Promise.all(createdServers.splice(0).map(closeServer));
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("read api integration", () => {
  it("serves the full bench/component/resource read slice from the workspace-backed services", async () => {
    const { app, bench, requirement, literatureComponent, budgetComponent, markdownResourceId, pdfResourceId } = await createReadApiApp();

    const benchesResponse = await request(app, "/api/benches", { method: "GET" });
    expect(benchesResponse.status).toBe(200);
    expect(await benchesResponse.json()).toEqual({
      benches: [
        {
          id: bench.id,
          title: bench.title,
          question: bench.question,
          status: bench.status,
          updatedAt: bench.updatedAt,
        },
      ],
    });

    const requirementsResponse = await request(app, `/api/benches/${bench.id}/requirements`, { method: "GET" });
    expect(requirementsResponse.status).toBe(200);
    expect(await requirementsResponse.json()).toEqual({ requirements: [requirement] });

    const componentsResponse = await request(app, `/api/benches/${bench.id}/components`, { method: "GET" });
    expect(componentsResponse.status).toBe(200);
    expect(await componentsResponse.json()).toEqual({
      components: [
        {
          ...budgetComponent,
          resourceCount: 0,
        },
        {
          ...literatureComponent,
          resourceCount: 2,
        },
      ],
    });

    const resourcesResponse = await request(app, `/api/benches/${bench.id}/components/${literatureComponent.id}/resources`, { method: "GET" });
    expect(resourcesResponse.status).toBe(200);
    const resourcesBody = await resourcesResponse.json();
    expect(resourcesBody.resources).toHaveLength(2);
    expect(resourcesBody.resources.map((resource: any) => resource.id).sort()).toEqual([markdownResourceId, pdfResourceId].sort());
    expect(resourcesBody.resources.every((resource: any) => !("files" in resource))).toBe(true);

    const markdownDetailResponse = await request(app, `/api/benches/${bench.id}/components/${literatureComponent.id}/resources/${markdownResourceId}`, { method: "GET" });
    expect(markdownDetailResponse.status).toBe(200);
    const markdownDetailBody = await markdownDetailResponse.json();
    expect(markdownDetailBody.resource.content).toBe("# Notes\nhello markdown");

    const pdfDetailResponse = await request(app, `/api/benches/${bench.id}/components/${literatureComponent.id}/resources/${pdfResourceId}`, { method: "GET" });
    expect(pdfDetailResponse.status).toBe(200);
    const pdfDetailBody = await pdfDetailResponse.json();
    expect(pdfDetailBody.resource.content).toContain("Hello PDF world");
    expect(pdfDetailBody.resource.files.some((file: any) => file.role === "extracted-text")).toBe(true);

    const contextResponse = await request(app, `/api/benches/${bench.id}/context/components/${literatureComponent.id}`, { method: "GET" });
    expect(contextResponse.status).toBe(200);
    const contextBody = await contextResponse.json();
    expect(contextBody.context.self.component.id).toBe(literatureComponent.id);
    expect(contextBody.context.self.toc).toHaveLength(2);
    expect(contextBody.context.others).toEqual([
      {
        component: {
          ...budgetComponent,
          resourceCount: 0,
        },
        summary: "Tracks costs and assumptions.\n",
        toc: [],
      },
    ]);
  });

  it("returns 404 for unknown bench, component, and resource IDs", async () => {
    const { app, bench, literatureComponent } = await createReadApiApp();

    expect((await request(app, "/api/benches/bench-missing", { method: "GET" })).status).toBe(404);
    expect((await request(app, `/api/benches/${bench.id}/components/missing-component`, { method: "GET" })).status).toBe(404);
    expect((await request(app, `/api/benches/${bench.id}/components/${literatureComponent.id}/resources/missing-resource`, { method: "GET" })).status).toBe(404);
  });
});

async function createReadApiApp() {
  const baseDir = await mkdtemp(path.join(os.tmpdir(), "benchpilot-read-api-"));
  tempDirs.push(baseDir);

  const store = new WorkspaceStore(baseDir);
  const ingestion = new ResourceIngestionService(store);

  const bench = createBench(
    {
      title: "CRP biosensor",
      question: "Can we build a paper-based electrochemical biosensor for CRP?",
      normalizedQuestion: "A paper-based electrochemical biosensor will detect CRP in whole blood.",
    },
    { now: new Date("2026-04-25T19:00:00.000Z") },
  );
  const requirement = createRequirement(
    {
      benchId: bench.id,
      title: "Assess novelty and prior art",
      summary: "Determine whether closely similar work already exists.",
      componentInstanceIds: ["literature-crp-biosensor"],
    },
    { now: new Date("2026-04-25T19:05:00.000Z") },
  );
  const literatureComponent = createComponentInstance(
    {
      benchId: bench.id,
      presetId: "literature",
      name: "Literature — CRP biosensor",
      summary: "Tracks prior work, novelty signal, and references relevant to the CRP biosensor hypothesis.",
      requirementIds: [requirement.id],
      toolMode: "read-only",
    },
    { now: new Date("2026-04-25T19:10:00.000Z") },
  );
  const budgetComponent = createComponentInstance(
    {
      benchId: bench.id,
      presetId: "budget",
      name: "Budget — CRP biosensor",
      summary: "Tracks costs and assumptions.",
      toolMode: "read-only",
    },
    { now: new Date("2026-04-25T19:10:00.000Z") },
  );

  await store.writeBench(bench);
  await store.writeRequirement({
    ...requirement,
    componentInstanceIds: [literatureComponent.id],
  });
  await store.writeComponent(literatureComponent);
  await store.writeComponent(budgetComponent);

  const markdownResult = await ingestion.ingest(parseResourceIngestionRequest({
    resource: {
      benchId: bench.id,
      componentInstanceId: literatureComponent.id,
      title: "Manual notes",
      kind: "lab-note",
      description: "Markdown notes for later browsing.",
      summary: "Notes about the experimental setup.",
      supportsRequirementIds: [requirement.id],
    },
    files: [
      {
        filename: "notes.md",
        mediaType: "text/markdown",
        description: "Primary markdown notes",
        role: "primary",
        content: Buffer.from("# Notes\nhello markdown", "utf8"),
      },
    ],
  }));

  const pdfResult = await ingestion.ingest(parseResourceIngestionRequest({
    resource: {
      benchId: bench.id,
      componentInstanceId: literatureComponent.id,
      title: "CRP paper sensor prior art",
      kind: "paper-note",
      description: "Prior-art PDF",
      summary: "Summary of prior work on CRP paper sensors.",
      supportsRequirementIds: [requirement.id],
    },
    files: [
      {
        filename: "prior-art.pdf",
        mediaType: "application/pdf",
        description: "Original paper PDF",
        role: "primary",
        content: createPdfWithText("Hello PDF world"),
      },
    ],
  }));

  const app = createApp(createFakePool(), new BenchReadService(store));

  return {
    app,
    bench,
    requirement: { ...requirement, componentInstanceIds: [literatureComponent.id] },
    literatureComponent,
    budgetComponent,
    markdownResourceId: markdownResult.resource.id,
    pdfResourceId: pdfResult.resource.id,
  };
}

function createFakePool(): SessionService {
  return {
    list: () => [],
    createStandbySession: async (role) => createSessionSummary(role),
    prompt: async () => undefined,
    dispose: async () => true,
  };
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

function createPdfWithText(text: string): Buffer {
  const objects: string[] = [];
  const push = (value: string) => objects.push(value);

  push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  push(
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
  );
  const stream = `BT\n/F1 24 Tf\n72 72 Td\n(${escapePdfText(text)}) Tj\nET`;
  push(`4 0 obj\n<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream\nendobj\n`);
  push("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += object;
  }
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += "xref\n0 6\n";
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index <= 5; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += "trailer\n<< /Size 6 /Root 1 0 R >>\n";
  pdf += `startxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "utf8");
}

function escapePdfText(text: string): string {
  return text.replace(/[\\()]/g, "\\$&");
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

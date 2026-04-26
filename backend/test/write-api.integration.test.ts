import { Buffer } from "node:buffer";
import { mkdtemp, rm } from "node:fs/promises";
import type { Server } from "node:http";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createApp, type SessionService } from "../src/app.js";
import { BenchReadService } from "../src/bench-read-service.js";
import { BenchWriteService } from "../src/bench-write-service.js";
import { createBench } from "../src/bench.js";
import { createComponentInstance } from "../src/component.js";
import type { RoleDefinition, SessionSummary } from "../src/types.js";
import { WorkspaceStore } from "../src/workspace-store.js";

const tempDirs: string[] = [];
const createdServers: Server[] = [];

afterEach(async () => {
  await Promise.all(createdServers.splice(0).map(closeServer));
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("write api integration", () => {
  it("creates and updates resources, then serves the updated state through the read api", async () => {
    const { app, bench, literatureComponent } = await createWriteApiApp();

    const createMarkdownResponse = await request(
      app,
      `/api/benches/${bench.id}/components/${literatureComponent.id}/resources`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          actor: {
            benchId: bench.id,
            componentInstanceId: literatureComponent.id,
            presetId: "literature",
          },
          resource: {
            benchId: bench.id,
            componentInstanceId: literatureComponent.id,
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
              contentBase64: Buffer.from("# Notes\nhello markdown", "utf8").toString("base64"),
            },
          ],
          primaryFilename: "notes.md",
        }),
      },
    );
    expect(createMarkdownResponse.status).toBe(201);
    const createMarkdownBody = await createMarkdownResponse.json();
    const markdownResourceId = createMarkdownBody.resource.id as string;

    const createPdfResponse = await request(
      app,
      `/api/benches/${bench.id}/components/${literatureComponent.id}/resources`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          actor: {
            benchId: bench.id,
            componentInstanceId: literatureComponent.id,
            presetId: "literature",
          },
          resource: {
            benchId: bench.id,
            componentInstanceId: literatureComponent.id,
            title: "CRP paper sensor prior art",
            kind: "paper-note",
            description: "Prior-art PDF",
            summary: "Summary of prior work on CRP paper sensors.",
          },
          files: [
            {
              filename: "prior-art.pdf",
              mediaType: "application/pdf",
              description: "Original paper PDF",
              role: "primary",
              contentBase64: createPdfWithText("Hello PDF world").toString("base64"),
            },
          ],
          primaryFilename: "prior-art.pdf",
        }),
      },
    );
    expect(createPdfResponse.status).toBe(201);
    const createPdfBody = await createPdfResponse.json();
    const pdfResourceId = createPdfBody.resource.id as string;

    const patchMarkdownResponse = await request(
      app,
      `/api/benches/${bench.id}/components/${literatureComponent.id}/resources/${markdownResourceId}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          actor: {
            benchId: bench.id,
            componentInstanceId: literatureComponent.id,
            presetId: "literature",
          },
          resource: {
            summary: "Updated notes about the experimental setup.",
            tags: ["diagnostics"],
          },
          files: [
            {
              filename: "notes.md",
              mediaType: "text/markdown",
              description: "Updated markdown notes",
              role: "primary",
              contentBase64: Buffer.from("# Notes\nupdated markdown", "utf8").toString("base64"),
            },
          ],
        }),
      },
    );
    expect(patchMarkdownResponse.status).toBe(200);

    const patchSummaryResponse = await request(
      app,
      `/api/benches/${bench.id}/components/${literatureComponent.id}/summary`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          actor: {
            benchId: bench.id,
            componentInstanceId: literatureComponent.id,
            presetId: "literature",
          },
          summary: "Updated public summary.",
        }),
      },
    );
    expect(patchSummaryResponse.status).toBe(200);

    const markdownReadResponse = await request(
      app,
      `/api/benches/${bench.id}/components/${literatureComponent.id}/resources/${markdownResourceId}`,
      { method: "GET" },
    );
    expect(markdownReadResponse.status).toBe(200);
    const markdownReadBody = await markdownReadResponse.json();
    expect(markdownReadBody.resource.summary).toBe("Updated notes about the experimental setup.");
    expect(markdownReadBody.resource.tags).toEqual(["diagnostics"]);
    expect(markdownReadBody.resource.content).toBe("# Notes\nupdated markdown");

    const pdfReadResponse = await request(
      app,
      `/api/benches/${bench.id}/components/${literatureComponent.id}/resources/${pdfResourceId}`,
      { method: "GET" },
    );
    expect(pdfReadResponse.status).toBe(200);
    const pdfReadBody = await pdfReadResponse.json();
    expect(pdfReadBody.resource.content).toContain("Hello PDF world");
    expect(pdfReadBody.resource.files.some((file: any) => file.role === "extracted-text")).toBe(true);

    const componentReadResponse = await request(
      app,
      `/api/benches/${bench.id}/components/${literatureComponent.id}`,
      { method: "GET" },
    );
    expect(componentReadResponse.status).toBe(200);
    const componentReadBody = await componentReadResponse.json();
    expect(componentReadBody.component.summary).toBe("Updated public summary.");
    expect(componentReadBody.component.resourceCount).toBe(2);

    const contextReadResponse = await request(
      app,
      `/api/benches/${bench.id}/context/components/${literatureComponent.id}`,
      { method: "GET" },
    );
    expect(contextReadResponse.status).toBe(200);
    const contextReadBody = await contextReadResponse.json();
    expect(contextReadBody.context.self.summary).toBe("Updated public summary.\n");
    expect(contextReadBody.context.self.toc).toHaveLength(2);
  });

  it("rejects invalid write scoping and returns 404 for unknown write targets", async () => {
    const { app, bench, literatureComponent, budgetComponent } = await createWriteApiApp();

    const forbiddenResponse = await request(
      app,
      `/api/benches/${bench.id}/components/${budgetComponent.id}/resources`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          actor: {
            benchId: bench.id,
            componentInstanceId: literatureComponent.id,
            presetId: "literature",
          },
          resource: {
            benchId: bench.id,
            componentInstanceId: budgetComponent.id,
            title: "Budget notes",
            kind: "lab-note",
            description: "Should be forbidden.",
            summary: "Should be forbidden.",
          },
          files: [
            {
              filename: "notes.md",
              mediaType: "text/markdown",
              description: "Primary markdown notes",
              role: "primary",
              contentBase64: Buffer.from("# Notes\nforbidden", "utf8").toString("base64"),
            },
          ],
          primaryFilename: "notes.md",
        }),
      },
    );
    expect(forbiddenResponse.status).toBe(400);

    const missingPatchResponse = await request(
      app,
      `/api/benches/${bench.id}/components/${literatureComponent.id}/resources/missing-resource`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          actor: {
            benchId: bench.id,
            componentInstanceId: literatureComponent.id,
            presetId: "literature",
          },
          resource: {
            summary: "Missing resource",
          },
        }),
      },
    );
    expect(missingPatchResponse.status).toBe(404);
  });
});

async function createWriteApiApp() {
  const baseDir = await mkdtemp(path.join(os.tmpdir(), "benchpilot-write-api-"));
  tempDirs.push(baseDir);

  const store = new WorkspaceStore(baseDir);
  const bench = createBench({
    title: "CRP biosensor",
    question: "Can we build a paper-based electrochemical biosensor for CRP?",
  });
  const literatureComponent = createComponentInstance({
    benchId: bench.id,
    presetId: "literature",
    name: "Literature — CRP biosensor",
    summary: "Tracks prior work and novelty.",
    toolMode: "read-only",
  });
  const budgetComponent = createComponentInstance({
    benchId: bench.id,
    presetId: "budget",
    name: "Budget — CRP biosensor",
    summary: "Tracks costs and assumptions.",
    toolMode: "read-only",
  });

  await store.writeBench(bench);
  await store.writeComponent(literatureComponent);
  await store.writeComponent(budgetComponent);

  const app = createApp(
    createFakePool(),
    new BenchReadService(store),
    new BenchWriteService(store),
  );

  return { app, bench, literatureComponent, budgetComponent };
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

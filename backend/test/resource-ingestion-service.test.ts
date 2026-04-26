import { Buffer } from "node:buffer";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createBench } from "../src/bench.js";
import { createComponentInstance } from "../src/component.js";
import { ResourceIngestionService } from "../src/resource-ingestion-service.js";
import { parseResourceIngestionRequest } from "../src/resource-ingestion.js";
import { WorkspaceNotFoundError, WorkspaceStore } from "../src/workspace-store.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("resource ingestion service", () => {
  it("ingests markdown resources end to end", async () => {
    const { service, store, bench, component } = await createReadyStore();

    const result = await service.ingest(parseResourceIngestionRequest({
      resource: {
        benchId: bench.id,
        componentInstanceId: component.id,
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
          content: Buffer.from("# Notes\nhello\n"),
        },
      ],
    }));

    expect(result.resource.files.map((file) => file.filename)).toEqual(["notes.md"]);
    await expect(store.readResourceFile(bench.id, component.id, result.resource.id, "notes.md")).resolves.toEqual(
      Buffer.from("# Notes\nhello\n"),
    );
  });

  it("ingests pdf resources and creates extracted text companions", async () => {
    const { service, store, bench, component } = await createReadyStore();

    const result = await service.ingest(parseResourceIngestionRequest({
      resource: {
        benchId: bench.id,
        componentInstanceId: component.id,
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
          content: createPdfWithText("Hello PDF world"),
        },
      ],
    }));

    expect(result.storedFilenames).toEqual(["prior-art.pdf", "prior-art.txt"]);
    expect(result.generatedFiles).toHaveLength(1);
    const extracted = await store.readResourceFile(bench.id, component.id, result.resource.id, "prior-art.txt");
    expect(extracted.toString("utf8")).toContain("Hello PDF world");
  });

  it("rolls back partially created resource state when ingestion fails", async () => {
    const { service, store, bench, component } = await createReadyStore();

    await expect(service.ingest(parseResourceIngestionRequest({
      resource: {
        benchId: bench.id,
        componentInstanceId: component.id,
        title: "Broken PDF",
        kind: "paper-note",
        description: "Broken PDF",
        summary: "Should fail during extraction.",
      },
      files: [
        {
          filename: "broken.pdf",
          mediaType: "application/pdf",
          description: "Broken PDF payload",
          role: "primary",
          content: Buffer.from("not a pdf", "utf8"),
        },
      ],
    }))).rejects.toThrow();

    await expect(store.listResources(bench.id, component.id)).resolves.toEqual([]);
    await expect(store.readResource(bench.id, component.id, "broken-pdf")).rejects.toBeInstanceOf(WorkspaceNotFoundError);
  });
});

async function createReadyStore() {
  const baseDir = await mkdtemp(path.join(os.tmpdir(), "benchpilot-resource-ingestion-"));
  tempDirs.push(baseDir);

  const store = new WorkspaceStore(baseDir);
  const bench = createBench({
    title: "CRP biosensor",
    question: "Can we build a paper-based electrochemical biosensor for CRP?",
  });
  const component = createComponentInstance({
    benchId: bench.id,
    presetId: "literature",
    name: "Literature — CRP biosensor",
    summary: "Tracks prior work and novelty.",
  });

  await store.writeBench(bench);
  await store.writeComponent(component);

  return {
    service: new ResourceIngestionService(store),
    store,
    bench,
    component,
  };
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

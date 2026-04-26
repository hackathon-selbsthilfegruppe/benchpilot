import { Buffer } from "node:buffer";

import { describe, expect, it } from "vitest";

import {
  mediaTypeFromFilename,
  parseResourceIngestionRequest,
  resourceIngestionFileSchema,
  resourceIngestionRequestSchema,
  SUPPORTED_RESOURCE_FILE_TYPES,
} from "../src/resource-ingestion.js";

describe("resource ingestion validation", () => {
  it("tracks the supported media-type to extension contract", () => {
    expect(SUPPORTED_RESOURCE_FILE_TYPES).toEqual({
      "text/markdown": [".md"],
      "text/plain": [".txt"],
      "application/pdf": [".pdf"],
    });
    expect(mediaTypeFromFilename("note.md")).toBe("text/markdown");
    expect(mediaTypeFromFilename("note.txt")).toBe("text/plain");
    expect(mediaTypeFromFilename("paper.pdf")).toBe("application/pdf");
    expect(mediaTypeFromFilename("archive.zip")).toBeNull();
  });

  it("accepts resource-local markdown, text, and pdf uploads", () => {
    const file = resourceIngestionFileSchema.parse({
      filename: "prior-art.pdf",
      mediaType: "application/pdf",
      description: "Original paper PDF",
      role: "primary",
      content: Buffer.from("%PDF-1.4 sample"),
    });

    expect(file.filename).toBe("prior-art.pdf");
  });

  it("rejects unsupported extensions, paths, and empty content before writes begin", () => {
    expect(resourceIngestionFileSchema.safeParse({
      filename: "prior-art.docx",
      mediaType: "application/pdf",
      description: "Wrong extension",
      role: "primary",
      content: Buffer.from("x"),
    }).success).toBe(false);

    expect(resourceIngestionFileSchema.safeParse({
      filename: "nested/prior-art.pdf",
      mediaType: "application/pdf",
      description: "Has path separators",
      role: "primary",
      content: Buffer.from("x"),
    }).success).toBe(false);

    expect(resourceIngestionFileSchema.safeParse({
      filename: "prior-art.pdf",
      mediaType: "application/pdf",
      description: "Empty content",
      role: "primary",
      content: Buffer.alloc(0),
    }).success).toBe(false);
  });

  it("requires exactly one primary file and unique filenames", () => {
    const result = resourceIngestionRequestSchema.safeParse({
      resource: {
        benchId: "bench-crp-biosensor",
        componentInstanceId: "literature-crp-biosensor",
        title: "CRP paper sensor prior art",
        kind: "paper-note",
        description: "Prior-art note",
        summary: "Summary of prior work on CRP paper sensors.",
      },
      files: [
        {
          filename: "prior-art.pdf",
          mediaType: "application/pdf",
          description: "Original PDF",
          role: "attachment",
          content: Buffer.from("x"),
        },
        {
          filename: "prior-art.pdf",
          mediaType: "application/pdf",
          description: "Duplicate name",
          role: "attachment",
          content: Buffer.from("y"),
        },
      ],
    });

    expect(result.success).toBe(false);
    const messages = result.error?.issues.map((issue) => issue.message) ?? [];
    expect(messages).toContain("Exactly one ingested file must be marked as the primary file");
    expect(messages).toContain("Filenames must be unique within one resource ingestion request");
  });

  it("parses a valid ingestion request with resource metadata plus uploaded files", () => {
    const request = parseResourceIngestionRequest({
      resource: {
        benchId: "bench-crp-biosensor",
        componentInstanceId: "literature-crp-biosensor",
        title: "CRP paper sensor prior art",
        kind: "paper-note",
        description: "Prior-art note",
        summary: "Summary of prior work on CRP paper sensors.",
        supportsRequirementIds: ["req-assess-novelty"],
      },
      primaryFilename: "prior-art.pdf",
      files: [
        {
          filename: "prior-art.pdf",
          mediaType: "application/pdf",
          description: "Original paper PDF",
          role: "primary",
          content: Buffer.from("%PDF-1.4 sample"),
        },
        {
          filename: "prior-art-notes.txt",
          mediaType: "text/plain",
          description: "Short extracted notes from manual review",
          role: "attachment",
          content: Buffer.from("notes"),
        },
      ],
    });

    expect(request.resource.title).toBe("CRP paper sensor prior art");
    expect(request.files).toHaveLength(2);
    expect(request.primaryFilename).toBe("prior-art.pdf");
  });
});

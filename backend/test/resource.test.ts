import { describe, expect, it } from "vitest";

import {
  createResource,
  resourceFileSchema,
  resourceMetadataSchema,
  resourceTocEntrySchema,
  toResourceTocEntry,
} from "../src/resource.js";

describe("resource schema and TOC model", () => {
  it("requires extracted PDF text files to point back to their source PDF", () => {
    const invalidFile = resourceFileSchema.safeParse({
      filename: "protocol.txt",
      mediaType: "text/plain",
      description: "Extracted plain text",
      role: "extracted-text",
    });

    expect(invalidFile.success).toBe(false);
    expect(invalidFile.error?.issues[0]?.path).toEqual(["sourceFilename"]);
  });

  it("creates file-backed resources with requirement and provenance linkage", () => {
    const resource = createResource(
      {
        benchId: "bench-crp-biosensor",
        componentInstanceId: "literature-crp-biosensor",
        title: "CRP paper sensor prior art",
        kind: "paper-note",
        description: "Prior-art note for cheap global browsing.",
        summary: "Summary of prior work on CRP paper sensors and likely overlap with the current hypothesis.",
        tags: ["diagnostics", "crp"],
        files: [
          {
            filename: "prior-art.pdf",
            mediaType: "application/pdf",
            description: "Original paper PDF",
            role: "primary",
          },
          {
            filename: "prior-art.txt",
            mediaType: "text/plain",
            description: "Extracted text from the PDF for cheap downstream reading",
            role: "extracted-text",
            sourceFilename: "prior-art.pdf",
          },
        ],
        primaryFile: "prior-art.pdf",
        contentType: "application/pdf",
        supportsRequirementIds: ["req-assess-novelty"],
        derivedFromResourceIds: ["literature-search-results"],
        confidence: "high",
      },
      { now: new Date("2026-04-25T19:10:00.000Z") },
    );

    expect(resource).toEqual({
      id: "crp-paper-sensor-prior-art",
      benchId: "bench-crp-biosensor",
      componentInstanceId: "literature-crp-biosensor",
      producedByComponentInstanceId: "literature-crp-biosensor",
      title: "CRP paper sensor prior art",
      kind: "paper-note",
      description: "Prior-art note for cheap global browsing.",
      summary: "Summary of prior work on CRP paper sensors and likely overlap with the current hypothesis.",
      tags: ["diagnostics", "crp"],
      files: [
        {
          filename: "prior-art.pdf",
          mediaType: "application/pdf",
          description: "Original paper PDF",
          role: "primary",
        },
        {
          filename: "prior-art.txt",
          mediaType: "text/plain",
          description: "Extracted text from the PDF for cheap downstream reading",
          role: "extracted-text",
          sourceFilename: "prior-art.pdf",
        },
      ],
      primaryFile: "prior-art.pdf",
      contentType: "application/pdf",
      supportsRequirementIds: ["req-assess-novelty"],
      derivedFromResourceIds: ["literature-search-results"],
      status: "ready",
      confidence: "high",
      createdAt: "2026-04-25T19:10:00.000Z",
      updatedAt: "2026-04-25T19:10:00.000Z",
    });
  });

  it("projects resources into cheap TOC entries without file inventory or full content", () => {
    const resource = resourceMetadataSchema.parse({
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
    });

    const tocEntry = toResourceTocEntry(resource);
    expect(resourceTocEntrySchema.parse(tocEntry)).toEqual({
      id: "lit-0007",
      benchId: "bench-crp-biosensor",
      componentInstanceId: "literature-crp-biosensor",
      title: "CRP paper sensor prior art",
      kind: "paper-note",
      description: "Prior-art note",
      summary: "Summary of prior work on CRP paper sensors and likely overlap with the current hypothesis.",
      tags: ["diagnostics", "crp"],
      updatedAt: "2026-04-25T19:10:00.000Z",
    });
    expect("files" in tocEntry).toBe(false);
  });

  it("rejects a primary file that is not present in the file inventory", () => {
    const result = resourceMetadataSchema.safeParse({
      id: "lit-0007",
      benchId: "bench-crp-biosensor",
      componentInstanceId: "literature-crp-biosensor",
      producedByComponentInstanceId: "literature-crp-biosensor",
      title: "CRP paper sensor prior art",
      kind: "paper-note",
      description: "Prior-art note",
      summary: "Summary of prior work on CRP paper sensors and likely overlap with the current hypothesis.",
      tags: [],
      files: [],
      primaryFile: "missing.md",
      supportsRequirementIds: [],
      derivedFromResourceIds: [],
      status: "ready",
      createdAt: "2026-04-25T19:10:00.000Z",
      updatedAt: "2026-04-25T19:10:00.000Z",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["primaryFile"]);
  });
});

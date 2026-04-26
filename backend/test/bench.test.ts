import { describe, expect, it } from "vitest";

import {
  allocateBenchId,
  benchIdSchema,
  benchMetadataSchema,
  benchSummarySchema,
  createBench,
  createBenchId,
  normalizeBenchSlug,
} from "../src/bench.js";

describe("bench schema and identity", () => {
  it("normalizes bench slugs into lowercase kebab-case", () => {
    expect(normalizeBenchSlug("  CRP Biosensor / Whole Blood  ")).toBe("crp-biosensor-whole-blood");
    expect(normalizeBenchSlug("Café au lait")).toBe("cafe-au-lait");
    expect(normalizeBenchSlug("***")).toBe("untitled");
  });

  it("creates stable bench IDs with the bench- prefix", () => {
    expect(createBenchId("CRP biosensor")).toBe("bench-crp-biosensor");
    expect(benchIdSchema.safeParse("bench-crp-biosensor").success).toBe(true);
    expect(benchIdSchema.safeParse("crp-biosensor").success).toBe(false);
    expect(benchIdSchema.safeParse("bench-CRP").success).toBe(false);
  });

  it("allocates deduplicated bench IDs within the existing bench namespace", () => {
    expect(allocateBenchId("CRP biosensor", [])).toBe("bench-crp-biosensor");
    expect(allocateBenchId("CRP biosensor", ["bench-crp-biosensor"])).toBe("bench-crp-biosensor-2");
    expect(
      allocateBenchId("CRP biosensor", [
        "bench-crp-biosensor",
        "bench-crp-biosensor-2",
        "bench-crp-biosensor-3",
      ]),
    ).toBe("bench-crp-biosensor-4");
  });

  it("creates a bench with intake-derived fields and runtime-owned metadata", () => {
    const bench = createBench(
      {
        title: "CRP biosensor",
        question: "Can we build a paper-based electrochemical biosensor for CRP?",
        normalizedQuestion: "A paper-based electrochemical biosensor will detect CRP in whole blood.",
        intakeBriefId: "brief-001",
      },
      { now: new Date("2026-04-25T19:10:00.000Z") },
    );

    expect(bench).toEqual({
      id: "bench-crp-biosensor",
      title: "CRP biosensor",
      question: "Can we build a paper-based electrochemical biosensor for CRP?",
      normalizedQuestion: "A paper-based electrochemical biosensor will detect CRP in whole blood.",
      intakeBriefId: "brief-001",
      status: "active",
      createdAt: "2026-04-25T19:10:00.000Z",
      updatedAt: "2026-04-25T19:10:00.000Z",
    });
    expect(benchMetadataSchema.parse(bench)).toEqual(bench);
    expect(benchSummarySchema.parse(bench)).toEqual({
      id: "bench-crp-biosensor",
      title: "CRP biosensor",
      question: "Can we build a paper-based electrochemical biosensor for CRP?",
      status: "active",
      updatedAt: "2026-04-25T19:10:00.000Z",
    });
  });

  it("rejects benches whose updatedAt predates createdAt", () => {
    const result = benchMetadataSchema.safeParse({
      id: "bench-crp-biosensor",
      title: "CRP biosensor",
      question: "Can we build a paper-based electrochemical biosensor for CRP?",
      status: "active",
      createdAt: "2026-04-25T19:10:00.000Z",
      updatedAt: "2026-04-25T19:09:59.000Z",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["updatedAt"]);
  });
});

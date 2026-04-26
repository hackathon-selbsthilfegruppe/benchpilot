import { describe, expect, it } from "vitest";

import {
  REQUIREMENT_STORAGE_MODE,
  allocateRequirementId,
  createRequirement,
  createRequirementId,
  normalizeRequirementSlug,
  requirementIdSchema,
  requirementMetadataSchema,
} from "../src/requirement.js";

describe("requirement schema and lifecycle", () => {
  it("commits to first-class requirement storage for the initial backend model", () => {
    expect(REQUIREMENT_STORAGE_MODE).toBe("first-class");
  });

  it("normalizes requirement slugs and IDs", () => {
    expect(normalizeRequirementSlug("Assess novelty & prior art")).toBe("assess-novelty-prior-art");
    expect(createRequirementId("Assess novelty & prior art")).toBe("req-assess-novelty-prior-art");
    expect(requirementIdSchema.safeParse("req-001").success).toBe(true);
    expect(requirementIdSchema.safeParse("requirement-001").success).toBe(false);
  });

  it("allocates deduplicated requirement IDs within one bench", () => {
    expect(allocateRequirementId("Assess novelty", [])).toBe("req-assess-novelty");
    expect(allocateRequirementId("Assess novelty", ["req-assess-novelty"])) .toBe("req-assess-novelty-2");
  });

  it("creates open requirements with explicit bench linkage and dependency references", () => {
    const requirement = createRequirement(
      {
        benchId: "bench-crp-biosensor",
        title: "Assess novelty and prior art",
        summary: "Determine whether closely similar CRP paper-biosensor protocols already exist.",
        componentInstanceIds: ["literature-crp-biosensor"],
        resourceIds: ["lit-0007"],
      },
      { now: new Date("2026-04-25T19:20:00.000Z") },
    );

    expect(requirement).toEqual({
      id: "req-assess-novelty-and-prior-art",
      benchId: "bench-crp-biosensor",
      title: "Assess novelty and prior art",
      summary: "Determine whether closely similar CRP paper-biosensor protocols already exist.",
      status: "open",
      componentInstanceIds: ["literature-crp-biosensor"],
      resourceIds: ["lit-0007"],
      createdAt: "2026-04-25T19:20:00.000Z",
      updatedAt: "2026-04-25T19:20:00.000Z",
      resolvedAt: undefined,
    });
  });

  it("requires resolvedAt exactly when a requirement is resolved", () => {
    const unresolved = requirementMetadataSchema.safeParse({
      id: "req-assess-novelty",
      benchId: "bench-crp-biosensor",
      title: "Assess novelty",
      summary: "Check whether similar work exists.",
      status: "resolved",
      componentInstanceIds: [],
      resourceIds: [],
      createdAt: "2026-04-25T19:20:00.000Z",
      updatedAt: "2026-04-25T19:20:00.000Z",
    });

    expect(unresolved.success).toBe(false);
    expect(unresolved.error?.issues[0]?.path).toEqual(["resolvedAt"]);

    const prematureResolvedAt = requirementMetadataSchema.safeParse({
      id: "req-assess-novelty",
      benchId: "bench-crp-biosensor",
      title: "Assess novelty",
      summary: "Check whether similar work exists.",
      status: "open",
      componentInstanceIds: [],
      resourceIds: [],
      createdAt: "2026-04-25T19:20:00.000Z",
      updatedAt: "2026-04-25T19:20:00.000Z",
      resolvedAt: "2026-04-25T19:20:00.000Z",
    });

    expect(prematureResolvedAt.success).toBe(false);
    expect(prematureResolvedAt.error?.issues[0]?.path).toEqual(["resolvedAt"]);
  });
});

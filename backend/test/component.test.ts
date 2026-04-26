import { describe, expect, it } from "vitest";

import {
  INITIAL_COMPONENT_PRESET_IDS,
  allocateComponentInstanceId,
  benchIdToInstanceSuffix,
  componentInstanceSchema,
  componentPresetSchema,
  createComponentInstance,
  createComponentInstanceId,
  normalizeComponentSlug,
} from "../src/component.js";

describe("component preset and instance schema", () => {
  it("tracks the agreed initial preset component IDs", () => {
    expect(INITIAL_COMPONENT_PRESET_IDS).toEqual([
      "orchestrator",
      "protocols",
      "budget",
      "timeline",
      "literature",
    ]);
  });

  it("validates preset metadata including prompt-facing fields", () => {
    const preset = componentPresetSchema.parse({
      id: "literature",
      name: "Literature",
      shortDescription: "Investigates prior work and novelty.",
      detailedDescription: "Reads scientific references, compares overlap, and produces literature resources.",
      preprompt: "You are the literature component.",
      defaultToolMode: "read-only",
    });

    expect(preset.id).toBe("literature");
  });

  it("derives component instance IDs from component identity plus bench scope", () => {
    expect(normalizeComponentSlug("Literature Review")).toBe("literature-review");
    expect(benchIdToInstanceSuffix("bench-crp-biosensor")).toBe("crp-biosensor");
    expect(createComponentInstanceId("literature", "bench-crp-biosensor")).toBe("literature-crp-biosensor");
    expect(
      allocateComponentInstanceId("literature", "bench-crp-biosensor", ["literature-crp-biosensor"]),
    ).toBe("literature-crp-biosensor-2");
  });

  it("creates active component instances linked to one bench and its requirements", () => {
    const component = createComponentInstance(
      {
        benchId: "bench-crp-biosensor",
        presetId: "literature",
        name: "Literature — CRP biosensor",
        summary: "Tracks prior work, novelty signal, and references relevant to the CRP biosensor hypothesis.",
        requirementIds: ["req-assess-novelty"],
        toolMode: "read-only",
      },
      { now: new Date("2026-04-25T19:12:00.000Z") },
    );

    expect(component).toEqual({
      id: "literature-crp-biosensor",
      benchId: "bench-crp-biosensor",
      presetId: "literature",
      name: "Literature — CRP biosensor",
      summary: "Tracks prior work, novelty signal, and references relevant to the CRP biosensor hypothesis.",
      requirementIds: ["req-assess-novelty"],
      toolMode: "read-only",
      resourceCount: 0,
      status: "active",
      createdAt: "2026-04-25T19:12:00.000Z",
      updatedAt: "2026-04-25T19:12:00.000Z",
    });
  });

  it("rejects component instances whose updatedAt predates createdAt", () => {
    const result = componentInstanceSchema.safeParse({
      id: "literature-crp-biosensor",
      benchId: "bench-crp-biosensor",
      presetId: "literature",
      name: "Literature — CRP biosensor",
      summary: "Tracks prior work.",
      requirementIds: ["req-assess-novelty"],
      resourceCount: 0,
      status: "active",
      createdAt: "2026-04-25T19:12:00.000Z",
      updatedAt: "2026-04-25T19:11:59.000Z",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["updatedAt"]);
  });
});

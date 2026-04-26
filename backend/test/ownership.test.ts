import { describe, expect, it } from "vitest";

import {
  OwnershipRuleError,
  assertCanApplyMutation,
  canApplyMutation,
  explainMutationDenial,
  isOrchestratorActor,
} from "../src/ownership.js";

describe("ownership and mutation rules", () => {
  it("allows the backend/system actor to mutate any backend-owned state", () => {
    expect(canApplyMutation({ kind: "system" }, { kind: "write-bench", benchId: "bench-crp-biosensor" })).toBe(true);
    expect(
      canApplyMutation(
        { kind: "system" },
        {
          kind: "refresh-component-toc",
          benchId: "bench-crp-biosensor",
          componentInstanceId: "literature-crp-biosensor",
        },
      ),
    ).toBe(true);
  });

  it("allows a component to mutate only its own summary and resources", () => {
    const actor = {
      kind: "component" as const,
      benchId: "bench-crp-biosensor",
      componentInstanceId: "literature-crp-biosensor",
      presetId: "literature",
    };

    expect(
      canApplyMutation(actor, {
        kind: "write-component-summary",
        benchId: "bench-crp-biosensor",
        componentInstanceId: "literature-crp-biosensor",
      }),
    ).toBe(true);
    expect(
      canApplyMutation(actor, {
        kind: "write-resource",
        benchId: "bench-crp-biosensor",
        componentInstanceId: "literature-crp-biosensor",
        resourceId: "lit-0007",
      }),
    ).toBe(true);
    expect(
      canApplyMutation(actor, {
        kind: "write-resource",
        benchId: "bench-crp-biosensor",
        componentInstanceId: "budget-crp-biosensor",
        resourceId: "budget-001",
      }),
    ).toBe(false);
    expect(
      explainMutationDenial(actor, {
        kind: "write-resource",
        benchId: "bench-crp-biosensor",
        componentInstanceId: "budget-crp-biosensor",
        resourceId: "budget-001",
      }),
    ).toContain("cross-component work must happen through tasks");
  });

  it("allows orchestrator actors to mutate requirements inside their own bench", () => {
    const orchestrator = {
      kind: "component" as const,
      benchId: "bench-crp-biosensor",
      componentInstanceId: "orchestrator-crp-biosensor",
      presetId: "orchestrator",
    };

    expect(isOrchestratorActor(orchestrator)).toBe(true);
    expect(
      canApplyMutation(orchestrator, {
        kind: "write-requirement",
        benchId: "bench-crp-biosensor",
        requirementId: "req-assess-novelty",
      }),
    ).toBe(true);
    expect(
      canApplyMutation(orchestrator, {
        kind: "write-resource",
        benchId: "bench-crp-biosensor",
        componentInstanceId: "literature-crp-biosensor",
        resourceId: "lit-0007",
      }),
    ).toBe(false);
  });

  it("rejects non-orchestrator requirement writes and backend-owned mutations", () => {
    const actor = {
      kind: "component" as const,
      benchId: "bench-crp-biosensor",
      componentInstanceId: "literature-crp-biosensor",
      presetId: "literature",
    };

    expect(
      canApplyMutation(actor, {
        kind: "write-requirement",
        benchId: "bench-crp-biosensor",
        requirementId: "req-assess-novelty",
      }),
    ).toBe(false);
    expect(
      canApplyMutation(actor, {
        kind: "write-task-state",
        benchId: "bench-crp-biosensor",
        componentInstanceId: "literature-crp-biosensor",
      }),
    ).toBe(false);
    expect(() =>
      assertCanApplyMutation(actor, {
        kind: "write-bench",
        benchId: "bench-crp-biosensor",
      }),
    ).toThrow(OwnershipRuleError);
  });

  it("rejects mutations across bench boundaries", () => {
    const actor = {
      kind: "component" as const,
      benchId: "bench-crp-biosensor",
      componentInstanceId: "literature-crp-biosensor",
      presetId: "literature",
    };

    expect(
      explainMutationDenial(actor, {
        kind: "write-component-summary",
        benchId: "bench-some-other-bench",
        componentInstanceId: "literature-some-other-bench",
      }),
    ).toContain("own bench");
  });
});

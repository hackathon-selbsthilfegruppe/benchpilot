import { describe, expect, it } from "vitest";

import { OwnershipRuleError } from "../src/ownership.js";
import { assertWriteAccess, componentWriteActorSchema, parseComponentWriteActor } from "../src/write-actor.js";

describe("write actor contract and ownership enforcement", () => {
  it("parses the write actor contract for component-owned writes", () => {
    const actor = parseComponentWriteActor({
      benchId: "bench-crp-biosensor",
      componentInstanceId: "literature-crp-biosensor",
      presetId: "literature",
    });

    expect(componentWriteActorSchema.parse(actor)).toEqual({
      benchId: "bench-crp-biosensor",
      componentInstanceId: "literature-crp-biosensor",
      presetId: "literature",
    });
  });

  it("allows same-component resource writes", () => {
    const actor = assertWriteAccess(
      {
        benchId: "bench-crp-biosensor",
        componentInstanceId: "literature-crp-biosensor",
        presetId: "literature",
      },
      {
        kind: "write-resource",
        benchId: "bench-crp-biosensor",
        componentInstanceId: "literature-crp-biosensor",
        resourceId: "lit-0007",
      },
    );

    expect(actor.componentInstanceId).toBe("literature-crp-biosensor");
  });

  it("rejects cross-component writes", () => {
    expect(() =>
      assertWriteAccess(
        {
          benchId: "bench-crp-biosensor",
          componentInstanceId: "literature-crp-biosensor",
          presetId: "literature",
        },
        {
          kind: "write-resource",
          benchId: "bench-crp-biosensor",
          componentInstanceId: "budget-crp-biosensor",
          resourceId: "budget-001",
        },
      ),
    ).toThrow(OwnershipRuleError);
  });

  it("rejects bench-crossing writes", () => {
    expect(() =>
      assertWriteAccess(
        {
          benchId: "bench-crp-biosensor",
          componentInstanceId: "literature-crp-biosensor",
          presetId: "literature",
        },
        {
          kind: "write-component-summary",
          benchId: "bench-other-biosensor",
          componentInstanceId: "literature-other-biosensor",
        },
      ),
    ).toThrow(OwnershipRuleError);
  });

  it("allows orchestrator-scoped requirement writes but rejects non-orchestrator ones", () => {
    expect(() =>
      assertWriteAccess(
        {
          benchId: "bench-crp-biosensor",
          componentInstanceId: "orchestrator-crp-biosensor",
          presetId: "orchestrator",
        },
        {
          kind: "write-requirement",
          benchId: "bench-crp-biosensor",
          requirementId: "req-assess-novelty",
        },
      ),
    ).not.toThrow();

    expect(() =>
      assertWriteAccess(
        {
          benchId: "bench-crp-biosensor",
          componentInstanceId: "literature-crp-biosensor",
          presetId: "literature",
        },
        {
          kind: "write-requirement",
          benchId: "bench-crp-biosensor",
          requirementId: "req-assess-novelty",
        },
      ),
    ).toThrow(OwnershipRuleError);
  });
});

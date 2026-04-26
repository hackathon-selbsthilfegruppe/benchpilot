import { describe, expect, it } from "vitest";

import { adaptBackendWorkbench } from "./backend-workbench-adapter";

describe("backend workbench adapter", () => {
  it("adapts backend bench state into the legacy workbench component model", () => {
    const result = adaptBackendWorkbench({
      bench: {
        id: "bench-crp-biosensor",
        title: "CRP biosensor",
        question: "Can we build a paper-based electrochemical biosensor for CRP?",
        status: "active",
        updatedAt: "2026-04-25T19:12:00.000Z",
      },
      requirements: [
        {
          id: "req-assess-novelty",
          benchId: "bench-crp-biosensor",
          title: "Assess novelty and prior art",
          summary: "Determine whether closely similar work already exists.",
          status: "open",
        },
      ],
      components: [
        {
          id: "orchestrator-crp-biosensor",
          benchId: "bench-crp-biosensor",
          presetId: "orchestrator",
          name: "Orchestrator — CRP biosensor",
          summary: "Coordinates the bench.",
          requirementIds: [],
          resourceCount: 0,
          updatedAt: "2026-04-25T19:12:00.000Z",
          status: "active",
          toolMode: "full",
        },
        {
          id: "literature-crp-biosensor",
          benchId: "bench-crp-biosensor",
          presetId: "literature",
          name: "Literature — CRP biosensor",
          summary: "Tracks prior work and novelty.",
          requirementIds: ["req-assess-novelty"],
          resourceCount: 1,
          updatedAt: "2026-04-25T19:12:00.000Z",
          status: "active",
          toolMode: "read-only",
        },
      ],
      resourcesByComponentId: {
        "literature-crp-biosensor": [
          {
            id: "lit-0007",
            benchId: "bench-crp-biosensor",
            componentInstanceId: "literature-crp-biosensor",
            producedByComponentInstanceId: "literature-crp-biosensor",
            title: "CRP prior art",
            kind: "paper-note",
            description: "Prior-art note",
            summary: "Summary of prior work.",
            tags: ["crp"],
            files: [],
            supportsRequirementIds: ["req-assess-novelty"],
            derivedFromResourceIds: [],
            status: "ready",
            createdAt: "2026-04-25T19:10:00.000Z",
            updatedAt: "2026-04-25T19:12:00.000Z",
            content: "# Notes\n\nFull markdown body here...",
          },
        ],
      },
    });

    expect(result.hypothesis.name).toBe("CRP biosensor");
    expect(result.hypothesis.summary).toBe("Can we build a paper-based electrochemical biosensor for CRP?");
    expect(result.hypothesis.toc).toEqual([
      {
        slug: "req-assess-novelty",
        title: "Assess novelty and prior art",
        descriptor: "Determine whether closely similar work already exists.",
        status: "ok",
      },
    ]);

    expect(result.components).toHaveLength(1);
    expect(result.components[0]).toMatchObject({
      id: "literature-crp-biosensor",
      name: "Literature — CRP biosensor",
      summary: "Tracks prior work and novelty.",
    });
    expect(result.components[0]?.preprompt).toContain("You are the BenchPilot literature component.");
    expect(result.components[0]?.tooling).toContain("literature resource writes");
    expect(result.components[0]?.toc).toEqual([
      {
        slug: "lit-0007",
        title: "CRP prior art",
        descriptor: "Prior-art note",
        status: "ok",
      },
    ]);
    expect(result.components[0]?.details[0]?.body).toBe("# Notes\n\nFull markdown body here...");
    expect(result.supporting).toEqual([]);
    expect(result.orchestratorComponentId).toBe("orchestrator-crp-biosensor");
  });
});

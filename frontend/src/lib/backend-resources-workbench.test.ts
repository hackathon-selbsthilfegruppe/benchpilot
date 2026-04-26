import { describe, expect, it } from "vitest";

import { applyResourcesToComponents } from "./backend-resources-workbench";
import type { BenchComponent } from "./components-shared";

describe("applyResourcesToComponents", () => {
  it("replaces toc/details for components that have fresh resources", () => {
    const components: BenchComponent[] = [
      {
        id: "budget-bench-1",
        name: "Budget",
        preprompt: "p",
        tooling: "t",
        summary: "s",
        toc: [],
        details: [],
        tasks: [],
      },
      {
        id: "literature-bench-1",
        name: "Literature",
        preprompt: "p",
        tooling: "t",
        summary: "s",
        toc: [{ slug: "stale", title: "Stale", descriptor: "stale", status: "ok" }],
        details: [{ slug: "stale", title: "Stale", body: "stale" }],
        tasks: [],
      },
    ];

    const result = applyResourcesToComponents(components, {
      "budget-bench-1": [
        {
          id: "create-budget-proposal-result",
          benchId: "bench-1",
          componentInstanceId: "budget-bench-1",
          producedByComponentInstanceId: "budget-bench-1",
          title: "Create budget proposal Result",
          kind: "task-result",
          description: "Auto-recorded result for task Create budget proposal",
          summary: "summary",
          tags: ["task-result"],
          files: [],
          supportsRequirementIds: [],
          derivedFromResourceIds: [],
          status: "ready",
          createdAt: "2026-04-26T08:45:12.540Z",
          updatedAt: "2026-04-26T08:45:12.540Z",
          content: "## Body\nproposal markdown",
        },
      ],
    });

    expect(result[0].toc).toEqual([
      {
        slug: "create-budget-proposal-result",
        title: "Create budget proposal Result",
        descriptor: "Auto-recorded result for task Create budget proposal",
        status: "ok",
      },
    ]);
    expect(result[0].details).toEqual([
      {
        slug: "create-budget-proposal-result",
        title: "Create budget proposal Result",
        body: "## Body\nproposal markdown",
      },
    ]);
    // Untouched components keep their existing toc/details.
    expect(result[1].toc[0]?.slug).toBe("stale");
  });
});

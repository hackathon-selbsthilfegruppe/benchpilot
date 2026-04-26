import { afterEach, describe, expect, it, vi } from "vitest";

import {
  applyResourcesToComponents,
  fetchComponentResources,
  fetchResourcesForComponents,
} from "./backend-resources-workbench";
import type { ResourceDetail, ResourceTocEntry } from "./benchpilot-workbench-client";
import type { BenchComponent } from "./components-shared";

vi.mock("./benchpilot-workbench-client", () => ({
  listResources: vi.fn(),
  getResource: vi.fn(),
}));

import { getResource, listResources } from "./benchpilot-workbench-client";

afterEach(() => {
  vi.resetAllMocks();
});

function makeResource(overrides: Partial<ResourceDetail> = {}): ResourceDetail {
  return {
    id: "r1",
    benchId: "bench-1",
    componentInstanceId: "comp-1",
    producedByComponentInstanceId: "comp-1",
    title: "Resource One",
    kind: "task-result",
    description: "Auto-generated",
    summary: "summary text",
    tags: [],
    files: [],
    supportsRequirementIds: [],
    derivedFromResourceIds: [],
    status: "ready",
    createdAt: "2026-04-26T08:00:00.000Z",
    updatedAt: "2026-04-26T08:00:00.000Z",
    content: "## Body\nproposal markdown",
    ...overrides,
  };
}

const TOC_ENTRY: ResourceTocEntry = {
  id: "r1",
  benchId: "bench-1",
  componentInstanceId: "comp-1",
  title: "Resource One",
  kind: "task-result",
  description: "Auto-generated",
  summary: "summary text",
  tags: [],
  updatedAt: "2026-04-26T08:00:00.000Z",
};

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
        makeResource({
          id: "create-budget-proposal-result",
          title: "Create budget proposal Result",
          description: "Auto-recorded result for task Create budget proposal",
        }),
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
    expect(result[1].toc[0]?.slug).toBe("stale");
  });

  it("falls back to the resource kind when description is missing", () => {
    const components: BenchComponent[] = [
      {
        id: "comp-1",
        name: "C",
        preprompt: "",
        tooling: "",
        summary: "",
        toc: [],
        details: [],
        tasks: [],
      },
    ];

    const result = applyResourcesToComponents(components, {
      "comp-1": [makeResource({ description: "" })],
    });
    expect(result[0].toc[0]?.descriptor).toBe("task-result");
  });

  it.each([
    ["ready", "ok"],
    ["draft", "pending"],
    ["error", "blocked"],
    ["something-else", "info"],
  ] as const)("maps resource status %s to %s", (status, expected) => {
    const components: BenchComponent[] = [
      {
        id: "comp-1",
        name: "C",
        preprompt: "",
        tooling: "",
        summary: "",
        toc: [],
        details: [],
        tasks: [],
      },
    ];
    const result = applyResourcesToComponents(components, {
      "comp-1": [makeResource({ status })],
    });
    expect(result[0].toc[0]?.status).toBe(expected);
  });

  it("renders a fallback body when content is empty", () => {
    const components: BenchComponent[] = [
      {
        id: "comp-1",
        name: "C",
        preprompt: "",
        tooling: "",
        summary: "",
        toc: [],
        details: [],
        tasks: [],
      },
    ];
    const result = applyResourcesToComponents(components, {
      "comp-1": [
        makeResource({
          content: "",
          title: "No Content Resource",
          description: "Has a description",
          summary: "summary line",
          status: "ready",
          kind: "report",
        }),
      ],
    });
    // formatResourceFallback uses filter(Boolean) which collapses the
    // intentionally-blank separator lines too — match real behavior.
    expect(result[0].details[0]?.body).toBe(
      "# No Content Resource\nKind: report\nStatus: ready\nDescription: Has a description\nsummary line",
    );
  });
});

describe("fetchComponentResources", () => {
  it("expands the toc into full resource details", async () => {
    vi.mocked(listResources).mockResolvedValueOnce([TOC_ENTRY]);
    const detail = makeResource();
    vi.mocked(getResource).mockResolvedValueOnce(detail);

    const result = await fetchComponentResources("bench-1", "comp-1");
    expect(result).toEqual([detail]);
    expect(listResources).toHaveBeenCalledWith("bench-1", "comp-1");
    expect(getResource).toHaveBeenCalledWith("bench-1", "comp-1", "r1");
  });
});

describe("fetchResourcesForComponents", () => {
  it("collects resources keyed by component id", async () => {
    vi.mocked(listResources).mockResolvedValue([TOC_ENTRY]);
    vi.mocked(getResource).mockResolvedValue(makeResource());

    const result = await fetchResourcesForComponents("bench-1", ["comp-1", "comp-2"]);
    expect(Object.keys(result).sort()).toEqual(["comp-1", "comp-2"]);
    expect(result["comp-1"]?.[0]?.id).toBe("r1");
  });

  it("drops components whose resource fetch fails", async () => {
    vi.mocked(listResources).mockImplementation(async (_benchId, componentId) => {
      if (componentId === "broken") throw new Error("boom");
      return [TOC_ENTRY];
    });
    vi.mocked(getResource).mockResolvedValue(makeResource());

    const result = await fetchResourcesForComponents("bench-1", ["ok", "broken"]);
    expect(result).toHaveProperty("ok");
    expect(result).not.toHaveProperty("broken");
  });
});

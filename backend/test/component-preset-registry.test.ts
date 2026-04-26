import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  loadCurrentPresetRegistry,
  loadPresetFromMarkdownFile,
  reviewPresetCoverage,
} from "../src/component-preset-registry.js";

describe("component preset registry", () => {
  it("loads the protocols preset from the prompt-engineering package", async () => {
    const preset = await loadPresetFromMarkdownFile(
      path.join(process.cwd(), "..", "docs", "preset-components", "protocols", "README.md"),
    );

    expect(preset.id).toBe("protocols");
    expect(preset.shortDescription).toContain("published lab protocols");
    expect(preset.detailedDescription).toContain("procedural foundation");
    expect(preset.preprompt).toContain("You are the **protocols** component of BenchPilot");
  });

  it("builds the current backend preset registry with exact and provisional entries", async () => {
    const registry = await loadCurrentPresetRegistry(path.join(process.cwd(), ".."));

    expect(Object.keys(registry).sort()).toEqual([
      "budget",
      "experiment-planner",
      "literature",
      "orchestrator",
      "protocols",
      "reviewer",
      "timeline",
    ]);
    expect(registry.protocols.source).toEqual({
      kind: "doc-package",
      path: "docs/preset-components/protocols/README.md",
    });
    expect(registry["experiment-planner"].source).toEqual({
      kind: "doc-package",
      path: "docs/preset-components/experiment-planner/README.md",
    });
    expect(registry["experiment-planner"].defaultToolMode).toBe("full");
    expect(registry.reviewer.source.kind).toBe("inline-provisional");
    expect(registry.orchestrator.source.kind).toBe("inline-provisional");
    expect(registry.literature.source.kind).toBe("inline-provisional");
  });

  it("makes the preset coverage mismatch explicit", () => {
    const review = reviewPresetCoverage();

    expect(review.officialPresetIds).toEqual([
      "orchestrator",
      "protocols",
      "budget",
      "timeline",
      "literature",
      "reviewer",
      "experiment-planner",
    ]);
    expect(review.preparedPromptPackages).toEqual([
      "experiment-planner",
      "protocols",
      "quick-literature-research",
      "reagents",
      "thorough-literature-research",
    ]);
    expect(review.exactMatches).toEqual(["experiment-planner", "protocols"]);
    expect(review.notes.join(" ")).toContain("provisional inline presets");
  });
});

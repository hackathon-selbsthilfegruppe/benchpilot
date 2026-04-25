import { describe, expect, it } from "vitest";

import { resolvePreferredModel } from "../src/model-selection.js";

type FakeModel = { provider: string; id: string };

function createRegistry(models: FakeModel[]) {
  return {
    find(provider: string, id: string) {
      return models.find((model) => model.provider === provider && model.id === id);
    },
  };
}

describe("resolvePreferredModel", () => {
  it("prefers openai-codex/gpt-5.4-mini when no env override is set", () => {
    const model = resolvePreferredModel(
      createRegistry([
        { provider: "openai-codex", id: "gpt-5.4-mini" },
        { provider: "openai-codex", id: "gpt-5.5" },
      ]),
      undefined,
    );

    expect(model).toEqual({ provider: "openai-codex", id: "gpt-5.4-mini" });
  });

  it("uses the configured model when provided", () => {
    const model = resolvePreferredModel(
      createRegistry([{ provider: "openai-codex", id: "gpt-5.5" }]),
      "openai-codex/gpt-5.5",
    );

    expect(model).toEqual({ provider: "openai-codex", id: "gpt-5.5" });
  });

  it("returns undefined when no preferred fallback exists", () => {
    const model = resolvePreferredModel(createRegistry([{ provider: "anthropic", id: "claude-sonnet-4-5" }]), undefined);
    expect(model).toBeUndefined();
  });

  it("throws for invalid configured ids", () => {
    expect(() => resolvePreferredModel(createRegistry([]), "gpt-5.4-mini")).toThrow(
      "Invalid model id: gpt-5.4-mini. Expected provider/model-id",
    );
  });

  it("throws when a configured model is missing", () => {
    expect(() => resolvePreferredModel(createRegistry([]), "openai-codex/gpt-5.4-mini")).toThrow(
      "Configured model not found: openai-codex/gpt-5.4-mini",
    );
  });
});

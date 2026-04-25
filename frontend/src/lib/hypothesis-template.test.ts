import { describe, it, expect } from "vitest";
import {
  buildDraftPrompt,
  extractJsonBlock,
  parseTemplateDraft,
  slugify,
} from "./hypothesis-template";

describe("extractJsonBlock", () => {
  it("pulls JSON from a fenced code block", () => {
    const text = "Here is the template:\n```json\n{\"a\":1}\n```\nThanks";
    expect(extractJsonBlock(text)).toBe('{"a":1}');
  });

  it("falls back to bare JSON object", () => {
    expect(extractJsonBlock('{"a":1}')).toBe('{"a":1}');
  });

  it("returns null when no JSON is present", () => {
    expect(extractJsonBlock("nope")).toBeNull();
  });
});

describe("parseTemplateDraft", () => {
  it("parses a well-formed template", () => {
    const text = JSON.stringify({
      hypothesis: { name: "H", summary: "s", preprompt: "p" },
      components: [
        { id: "step-1", name: "Step 1", preprompt: "do it", summary: "sum" },
      ],
      supporting: [
        { id: "protocols", name: "Protocols", preprompt: "p", summary: "s" },
      ],
    });
    const tpl = parseTemplateDraft(text);
    expect(tpl.hypothesis.name).toBe("H");
    expect(tpl.components).toHaveLength(1);
    expect(tpl.components[0].id).toBe("step-1");
    expect(tpl.supporting).toHaveLength(1);
  });

  it("re-slugs missing/dirty ids", () => {
    const text = JSON.stringify({
      hypothesis: { name: "H", summary: "s", preprompt: "p" },
      components: [{ name: "Cell Culture", preprompt: "x", summary: "y" }],
    });
    expect(parseTemplateDraft(text).components[0].id).toBe("cell-culture");
  });

  it("rejects missing components array", () => {
    const text = JSON.stringify({
      hypothesis: { name: "H", summary: "s", preprompt: "p" },
    });
    expect(() => parseTemplateDraft(text)).toThrow(/components/);
  });
});

describe("slugify", () => {
  it("kebab-cases mixed input", () => {
    expect(slugify("Enzyme pH-stability!")).toBe("enzyme-ph-stability");
  });

  it("falls back to 'untitled' for empty", () => {
    expect(slugify("   ")).toBe("untitled");
  });
});

describe("buildDraftPrompt", () => {
  it("includes the question and protocol titles", () => {
    const prompt = buildDraftPrompt({
      question: "Why is enzyme X unstable at low pH?",
      protocols: [
        { sourceId: "protocols-io", title: "pH–activity assay", url: "https://x" },
      ],
    });
    expect(prompt).toContain("Why is enzyme X unstable at low pH?");
    expect(prompt).toContain("pH–activity assay");
    expect(prompt).toContain("[protocols-io]");
  });

  it("handles empty protocol list", () => {
    const prompt = buildDraftPrompt({ question: "q", protocols: [] });
    expect(prompt).toContain("no external protocols selected");
  });
});

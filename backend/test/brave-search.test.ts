import { describe, expect, it } from "vitest";

import {
  parseBsearchOutput,
  parseBxJsonOutput,
} from "../src/literature/sources/brave-search.js";

describe("brave-search adapter parsers", () => {
  it("parses bx (official Brave CLI) JSON output into canonical hits", () => {
    const stdout = JSON.stringify({
      web: {
        results: [
          {
            title: "Catalase activity in potato cells",
            url: "https://example.org/catalase",
            description: "<b>Catalase</b> activity rises with pH ...",
            age: "Published 2021-04-12",
          },
          {
            title: "Untitled, no url",
            description: "should be skipped",
          },
          {
            title: "",
            url: "https://example.org/no-title",
          },
        ],
      },
    });

    const hits = parseBxJsonOutput(stdout);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({
      source: "brave-search",
      title: "Catalase activity in potato cells",
      sourceUrl: "https://example.org/catalase",
      year: 2021,
    });
    expect(hits[0].abstract).toBe("Catalase activity rises with pH ...");
  });

  it("parses bsearch (npm hobby CLI) numbered-list output into canonical hits", () => {
    const stdout = [
      'Found 2 results for "catalase":',
      "",
      "1. Catalase activity in potato cells",
      "   https://example.org/catalase",
      "   Description blob about pH and catalase.",
      "",
      "2. Effect of pH on enzymes",
      "   https://example.org/ph-effect",
      "   Some more description text.",
      "",
    ].join("\n");

    const hits = parseBsearchOutput(stdout);
    expect(hits).toHaveLength(2);
    expect(hits[0].title).toBe("Catalase activity in potato cells");
    expect(hits[0].sourceUrl).toBe("https://example.org/catalase");
    expect(hits[0].abstract).toBe("Description blob about pH and catalase.");
    expect(hits[1].sourceUrl).toBe("https://example.org/ph-effect");
  });

  it("returns no hits for malformed JSON-less bx output", () => {
    expect(() => parseBxJsonOutput("not-json")).toThrow();
  });
});

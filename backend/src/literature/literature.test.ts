import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { XMLParser } from "fast-xml-parser";
import { describe, expect, it } from "vitest";

import { pubmedArticleToCanonical } from "./index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, "__fixtures__");

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: true,
});

function readArticle(rel: string) {
  const xml = readFileSync(path.join(FIXTURES, rel), "utf-8");
  const parsed = xmlParser.parse(xml) as {
    PubmedArticleSet?: { PubmedArticle?: unknown };
  };
  const a = parsed.PubmedArticleSet?.PubmedArticle;
  if (!a) throw new Error(`fixture ${rel} has no PubmedArticle`);
  // efetch can return a single article or an array; the fixture has one.
  return Array.isArray(a) ? a[0] : a;
}

describe("pubmed adapter", () => {
  it("converts the MIQE article XML to canonical", () => {
    const article = readArticle("pubmed/efetch-miqe.xml");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = pubmedArticleToCanonical(article as any);
    expect(c.source).toBe("pubmed");
    expect(c.id).toBe("pubmed:19246619");
    expect(c.pubmedId).toBe("19246619");
    expect(c.doi).toBe("10.1373/clinchem.2008.112797");
    expect(c.title.startsWith("The MIQE guidelines")).toBe(true);
    expect(c.journal).toBe("Clinical chemistry");
    expect(c.authors).toEqual([
      "Stephen A Bustin",
      "Vladimir Benes",
      "Jeremy A Garson",
    ]);
    expect(c.publishedAt).toBe("2009-04-01T00:00:00.000Z");
    expect(c.abstract).toContain("BACKGROUND:");
    expect(c.abstract).toContain("CONTENT:");
    expect(c.keywords).toEqual(["qPCR", "MIQE", "reproducibility"]);
    expect(c.sourceUrl).toBe("https://pubmed.ncbi.nlm.nih.gov/19246619/");
  });

  it("does NOT invent a PMC ID for the MIQE paper (it has no free PMC version)", () => {
    const article = readArticle("pubmed/efetch-miqe.xml");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = pubmedArticleToCanonical(article as any);
    expect(c.pmcId).toBeUndefined();
  });
});

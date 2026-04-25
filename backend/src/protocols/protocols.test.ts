import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  bioschemasToCanonical,
  canonicalToBioschemas,
  canonicalToCrossrefMessage,
  canonicalToJats,
  canonicalToMediawiki,
  canonicalToProtocolsIo,
  crossrefMessageToEnvelope,
  jatsToCanonical,
  mediawikiToCanonical,
  protocolsIoToCanonical,
  protocolsIoToEnvelope,
  type CanonicalProtocol,
} from "./index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, "__fixtures__");

function readJson<T>(rel: string): T {
  const raw = readFileSync(path.join(FIXTURES, rel), "utf-8");
  return JSON.parse(raw) as T;
}

function readText(rel: string): string {
  return readFileSync(path.join(FIXTURES, rel), "utf-8");
}

interface ProtocolsIoSearchResponse {
  items: Parameters<typeof protocolsIoToEnvelope>[0][];
}

describe("protocols-io adapter", () => {
  it("converts a search hit to an envelope", () => {
    const body = readJson<ProtocolsIoSearchResponse>(
      "protocols-io/search-pcr.json",
    );
    const first = body.items[0];
    if (!first) throw new Error("fixture is empty");
    const env = protocolsIoToEnvelope(first);
    expect(env.source).toBe("protocols.io");
    expect(env.id.startsWith("protocols.io:")).toBe(true);
    expect(env.title).toBeTruthy();
    expect(env.sourceUrl).toMatch(/^https:\/\/www\.protocols\.io\//);
    expect(env.rawSourceRef.kind).toBe("protocols.io");
  });

  it("flattens Draft.js descriptions to plain text", () => {
    const body = readJson<ProtocolsIoSearchResponse>(
      "protocols-io/search-pcr.json",
    );
    const env = protocolsIoToEnvelope(body.items[0]!);
    expect(env.abstract).toBeDefined();
    expect(env.abstract).not.toContain("{");
    expect(env.abstract).not.toContain("\"blocks\"");
  });

  it("converts a full detail response to a CanonicalProtocol with steps", () => {
    const body = readJson<{ protocol: Parameters<typeof protocolsIoToCanonical>[0] }>(
      "protocols-io/fish-detail.json",
    );
    const proto = protocolsIoToCanonical(body.protocol);
    expect(proto.source).toBe("protocols.io");
    expect(proto.title.length).toBeGreaterThan(0);
    expect(proto.steps.length).toBeGreaterThan(0);
    for (const s of proto.steps) {
      expect(s.position).toBeTypeOf("number");
      expect(s.text.length).toBeGreaterThan(0);
      expect(s.text).not.toMatch(/<\/?[a-z]+/i);
    }
  });
});

describe("crossref adapter", () => {
  it("converts a Crossref work message to an envelope (Nature Protocols sample)", () => {
    const body = readJson<{ message: Parameters<typeof crossrefMessageToEnvelope>[0] }>(
      "crossref/nature-protocols.json",
    );
    const env = crossrefMessageToEnvelope(body.message);
    expect(env.source).toBe("crossref");
    expect(env.doi).toBe("10.1038/nprot.2008.73");
    expect(env.title.length).toBeGreaterThan(0);
    expect(env.authors.length).toBeGreaterThan(0);
    expect(env.publishedAt).toBeDefined();
  });
});

describe("bioschemas adapter", () => {
  it("converts a LabProtocol JSON-LD to canonical", () => {
    const json = readText("bioschemas/sample.jsonld");
    const proto = bioschemasToCanonical(json);
    expect(proto.source).toBe("bioschemas");
    expect(proto.title).toBe("Trypan blue cell viability assay");
    expect(proto.doi).toBe("10.21769/BioProtoc.demo.0001");
    expect(proto.authors).toEqual(["Jane Doe", "Alex Lee"]);
    expect(proto.steps).toHaveLength(3);
    expect(proto.steps[0]).toEqual({
      position: 1,
      text: "Resuspend cells in PBS to 1×10^6/mL.",
      duration: "PT5M",
    });
    expect(proto.tools.map((t) => t.name)).toContain("hemocytometer");
    expect(proto.supplies.map((s) => s.name)).toContain("trypan blue 0.4%");
    expect(proto.references[0]?.doi).toBe("10.1002/0471142735.ima03bs111");
    expect(proto.license).toBe("https://creativecommons.org/licenses/by/4.0/");
  });

  it("rejects records that are not LabProtocol/HowTo", () => {
    expect(() =>
      bioschemasToCanonical({
        "@type": "Person",
        name: "Not a protocol",
      } as unknown as Parameters<typeof bioschemasToCanonical>[0]),
    ).toThrow(/LabProtocol or HowTo/);
  });
});

describe("jats adapter", () => {
  it("converts a JATS protocol XML to canonical", () => {
    const xml = readText("jats/sample.xml");
    const proto = jatsToCanonical(xml, { sourceUrl: "https://example.org/p2" });
    expect(proto.source).toBe("jats");
    expect(proto.title).toBe("pH–activity assay for soluble enzymes");
    expect(proto.doi).toBe("10.21769/BioProtoc.demo.0002");
    expect(proto.authors).toEqual(["Vera Marsh", "Anke Schmidt"]);
    expect(proto.publishedAt).toBe("2024-03-15T00:00:00.000Z");
    expect(proto.abstract).toContain("buffer-series");
    expect(proto.steps).toHaveLength(4);
    expect(proto.steps[0]?.section).toBe("Procedure");
    expect(proto.references[0]?.doi).toBe("10.1016/example");
  });
});

describe("mediawiki adapter", () => {
  it("converts an OpenWetWare-style page to canonical", () => {
    const wikitext = readText("mediawiki/sample.txt");
    const proto = mediawikiToCanonical({
      pageTitle: "Standard PCR",
      pageUrl: "https://openwetware.org/wiki/Standard_PCR",
      wikitext,
    });
    expect(proto.source).toBe("mediawiki");
    expect(proto.title).toBe("Standard PCR");
    expect(proto.steps).toHaveLength(5);
    expect(proto.steps[0]?.text).toMatch(/Place PCR tubes on ice/);
    expect(proto.steps[3]?.text).toBe(
      "Run on the thermocycler with the Standard PCR cycle profile.",
    );
    expect(proto.supplies.map((s) => s.name)).toContain("Plasmid template (10 ng/µL)");
    expect(proto.tools.map((t) => t.name)).toContain("Thermocycler (Bio-Rad C1000)");
  });
});

/* --------------------------- reverse mappers -------------------------- */

function fixture(): CanonicalProtocol {
  return {
    id: "test:fixture-1",
    source: "manual",
    sourceUrl: "https://example.org/protocols/fixture-1",
    doi: "10.0000/example.fixture.1",
    title: "Round-trip fixture protocol",
    authors: ["Vera Marsh", "Anke Schmidt"],
    abstract: "A short abstract for the round-trip fixture.",
    publishedAt: "2024-03-15T00:00:00.000Z",
    license: "https://creativecommons.org/licenses/by/4.0/",
    steps: [
      { position: 1, text: "Prepare buffers spanning pH 4.0–8.0.", duration: "PT5M" },
      { position: 2, text: "Equilibrate enzyme aliquots at room temperature for 5 min." },
      { position: 3, text: "Initiate assay; record activity at each pH (n=3 per condition)." },
    ],
    supplies: [
      { name: "Buffer panel", identifier: "BUF-001" },
      { name: "Activity substrate", notes: "Sigma S0001" },
    ],
    tools: [
      { name: "Plate reader", identifier: "RRID:SCR_009999" },
    ],
    references: [
      {
        title: "Buffer systems for biochemistry",
        url: "https://doi.org/10.1016/example",
        doi: "10.1016/example",
      },
    ],
    rawSourceRef: { kind: "manual", uri: "fixture-1" },
  };
}

describe("bioschemas reverse mapper", () => {
  it("emits a LabProtocol JSON-LD with the canonical fields", () => {
    const out = canonicalToBioschemas(fixture());
    expect(out["@context"]).toBe("https://schema.org");
    expect(out["@type"]).toEqual(["LabProtocol", "CreativeWork"]);
    expect(out.name).toBe("Round-trip fixture protocol");
    expect(out.doi).toBe("10.0000/example.fixture.1");
    expect(Array.isArray(out.author) ? out.author : [out.author]).toHaveLength(2);
    const stepArr = Array.isArray(out.step) ? out.step : out.step ? [out.step] : [];
    expect(stepArr).toHaveLength(3);
    expect(stepArr[0]?.totalTime).toBe("PT5M");
  });

  it("round-trips canonical → bioschemas → canonical", () => {
    const orig = fixture();
    const back = bioschemasToCanonical(canonicalToBioschemas(orig));
    expect(back.title).toBe(orig.title);
    expect(back.doi).toBe(orig.doi);
    expect(back.authors).toEqual(orig.authors);
    expect(back.abstract).toBe(orig.abstract);
    expect(back.publishedAt).toBe(orig.publishedAt);
    expect(back.license).toBe(orig.license);
    expect(back.steps.map((s) => ({ position: s.position, text: s.text, duration: s.duration })))
      .toEqual(orig.steps.map((s) => ({ position: s.position, text: s.text, duration: s.duration })));
    expect(back.tools.map((t) => t.name)).toEqual(orig.tools.map((t) => t.name));
    expect(back.supplies.map((s) => s.name)).toEqual(orig.supplies.map((s) => s.name));
    expect(back.references[0]?.doi).toBe(orig.references[0]?.doi);
  });
});

describe("jats reverse mapper", () => {
  it("emits parseable JATS XML with the canonical fields", () => {
    const xml = canonicalToJats(fixture());
    expect(xml.startsWith("<?xml")).toBe(true);
    expect(xml).toContain("<article-title>Round-trip fixture protocol</article-title>");
    expect(xml).toContain("<surname>Marsh</surname>");
    expect(xml).toContain("<list list-type=\"order\">");
    expect(xml).toContain("10.0000/example.fixture.1");
  });

  it("round-trips canonical → JATS → canonical (lossy on supplies/tools)", () => {
    const orig = fixture();
    const xml = canonicalToJats(orig);
    const back = jatsToCanonical(xml, { sourceUrl: orig.sourceUrl });
    expect(back.title).toBe(orig.title);
    expect(back.doi).toBe(orig.doi);
    expect(back.authors).toEqual(orig.authors);
    expect(back.publishedAt).toBe(orig.publishedAt);
    expect(back.abstract).toBe(orig.abstract);
    expect(back.steps.map((s) => s.text)).toEqual(orig.steps.map((s) => s.text));
    expect(back.references[0]?.doi).toBe(orig.references[0]?.doi);
    // JATS doesn't model supplies / tools — they round back as empty.
    expect(back.supplies).toEqual([]);
    expect(back.tools).toEqual([]);
  });
});

describe("mediawiki reverse mapper", () => {
  it("emits wikitext with Materials / Equipment / Procedure sections", () => {
    const wikitext = canonicalToMediawiki(fixture());
    expect(wikitext).toMatch(/'''Round-trip fixture protocol'''/);
    expect(wikitext).toMatch(/== Materials ==/);
    expect(wikitext).toMatch(/== Equipment ==/);
    expect(wikitext).toMatch(/== Procedure ==/);
    expect(wikitext).toMatch(/^# Prepare buffers spanning pH 4\.0–8\.0\./m);
    expect(wikitext).toMatch(/\* Buffer panel \(BUF-001\)/);
  });

  it("round-trips canonical → wikitext → canonical (steps + lists)", () => {
    const orig = fixture();
    const wikitext = canonicalToMediawiki(orig);
    const back = mediawikiToCanonical({
      pageTitle: orig.title,
      pageUrl: orig.sourceUrl,
      wikitext,
    });
    expect(back.title).toBe(orig.title);
    expect(back.steps.map((s) => s.text)).toEqual(orig.steps.map((s) => s.text));
    expect(back.tools[0]?.name).toContain("Plate reader");
    expect(back.supplies.map((s) => s.name)).toContain("Buffer panel (BUF-001)");
  });
});

describe("protocols.io reverse mapper", () => {
  it("emits a protocols.io-shaped record and round-trips through the forward converter", () => {
    const orig = fixture();
    const raw = canonicalToProtocolsIo(orig);
    expect(raw.title).toBe(orig.title);
    expect(raw.uri).toBeTruthy();
    expect(raw.steps).toHaveLength(orig.steps.length);
    expect(raw.steps[0]?.duration).toBe(5 * 60);
    expect(raw.materials).toHaveLength(orig.supplies.length);

    const back = protocolsIoToCanonical(raw);
    expect(back.title).toBe(orig.title);
    expect(back.doi).toBe(orig.doi);
    expect(back.publishedAt).toBe(orig.publishedAt);
    expect(back.steps.map((s) => s.text)).toEqual(orig.steps.map((s) => s.text));
    expect(back.steps[0]?.duration).toBe("PT300S");
    expect(back.supplies.map((s) => s.name)).toEqual(orig.supplies.map((s) => s.name));
    expect(back.references[0]?.doi).toBe(orig.references[0]?.doi);
  });
});

describe("crossref reverse mapper", () => {
  it("emits a crossref message and round-trips the envelope fields", () => {
    const orig = fixture();
    const msg = canonicalToCrossrefMessage(orig);
    expect(msg.DOI).toBe(orig.doi);
    expect(msg.title?.[0]).toBe(orig.title);
    expect(msg.author?.[0]?.family).toBe("Marsh");

    const back = crossrefMessageToEnvelope(msg);
    expect(back.title).toBe(orig.title);
    expect(back.doi).toBe(orig.doi);
    expect(back.authors).toEqual(orig.authors);
    expect(back.abstract).toBe(orig.abstract);
    expect(back.publishedAt).toBe(orig.publishedAt);
    expect(back.license).toBe(orig.license);
  });
});

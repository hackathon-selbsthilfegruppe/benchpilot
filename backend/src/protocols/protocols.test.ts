import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  bioschemasToCanonical,
  canonicalToBioschemas,
  canonicalToCrossrefMessage,
  canonicalToJats,
  canonicalToMediawiki,
  canonicalToProtocolsIo,
  crossrefMessageToEnvelope,
  fetchCrossref,
  fetchProtocolIo,
  jatsToCanonical,
  mediawikiToCanonical,
  protocolsIoToCanonical,
  protocolsIoToEnvelope,
  searchProtocolsIo,
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

/* ---------------------------- edge cases ------------------------------ */

describe("bioschemas edge cases", () => {
  it("handles bare-string license and array-typed tools", () => {
    const json = readText("bioschemas/array-tool-and-string-license.jsonld");
    const proto = bioschemasToCanonical(json);
    expect(proto.license).toBe("CC-BY-4.0");
    expect(proto.tools.map((t) => t.name)).toEqual([
      "centrifuge",
      "vortex mixer",
    ]);
  });

  it("merges per-step tools/supplies and falls back to step.name when text is missing", () => {
    const json = readText("bioschemas/howto-with-step-tools.jsonld");
    const proto = bioschemasToCanonical(json);
    // step 1 supply pulled up to top-level supplies
    expect(proto.supplies.map((s) => s.name)).toEqual(["buffer A"]);
    expect(proto.tools.map((t) => t.name)).toEqual(["water bath"]);
    // step 2 has no `text` — should fall through to `name`
    expect(proto.steps[1]?.text).toBe(
      "Without text — uses name as fallback",
    );
    // string position "1" coerces to number 1
    expect(proto.steps[0]?.position).toBe(1);
  });
});

describe("jats edge cases", () => {
  it("reads references from <mixed-citation> when <element-citation> is absent", () => {
    const xml = readText("jats/mixed-citation.xml");
    const proto = jatsToCanonical(xml);
    expect(proto.references).toHaveLength(1);
    expect(proto.references[0]?.doi).toBe("10.1016/older");
    expect(proto.references[0]?.title).toContain("Older mixed-citation");
  });

  it("supports <string-name> in contrib instead of <name><surname/>", () => {
    const xml = readText("jats/mixed-citation.xml");
    const proto = jatsToCanonical(xml);
    expect(proto.authors).toEqual(["Vera Marsh"]);
  });

  it("falls back to procedure section paragraphs when there is no ordered list", () => {
    const xml = `<?xml version="1.0"?><article>
      <front><article-meta>
        <title-group><article-title>Para procedure</article-title></title-group>
      </article-meta></front>
      <body>
        <sec sec-type="procedure">
          <title>Procedure</title>
          <p>First paragraph step.</p>
          <p>Second paragraph step.</p>
        </sec>
      </body>
    </article>`;
    const proto = jatsToCanonical(xml);
    expect(proto.steps).toHaveLength(2);
    expect(proto.steps[0]?.text).toMatch(/First paragraph step/);
  });
});

describe("mediawiki edge cases", () => {
  it("returns empty steps/supplies/tools when sections are missing", () => {
    const wikitext = readText("mediawiki/no-headings.txt");
    const proto = mediawikiToCanonical({
      pageTitle: "Free-form lab note",
      pageUrl: "https://example.org/owsample",
      wikitext,
    });
    expect(proto.steps).toEqual([]);
    expect(proto.supplies).toEqual([]);
    expect(proto.tools).toEqual([]);
  });

  it("handles a procedure-only page with no Materials/Equipment headings", () => {
    const wikitext = readText("mediawiki/procedure-only.txt");
    const proto = mediawikiToCanonical({
      pageTitle: "Minimal procedure",
      pageUrl: "https://example.org/min",
      wikitext,
    });
    expect(proto.steps.map((s) => s.text)).toEqual([
      "Wash plates twice with PBS.",
      "Add fresh medium and incubate.",
    ]);
    expect(proto.supplies).toEqual([]);
    expect(proto.tools).toEqual([]);
  });
});

/* ---------------------------- network mocks --------------------------- */

const ORIGINAL_FETCH = global.fetch;
const ORIGINAL_TOKEN = process.env.PROTOCOLS_IO_TOKEN;

function mockFetchOnce(body: unknown, init: ResponseInit = { status: 200 }) {
  const fn = vi.fn(async () =>
    new Response(JSON.stringify(body), {
      ...init,
      headers: { "Content-Type": "application/json" },
    }),
  );
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

describe("network wrappers (mocked fetch)", () => {
  beforeEach(() => {
    process.env.PROTOCOLS_IO_TOKEN = "test-token";
  });
  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
    if (ORIGINAL_TOKEN === undefined) delete process.env.PROTOCOLS_IO_TOKEN;
    else process.env.PROTOCOLS_IO_TOKEN = ORIGINAL_TOKEN;
  });

  it("searchProtocolsIo: sends Bearer token and converts hits to envelopes", async () => {
    const fetchSpy = mockFetchOnce({
      items: [
        {
          id: 1,
          uri: "demo-uri",
          title: "Demo",
          authors: [{ name: "A B" }],
          url: "https://www.protocols.io/view/demo-uri",
        },
      ],
      status_code: 0,
    });

    const hits = await searchProtocolsIo("PCR", 5);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.id).toBe("protocols.io:demo-uri");

    expect(fetchSpy).toHaveBeenCalledOnce();
    const callArgs = fetchSpy.mock.calls[0]!;
    const url = callArgs[0] as URL;
    expect(url.searchParams.get("key")).toBe("PCR");
    expect(url.searchParams.get("page_size")).toBe("5");
    const init = callArgs[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-token");
  });

  it("searchProtocolsIo: throws on non-zero status_code", async () => {
    mockFetchOnce({ status_code: 1, error_message: "boom" });
    await expect(searchProtocolsIo("PCR")).rejects.toThrow(/status_code 1/);
  });

  it("searchProtocolsIo: throws on HTTP non-2xx with body excerpt", async () => {
    mockFetchOnce({ error: "rate limited" }, { status: 429 });
    await expect(searchProtocolsIo("PCR")).rejects.toThrow(/HTTP 429/);
  });

  it("fetchProtocolIo: returns canonical from a detail response", async () => {
    mockFetchOnce({
      protocol: {
        id: 99,
        uri: "demo-detail",
        title: "Detail demo",
        authors: [{ name: "Z" }],
        steps: [
          { number: 1, step: "<p>do thing</p>", components: [] },
        ],
      },
      status_code: 0,
    });
    const proto = await fetchProtocolIo("demo-detail");
    expect(proto.id).toBe("protocols.io:demo-detail");
    expect(proto.steps[0]?.text).toBe("do thing");
  });

  it("fetchProtocolIo: throws when the API omits the protocol field", async () => {
    mockFetchOnce({ status_code: 0 });
    await expect(fetchProtocolIo("nope")).rejects.toThrow(/missing `protocol`/);
  });

  it("token(): missing PROTOCOLS_IO_TOKEN propagates a clear error", async () => {
    delete process.env.PROTOCOLS_IO_TOKEN;
    await expect(searchProtocolsIo("PCR")).rejects.toThrow(
      /PROTOCOLS_IO_TOKEN is not set/,
    );
  });

  it("fetchCrossref: maps `message` to envelope; passes Accept header", async () => {
    const fetchSpy = mockFetchOnce({
      message: {
        DOI: "10.1234/example",
        URL: "https://doi.org/10.1234/example",
        title: ["Mocked work"],
        author: [{ given: "First", family: "Last" }],
        issued: { "date-parts": [[2024, 6, 1]] },
      },
    });
    const env = await fetchCrossref("10.1234/example");
    expect(env.title).toBe("Mocked work");
    expect(env.doi).toBe("10.1234/example");
    expect(env.authors).toEqual(["First Last"]);
    const headers = (fetchSpy.mock.calls[0]![1] as RequestInit).headers as Record<string, string>;
    expect(headers.Accept).toBe("application/json");
    expect(headers["User-Agent"]).toContain("BenchPilot");
  });

  it("fetchCrossref: rejects on HTTP failure", async () => {
    mockFetchOnce({ status: "fail" }, { status: 404 });
    await expect(fetchCrossref("10.0/missing")).rejects.toThrow(/HTTP 404/);
  });

  it("fetchCrossref: rejects when message is missing", async () => {
    mockFetchOnce({ status: "ok" });
    await expect(fetchCrossref("10.0/empty")).rejects.toThrow(
      /missing `message`/,
    );
  });
});

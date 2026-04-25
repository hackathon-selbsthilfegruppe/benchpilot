import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  addgenePlasmidToCanonical,
  addgenePlasmidToEnvelope,
  cellosaurusToCanonical,
  idtCatalogItemToCanonical,
  parseCellosaurusDump,
  parseCellosaurusRecord,
  quartzyItemToCanonical,
  quartzyItemToEnvelope,
  type AddgenePlasmid,
  type QuartzyInventoryItem,
} from "./index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, "__fixtures__");

function readJson<T>(rel: string): T {
  return JSON.parse(readFileSync(path.join(FIXTURES, rel), "utf-8")) as T;
}
function readText(rel: string): string {
  return readFileSync(path.join(FIXTURES, rel), "utf-8");
}

describe("addgene adapter", () => {
  it("maps a plasmid record to canonical", () => {
    const p = readJson<AddgenePlasmid>("addgene/pkasi.json");
    const c = addgenePlasmidToCanonical(p);
    expect(c.source).toBe("addgene");
    expect(c.kind).toBe("plasmid");
    expect(c.id).toBe("addgene:plasmid:16077");
    expect(c.identifier).toBe("16077");
    expect(c.name).toBe("pCAG-Cre");
    expect(c.vendor).toBe("Connie Cepko Lab");
    expect(c.attributes.vector_type).toBe("Mammalian Expression");
    expect(c.attributes.expression).toBe("Mammalian Cells");
    expect(c.references).toHaveLength(1);
    expect(c.references[0]?.pubmedId).toBe("11697861");
    expect(c.references[0]?.doi).toBe("10.1006/dbio.2001.0439");
  });

  it("envelope keeps a teaser instead of the full description", () => {
    const p = readJson<AddgenePlasmid>("addgene/pkasi.json");
    const env = addgenePlasmidToEnvelope(p);
    expect(env.teaser).toContain("Cre recombinase");
    expect(env).not.toHaveProperty("description");
    expect(env).not.toHaveProperty("attributes");
  });
});

describe("cellosaurus adapter", () => {
  it("parses the on-the-wire text format", () => {
    const txt = readText("cellosaurus/hela.txt");
    const rec = parseCellosaurusRecord(txt);
    expect(rec.ID).toBe("HeLa");
    expect(rec.AC).toBe("CVCL_0030");
    expect(rec.SY).toEqual([
      "HELA",
      "HeLa-CCL2",
      "Henrietta Lacks cells",
    ]);
    expect(rec.DR?.find((d) => d.resource === "ATCC")?.id).toBe("CCL-2");
    expect(rec.RX?.[0]?.type).toBe("PubMed");
    expect(rec.RX?.[0]?.id).toBe("13502878");
  });

  it("dump splitter handles single-record input cleanly", () => {
    const txt = readText("cellosaurus/hela.txt");
    const records = parseCellosaurusDump(txt);
    expect(records).toHaveLength(1);
    expect(records[0]?.AC).toBe("CVCL_0030");
  });

  it("maps a record to canonical and prefers ATCC as vendor", () => {
    const rec = parseCellosaurusRecord(readText("cellosaurus/hela.txt"));
    const c = cellosaurusToCanonical(rec);
    expect(c.source).toBe("cellosaurus");
    expect(c.kind).toBe("cell-line");
    expect(c.id).toBe("cellosaurus:cell-line:CVCL_0030");
    expect(c.identifier).toBe("CVCL_0030");
    expect(c.vendor).toBe("ATCC CCL-2");
    expect(c.synonyms).toContain("HELA");
    expect(c.attributes.sex).toBe("Female");
    expect(c.attributes.cross_references).toContain("DSMZ:ACC-57");
    expect(c.references.find((r) => r.pubmedId === "13502878")).toBeTruthy();
  });

  it("rejects records missing ID or AC", () => {
    expect(() => parseCellosaurusRecord("DT   01-JAN-2026\n//\n")).toThrow(
      /missing required ID\/AC/,
    );
  });
});

describe("quartzy adapter", () => {
  it("maps an inventory item to canonical and infers kind from type", () => {
    const item = readJson<QuartzyInventoryItem>("quartzy/inventory-item.json");
    const c = quartzyItemToCanonical(item);
    expect(c.source).toBe("quartzy");
    expect(c.kind).toBe("antibody");
    expect(c.id).toBe("quartzy:antibody:qz_abc123");
    expect(c.identifier).toBe("ab12345");
    expect(c.vendor).toBe("Abcam");
    expect(c.attributes.quartzy_type).toBe("Antibody");
    expect(c.attributes.unit_size).toBe("100 µg");
    expect(c.attributes.price).toBe("425 USD");
  });

  it("envelope strips heavy fields", () => {
    const item = readJson<QuartzyInventoryItem>("quartzy/inventory-item.json");
    const env = quartzyItemToEnvelope(item);
    expect(env.teaser).toContain("C-reactive protein");
    expect(env).not.toHaveProperty("description");
    expect(env).not.toHaveProperty("attributes");
  });
});

describe("idt stub", () => {
  it("builds a canonical record from a manual seed", () => {
    const c = idtCatalogItemToCanonical({
      sku: "OLIGO-123",
      name: "GAPDH forward primer",
      description: "Human GAPDH forward primer for qPCR",
    });
    expect(c.source).toBe("idt");
    expect(c.kind).toBe("oligo");
    expect(c.identifier).toBe("OLIGO-123");
    expect(c.vendor).toBe("Integrated DNA Technologies");
    expect(c.id).toBe("idt:oligo:OLIGO-123");
  });
});

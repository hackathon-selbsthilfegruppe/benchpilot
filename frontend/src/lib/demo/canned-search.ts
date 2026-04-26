// Canned literature + protocol hits served by the search API routes
// when BENCHPILOT_DEMO_MODE=1 is set on the Next.js server. Used by
// the e2e screencast so the demo flow never hits Semantic Scholar or
// protocols.io — and never depends on their availability or rate
// limits.

export function isDemoMode(): boolean {
  return process.env.BENCHPILOT_DEMO_MODE?.trim() === "1";
}

export const DEMO_LITERATURE_SOURCES = [
  {
    sourceId: "semantic-scholar",
    hits: [
      {
        sourceId: "semantic-scholar",
        externalId: "miller-2014-rapamycin-itp",
        title: "Rapamycin extends murine lifespan but has limited effects on aging",
        authors: "Miller et al.",
        year: 2014,
        url: "https://www.semanticscholar.org/paper/miller-2014",
        doi: "10.1111/acel.12194",
        summary:
          "ITP-style intervention testing in heterogeneous mice. Rapamycin started at 9 or 20 months extended median lifespan in both sexes.",
        citationCount: 361,
      },
      {
        sourceId: "semantic-scholar",
        externalId: "harrison-2009-rapamycin-lifespan",
        title: "Rapamycin fed late in life extends lifespan in genetically heterogeneous mice",
        authors: "Harrison et al.",
        year: 2009,
        url: "https://www.semanticscholar.org/paper/harrison-2009",
        doi: "10.1038/nature08221",
        summary:
          "Foundational ITP report: encapsulated rapamycin in chow extended median and maximal lifespan in both sexes.",
        citationCount: 2487,
      },
    ],
  },
];

export const DEMO_PROTOCOL_SOURCES = [
  {
    sourceId: "protocols-io",
    hits: [
      {
        sourceId: "protocols-io",
        externalId: "encapsulated-rapamycin-chow-prep",
        title: "Eudragit-encapsulated rapamycin chow preparation (ITP-style)",
        authors: "Wilkinson et al.",
        url: "https://www.protocols.io/view/encapsulated-rapamycin-chow",
        description:
          "Standard preparation of 14 ppm encapsulated rapamycin in chow with eudragit-only control batches.",
      },
      {
        sourceId: "protocols-io",
        externalId: "lifespan-monitoring-c57bl6j",
        title: "Longitudinal lifespan monitoring in C57BL/6J mice",
        authors: "Strong et al.",
        url: "https://www.protocols.io/view/lifespan-c57bl6j",
        description:
          "Daily welfare checks, biweekly weights, humane endpoint criteria, and necropsy SOP for in-vivo lifespan studies.",
      },
    ],
  },
];

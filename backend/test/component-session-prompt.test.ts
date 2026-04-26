import { describe, expect, it } from "vitest";

import { buildComponentSessionPrompt } from "../src/component-session-prompt.js";

describe("component session prompt builder", () => {
  it("builds a TOC-first prompt for a component session", () => {
    const prompt = buildComponentSessionPrompt({
      bench: {
        id: "bench-crp-biosensor",
        title: "CRP biosensor",
        question: "Can we build a paper-based electrochemical biosensor for CRP?",
        status: "active",
        updatedAt: "2026-04-25T19:12:00.000Z",
      },
      preset: {
        id: "protocols",
        name: "Protocols",
        shortDescription: "Finds and curates procedural foundations.",
        detailedDescription: "Detailed protocols description.",
        preprompt: "You are the protocols component.",
        defaultToolMode: "read-only",
        source: {
          kind: "doc-package",
          path: "docs/preset-components/protocols/README.md",
        },
      },
      self: {
        component: {
          id: "protocols-crp-biosensor",
          benchId: "bench-crp-biosensor",
          presetId: "protocols",
          name: "Protocols — CRP biosensor",
          summary: "Tracks protocol candidates.",
          requirementIds: ["req-protocol-family"],
          toolMode: "read-only",
          resourceCount: 2,
          status: "active",
          createdAt: "2026-04-25T19:10:00.000Z",
          updatedAt: "2026-04-25T19:12:00.000Z",
        },
        summary: "Tracks protocol candidates.\n",
        toc: [
          {
            id: "proto-001",
            benchId: "bench-crp-biosensor",
            componentInstanceId: "protocols-crp-biosensor",
            title: "ELISA-derived baseline protocol",
            kind: "protocol",
            description: "Protocol baseline",
            summary: "Protocol summary.",
            tags: ["crp"],
            updatedAt: "2026-04-25T19:12:00.000Z",
          },
        ],
      },
      requirements: [
        {
          id: "req-protocol-family",
          benchId: "bench-crp-biosensor",
          title: "Identify a viable protocol family",
          summary: "Find a procedural baseline for the experiment.",
          status: "open",
          componentInstanceIds: ["protocols-crp-biosensor"],
          resourceIds: [],
          createdAt: "2026-04-25T19:05:00.000Z",
          updatedAt: "2026-04-25T19:06:00.000Z",
        },
      ],
      others: [
        {
          component: {
            id: "literature-crp-biosensor",
            benchId: "bench-crp-biosensor",
            presetId: "literature",
            name: "Literature — CRP biosensor",
            summary: "Tracks novelty evidence.",
            requirementIds: ["req-assess-novelty"],
            toolMode: "read-only",
            resourceCount: 1,
            status: "active",
            createdAt: "2026-04-25T19:10:00.000Z",
            updatedAt: "2026-04-25T19:12:00.000Z",
          },
          summary: "Tracks novelty evidence.\n",
          toc: [
            {
              id: "lit-0007",
              benchId: "bench-crp-biosensor",
              componentInstanceId: "literature-crp-biosensor",
              title: "CRP prior art",
              kind: "paper-note",
              description: "Prior-art note",
              summary: "Literature summary.",
              tags: ["crp"],
              updatedAt: "2026-04-25T19:12:00.000Z",
            },
          ],
        },
      ],
    });

    expect(prompt).toContain("## Component pre-prompt");
    expect(prompt).toContain("You are the protocols component.");
    expect(prompt).toContain("## Requirements served by this component");
    expect(prompt).toContain("req-protocol-family");
    expect(prompt).toContain("## This component's TOC");
    expect(prompt).toContain("proto-001");
    expect(prompt).toContain("## Other components (cheap awareness only)");
    expect(prompt).toContain("literature-crp-biosensor");
    expect(prompt).not.toContain("Full resource bodies are injected by default");
  });
});

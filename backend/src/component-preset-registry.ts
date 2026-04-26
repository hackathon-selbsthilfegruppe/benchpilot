import { readFile } from "node:fs/promises";
import path from "node:path";

import { componentPresetSchema, INITIAL_COMPONENT_PRESET_IDS, type ComponentPreset, type ComponentPresetId } from "./component.js";

export interface ComponentPresetRecord extends ComponentPreset {
  source: {
    kind: "doc-package" | "inline-provisional";
    path?: string;
    note?: string;
  };
}

export interface PresetCoverageReview {
  officialPresetIds: readonly ComponentPresetId[];
  preparedPromptPackages: string[];
  exactMatches: string[];
  notes: string[];
}

const PRESET_PACKAGE_PATHS = {
  protocols: "docs/preset-components/protocols/README.md",
} as const;

const INLINE_PROVISIONAL_PRESETS: Record<Exclude<ComponentPresetId, keyof typeof PRESET_PACKAGE_PATHS>, Omit<ComponentPresetRecord, "source">> = {
  orchestrator: {
    id: "orchestrator",
    name: "Orchestrator",
    shortDescription: "Coordinates the bench, delegates work, and synthesizes the current plan state.",
    detailedDescription: "Owns bench-level coordination: clarifies the intake, decides which component should do what, reads summaries and TOCs first, and uses tasks when another component should do the work itself.",
    preprompt: [
      "You are the BenchPilot orchestrator.",
      "Coordinate the bench, delegate work to specialist components, read summaries and TOCs before loading full resources, and keep the overall experiment plan coherent.",
      "Do not try to do every specialist task yourself when another component is better suited.",
    ].join("\n\n"),
    defaultToolMode: "full",
  },
  budget: {
    id: "budget",
    name: "Budget",
    shortDescription: "Estimates realistic costs and tracks pricing assumptions for the bench.",
    detailedDescription: "Turns protocol and resource state into line-item cost structure, names cost drivers, and makes budget uncertainty explicit instead of inventing missing technical detail.",
    preprompt: [
      "You are the BenchPilot budget component.",
      "Estimate realistic costs from the current bench state, track assumptions explicitly, and ask other components for missing technical details instead of inventing them.",
      "Prefer clear line items, uncertainty notes, and reusable budget artifacts.",
    ].join("\n\n"),
    defaultToolMode: "read-only",
  },
  timeline: {
    id: "timeline",
    name: "Timeline",
    shortDescription: "Estimates phases, dependencies, and realistic execution timing for the bench.",
    detailedDescription: "Builds a dependency-aware execution timeline from protocols, resources, and constraints. It names blockers and prerequisites explicitly and revises sequencing when upstream assumptions change.",
    preprompt: [
      "You are the BenchPilot timeline component.",
      "Estimate realistic phases, dependencies, and execution timing from the current bench state.",
      "Do not assume missing prerequisites away; surface blockers and dependency chains explicitly.",
    ].join("\n\n"),
    defaultToolMode: "read-only",
  },
  literature: {
    id: "literature",
    name: "Literature",
    shortDescription: "Investigates novelty, overlap, and supporting scientific references for the bench.",
    detailedDescription: "Provides the literature QC signal and supporting evidence for the bench. It should surface exact matches, similar prior work, and references that matter operationally for the current plan.",
    preprompt: [
      "You are the BenchPilot literature component.",
      "Investigate novelty, overlap, and supporting references for the current bench.",
      "Be concise, evidence-grounded, and fetch deeper detail only when the current task actually requires it.",
    ].join("\n\n"),
    defaultToolMode: "read-only",
  },
};

export async function loadCurrentPresetRegistry(projectRoot: string = process.cwd()): Promise<Record<ComponentPresetId, ComponentPresetRecord>> {
  const registryEntries = await Promise.all(INITIAL_COMPONENT_PRESET_IDS.map(async (presetId) => {
    const packageRelativePath = PRESET_PACKAGE_PATHS[presetId as keyof typeof PRESET_PACKAGE_PATHS];
    if (packageRelativePath) {
      const absolutePath = path.join(projectRoot, packageRelativePath);
      const preset = await loadPresetFromMarkdownFile(absolutePath);
      return [presetId, { ...preset, source: { kind: "doc-package", path: packageRelativePath } }] as const;
    }

    const preset = INLINE_PROVISIONAL_PRESETS[presetId as keyof typeof INLINE_PROVISIONAL_PRESETS];
    return [presetId, {
      ...preset,
      source: {
        kind: "inline-provisional",
        note: "No exact prompt-engineering package exists yet for this current backend preset ID.",
      },
    }] as const;
  }));

  return Object.fromEntries(registryEntries) as Record<ComponentPresetId, ComponentPresetRecord>;
}

export function reviewPresetCoverage(): PresetCoverageReview {
  const preparedPromptPackages = [
    "experiment-planner",
    "protocols",
    "quick-literature-research",
    "reagents",
    "thorough-literature-research",
  ];

  return {
    officialPresetIds: INITIAL_COMPONENT_PRESET_IDS,
    preparedPromptPackages,
    exactMatches: ["protocols"],
    notes: [
      "The current backend preset vocabulary is orchestrator / protocols / budget / timeline / literature.",
      "Prompt-engineering packages are richer and include quick-literature-research, thorough-literature-research, reagents, and experiment-planner.",
      "The backend currently loads protocols from an exact prompt package and uses provisional inline presets for orchestrator, budget, timeline, and literature until the taxonomies are reconciled.",
    ],
  };
}

export async function loadPresetFromMarkdownFile(filePath: string): Promise<ComponentPreset> {
  const markdown = await readFile(filePath, "utf8");
  const id = readHeadingValue(markdown, /^# Component: `([^`]+)`$/m, "component id");
  const shortDescription = readSection(markdown, "## Short description");
  const detailedDescription = readSection(markdown, "## Detailed description");
  const preprompt = readSection(markdown, "## Pre-prompt");

  return componentPresetSchema.parse({
    id,
    name: toTitleCase(id),
    shortDescription,
    detailedDescription,
    preprompt,
    defaultToolMode: "read-only",
  });
}

function readHeadingValue(markdown: string, pattern: RegExp, label: string): string {
  const match = markdown.match(pattern);
  if (!match?.[1]) {
    throw new Error(`Missing ${label} in preset markdown`);
  }
  return match[1].trim();
}

function readSection(markdown: string, heading: string): string {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`${escapedHeading}\\n\\n([\\s\\S]*?)(?:\\n## |\\n# |$)`);
  const match = markdown.match(pattern);
  if (!match?.[1]) {
    throw new Error(`Missing section ${heading} in preset markdown`);
  }
  return match[1].trim();
}

function toTitleCase(id: string): string {
  return id
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

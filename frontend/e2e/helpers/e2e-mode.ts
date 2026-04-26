/**
 * E2E mode selection.
 *
 * `real`       — default: tests run against the local dev stack
 *                (scripts/start-dev.sh). No screencast recording.
 * `screencast` — same backend, plus `createStoryboard` records per-narration
 *                CDP clips and writes `storyboard.json` for the
 *                `screencast-narrator` CLI to post-process into the final mp4.
 */
export enum E2eMode {
  Real = "real",
  Screencast = "screencast",
}

const ALL_MODES = Object.values(E2eMode) as string[];

export function readMode(): E2eMode {
  const raw = process.env.E2E_MODE;
  if (raw === undefined || raw === "") return E2eMode.Real;
  if (!ALL_MODES.includes(raw)) {
    throw new Error(
      `E2E_MODE must be one of ${ALL_MODES.join(" | ")} — got ${JSON.stringify(raw)}`,
    );
  }
  return raw as E2eMode;
}

export function isScreencast(mode: E2eMode = readMode()): boolean {
  return mode === E2eMode.Screencast;
}

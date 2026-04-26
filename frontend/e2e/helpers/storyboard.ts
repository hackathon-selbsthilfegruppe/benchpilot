import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page, Locator } from "@playwright/test";
import { Storyboard as NarratorStoryboard } from "screencast-narrator";
import { E2eMode, readMode } from "./e2e-mode";

// Single source of truth: the same logo SVG that the running app serves
// at /benchpilot-logo.svg. Read once at module load.
const LOGO_SVG = readFileSync(
  join(__dirname, "..", "..", "public", "benchpilot-logo.svg"),
  "utf8",
);

export type Voice = "natalie" | "harmony" | "clara" | "douglas";

const VOICE_MAP: Record<Voice, "female" | "male"> = {
  natalie: "female",
  harmony: "male",
  clara: "female",
  douglas: "male",
};

export interface Storyboard {
  narrate(voice: Voice, text: string, action?: () => Promise<void>): Promise<void>;
  pause(ms: number): Promise<void>;
  showTitleCard(
    title: string,
    subtitle: string,
    voice?: Voice,
    narrationText?: string,
  ): Promise<void>;
  highlight(locator: Locator): Promise<void>;
  done(): Promise<void>;
}

const TITLE_CARD_HTML = (title: string, subtitle: string) => `
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    display: flex; align-items: center; justify-content: center;
    height: 100vh;
    background:
      radial-gradient(circle at 20% 20%, rgba(14, 165, 233, 0.20), transparent 55%),
      radial-gradient(circle at 80% 80%, rgba(129, 140, 248, 0.22), transparent 60%),
      linear-gradient(135deg, #0a0f1f 0%, #111827 100%);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: white; text-align: center;
  }
  .card { max-width: 1100px; padding: 60px; }
  .mark {
    display: flex; justify-content: center; margin-bottom: 40px;
    color: #f8fafc; /* drives currentColor inside the inlined SVG */
  }
  .mark svg { width: 360px; height: auto; }
  .badge {
    display: inline-block;
    font-size: 13px; letter-spacing: 4px; text-transform: uppercase;
    color: #64748b; margin-bottom: 32px;
    border: 1px solid rgba(148, 163, 184, 0.25);
    padding: 6px 14px; border-radius: 999px;
  }
  h1 {
    font-size: 64px; font-weight: 700; letter-spacing: -1.5px; line-height: 1.1;
    margin-bottom: 28px;
    background: linear-gradient(90deg, #38bdf8 0%, #818cf8 50%, #c084fc 100%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  }
  p {
    font-size: 26px; color: #cbd5e1; line-height: 1.5; max-width: 820px;
    margin: 0 auto;
  }
</style>
</head>
<body>
<div class="card">
  <div class="mark">${LOGO_SVG}</div>
  <div class="badge">Protocol Generation Engine</div>
  <h1>${title.replace(/"/g, "&quot;")}</h1>
  <p>${subtitle.replace(/"/g, "&quot;")}</p>
</div>
</body>
</html>`;

export interface StoryboardOptions {
  language?: string;
  width?: number;
  height?: number;
}

function noopStoryboard(): Storyboard {
  return {
    async narrate(_voice, _text, action) {
      if (action) await action();
    },
    async pause() {},
    async showTitleCard() {},
    async highlight() {},
    async done() {},
  };
}

export function createStoryboard(
  page: Page,
  outputDir: string,
  options?: StoryboardOptions,
): Storyboard {
  if (readMode() !== E2eMode.Screencast) {
    return noopStoryboard();
  }

  const sb = new NarratorStoryboard(outputDir, page, {
    language: options?.language ?? "en",
    voices: VOICE_MAP,
    videoWidth: options?.width ?? 1920,
    videoHeight: options?.height ?? 1080,
  });
  let inBracket = false;

  async function bracket(
    text: string | undefined,
    voice: Voice | undefined,
    action: () => Promise<void>,
  ): Promise<void> {
    await sb.narrate(
      async () => {
        inBracket = true;
        try {
          await action();
        } finally {
          inBracket = false;
        }
      },
      text,
      undefined,
      voice,
    );
  }

  return {
    async narrate(voice, text, action) {
      await bracket(text, voice, async () => {
        if (action) await action();
      });
    },

    async pause(ms) {
      await page.waitForTimeout(ms);
    },

    async showTitleCard(title, subtitle, voice, narrationText) {
      await page.setContent(TITLE_CARD_HTML(title, subtitle));
      await bracket(narrationText, voice, async () => {});
    },

    async highlight(locator) {
      if (inBracket) {
        await sb.highlight(locator);
      } else {
        await locator.scrollIntoViewIfNeeded();
      }
    },

    async done() {
      await sb.done();
    },
  };
}

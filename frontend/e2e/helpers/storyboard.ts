import type { Page, Locator } from "@playwright/test";
import { Storyboard as NarratorStoryboard } from "screencast-narrator";
import { E2eMode, readMode } from "./e2e-mode";

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
    height: 100vh; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: white; text-align: center;
  }
  .card { max-width: 960px; padding: 60px; }
  .badge {
    display: inline-block;
    font-size: 14px; letter-spacing: 4px; text-transform: uppercase;
    color: #94a3b8; margin-bottom: 24px;
  }
  h1 {
    font-size: 56px; font-weight: 700; letter-spacing: -1px;
    margin-bottom: 24px;
    background: linear-gradient(90deg, #0ea5e9, #818cf8);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  }
  p { font-size: 24px; color: #cbd5e1; line-height: 1.6; }
</style>
</head>
<body>
<div class="card">
  <div class="badge">BenchPilot — Protocol Generation Engine</div>
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

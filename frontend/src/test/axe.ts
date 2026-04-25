import axe, { type AxeResults, type RunOptions, type ContextObject } from "axe-core";
import { expect } from "vitest";

/**
 * Run axe-core against a rendered DOM container and return its results.
 *
 * Defaults to WCAG 2.1 AA tags so violations of the most commonly
 * targeted criteria fail the test. Tag selection mirrors what most
 * SaaS products commit to: `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`,
 * plus the `best-practice` set for non-WCAG conventions axe encodes.
 *
 * jsdom limitations to be aware of:
 *  - `color-contrast` rule can't run reliably (requires real layout +
 *    pseudo-element resolution); axe disables it in jsdom by default.
 *  - Focus-order rules that depend on computed `display` are weaker
 *    than what Playwright sees in a real browser.
 *
 * For full contrast / focus-ring checks, use the Playwright + axe
 * suite (see docs/accessibility.md).
 */
export async function runAxe(
  container: ContextObject | Element | Document = document,
  options: RunOptions = {},
): Promise<AxeResults> {
  return axe.run(container, {
    runOnly: {
      type: "tag",
      values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"],
    },
    ...options,
  });
}

/**
 * Convenience matcher: assert no axe violations on the given container.
 * Prints a readable summary of every violation when it fails.
 */
export async function expectNoA11yViolations(
  container: Element | Document = document,
  options: RunOptions = {},
): Promise<void> {
  const results = await runAxe(container, options);
  if (results.violations.length === 0) return;
  const summary = results.violations
    .map(
      (v) =>
        `  • [${v.id}] (${v.impact ?? "n/a"}) ${v.help}\n    ${v.helpUrl}\n    affected: ${v.nodes
          .map((n) => n.target.join(" "))
          .join(", ")}`,
    )
    .join("\n");
  expect.fail(
    `${results.violations.length} accessibility violation(s):\n${summary}`,
  );
}

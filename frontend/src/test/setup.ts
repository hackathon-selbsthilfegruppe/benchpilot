import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement HTMLCanvasElement.getContext, so axe-core's
// color-contrast probe (and any other code that touches it) logs a noisy
// "Not implemented" warning. Stub it out — contrast checks belong in
// Playwright (real browser), not in the unit-level axe pass.
if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement["getContext"];
}

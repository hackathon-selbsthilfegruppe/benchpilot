import { render, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StatusSymbol } from "./status";
import { expectNoA11yViolations } from "@/test/axe";

afterEach(cleanup);

describe("StatusSymbol a11y", () => {
  it("each status renders an aria-label and passes axe", async () => {
    const { container } = render(
      <ul>
        <li><StatusSymbol status="ok" /></li>
        <li><StatusSymbol status="pending" /></li>
        <li><StatusSymbol status="blocked" /></li>
        <li><StatusSymbol status="done" /></li>
        <li><StatusSymbol status="info" /></li>
      </ul>,
    );
    const labels = Array.from(container.querySelectorAll("[aria-label]")).map(
      (el) => el.getAttribute("aria-label"),
    );
    expect(labels).toEqual(["ok", "pending", "blocked", "done", "info"]);
    await expectNoA11yViolations(container);
  });
});

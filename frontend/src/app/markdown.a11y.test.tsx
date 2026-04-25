import { render, cleanup } from "@testing-library/react";
import { afterEach, describe, it } from "vitest";
import { Markdown } from "./markdown";
import { expectNoA11yViolations } from "@/test/axe";

afterEach(cleanup);

describe("Markdown a11y", () => {
  it("renders headings, lists and code blocks without axe violations", async () => {
    const sample = `
# Heading One

A paragraph with **bold** and *italic* text and a [link](https://example.org).

## Heading Two

- Item one
- Item two
- Item three

\`\`\`
code block
multi-line
\`\`\`

> A blockquote.
`;
    const { container } = render(<Markdown>{sample}</Markdown>);
    await expectNoA11yViolations(container);
  });

  it("links carry rel=noopener noreferrer when target=_blank (no axe violations)", async () => {
    const { container } = render(
      <Markdown>{"See [the docs](https://example.org)."}</Markdown>,
    );
    const link = container.querySelector("a")!;
    if (link.target === "_blank") {
      // Implementation responsibility: ensure security-relevant rel tokens.
      // axe will also complain via target-blank-rel rules.
      const rel = link.getAttribute("rel") ?? "";
      if (!rel.includes("noopener") || !rel.includes("noreferrer")) {
        throw new Error(
          `target=_blank link missing noopener/noreferrer: rel="${rel}"`,
        );
      }
    }
    await expectNoA11yViolations(container);
  });
});

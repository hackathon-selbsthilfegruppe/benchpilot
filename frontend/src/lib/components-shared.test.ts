import { describe, expect, it } from "vitest";
import { rollupStatus, type TocEntry } from "./components-shared";

function entry(status: TocEntry["status"]): TocEntry {
  return { slug: status, title: status, descriptor: status, status };
}

describe("rollupStatus", () => {
  it("returns info for an empty list", () => {
    expect(rollupStatus([])).toBe("info");
  });

  it("picks the worst status by severity (blocked > pending > ok > done > info)", () => {
    expect(rollupStatus([entry("ok")])).toBe("ok");
    expect(rollupStatus([entry("ok"), entry("pending")])).toBe("pending");
    expect(rollupStatus([entry("ok"), entry("pending"), entry("blocked")])).toBe(
      "blocked",
    );
    expect(rollupStatus([entry("done"), entry("info")])).toBe("done");
    expect(rollupStatus([entry("info"), entry("info")])).toBe("info");
  });

  it("is order-independent", () => {
    expect(rollupStatus([entry("blocked"), entry("ok")])).toBe(
      rollupStatus([entry("ok"), entry("blocked")]),
    );
  });
});

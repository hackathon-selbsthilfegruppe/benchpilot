import { describe, expect, it } from "vitest";

import {
  buildBackendComponentPrewarmTargets,
  shouldUseBackendComponentSession,
} from "./workbench-session-routing";

type Comp = Parameters<typeof buildBackendComponentPrewarmTargets>[1][number];

describe("workbench session routing", () => {
  it("uses backend component sessions only for real backend-backed component chats", () => {
    expect(shouldUseBackendComponentSession("orchestrator", "hypothesis", "bench-1")).toBe(false);
    expect(shouldUseBackendComponentSession("hypothesis", "hypothesis", "bench-1")).toBe(false);
    expect(shouldUseBackendComponentSession("literature-comp", "hypothesis", "bench-1")).toBe(true);
    expect(shouldUseBackendComponentSession("literature-comp", "hypothesis", undefined)).toBe(false);
  });

  it("builds backend prewarm targets only for real backend component instances", () => {
    expect(
      buildBackendComponentPrewarmTargets(
        "bench-1",
        [{ id: "comp-1" } as Comp],
        [{ id: "comp-2" } as Comp],
        "orchestrator-comp",
      ),
    ).toEqual([
      { benchId: "bench-1", componentInstanceId: "orchestrator-comp" },
      { benchId: "bench-1", componentInstanceId: "comp-1" },
      { benchId: "bench-1", componentInstanceId: "comp-2" },
    ]);

    expect(
      buildBackendComponentPrewarmTargets(undefined, [{ id: "comp-1" } as Comp], []),
    ).toEqual([]);
  });
});

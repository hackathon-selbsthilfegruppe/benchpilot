import { describe, expect, it } from "vitest";
import { reorderGroups } from "./reorder";

describe("reorderGroups", () => {
  const primary = ["hypothesis", "reagents", "samples", "equipment", "experiments"];
  const supporting = ["literature"];

  it("is a no-op when dragging onto self", () => {
    const result = reorderGroups(primary, supporting, "samples", "samples", "primary");
    expect(result.changed).toBe(false);
    expect(result.primary).toEqual(primary);
    expect(result.supporting).toEqual(supporting);
  });

  it("returns unchanged arrays when dragId is unknown", () => {
    const result = reorderGroups(primary, supporting, "ghost", "reagents", "primary");
    expect(result.changed).toBe(false);
    expect(result.primary).toEqual(primary);
    expect(result.supporting).toEqual(supporting);
  });

  it("moves an item up within the primary group", () => {
    const result = reorderGroups(primary, supporting, "experiments", "samples", "primary");
    expect(result.primary).toEqual([
      "hypothesis",
      "reagents",
      "experiments",
      "samples",
      "equipment",
    ]);
    expect(result.supporting).toEqual(supporting);
    expect(result.changed).toBe(true);
  });

  it("moves an item down within the primary group", () => {
    const result = reorderGroups(primary, supporting, "hypothesis", "experiments", "primary");
    expect(result.primary).toEqual([
      "reagents",
      "samples",
      "equipment",
      "hypothesis",
      "experiments",
    ]);
    expect(result.changed).toBe(true);
  });

  it("moves an item from primary into supporting", () => {
    const result = reorderGroups(primary, supporting, "experiments", "literature", "supporting");
    expect(result.primary).toEqual(["hypothesis", "reagents", "samples", "equipment"]);
    expect(result.supporting).toEqual(["experiments", "literature"]);
    expect(result.changed).toBe(true);
  });

  it("moves an item from supporting into primary", () => {
    const result = reorderGroups(primary, supporting, "literature", "samples", "primary");
    expect(result.primary).toEqual([
      "hypothesis",
      "reagents",
      "literature",
      "samples",
      "equipment",
      "experiments",
    ]);
    expect(result.supporting).toEqual([]);
    expect(result.changed).toBe(true);
  });

  it("appends to target group when target id is not present (e.g. empty group drop)", () => {
    const result = reorderGroups(
      ["a", "b", "c"],
      [],
      "a",
      "missing",
      "supporting",
    );
    expect(result.primary).toEqual(["b", "c"]);
    expect(result.supporting).toEqual(["a"]);
    expect(result.changed).toBe(true);
  });

  it("does not mutate the input arrays", () => {
    const primaryCopy = [...primary];
    const supportingCopy = [...supporting];
    reorderGroups(primary, supporting, "experiments", "literature", "supporting");
    expect(primary).toEqual(primaryCopy);
    expect(supporting).toEqual(supportingCopy);
  });
});

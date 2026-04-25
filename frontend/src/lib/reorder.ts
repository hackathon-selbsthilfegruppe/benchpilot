export type Group = "primary" | "supporting";

export type ReorderResult = {
  primary: string[];
  supporting: string[];
  changed: boolean;
};

/**
 * Compute new (primary, supporting) ID lists after dropping `dragId` onto
 * `targetId` in `targetGroup`. Pure function — no side effects.
 *
 * Rules:
 *  - Dropping onto self is a no-op (returns the original arrays unchanged).
 *  - The dragged item is removed from whichever group it was in, then
 *    inserted before the target's current position in the target group.
 *  - If the target ID is not found in the target group, the dragged item
 *    is appended to the end of the target group (covers drop-into-empty
 *    and stale-target cases).
 */
export function reorderGroups(
  primary: readonly string[],
  supporting: readonly string[],
  dragId: string,
  targetId: string,
  targetGroup: Group,
): ReorderResult {
  if (dragId === targetId) {
    return { primary: [...primary], supporting: [...supporting], changed: false };
  }

  const fromPrimary = primary.includes(dragId);
  const fromSupporting = supporting.includes(dragId);
  if (!fromPrimary && !fromSupporting) {
    return { primary: [...primary], supporting: [...supporting], changed: false };
  }

  const nextPrimary = fromPrimary
    ? primary.filter((id) => id !== dragId)
    : [...primary];
  const nextSupporting = fromSupporting
    ? supporting.filter((id) => id !== dragId)
    : [...supporting];

  const dst = targetGroup === "primary" ? nextPrimary : nextSupporting;
  const dstIdx = dst.indexOf(targetId);
  if (dstIdx === -1) {
    dst.push(dragId);
  } else {
    dst.splice(dstIdx, 0, dragId);
  }

  return { primary: nextPrimary, supporting: nextSupporting, changed: true };
}

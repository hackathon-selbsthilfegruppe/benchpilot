import { z } from "zod";

import { benchIdSchema } from "./bench.js";
import { componentInstanceIdSchema, componentPresetIdSchema } from "./component.js";
import { requirementIdSchema } from "./requirement.js";
import { resourceIdSchema } from "./resource.js";

export const mutationActorSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("system") }),
  z.object({
    kind: z.literal("component"),
    benchId: benchIdSchema,
    componentInstanceId: componentInstanceIdSchema,
    presetId: componentPresetIdSchema.optional(),
  }),
]);

export type MutationActor = z.infer<typeof mutationActorSchema>;

export const mutationRequestSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("write-bench"), benchId: benchIdSchema }),
  z.object({ kind: z.literal("write-requirement"), benchId: benchIdSchema, requirementId: requirementIdSchema.optional() }),
  z.object({ kind: z.literal("write-component-summary"), benchId: benchIdSchema, componentInstanceId: componentInstanceIdSchema }),
  z.object({ kind: z.literal("write-resource"), benchId: benchIdSchema, componentInstanceId: componentInstanceIdSchema, resourceId: resourceIdSchema.optional() }),
  z.object({ kind: z.literal("refresh-component-toc"), benchId: benchIdSchema, componentInstanceId: componentInstanceIdSchema }),
  z.object({ kind: z.literal("write-task-state"), benchId: benchIdSchema, componentInstanceId: componentInstanceIdSchema }),
]);

export type MutationRequest = z.infer<typeof mutationRequestSchema>;

export class OwnershipRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OwnershipRuleError";
  }
}

export function canApplyMutation(actor: MutationActor, request: MutationRequest): boolean {
  return explainMutationDenial(actor, request) === null;
}

export function assertCanApplyMutation(actor: MutationActor, request: MutationRequest): void {
  const denial = explainMutationDenial(actor, request);
  if (denial) {
    throw new OwnershipRuleError(denial);
  }
}

export function explainMutationDenial(actor: MutationActor, request: MutationRequest): string | null {
  const parsedActor = mutationActorSchema.parse(actor);
  const parsedRequest = mutationRequestSchema.parse(request);

  if (parsedActor.kind === "system") {
    return null;
  }

  if (parsedActor.benchId !== parsedRequest.benchId) {
    return "Component actors may only mutate state inside their own bench";
  }

  switch (parsedRequest.kind) {
    case "write-bench":
      return "Bench metadata is backend-owned and cannot be mutated directly by components";

    case "write-requirement":
      return parsedActor.presetId === "orchestrator"
        ? null
        : "Requirement mutations are reserved for the orchestrator or backend";

    case "write-component-summary":
      return parsedActor.componentInstanceId === parsedRequest.componentInstanceId
        ? null
        : "Components may not overwrite another component's summary directly";

    case "write-resource":
      return parsedActor.componentInstanceId === parsedRequest.componentInstanceId
        ? null
        : "Components may only write resources they own; cross-component work must happen through tasks";

    case "refresh-component-toc":
      return "Component TOC regeneration is backend-owned";

    case "write-task-state":
      return "Task state transitions are backend-owned";

    default:
      return "Unknown mutation request";
  }
}

export function isOrchestratorActor(actor: MutationActor): boolean {
  return actor.kind === "component" && actor.presetId === "orchestrator";
}

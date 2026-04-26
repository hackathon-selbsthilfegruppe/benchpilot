import { z } from "zod";

import {
  assertCanApplyMutation,
  type MutationRequest,
} from "./ownership.js";
import { benchIdSchema } from "./bench.js";
import { componentInstanceIdSchema, componentPresetIdSchema } from "./component.js";

export const componentWriteActorSchema = z.object({
  benchId: benchIdSchema,
  componentInstanceId: componentInstanceIdSchema,
  presetId: componentPresetIdSchema.optional(),
}).strict();

export type ComponentWriteActor = z.infer<typeof componentWriteActorSchema>;

export function parseComponentWriteActor(input: unknown): ComponentWriteActor {
  return componentWriteActorSchema.parse(input);
}

export function assertWriteAccess(actorInput: unknown, mutation: MutationRequest): ComponentWriteActor {
  const actor = parseComponentWriteActor(actorInput);
  assertCanApplyMutation(
    {
      kind: "component",
      benchId: actor.benchId,
      componentInstanceId: actor.componentInstanceId,
      presetId: actor.presetId,
    },
    mutation,
  );
  return actor;
}

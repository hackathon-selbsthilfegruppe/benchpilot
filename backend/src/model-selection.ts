import type { ModelRegistry } from "@mariozechner/pi-coding-agent";

const DEFAULT_MODEL_CANDIDATES = [
  "openai-codex/gpt-5.4-mini",
  "openai-codex/gpt-5.4",
  "openai-codex/gpt-5.5",
  "openai/gpt-5.4-mini",
  "openai/gpt-5-mini",
] as const;

export function resolvePreferredModel(
  registry: Pick<ModelRegistry, "find">,
  configuredModel: string | undefined,
) {
  const normalizedConfigured = configuredModel?.trim();
  if (normalizedConfigured) {
    return resolveModelById(registry, normalizedConfigured);
  }

  for (const candidate of DEFAULT_MODEL_CANDIDATES) {
    const model = resolveOptionalModelById(registry, candidate);
    if (model) {
      return model;
    }
  }

  return undefined;
}

function resolveModelById(registry: Pick<ModelRegistry, "find">, modelId: string) {
  const model = resolveOptionalModelById(registry, modelId);
  if (!model) {
    throw new Error(`Configured model not found: ${modelId}`);
  }
  return model;
}

function resolveOptionalModelById(registry: Pick<ModelRegistry, "find">, modelId: string) {
  const [provider, ...modelParts] = modelId.split("/");
  const id = modelParts.join("/");

  if (!provider || !id) {
    throw new Error(`Invalid model id: ${modelId}. Expected provider/model-id`);
  }

  return registry.find(provider, id);
}

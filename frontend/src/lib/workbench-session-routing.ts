import type { BenchComponent } from "./components-shared";

export function shouldUseBackendComponentSession(
  chatId: string,
  hypothesisId: string,
  backendBenchId?: string,
): boolean {
  return Boolean(backendBenchId && chatId !== "orchestrator" && chatId !== hypothesisId);
}

export function buildBackendComponentPrewarmTargets(
  backendBenchId: string | undefined,
  components: BenchComponent[],
  supporting: BenchComponent[],
  orchestratorComponentId?: string,
): Array<{ benchId: string; componentInstanceId: string }> {
  if (!backendBenchId) {
    return [];
  }

  return [
    ...(orchestratorComponentId ? [{ benchId: backendBenchId, componentInstanceId: orchestratorComponentId }] : []),
    ...[...components, ...supporting].map((component) => ({
      benchId: backendBenchId,
      componentInstanceId: component.id,
    })),
  ];
}

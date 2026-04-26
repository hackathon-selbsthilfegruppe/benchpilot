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
): Array<{ benchId: string; componentInstanceId: string }> {
  if (!backendBenchId) {
    return [];
  }

  return [...components, ...supporting].map((component) => ({
    benchId: backendBenchId,
    componentInstanceId: component.id,
  }));
}

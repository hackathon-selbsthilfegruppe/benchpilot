import type { BackendTask } from "./benchpilot-task-client";
import { adaptBackendTask } from "./backend-task-adapter";
import type { BenchComponent } from "./components-shared";

export function applyBackendTasksToWorkbench(
  components: BenchComponent[],
  supporting: BenchComponent[],
  hypothesis: BenchComponent,
  backendTasks: BackendTask[],
) {
  const inboundByTarget = new Map<string, BackendTask[]>();
  for (const task of backendTasks) {
    const list = inboundByTarget.get(task.toComponentInstanceId) ?? [];
    list.push(task);
    inboundByTarget.set(task.toComponentInstanceId, list);
  }

  const mapComponent = (component: BenchComponent): BenchComponent => ({
    ...component,
    tasks: (inboundByTarget.get(component.id) ?? []).map(adaptBackendTask),
  });

  return {
    components: components.map(mapComponent),
    supporting: supporting.map(mapComponent),
    hypothesis: {
      ...hypothesis,
      tasks: [],
    },
  };
}

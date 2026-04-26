import { loadCurrentPresetRegistry } from "./component-preset-registry.js";
import { createBench, type BenchMetadata, type BenchStatus, type CreateBenchInput } from "./bench.js";
import { createComponentInstance, type ComponentInstance } from "./component.js";
import { logger as rootLogger } from "./logger.js";
import { WorkspaceStore } from "./workspace-store.js";

export interface CreateBenchFromIntakeInput {
  title?: string;
  question: string;
  normalizedQuestion?: string;
  intakeBriefId?: string;
  status?: BenchStatus;
}

export interface MaterializedBench {
  bench: BenchMetadata;
  components: ComponentInstance[];
}

export class BenchMaterializationService {
  private readonly logger = rootLogger.child({ scope: "bench_materialization" });

  constructor(
    private readonly store: WorkspaceStore,
    private readonly projectRoot: string = process.cwd(),
  ) {}

  async createBenchFromIntake(input: CreateBenchFromIntakeInput): Promise<MaterializedBench> {
    this.logger.info("bench.materialization.requested", {
      title: input.title ?? null,
      question: input.question,
      status: input.status ?? "draft",
      intakeBriefId: input.intakeBriefId ?? null,
    });

    const bench = createBench(
      {
        title: input.title?.trim() || input.question,
        question: input.question,
        normalizedQuestion: input.normalizedQuestion,
        intakeBriefId: input.intakeBriefId,
      } satisfies CreateBenchInput,
      {
        existingBenchIds: (await this.store.listBenches()).map((entry) => entry.id),
        status: input.status ?? "draft",
      },
    );

    await this.store.writeBench(bench);

    const presetRegistry = await loadCurrentPresetRegistry(this.projectRoot);
    const components = await Promise.all(
      Object.values(presetRegistry).map(async (preset) => {
        const component = createComponentInstance(
          {
            benchId: bench.id,
            presetId: preset.id,
            name: `${preset.name} — ${bench.title}`,
            summary: preset.shortDescription,
            toolMode: preset.defaultToolMode,
          },
          {
            existingComponentIds: (await this.store.listComponents(bench.id)).map((entry) => entry.id),
          },
        );
        await this.store.writeComponent(component);
        return component;
      }),
    );

    this.logger.info("bench.materialization.completed", {
      benchId: bench.id,
      status: bench.status,
      intakeBriefId: bench.intakeBriefId ?? null,
      componentIds: components.map((component) => component.id),
      presetIds: components.map((component) => component.presetId ?? null),
      componentCount: components.length,
    });

    return { bench, components };
  }
}

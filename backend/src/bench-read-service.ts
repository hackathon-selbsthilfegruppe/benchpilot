import { benchSummarySchema, type BenchMetadata, type BenchSummary } from "./bench.js";
import { type ComponentInstance } from "./component.js";
import { type RequirementMetadata } from "./requirement.js";
import { type ResourceDetail, type ResourceMetadata, type ResourceTocEntry } from "./resource.js";
import { WorkspaceStore } from "./workspace-store.js";

export interface ComponentContextView {
  bench: BenchSummary;
  self: ComponentInstance;
  selfSummary: string;
  others: Array<{
    component: ComponentInstance;
    summary: string;
    toc: ResourceTocEntry[];
  }>;
}

export class BenchReadService {
  constructor(private readonly store: WorkspaceStore) {}

  async listBenches(): Promise<BenchSummary[]> {
    const benches = await this.store.listBenches();
    return benches.map((bench) => benchSummarySchema.parse(bench));
  }

  async getBench(benchId: string): Promise<BenchMetadata> {
    return this.store.readBench(benchId);
  }

  async listRequirements(benchId: string): Promise<RequirementMetadata[]> {
    return this.store.listRequirements(benchId);
  }

  async listComponents(benchId: string): Promise<ComponentInstance[]> {
    const components = await this.store.listComponents(benchId);
    return Promise.all(components.map((component) => this.withResourceCount(benchId, component)));
  }

  async getComponent(benchId: string, componentInstanceId: string): Promise<ComponentInstance> {
    const component = await this.store.readComponent(benchId, componentInstanceId);
    return this.withResourceCount(benchId, component);
  }

  async listComponentResources(benchId: string, componentInstanceId: string): Promise<ResourceTocEntry[]> {
    return this.store.readComponentToc(benchId, componentInstanceId);
  }

  async getComponentResource(
    benchId: string,
    componentInstanceId: string,
    resourceId: string,
  ): Promise<ResourceDetail> {
    const resource = await this.store.readResource(benchId, componentInstanceId, resourceId);
    const content = await readResourceContent(this.store, resource);
    return {
      ...resource,
      content,
    };
  }

  async getComponentContext(benchId: string, componentInstanceId: string): Promise<ComponentContextView> {
    const [bench, self, selfSummary, components] = await Promise.all([
      this.getBench(benchId),
      this.getComponent(benchId, componentInstanceId),
      this.store.readComponentSummary(benchId, componentInstanceId),
      this.listComponents(benchId),
    ]);

    const others = await Promise.all(
      components
        .filter((component) => component.id !== componentInstanceId)
        .map(async (component) => ({
          component,
          summary: await this.store.readComponentSummary(benchId, component.id),
          toc: await this.store.readComponentToc(benchId, component.id),
        })),
    );

    return {
      bench: benchSummarySchema.parse(bench),
      self,
      selfSummary,
      others,
    };
  }

  private async withResourceCount(benchId: string, component: ComponentInstance): Promise<ComponentInstance> {
    const toc = await this.store.readComponentToc(benchId, component.id).catch(() => []);
    return {
      ...component,
      resourceCount: toc.length,
    };
  }
}

async function readResourceContent(store: WorkspaceStore, resource: ResourceMetadata): Promise<string | undefined> {
  const primaryFilename = chooseReadableContentFilename(resource);
  if (!primaryFilename) {
    return undefined;
  }

  const data = await store.readResourceFile(resource.benchId, resource.componentInstanceId, resource.id, primaryFilename);
  return data.toString("utf8");
}

function chooseReadableContentFilename(resource: ResourceMetadata): string | undefined {
  const extractedText = resource.files.find((file) => file.role === "extracted-text");
  if (extractedText) {
    return extractedText.filename;
  }

  if (resource.contentType === "text/markdown" || resource.contentType === "text/plain") {
    return resource.primaryFile;
  }

  const primaryTextLike = resource.files.find(
    (file) => file.role === "primary" && (file.mediaType === "text/markdown" || file.mediaType === "text/plain"),
  );
  return primaryTextLike?.filename;
}

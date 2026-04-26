import { type BenchMetadata } from "./bench.js";
import { BenchReadService } from "./bench-read-service.js";
import { BenchMaterializationService } from "./bench-materialization-service.js";
import { type ComponentInstance } from "./component.js";
import { ComponentSessionService } from "./component-session-service.js";
import { createIntakeBrief, intakeBriefSchema, type IntakeBrief } from "./intake.js";
import { logger as rootLogger } from "./logger.js";
import { type SessionSummary } from "./types.js";
import { createRequirement, type RequirementMetadata } from "./requirement.js";
import { createResource, type ResourceMetadata } from "./resource.js";
import { WorkspaceStore } from "./workspace-store.js";

export interface IntakeSelection {
  sourceId: string;
  title: string;
  url?: string;
  description?: string;
  authors?: string;
  year?: number;
  citationCount?: number;
  openAccessPdfUrl?: string;
}

export interface CreateIntakeBriefRequest {
  title?: string;
  question: string;
  normalizedQuestion?: string;
}

export interface UpdateIntakeBriefRequest {
  title?: string;
  question?: string;
  normalizedQuestion?: string;
}

export interface FinalizeIntakeBriefRequest {
  title?: string;
  question?: string;
  normalizedQuestion?: string;
  literatureSelections?: IntakeSelection[];
  protocolSelections?: IntakeSelection[];
}

export interface IntakeBootstrapResult {
  brief: IntakeBrief;
  bench: BenchMetadata;
  components: ComponentInstance[];
  orchestratorComponent: ComponentInstance;
  orchestratorSession: SessionSummary;
}

export interface FinalizedIntakeResult {
  brief: IntakeBrief;
  bench: BenchMetadata;
  components: ComponentInstance[];
  requirements: RequirementMetadata[];
}

export class IntakeService {
  private readonly logger = rootLogger.child({ scope: "intake_service" });

  constructor(
    private readonly store: WorkspaceStore,
    private readonly benchMaterializationService: BenchMaterializationService,
    private readonly benchReadService: BenchReadService,
    private readonly componentSessionService: ComponentSessionService,
  ) {}

  async createBrief(input: CreateIntakeBriefRequest): Promise<IntakeBootstrapResult> {
    this.logger.info("intake.brief.create.requested", {
      title: input.title ?? null,
      question: input.question,
      normalizedQuestion: input.normalizedQuestion ?? null,
    });
    const materialized = await this.benchMaterializationService.createBenchFromIntake({
      title: input.title,
      question: input.question,
      normalizedQuestion: input.normalizedQuestion,
      status: "draft",
    });

    const orchestratorComponent = requirePresetComponent(materialized.components, "orchestrator");
    const orchestratorSession = await this.componentSessionService.ensureComponentSession(
      materialized.bench.id,
      orchestratorComponent.id,
    );

    const brief = intakeBriefSchema.parse({
      ...createIntakeBrief({
        benchId: materialized.bench.id,
        orchestratorComponentInstanceId: orchestratorComponent.id,
        orchestratorSessionId: orchestratorSession.id,
        title: input.title?.trim() || materialized.bench.title,
        question: input.question,
        normalizedQuestion: input.normalizedQuestion,
      }),
      orchestratorSessionId: orchestratorSession.id,
    });

    await this.store.writeIntakeBrief(brief);
    this.logger.info("intake.brief.created", {
      briefId: brief.id,
      benchId: brief.benchId,
      orchestratorComponentInstanceId: brief.orchestratorComponentInstanceId,
      orchestratorSessionId: brief.orchestratorSessionId ?? null,
      status: brief.status,
    });

    return {
      brief,
      bench: materialized.bench,
      components: materialized.components,
      orchestratorComponent,
      orchestratorSession,
    };
  }

  async updateBrief(briefId: string, input: UpdateIntakeBriefRequest): Promise<{ brief: IntakeBrief; bench: BenchMetadata }> {
    const brief = await this.store.readIntakeBrief(briefId);
    this.logger.info("intake.brief.update.requested", {
      briefId,
      benchId: brief.benchId,
      title: input.title ?? null,
      question: input.question ?? null,
      normalizedQuestion: input.normalizedQuestion ?? null,
    });
    const nextTitle = input.title?.trim() || brief.title;
    const nextQuestion = input.question?.trim() || brief.question;
    const updatedBench = await this.store.updateBench(brief.benchId, {
      title: nextTitle,
      question: nextQuestion,
      normalizedQuestion: input.normalizedQuestion,
    });

    const updatedBrief = intakeBriefSchema.parse({
      ...brief,
      title: nextTitle,
      question: nextQuestion,
      normalizedQuestion: input.normalizedQuestion ?? brief.normalizedQuestion,
      updatedAt: new Date().toISOString(),
    });
    await this.store.writeIntakeBrief(updatedBrief);
    this.logger.info("intake.brief.updated", {
      briefId: updatedBrief.id,
      benchId: updatedBrief.benchId,
      status: updatedBrief.status,
    });

    return { brief: updatedBrief, bench: updatedBench };
  }

  async ensureOrchestratorSession(briefId: string): Promise<IntakeBootstrapResult> {
    const brief = await this.store.readIntakeBrief(briefId);
    this.logger.info("intake.orchestrator_session.ensure_requested", {
      briefId,
      benchId: brief.benchId,
      orchestratorComponentInstanceId: brief.orchestratorComponentInstanceId,
    });
    const [bench, components] = await Promise.all([
      this.store.readBench(brief.benchId),
      this.benchReadService.listComponents(brief.benchId),
    ]);
    const orchestratorComponent = await this.benchReadService.getComponent(brief.benchId, brief.orchestratorComponentInstanceId);
    const orchestratorSession = await this.componentSessionService.ensureComponentSession(brief.benchId, orchestratorComponent.id);
    const updatedBrief = intakeBriefSchema.parse({
      ...brief,
      orchestratorSessionId: orchestratorSession.id,
      updatedAt: new Date().toISOString(),
    });
    await this.store.writeIntakeBrief(updatedBrief);
    this.logger.info("intake.orchestrator_session.ensured", {
      briefId: updatedBrief.id,
      benchId: updatedBrief.benchId,
      orchestratorSessionId: updatedBrief.orchestratorSessionId ?? null,
    });

    return {
      brief: updatedBrief,
      bench,
      components,
      orchestratorComponent,
      orchestratorSession,
    };
  }

  async finalizeBrief(briefId: string, input: FinalizeIntakeBriefRequest): Promise<FinalizedIntakeResult> {
    const brief = await this.store.readIntakeBrief(briefId);
    this.logger.info("intake.finalize.requested", {
      briefId,
      benchId: brief.benchId,
      literatureSelectionCount: input.literatureSelections?.length ?? 0,
      protocolSelectionCount: input.protocolSelections?.length ?? 0,
    });
    const update = await this.updateBrief(briefId, input);

    if (brief.status === "finalized") {
      this.logger.info("intake.finalize.already_finalized", {
        briefId,
        benchId: brief.benchId,
      });
      return {
        brief,
        bench: update.bench,
        components: await this.benchReadService.listComponents(update.bench.id),
        requirements: await this.store.listRequirements(update.bench.id),
      };
    }

    const components = await this.benchReadService.listComponents(update.bench.id);
    const orchestratorComponent = requirePresetComponent(components, "orchestrator");
    const literatureComponent = requirePresetComponent(components, "literature");
    const protocolsComponent = requirePresetComponent(components, "protocols");
    const budgetComponent = requirePresetComponent(components, "budget");
    const timelineComponent = requirePresetComponent(components, "timeline");
    const reviewerComponent = requirePresetComponent(components, "reviewer");
    const experimentPlannerComponent = requirePresetComponent(components, "experiment-planner");

    const requirements = await createInitialRequirements(this.store, update.bench.id, {
      orchestratorComponentId: orchestratorComponent.id,
      literatureComponentId: literatureComponent.id,
      protocolsComponentId: protocolsComponent.id,
      budgetComponentId: budgetComponent.id,
      timelineComponentId: timelineComponent.id,
      reviewerComponentId: reviewerComponent.id,
      experimentPlannerComponentId: experimentPlannerComponent.id,
    });

    const literatureRequirement = requirements.find((entry) => entry.componentInstanceIds.includes(literatureComponent.id));
    const protocolsRequirement = requirements.find((entry) => entry.componentInstanceIds.includes(protocolsComponent.id));

    const literatureResources = await Promise.all((input.literatureSelections ?? []).map((selection) =>
      this.createSelectionResource(update.bench.id, literatureComponent.id, selection, "paper-note", literatureRequirement?.id),
    ));
    const protocolResources = await Promise.all((input.protocolSelections ?? []).map((selection) =>
      this.createSelectionResource(update.bench.id, protocolsComponent.id, selection, "protocol-note", protocolsRequirement?.id),
    ));

    if (literatureRequirement) {
      await this.store.writeRequirement({
        ...literatureRequirement,
        resourceIds: literatureResources.map((resource) => resource.id),
        updatedAt: new Date().toISOString(),
      });
    }
    if (protocolsRequirement) {
      await this.store.writeRequirement({
        ...protocolsRequirement,
        resourceIds: protocolResources.map((resource) => resource.id),
        updatedAt: new Date().toISOString(),
      });
    }

    this.logger.info("intake.resources.persisted", {
      briefId,
      benchId: update.bench.id,
      literatureResourceIds: literatureResources.map((resource) => resource.id),
      protocolResourceIds: protocolResources.map((resource) => resource.id),
    });

    const finalizedBench = await this.store.updateBench(update.bench.id, { status: "active" });
    const finalizedBrief = intakeBriefSchema.parse({
      ...update.brief,
      status: "finalized",
      updatedAt: new Date().toISOString(),
      finalizedAt: new Date().toISOString(),
    });
    await this.store.writeIntakeBrief(finalizedBrief);
    this.logger.info("intake.finalized", {
      briefId: finalizedBrief.id,
      benchId: finalizedBench.id,
      requirementCount: requirements.length,
      componentCount: components.length,
      status: finalizedBrief.status,
    });

    return {
      brief: finalizedBrief,
      bench: finalizedBench,
      components: await this.benchReadService.listComponents(finalizedBench.id),
      requirements: await this.store.listRequirements(finalizedBench.id),
    };
  }

  private async createSelectionResource(
    benchId: string,
    componentInstanceId: string,
    selection: IntakeSelection,
    kind: string,
    supportsRequirementId?: string,
  ): Promise<ResourceMetadata> {
    const existingResourceIds = (await this.store.listResources(benchId, componentInstanceId)).map((entry) => entry.id);
    const title = selection.title.trim();
    const body = renderSelectionMarkdown(selection);
    const summarySource = selection.description?.trim() || title;
    const summary = summarySource.length <= 240 ? summarySource : `${summarySource.slice(0, 237)}...`;
    const resource = createResource({
      benchId,
      componentInstanceId,
      title,
      kind,
      description: `${selection.sourceId} intake selection`,
      summary,
      tags: [selection.sourceId],
      primaryFile: "selection.md",
      contentType: "text/markdown",
      supportsRequirementIds: supportsRequirementId ? [supportsRequirementId] : [],
      files: [
        {
          filename: "selection.md",
          mediaType: "text/markdown",
          description: `${title} intake selection markdown`,
          role: "primary",
        },
      ],
      status: "ready",
      confidence: selection.citationCount && selection.citationCount > 100 ? "high" : undefined,
    }, { existingResourceIds });

    await this.store.writeResource(resource);
    await this.store.writeResourceFile(benchId, componentInstanceId, resource.id, "selection.md", Buffer.from(body, "utf8"));
    this.logger.info("intake.selection_resource.created", {
      benchId,
      componentInstanceId,
      resourceId: resource.id,
      title: resource.title,
      kind: resource.kind,
      supportsRequirementId: supportsRequirementId ?? null,
      sourceId: selection.sourceId,
    });
    return resource;
  }
}

async function createInitialRequirements(
  store: WorkspaceStore,
  benchId: string,
  componentIds: {
    orchestratorComponentId: string;
    literatureComponentId: string;
    protocolsComponentId: string;
    budgetComponentId: string;
    timelineComponentId: string;
    reviewerComponentId: string;
    experimentPlannerComponentId: string;
  },
): Promise<RequirementMetadata[]> {
  const existingRequirements = await store.listRequirements(benchId);
  if (existingRequirements.length > 0) {
    return existingRequirements;
  }

  const usedRequirementIds = [] as string[];
  const requirements = [] as RequirementMetadata[];
  for (const draft of [
    {
      title: "Coordinate bench synthesis and open questions",
      summary: "Keep the overall experiment plan coherent, identify unresolved questions, and route work across the bench.",
      componentInstanceIds: [componentIds.orchestratorComponentId],
    },
    {
      title: "Assess novelty and supporting literature",
      summary: "Determine whether closely related prior work exists and what evidence supports or weakens the current question.",
      componentInstanceIds: [componentIds.literatureComponentId],
    },
    {
      title: "Curate protocol foundations",
      summary: "Identify the most relevant protocol families and extract actionable procedural detail for the bench.",
      componentInstanceIds: [componentIds.protocolsComponentId],
    },
    {
      title: "Estimate budget envelope",
      summary: "Estimate realistic cost drivers, assumptions, and major pricing uncertainty for the proposed experiment.",
      componentInstanceIds: [componentIds.budgetComponentId],
    },
    {
      title: "Estimate execution timeline",
      summary: "Map phases, dependencies, and plausible execution timing for the proposed experiment.",
      componentInstanceIds: [componentIds.timelineComponentId],
    },
    {
      title: "Review specialist output for defects and unjustified assumptions",
      summary: "Challenge protocol, literature, budget, timeline, and integrated-plan outputs by surfacing concrete defects, missing controls, weak evidence, and unjustified assumptions.",
      componentInstanceIds: [componentIds.reviewerComponentId],
    },
    {
      title: "Assemble the integrated experiment plan deliverable",
      summary: "Integrate protocol, literature, budget, timeline, and review outputs into the single experiment-plan deliverable or an explicit gap report.",
      componentInstanceIds: [componentIds.experimentPlannerComponentId],
    },
  ]) {
    const requirement = createRequirement({ benchId, ...draft }, { existingRequirementIds: usedRequirementIds });
    usedRequirementIds.push(requirement.id);
    requirements.push(requirement);
  }

  for (const requirement of requirements) {
    await store.writeRequirement(requirement);
  }

  const components = await Promise.all([
    store.readComponent(benchId, componentIds.orchestratorComponentId),
    store.readComponent(benchId, componentIds.literatureComponentId),
    store.readComponent(benchId, componentIds.protocolsComponentId),
    store.readComponent(benchId, componentIds.budgetComponentId),
    store.readComponent(benchId, componentIds.timelineComponentId),
    store.readComponent(benchId, componentIds.reviewerComponentId),
    store.readComponent(benchId, componentIds.experimentPlannerComponentId),
  ]);
  const requirementByComponentId = new Map(requirements.flatMap((requirement) =>
    requirement.componentInstanceIds.map((componentId) => [componentId, requirement.id] as const),
  ));

  for (const component of components) {
    const requirementId = requirementByComponentId.get(component.id);
    await store.writeComponent({
      ...component,
      requirementIds: requirementId ? [requirementId] : [],
      updatedAt: new Date().toISOString(),
    });
  }

  return store.listRequirements(benchId);
}

function requirePresetComponent(components: ComponentInstance[], presetId: string): ComponentInstance {
  const component = components.find((entry) => entry.presetId === presetId);
  if (!component) {
    throw new Error(`Missing preset component ${presetId}`);
  }
  return component;
}

function renderSelectionMarkdown(selection: IntakeSelection): string {
  const bullets = [
    `- Source: ${selection.sourceId}`,
    selection.authors ? `- Authors: ${selection.authors}` : undefined,
    selection.year ? `- Year: ${selection.year}` : undefined,
    selection.citationCount != null ? `- Citation count: ${selection.citationCount}` : undefined,
    selection.url ? `- URL: ${selection.url}` : undefined,
    selection.openAccessPdfUrl ? `- Open-access PDF: ${selection.openAccessPdfUrl}` : undefined,
  ].filter(Boolean);

  return [
    `# ${selection.title}`,
    "",
    ...bullets,
    "",
    selection.description?.trim() || "No summary was captured during intake.",
  ].join("\n");
}

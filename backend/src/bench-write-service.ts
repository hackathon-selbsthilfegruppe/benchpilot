import { z } from "zod";

import {
  ingestibleFileRoleSchema,
  parseResourceIngestionRequest,
  resourceIngestionMetadataSchema,
  supportedResourceMediaTypeSchema,
} from "./resource-ingestion.js";
import { buildExtractedTextFile, extractTextFromPdf } from "./pdf-extraction.js";
import { ResourceIngestionService } from "./resource-ingestion-service.js";
import { resourceMetadataSchema, type ResourceFile, type ResourceMetadata } from "./resource.js";
import { assertWriteAccess, componentWriteActorSchema, type ComponentWriteActor } from "./write-actor.js";
import { WorkspaceStore, WorkspaceValidationError } from "./workspace-store.js";

const base64ContentSchema = z.string().min(1).refine((value) => {
  try {
    Buffer.from(value, "base64");
    return true;
  } catch {
    return false;
  }
}, { message: "contentBase64 must be valid base64" });

export const createResourceRequestSchema = z.object({
  actor: componentWriteActorSchema,
  resource: resourceIngestionMetadataSchema,
  files: z.array(z.object({
    filename: z.string().trim().min(1),
    mediaType: supportedResourceMediaTypeSchema,
    description: z.string().trim().min(1),
    role: ingestibleFileRoleSchema.default("attachment"),
    contentBase64: base64ContentSchema,
  })).min(1),
  primaryFilename: z.string().trim().min(1).optional(),
}).strict();

export type CreateResourceRequest = z.infer<typeof createResourceRequestSchema>;

const updateResourceFieldsSchema = z.object({
  title: z.string().trim().min(1).optional(),
  kind: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).optional(),
  summary: z.string().trim().min(1).optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
  supportsRequirementIds: z.array(z.string().trim().min(1)).optional(),
  derivedFromResourceIds: z.array(z.string().trim().min(1)).optional(),
  status: z.enum(["draft", "ready", "error"]).optional(),
  confidence: z.enum(["low", "medium", "high"]).nullable().optional(),
  primaryFilename: z.string().trim().min(1).optional(),
}).strict();

export const updateResourceRequestSchema = z.object({
  actor: componentWriteActorSchema,
  resource: updateResourceFieldsSchema,
  files: z.array(z.object({
    filename: z.string().trim().min(1),
    mediaType: supportedResourceMediaTypeSchema,
    description: z.string().trim().min(1),
    role: ingestibleFileRoleSchema.default("attachment"),
    contentBase64: base64ContentSchema,
  })).optional(),
}).strict();

export type UpdateResourceRequest = z.infer<typeof updateResourceRequestSchema>;

const updateComponentSummaryRequestSchema = z.object({
  actor: componentWriteActorSchema,
  summary: z.string().trim().min(1),
}).strict();

export type UpdateComponentSummaryRequest = z.infer<typeof updateComponentSummaryRequestSchema>;

export class BenchWriteService {
  private readonly ingestion: ResourceIngestionService;

  constructor(private readonly store: WorkspaceStore) {
    this.ingestion = new ResourceIngestionService(store);
  }

  async createResource(
    benchId: string,
    componentInstanceId: string,
    input: unknown,
  ): Promise<ResourceMetadata> {
    const request = createResourceRequestSchema.parse(input);
    const actor = this.assertScopedActor(request.actor, benchId, componentInstanceId);

    assertWriteAccess(actor, {
      kind: "write-resource",
      benchId,
      componentInstanceId,
    });

    const ingestionRequest = parseResourceIngestionRequest({
      resource: {
        ...request.resource,
        benchId,
        componentInstanceId,
      },
      files: request.files.map((file) => ({
        filename: file.filename,
        mediaType: file.mediaType,
        description: file.description,
        role: file.role,
        content: Buffer.from(file.contentBase64, "base64"),
      })),
      primaryFilename: request.primaryFilename,
    });

    const result = await this.ingestion.ingest(ingestionRequest);
    return result.resource;
  }

  async updateResource(
    benchId: string,
    componentInstanceId: string,
    resourceId: string,
    input: unknown,
  ): Promise<ResourceMetadata> {
    const request = updateResourceRequestSchema.parse(input);
    const actor = this.assertScopedActor(request.actor, benchId, componentInstanceId);

    assertWriteAccess(actor, {
      kind: "write-resource",
      benchId,
      componentInstanceId,
      resourceId,
    });

    const existing = await this.store.readResource(benchId, componentInstanceId, resourceId);
    const existingFiles = await this.readStoredSourceFiles(existing);
    const incomingFiles = (request.files ?? []).map((file) => ({
      filename: file.filename,
      mediaType: file.mediaType,
      description: file.description,
      role: file.role,
      content: Buffer.from(file.contentBase64, "base64"),
    }));

    const mergedSourceFiles = mergeSourceFiles(existingFiles, incomingFiles);
    const generatedFiles = await this.generateDerivedFiles(mergedSourceFiles);
    const primaryFilename = request.resource.primaryFilename
      ?? existing.primaryFile
      ?? mergedSourceFiles.find((file) => file.role === "primary")?.filename;
    const primaryMediaType = mergedSourceFiles.find((file) => file.filename === primaryFilename)?.mediaType;

    const updated = resourceMetadataSchema.parse({
      ...existing,
      ...request.resource,
      confidence: request.resource.confidence === null ? undefined : request.resource.confidence ?? existing.confidence,
      files: [
        ...mergedSourceFiles.map<ResourceFile>(({ filename, mediaType, description, role }) => ({
          filename,
          mediaType,
          description,
          role,
        })),
        ...generatedFiles.map((entry) => entry.file),
      ],
      primaryFile: primaryFilename,
      contentType: primaryMediaType,
      updatedAt: new Date().toISOString(),
    });

    await this.store.writeResource(updated);
    await this.store.replaceResourceFiles(
      benchId,
      componentInstanceId,
      resourceId,
      [
        ...mergedSourceFiles.map((file) => ({ filename: file.filename, content: file.content })),
        ...generatedFiles.map((file) => ({ filename: file.file.filename, content: file.content })),
      ],
    );

    return updated;
  }

  async updateComponentSummary(
    benchId: string,
    componentInstanceId: string,
    input: unknown,
  ) {
    const request = updateComponentSummaryRequestSchema.parse(input);
    const actor = this.assertScopedActor(request.actor, benchId, componentInstanceId);

    assertWriteAccess(actor, {
      kind: "write-component-summary",
      benchId,
      componentInstanceId,
    });

    return this.store.updateComponentSummary(benchId, componentInstanceId, request.summary);
  }

  private assertScopedActor(
    actor: ComponentWriteActor,
    benchId: string,
    componentInstanceId: string,
  ): ComponentWriteActor {
    if (actor.benchId !== benchId) {
      throw new WorkspaceValidationError("Write actor benchId must match the route benchId");
    }
    if (actor.componentInstanceId !== componentInstanceId) {
      throw new WorkspaceValidationError("Write actor componentInstanceId must match the route componentInstanceId");
    }
    return actor;
  }

  private async readStoredSourceFiles(resource: ResourceMetadata) {
    const sourceFiles = resource.files.filter((file) => file.role !== "extracted-text");
    return Promise.all(sourceFiles.map(async (file) => ({
      filename: file.filename,
      mediaType: file.mediaType as z.infer<typeof supportedResourceMediaTypeSchema>,
      description: file.description,
      role: file.role as z.infer<typeof ingestibleFileRoleSchema>,
      content: await this.store.readResourceFile(resource.benchId, resource.componentInstanceId, resource.id, file.filename),
    })));
  }

  private async generateDerivedFiles(sourceFiles: Array<{ filename: string; mediaType: z.infer<typeof supportedResourceMediaTypeSchema>; description: string; role: z.infer<typeof ingestibleFileRoleSchema>; content: Uint8Array }>) {
    const generated = [] as Array<{ file: ResourceFile; content: Buffer }>;
    for (const file of sourceFiles) {
      if (file.mediaType !== "application/pdf") {
        continue;
      }
      const text = await extractTextFromPdf(file.content);
      generated.push(buildExtractedTextFile(file, text));
    }
    return generated;
  }
}

function mergeSourceFiles(
  existingFiles: Array<{ filename: string; mediaType: z.infer<typeof supportedResourceMediaTypeSchema>; description: string; role: z.infer<typeof ingestibleFileRoleSchema>; content: Uint8Array }>,
  incomingFiles: Array<{ filename: string; mediaType: z.infer<typeof supportedResourceMediaTypeSchema>; description: string; role: z.infer<typeof ingestibleFileRoleSchema>; content: Uint8Array }>,
) {
  const merged = new Map(existingFiles.map((file) => [file.filename, file]));
  for (const file of incomingFiles) {
    merged.set(file.filename, file);
  }
  return Array.from(merged.values()).sort((a, b) => a.filename.localeCompare(b.filename));
}

import { z } from "zod";

import {
  ingestibleFileRoleSchema,
  parseResourceIngestionRequest,
  resourceIngestionMetadataSchema,
  supportedResourceMediaTypeSchema,
} from "./resource-ingestion.js";
import { ResourceIngestionService } from "./resource-ingestion-service.js";
import type { ResourceMetadata } from "./resource.js";
import { assertWriteAccess, componentWriteActorSchema, type ComponentWriteActor } from "./write-actor.js";
import { WorkspaceStore } from "./workspace-store.js";

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

  private assertScopedActor(
    actor: ComponentWriteActor,
    benchId: string,
    componentInstanceId: string,
  ): ComponentWriteActor {
    if (actor.benchId !== benchId) {
      throw new Error("Write actor benchId must match the route benchId");
    }
    if (actor.componentInstanceId !== componentInstanceId) {
      throw new Error("Write actor componentInstanceId must match the route componentInstanceId");
    }
    return actor;
  }
}

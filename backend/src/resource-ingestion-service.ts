import {
  buildExtractedTextFile,
  extractTextFromPdf,
} from "./pdf-extraction.js";
import {
  buildResourceMetadataFromIngestion,
  parseResourceIngestionRequest,
  type GeneratedResourceFile,
  type ResourceIngestionRequest,
} from "./resource-ingestion.js";
import type { ResourceMetadata } from "./resource.js";
import { WorkspaceStore, WorkspaceValidationError } from "./workspace-store.js";

export interface IngestedResourceResult {
  resource: ResourceMetadata;
  generatedFiles: GeneratedResourceFile[];
  storedFilenames: string[];
}

export class ResourceIngestionService {
  constructor(private readonly store: WorkspaceStore) {}

  async ingest(
    input: ResourceIngestionRequest,
  ): Promise<IngestedResourceResult> {
    const request = parseResourceIngestionRequest(input);
    const generatedFiles = await this.generateDerivedFiles(request);
    const resource = buildResourceMetadataFromIngestion(request, generatedFiles);

    let createdResource = false;
    try {
      await this.store.writeResource(resource);
      createdResource = true;

      for (const file of request.files) {
        await this.store.writeResourceFile(
          resource.benchId,
          resource.componentInstanceId,
          resource.id,
          file.filename,
          file.content,
        );
      }

      for (const generated of generatedFiles) {
        await this.store.writeResourceFile(
          resource.benchId,
          resource.componentInstanceId,
          resource.id,
          generated.file.filename,
          generated.content,
        );
      }

      const storedFilenames = await this.store.listResourceFiles(
        resource.benchId,
        resource.componentInstanceId,
        resource.id,
      );
      const expectedFilenames = resource.files.map((file) => file.filename).sort();
      if (JSON.stringify(storedFilenames) !== JSON.stringify(expectedFilenames)) {
        throw new WorkspaceValidationError("Stored resource files do not match resource metadata inventory");
      }

      return {
        resource,
        generatedFiles,
        storedFilenames,
      };
    } catch (error) {
      if (createdResource) {
        await this.store.deleteResource(resource.benchId, resource.componentInstanceId, resource.id).catch(() => undefined);
      }
      throw error;
    }
  }

  private async generateDerivedFiles(request: ResourceIngestionRequest): Promise<GeneratedResourceFile[]> {
    const generatedFiles: GeneratedResourceFile[] = [];

    for (const file of request.files) {
      if (file.mediaType !== "application/pdf") {
        continue;
      }

      const text = await extractTextFromPdf(file.content);
      generatedFiles.push(buildExtractedTextFile(file, text));
    }

    return generatedFiles;
  }
}

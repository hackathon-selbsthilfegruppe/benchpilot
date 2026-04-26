import path from "node:path";

import { z } from "zod";

import {
  createResource,
  createResourceInputSchema,
  resourceFileSchema,
  type CreateResourceOptions,
  type ResourceFile,
  type ResourceMetadata,
} from "./resource.js";

export const SUPPORTED_RESOURCE_FILE_TYPES = {
  "text/markdown": [".md"],
  "text/plain": [".txt"],
  "application/pdf": [".pdf"],
} as const;

export type SupportedResourceMediaType = keyof typeof SUPPORTED_RESOURCE_FILE_TYPES;

export const supportedResourceMediaTypeSchema = z.enum([
  "text/markdown",
  "text/plain",
  "application/pdf",
]);

export const ingestibleFileRoleSchema = z.enum(["primary", "attachment"]);
export type IngestibleFileRole = z.infer<typeof ingestibleFileRoleSchema>;

const fileContentSchema = z.instanceof(Uint8Array).refine((value) => value.byteLength > 0, {
  message: "File content must not be empty",
});

export const resourceIngestionFileSchema = z.object({
  filename: z.string().trim().min(1),
  mediaType: supportedResourceMediaTypeSchema,
  description: z.string().trim().min(1),
  role: ingestibleFileRoleSchema.default("attachment"),
  content: fileContentSchema,
}).superRefine((file, ctx) => {
  if (path.basename(file.filename) !== file.filename) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["filename"],
      message: "Filenames must be resource-local basenames without path separators",
    });
    return;
  }

  const extension = path.extname(file.filename).toLowerCase();
  const allowedExtensions = SUPPORTED_RESOURCE_FILE_TYPES[file.mediaType];
  if (!allowedExtensions.includes(extension as never)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["filename"],
      message: `Filename extension ${extension || "<none>"} is not allowed for media type ${file.mediaType}`,
    });
  }
});

export type ResourceIngestionFile = z.infer<typeof resourceIngestionFileSchema>;

export const resourceIngestionMetadataSchema = createResourceInputSchema.omit({
  files: true,
  primaryFile: true,
  contentType: true,
}).extend({
  id: z.string().trim().min(1).optional(),
}).strict();

export const resourceIngestionRequestSchema = z.object({
  resource: resourceIngestionMetadataSchema,
  files: z.array(resourceIngestionFileSchema).min(1),
  primaryFilename: z.string().trim().min(1).optional(),
}).superRefine((request, ctx) => {
  const seen = new Set<string>();
  for (const [index, file] of request.files.entries()) {
    const key = file.filename.toLowerCase();
    if (seen.has(key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["files", index, "filename"],
        message: "Filenames must be unique within one resource ingestion request",
      });
    }
    seen.add(key);
  }

  const primaryFiles = request.files.filter((file) => file.role === "primary");
  if (primaryFiles.length !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["files"],
      message: "Exactly one ingested file must be marked as the primary file",
    });
  }

  if (request.primaryFilename && !request.files.some((file) => file.filename === request.primaryFilename)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["primaryFilename"],
      message: "primaryFilename must reference one of the uploaded files",
    });
  }

  if (request.primaryFilename) {
    const explicitPrimary = request.files.find((file) => file.filename === request.primaryFilename);
    if (explicitPrimary?.role !== "primary") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["primaryFilename"],
        message: "primaryFilename must point to the file marked as primary",
      });
    }
  }
});

export type ResourceIngestionRequest = z.infer<typeof resourceIngestionRequestSchema>;

export interface GeneratedResourceFile {
  file: ResourceFile;
  content: Uint8Array;
}

export function parseResourceIngestionRequest(input: unknown): ResourceIngestionRequest {
  return resourceIngestionRequestSchema.parse(input);
}

export function buildResourceMetadataFromIngestion(
  request: ResourceIngestionRequest,
  generatedFiles: GeneratedResourceFile[] = [],
  options: CreateResourceOptions = {},
): ResourceMetadata {
  const parsedRequest = parseResourceIngestionRequest(request);
  const parsedGeneratedFiles = generatedFiles.map((entry) => ({
    file: resourceFileSchema.parse(entry.file),
    content: entry.content,
  }));
  const files = [
    ...parsedRequest.files.map<ResourceFile>(({ filename, mediaType, description, role }) => ({
      filename,
      mediaType,
      description,
      role,
    })),
    ...parsedGeneratedFiles.map((entry) => entry.file),
  ];
  const primaryFile = parsedRequest.primaryFilename
    ?? parsedRequest.files.find((file) => file.role === "primary")?.filename;
  const primaryMediaType = parsedRequest.files.find((file) => file.filename === primaryFile)?.mediaType;

  return createResource(
    {
      ...parsedRequest.resource,
      files,
      primaryFile,
      contentType: primaryMediaType,
    },
    options,
  );
}

export function mediaTypeFromFilename(filename: string): SupportedResourceMediaType | null {
  const extension = path.extname(filename).toLowerCase();
  for (const [mediaType, extensions] of Object.entries(SUPPORTED_RESOURCE_FILE_TYPES) as Array<
    [SupportedResourceMediaType, readonly string[]]
  >) {
    if (extensions.includes(extension)) {
      return mediaType;
    }
  }
  return null;
}

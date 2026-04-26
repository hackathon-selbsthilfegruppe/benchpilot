import { Buffer } from "node:buffer";

import { PDFParse } from "pdf-parse";

import type { ResourceFile } from "./resource.js";
import type { ResourceIngestionFile } from "./resource-ingestion.js";

export class PdfExtractionError extends Error {
  constructor(message: string, readonly causeValue?: unknown) {
    super(message);
    this.name = "PdfExtractionError";
  }
}

export async function extractTextFromPdf(pdfData: Uint8Array): Promise<string> {
  const parser = new PDFParse({ data: Buffer.from(pdfData) });

  try {
    const result = await parser.getText({ pageJoiner: "" });
    return normalizeExtractedPdfText(result.text);
  } catch (error) {
    throw new PdfExtractionError("Failed to extract text from PDF", error);
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

export function buildExtractedTextFile(
  sourcePdfFile: Pick<ResourceIngestionFile, "filename" | "description">,
  text: string,
): { file: ResourceFile; content: Buffer } {
  if (!sourcePdfFile.filename.toLowerCase().endsWith(".pdf")) {
    throw new PdfExtractionError("Extracted-text companions may only be generated from PDF source files");
  }

  const filename = sourcePdfFile.filename.replace(/\.pdf$/i, ".txt");
  return {
    file: {
      filename,
      mediaType: "text/plain",
      description: `Extracted text from ${sourcePdfFile.filename}: ${sourcePdfFile.description}`,
      role: "extracted-text",
      sourceFilename: sourcePdfFile.filename,
    },
    content: Buffer.from(text, "utf8"),
  };
}

export function normalizeExtractedPdfText(text: string): string {
  return text.replace(/\r\n/g, "\n").trim();
}

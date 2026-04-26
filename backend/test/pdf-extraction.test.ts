import { Buffer } from "node:buffer";

import { describe, expect, it } from "vitest";

import {
  buildExtractedTextFile,
  extractTextFromPdf,
  PdfExtractionError,
} from "../src/pdf-extraction.js";
import { resourceFileSchema } from "../src/resource.js";

describe("pdf extracted text generation", () => {
  it("extracts plain text from a PDF without default page markers", async () => {
    const pdf = createPdfWithText("Hello PDF world");

    const text = await extractTextFromPdf(pdf);

    expect(text).toContain("Hello PDF world");
    expect(text).not.toContain("-- 1 of 1 --");
  });

  it("builds an extracted-text companion file linked back to the source PDF", () => {
    const extracted = buildExtractedTextFile(
      {
        filename: "prior-art.pdf",
        description: "Original paper PDF",
      },
      "hello world",
    );

    expect(resourceFileSchema.parse(extracted.file)).toEqual({
      filename: "prior-art.txt",
      mediaType: "text/plain",
      description: "Extracted text from prior-art.pdf: Original paper PDF",
      role: "extracted-text",
      sourceFilename: "prior-art.pdf",
    });
    expect(extracted.content).toEqual(Buffer.from("hello world", "utf8"));
  });

  it("throws an explicit backend error when PDF extraction fails", async () => {
    await expect(extractTextFromPdf(Buffer.from("not a pdf", "utf8"))).rejects.toBeInstanceOf(PdfExtractionError);
  });
});

function createPdfWithText(text: string): Buffer {
  const objects: string[] = [];
  const push = (value: string) => objects.push(value);

  push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  push(
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
  );

  const stream = `BT\n/F1 24 Tf\n72 72 Td\n(${escapePdfText(text)}) Tj\nET`;
  push(`4 0 obj\n<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream\nendobj\n`);
  push("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += object;
  }

  const xrefOffset = Buffer.byteLength(pdf);
  pdf += "xref\n0 6\n";
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index <= 5; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += "trailer\n<< /Size 6 /Root 1 0 R >>\n";
  pdf += `startxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "utf8");
}

function escapePdfText(text: string): string {
  return text.replace(/[\\()]/g, "\\$&");
}

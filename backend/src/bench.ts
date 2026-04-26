import { z } from "zod";

export const BENCH_ID_PREFIX = "bench-";

export const benchIdSchema = z.string().regex(/^bench-[a-z0-9]+(?:-[a-z0-9]+)*$/, {
  message: "Bench IDs must start with `bench-` and use lowercase kebab-case segments.",
});

export type BenchId = z.infer<typeof benchIdSchema>;

export const benchStatusSchema = z.enum(["draft", "active", "archived", "error"]);
export type BenchStatus = z.infer<typeof benchStatusSchema>;

const isoDateTimeSchema = z.string().datetime({ offset: true });

const benchMetadataBaseSchema = z.object({
  id: benchIdSchema,
  title: z.string().trim().min(1),
  question: z.string().trim().min(1),
  normalizedQuestion: z.string().trim().min(1).optional(),
  intakeBriefId: z.string().trim().min(1).optional(),
  status: benchStatusSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const benchMetadataSchema = benchMetadataBaseSchema.superRefine((bench, ctx) => {
  const createdAt = Date.parse(bench.createdAt);
  const updatedAt = Date.parse(bench.updatedAt);
  if (Number.isNaN(createdAt) || Number.isNaN(updatedAt)) {
    return;
  }
  if (updatedAt < createdAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["updatedAt"],
      message: "updatedAt must be greater than or equal to createdAt",
    });
  }
});

export type BenchMetadata = z.infer<typeof benchMetadataSchema>;

export const benchSummarySchema = benchMetadataBaseSchema.pick({
  id: true,
  title: true,
  question: true,
  status: true,
  updatedAt: true,
});

export type BenchSummary = z.infer<typeof benchSummarySchema>;

export const createBenchInputSchema = z.object({
  slug: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1),
  question: z.string().trim().min(1),
  normalizedQuestion: z.string().trim().min(1).optional(),
  intakeBriefId: z.string().trim().min(1).optional(),
}).strict();

export type CreateBenchInput = z.infer<typeof createBenchInputSchema>;

export interface CreateBenchOptions {
  now?: Date;
  existingBenchIds?: Iterable<string>;
  status?: BenchStatus;
}

export function normalizeBenchSlug(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return normalized || "untitled";
}

export function createBenchId(source: string): BenchId {
  return benchIdSchema.parse(`${BENCH_ID_PREFIX}${normalizeBenchSlug(source)}`);
}

export function allocateBenchId(source: string, existingBenchIds: Iterable<string> = []): BenchId {
  const baseId = createBenchId(source);
  const usedIds = new Set(existingBenchIds);
  if (!usedIds.has(baseId)) {
    return baseId;
  }

  let counter = 2;
  while (true) {
    const candidate = benchIdSchema.parse(`${baseId}-${counter}`);
    if (!usedIds.has(candidate)) {
      return candidate;
    }
    counter += 1;
  }
}

export function createBench(input: CreateBenchInput, options: CreateBenchOptions = {}): BenchMetadata {
  const parsedInput = createBenchInputSchema.parse(input);
  const timestamp = (options.now ?? new Date()).toISOString();
  const idSource = parsedInput.slug ?? parsedInput.title;

  return benchMetadataSchema.parse({
    id: allocateBenchId(idSource, options.existingBenchIds),
    title: parsedInput.title,
    question: parsedInput.question,
    normalizedQuestion: parsedInput.normalizedQuestion,
    intakeBriefId: parsedInput.intakeBriefId,
    status: options.status ?? "active",
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

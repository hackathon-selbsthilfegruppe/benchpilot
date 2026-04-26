import "server-only";

export type LiteratureHit = {
  sourceId: string;
  externalId: string;
  title: string;
  authors?: string;
  year?: number;
  url: string;
  doi?: string;
  /** Short summary — TL;DR if available, otherwise truncated abstract. */
  summary?: string;
  citationCount?: number;
  openAccessPdfUrl?: string;
};

export type LiteratureSourceResult = {
  sourceId: string;
  hits: LiteratureHit[];
  error?: string;
};

export interface LiteratureSource {
  readonly id: string;
  readonly label: string;
  isConfigured(): boolean;
  search(query: string, pageSize: number): Promise<LiteratureHit[]>;
}

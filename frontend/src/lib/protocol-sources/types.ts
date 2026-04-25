import "server-only";

export type ProtocolHit = {
  sourceId: string;
  externalId: string;
  title: string;
  authors?: string;
  url: string;
  doi?: string;
  description?: string;
  publishedAt?: string;
};

export type ProtocolSourceResult = {
  sourceId: string;
  hits: ProtocolHit[];
  error?: string;
};

export interface ProtocolSource {
  readonly id: string;
  readonly label: string;
  isConfigured(): boolean;
  search(query: string, pageSize: number): Promise<ProtocolHit[]>;
}

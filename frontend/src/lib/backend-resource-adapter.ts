import type { ResourceDetail } from "./benchpilot-workbench-client";
import type { DetailDoc, Status, TocEntry } from "./components-shared";

export function adaptResourceToTocEntry(resource: ResourceDetail): TocEntry {
  return {
    slug: resource.id,
    title: resource.title,
    descriptor: resource.description || resource.kind,
    status: mapResourceStatus(resource.status),
  };
}

export function adaptResourceToDetailDoc(resource: ResourceDetail): DetailDoc {
  return {
    slug: resource.id,
    title: resource.title,
    body: resource.content?.trim() || formatResourceFallback(resource),
  };
}

export function formatResourceFallback(resource: ResourceDetail): string {
  return [
    `# ${resource.title}`,
    "",
    `Kind: ${resource.kind}`,
    `Status: ${resource.status}`,
    resource.description ? `Description: ${resource.description}` : undefined,
    "",
    resource.summary,
  ].filter(Boolean).join("\n");
}

export function mapResourceStatus(status: string): Status {
  switch (status) {
    case "ready":
      return "ok";
    case "draft":
      return "pending";
    case "error":
      return "blocked";
    default:
      return "info";
  }
}

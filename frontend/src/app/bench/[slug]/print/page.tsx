import { notFound } from "next/navigation";

import { Markdown } from "../../../markdown";
import { getBenchpilotBackendEndpoint } from "@/lib/benchpilot-backend";

interface ExportResource {
  id: string;
  title: string;
  summary?: string;
  kind?: string;
  tags?: string[];
  content?: string;
  status?: string;
}

interface ExportComponent {
  component: {
    id: string;
    presetId?: string;
    name: string;
    summary: string;
    status?: string;
  };
  summary: string;
  resources: ExportResource[];
}

interface ExportBundle {
  exportedAt: string;
  bench: {
    id: string;
    title: string;
    question: string;
    status?: string;
    createdAt?: string;
  };
  components: ExportComponent[];
}

async function fetchExport(benchId: string): Promise<ExportBundle | null> {
  const url = getBenchpilotBackendEndpoint(`/api/benches/${encodeURIComponent(benchId)}/export.json`);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as ExportBundle;
}

export default async function BenchPrintPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const bundle = await fetchExport(slug);
  if (!bundle) notFound();

  return (
    <html>
      <head>
        <title>{bundle.bench.title} — BenchPilot plan</title>
        <style>{`
          @page { margin: 18mm; size: A4; }
          html, body { background: #fff; color: #0f172a; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 11pt; line-height: 1.5; margin: 0; padding: 24px;
            -webkit-print-color-adjust: exact; print-color-adjust: exact;
          }
          h1, h2, h3 { color: #1e293b; }
          h1 { font-size: 22pt; margin: 0 0 4px; }
          h2 { font-size: 14pt; margin: 24px 0 8px; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; page-break-after: avoid; }
          h3 { font-size: 12pt; margin: 16px 0 6px; page-break-after: avoid; }
          p, li { margin: 4px 0; }
          .meta { color: #64748b; font-size: 9pt; margin-bottom: 16px; }
          .question { background: #f1f5f9; border-left: 4px solid #6366f1; padding: 10px 14px; margin: 8px 0 24px; }
          .component { page-break-inside: avoid; margin-top: 18px; }
          .component-summary { color: #475569; font-style: italic; margin-bottom: 8px; }
          .resource { page-break-inside: avoid; margin: 12px 0; padding: 10px 12px; border-left: 3px solid #cbd5e1; background: #f8fafc; }
          .resource-title { font-weight: 600; }
          .resource-summary { color: #475569; font-size: 10pt; }
          .empty { color: #94a3b8; font-style: italic; }
          .toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
          .toolbar button { font: inherit; padding: 6px 12px; border: 1px solid #cbd5e1; background: #fff; border-radius: 4px; cursor: pointer; }
          @media print { .toolbar { display: none; } }
          .markdown-body { font-size: 10.5pt; }
          .markdown-body code { background: #e2e8f0; padding: 1px 4px; border-radius: 3px; }
          .markdown-body pre { background: #0f172a; color: #f8fafc; padding: 10px; border-radius: 4px; overflow-x: auto; }
          .markdown-body ul, .markdown-body ol { padding-left: 22px; }
        `}</style>
      </head>
      <body>
        <div className="toolbar">
          <span style={{ color: "#64748b", fontSize: "10pt" }}>
            The print dialog opens automatically. If it didn&apos;t, press ⌘P (or Ctrl+P) to print or save as PDF.
          </span>
        </div>

        <h1>{bundle.bench.title}</h1>
        <div className="meta">
          Bench {bundle.bench.id} · status {bundle.bench.status ?? "active"} · exported {new Date(bundle.exportedAt).toLocaleString()}
        </div>

        <h2>Research question</h2>
        <div className="question">{bundle.bench.question}</div>

        {bundle.components.map((entry) => (
          <section key={entry.component.id} className="component">
            <h2>{entry.component.name}</h2>
            {entry.component.summary && (
              <p className="component-summary">{entry.component.summary}</p>
            )}
            {entry.resources.length === 0 ? (
              <p className="empty">No resources captured for this component yet.</p>
            ) : (
              entry.resources.map((resource) => (
                <div key={resource.id} className="resource">
                  <div className="resource-title">{resource.title}</div>
                  {resource.summary && (
                    <div className="resource-summary">{resource.summary}</div>
                  )}
                  {resource.content && (
                    <Markdown className="markdown-body">{resource.content}</Markdown>
                  )}
                </div>
              ))
            )}
          </section>
        ))}

        <script dangerouslySetInnerHTML={{ __html: "setTimeout(() => window.print(), 400);" }} />
      </body>
    </html>
  );
}

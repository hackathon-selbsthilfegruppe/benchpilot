const DEFAULT_BACKEND_URL = "http://127.0.0.1:8787";

export function getBenchpilotBackendUrl(): string {
  return process.env.BENCHPILOT_BACKEND_URL?.trim() || DEFAULT_BACKEND_URL;
}

export function getBenchpilotBackendEndpoint(pathname: string): string {
  const baseUrl = getBenchpilotBackendUrl();
  return new URL(pathname, `${baseUrl.replace(/\/$/, "")}/`).toString();
}

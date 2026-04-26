"use client";

import { useEffect } from "react";

// Tiny client component that opens the browser print dialog once the
// print page is mounted. Lives in its own file so the print page can
// stay a server component (it fetches the export bundle server-side).
//
// Using a real React effect rather than an inline <script> tag — React
// 19 explicitly does not execute <script> elements rendered as
// children, so the previous "setTimeout(() => window.print(), 400)"
// trigger silently no-op'd in the client.
export function AutoPrint(): null {
  useEffect(() => {
    const t = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(t);
  }, []);
  return null;
}

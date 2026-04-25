import { loadHypothesesIndex } from "@/lib/components-fs";
import Start from "./start";

export default async function Page() {
  const idx = await loadHypothesesIndex();
  return <Start existingHypotheses={idx.hypotheses} />;
}

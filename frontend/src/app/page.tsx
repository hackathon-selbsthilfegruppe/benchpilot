import {
  loadAllComponents,
  loadAllDetails,
} from "@/lib/components-fs";
import type { BenchComponent } from "@/lib/components-shared";
import Workbench from "./workbench";

export default async function Page() {
  const summaries = await loadAllComponents();
  const components: BenchComponent[] = await Promise.all(
    summaries.map(async (c) => ({
      ...c,
      details: await loadAllDetails(c.id),
    })),
  );
  return <Workbench components={components} />;
}

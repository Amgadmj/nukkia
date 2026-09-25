import { briefIssues, identityReady } from "./brand-preview.ts";
import type { DemoData } from "./quick-start.ts";

export function contentPlanReady(data: DemoData, hasBrandKit: boolean) {
  return hasBrandKit && briefIssues(data).length === 0 && identityReady(data.brand);
}

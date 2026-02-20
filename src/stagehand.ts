import { Stagehand } from "@browserbasehq/stagehand";

let stagehand: Stagehand | null = null;

export async function getStagehand() {
  if (!stagehand) {
    stagehand = new Stagehand({
      env: "LOCAL",
    });
    await stagehand.init();
  }
  return stagehand;
}

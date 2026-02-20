import "dotenv/config";
import { Stagehand } from "@browserbasehq/stagehand";

let stagehand: Stagehand | null = null;
let initializationPromise: Promise<Stagehand> | null = null;

export async function getStagehand(): Promise<Stagehand> {
  // If already initialized, return immediately
  if (stagehand) {
    return stagehand;
  }

  // If initialization is in progress, wait for it
  if (initializationPromise) {
    return initializationPromise;
  }

  // Start initialization (only first call reaches here)
  initializationPromise = initStagehand();
  return initializationPromise;
}

const initStagehand = async (): Promise<Stagehand> => {
  const instance = new Stagehand({
    env: "LOCAL",
    localBrowserLaunchOptions: {
      headless: true,
    },
    model: {
      modelName: "anthropic/claude-haiku-4-5",
      apiKey: process.env.ANTHROPIC_API_KEY,
    },
  });

  await instance.init();

  // Only set stagehand after successful initialization
  stagehand = instance;

  return instance;
};

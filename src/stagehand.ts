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
  initializationPromise = (async () => {
    try {
      const instance = new Stagehand({
        env: "LOCAL",
        localBrowserLaunchOptions: {
          headless: true,
        },
      });

      await instance.init();

      // Only set stagehand after successful initialization
      stagehand = instance;

      return instance;
    } catch (error) {
      // Clear promise on error to allow retry
      initializationPromise = null;
      throw error;
    }
  })();

  return initializationPromise;
}

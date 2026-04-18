import "dotenv/config";
import { Stagehand } from "@browserbasehq/stagehand";
import { mkdtemp, cp } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
  const profileDir = join(process.cwd(), ".browser-use", "profile");
  let userDataDir: string | undefined;

  if (existsSync(profileDir)) {
    userDataDir = await mkdtemp(join(tmpdir(), "stagehand-profile-"));
    await cp(profileDir, userDataDir, { recursive: true });
    console.error(
      `[stagehand] Browser profile detected at ${profileDir}, copied to ${userDataDir}`,
    );
  }

  const instance = new Stagehand({
    env: "LOCAL",
    localBrowserLaunchOptions: {
      headless: true,
      ...(userDataDir && { userDataDir }),
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

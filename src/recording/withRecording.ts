import { Page, Stagehand } from "@browserbasehq/stagehand";
import { ScreenRecorder } from "./recorder";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

// Use cwd for recordings (works with npx); fall back to script parent dir
const RECORDINGS_BASE = process.cwd();

export async function withRecording<T>(
  toolName: string,
  page: Page,
  stagehand: Stagehand,
  callback: () => Promise<T>,
): Promise<{ result: T; recordingPath: string }> {
  const recordingsDir = join(RECORDINGS_BASE, ".browser-use", "recordings");
  console.error(`[withRecording] recordingsDir=${recordingsDir}`);
  await mkdir(recordingsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = join(recordingsDir, `${timestamp}-${toolName}.mp4`);
  console.error(`[withRecording] outputPath=${outputPath}`);

  const recorder = new ScreenRecorder(page, stagehand);

  try {
    await recorder.start();
  } catch (err) {
    console.error(`[withRecording] Failed to start recording:`, err);
    const result = await callback();
    return { result, recordingPath: "" };
  }

  let result: T;
  try {
    result = await callback();
  } catch (err) {
    // Stop recorder to release CDP screencast, then re-throw
    recorder.stop(outputPath).catch(() => {});
    throw err;
  }

  // Wait for enough frames, then encode before returning
  try {
    console.error(`[withRecording] waiting for frames...`);
    await recorder.waitForMinFrames(10, 5000);
    console.error(`[withRecording] frames ready, stopping recorder...`);
    await recorder.stop(outputPath);
    console.error(`[withRecording] recorder stopped`);
  } catch (err) {
    console.error(`[withRecording] Recording encoding failed:`, err);
  }

  return { result, recordingPath: outputPath };
}

import { Page, Stagehand } from "@browserbasehq/stagehand";
import { ScreenRecorder } from "./recorder";
import fs from "fs/promises";
import path from "path";

// Resolve project root from the script path (dist/index.js -> project root)
const SCRIPT_DIR = path.dirname(process.argv[1] || ".");
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..");

export async function withRecording<T>(
  toolName: string,
  page: Page,
  stagehand: Stagehand,
  callback: () => Promise<T>,
): Promise<{ result: T; recordingPath: string }> {
  const recordingsDir = path.join(PROJECT_ROOT, "recordings");
  console.error(`[withRecording] cwd=${process.cwd()}, projectRoot=${PROJECT_ROOT}, recordingsDir=${recordingsDir}`);
  await fs.mkdir(recordingsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = path.join(recordingsDir, `${toolName}-${timestamp}.mp4`);
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

  // Verify the file actually exists on disk
  try {
    const stat = await fs.stat(outputPath);
    console.error(`[withRecording] file exists: ${outputPath}, size=${stat.size} bytes`);
  } catch {
    console.error(`[withRecording] WARNING: file does NOT exist at ${outputPath}`);
  }

  return { result, recordingPath: outputPath };
}

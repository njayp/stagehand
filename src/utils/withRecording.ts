import { Page, Stagehand } from "@browserbasehq/stagehand";
import { ScreenRecorder } from "./recorder";
import fs from "fs/promises";
import path from "path";

export async function withRecording<T>(
  toolName: string,
  page: Page,
  stagehand: Stagehand,
  callback: () => Promise<T>,
): Promise<{ result: T; recordingPath: string }> {
  const recordingsDir = path.resolve("./recordings");
  await fs.mkdir(recordingsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = path.join(recordingsDir, `${toolName}-${timestamp}.mp4`);

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

  // Fire-and-forget: wait for frames, then encode
  recorder
    .waitForMinFrames(10, 5000)
    .then(() => recorder.stop(outputPath))
    .catch((err) =>
      console.error(`[withRecording] Background encoding failed:`, err),
    );

  return { result, recordingPath: outputPath };
}

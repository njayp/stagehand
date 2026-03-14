import { Stagehand, Page } from "@browserbasehq/stagehand";
import { Protocol } from "devtools-protocol";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import fs from "fs/promises";
import path from "path";
import os from "os";

// Set ffmpeg path to use bundled binary
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

interface Frame {
  data: string; // base64-encoded JPEG
  sessionId: number;
  timestamp: number;
}

export class ScreenRecorder {
  private frames: Frame[] = [];
  private frameHandler:
    | ((params: Protocol.Page.ScreencastFrameEvent) => void)
    | null = null;
  private session: any = null; // Will store the CDP session for event unregistration
  private readonly MAX_FRAMES = 1000;
  private recordingStartTime: number = 0;

  constructor(
    private page: Page,
    private stagehand: Stagehand,
  ) {}

  async start(): Promise<void> {
    this.frames = [];
    this.recordingStartTime = Date.now();

    // Enable Page domain first (required for screencast)
    await this.page.sendCDP("Page.enable");

    // Get the page's main frame session for listening to events
    const mainFrame = this.page.mainFrame();
    this.session = mainFrame.session;

    // Register event handler FIRST before starting screencast
    this.frameHandler = (params: Protocol.Page.ScreencastFrameEvent) => {
      // Buffer frames up to MAX_FRAMES limit
      if (this.frames.length < this.MAX_FRAMES) {
        this.frames.push({
          data: params.data,
          sessionId: params.sessionId,
          timestamp: Date.now() - this.recordingStartTime,
        });
      }

      // Always acknowledge frames to keep stream flowing
      this.page
        .sendCDP("Page.screencastFrameAck", { sessionId: params.sessionId })
        .catch((err) => {});
    };

    // Listen for screencast frame events on the page's session, not root connection
    this.session.on("Page.screencastFrame", this.frameHandler);

    // Start CDP screencast
    await this.page.sendCDP("Page.startScreencast", {
      format: "jpeg",
      quality: 80,
      maxWidth: 1280,
      maxHeight: 720,
      everyNthFrame: 1,
    });
  }

  async waitForMinFrames(min: number, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (this.frames.length < min && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  async stop(outputPath: string): Promise<void> {
    console.error(
      `[recorder] stop() called, frames captured: ${this.frames.length}, outputPath: ${outputPath}`,
    );

    try {
      // Stop CDP screencast
      await this.page.sendCDP("Page.stopScreencast");
    } catch (error) {
      console.error(`[recorder] Page.stopScreencast error:`, error);
    }

    // Unregister event handler from the page's session
    if (this.frameHandler && this.session) {
      this.session.off("Page.screencastFrame", this.frameHandler);
      this.frameHandler = null;
      this.session = null;
    }

    // Skip encoding if too few frames for a meaningful recording
    if (this.frames.length < 2) {
      console.error(
        `[recorder] Only ${this.frames.length} frame(s) captured, skipping encoding`,
      );
      return;
    }

    console.error(
      `[recorder] encoding ${this.frames.length} frames to ${outputPath}`,
    );
    // Encode frames to MP4
    await this.encodeToMp4(this.frames, outputPath);
    console.error(`[recorder] encoding complete: ${outputPath}`);
  }

  private async encodeToMp4(
    frames: Frame[],
    outputPath: string,
  ): Promise<void> {
    // Create temporary directory for frames
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "stagehand-frames-"));

    try {
      // Write each frame as a numbered JPEG file
      await Promise.all(
        frames.map((frame, i) => {
          const framePath = path.join(tempDir, `frame-${i.toString().padStart(5, "0")}.jpg`);
          return fs.writeFile(framePath, Buffer.from(frame.data, "base64"));
        }),
      );

      // Calculate frame rate based on actual recording duration
      const totalDuration = frames[frames.length - 1].timestamp / 1000; // Convert to seconds
      const fps = Math.max(1, Math.min(30, frames.length / totalDuration)); // Between 1-30 fps

      // Encode frames to MP4 using ffmpeg

      await new Promise<void>((resolve, reject) => {
        const command = ffmpeg()
          .input(path.join(tempDir, "frame-%05d.jpg"))
          .inputFPS(fps)
          .videoFilters([
            "scale=trunc(iw/2)*2:trunc(ih/2)*2", // Ensure even dimensions for H.264
          ])
          .outputOptions([
            "-c:v libx264", // H.264 codec
            "-pix_fmt yuv420p", // Pixel format for compatibility
            "-movflags +faststart", // Enable fast start for web playback
          ])
          .output(outputPath)
          .on("end", () => {
            resolve();
          })
          .on("error", (err, stdout, stderr) => {
            reject(new Error(`FFmpeg encoding failed: ${err.message}`));
          });

        command.run();
      });
    } finally {
      // Cleanup temporary directory
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {}
    }
  }
}

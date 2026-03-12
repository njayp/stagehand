import path from "path";

export function getLogsDir(): string {
  const base = process.env.STAGEHAND_LOGS_DIR || path.join(process.cwd(), ".stagehand", "logs");
  return base;
}

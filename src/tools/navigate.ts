import { z } from "zod";
import { Page } from "@browserbasehq/stagehand";
import { getStagehand } from "../stagehand";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

interface PerformanceMetrics {
  wallClockMs: number;
  ttfbMs: number | null;
  domInteractiveMs: number | null;
  domContentLoadedMs: number | null;
  loadEventEndMs: number | null;
  totalLoadTimeMs: number | null;
  domParsingMs: number | null;
}

async function collectPerformanceMetrics(
  page: Page,
  wallClockMs: number,
): Promise<PerformanceMetrics | null> {
  try {
    const timing = await page.evaluate(() => {
      const entries = performance.getEntriesByType(
        "navigation",
      ) as PerformanceNavigationTiming[];
      if (!entries.length) return null;
      const nav = entries[0];
      return {
        ttfb: nav.responseStart > 0 ? Math.round(nav.responseStart) : null,
        domInteractive:
          nav.domInteractive > 0 ? Math.round(nav.domInteractive) : null,
        domContentLoaded:
          nav.domContentLoadedEventEnd > 0
            ? Math.round(nav.domContentLoadedEventEnd)
            : null,
        loadEventEnd:
          nav.loadEventEnd > 0 ? Math.round(nav.loadEventEnd) : null,
        totalLoadTime:
          nav.loadEventEnd > 0 ? Math.round(nav.loadEventEnd) : null,
        domParsing:
          nav.domInteractive > 0 && nav.responseEnd > 0
            ? Math.round(nav.domInteractive - nav.responseEnd)
            : null,
      };
    });

    return {
      wallClockMs,
      ttfbMs: timing?.ttfb ?? null,
      domInteractiveMs: timing?.domInteractive ?? null,
      domContentLoadedMs: timing?.domContentLoaded ?? null,
      loadEventEndMs: timing?.loadEventEnd ?? null,
      totalLoadTimeMs: timing?.totalLoadTime ?? null,
      domParsingMs: timing?.domParsing ?? null,
    };
  } catch {
    return null;
  }
}

function formatMetrics(metrics: PerformanceMetrics): string {
  const lines: string[] = ["\n\nPerformance Metrics:"];
  lines.push(`  Navigation Duration (wall clock): ${metrics.wallClockMs}ms`);
  if (metrics.ttfbMs !== null)
    lines.push(`  TTFB (Time to First Byte): ${metrics.ttfbMs}ms`);
  if (metrics.domInteractiveMs !== null)
    lines.push(`  DOM Interactive: ${metrics.domInteractiveMs}ms`);
  if (metrics.domContentLoadedMs !== null)
    lines.push(`  DOM Content Loaded: ${metrics.domContentLoadedMs}ms`);
  if (metrics.loadEventEndMs !== null)
    lines.push(`  Load Event End: ${metrics.loadEventEndMs}ms`);
  if (metrics.totalLoadTimeMs !== null)
    lines.push(`  Total Load Time: ${metrics.totalLoadTimeMs}ms`);
  if (metrics.domParsingMs !== null)
    lines.push(`  DOM Parsing Time: ${metrics.domParsingMs}ms`);
  return lines.join("\n");
}

export function registerNavigateTool(server: McpServer) {
  server.registerTool(
    "navigate",
    {
      description: "Navigate the browser to a specified URL",
      inputSchema: {
        url: z
          .string()
          .describe("The URL to navigate to (e.g. https://google.com)"),
      },
    },
    async ({ url }) => {
      try {
        const sh = await getStagehand();
        const page = sh.context.activePage();
        if (!page) {
          throw new Error("No active page found in Stagehand context");
        }

        const navStart = Date.now();
        await page.goto(url, { waitUntil: "domcontentloaded" });
        const wallClockMs = Date.now() - navStart;
        const title = await page.title();

        const metrics = await collectPerformanceMetrics(page, wallClockMs);
        const metricsText = metrics ? formatMetrics(metrics) : "";

        return {
          content: [
            {
              type: "text",
              text: `Successfully navigated to ${url}. Page title is "${title}".${metricsText}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error navigating to ${url}: ${String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}

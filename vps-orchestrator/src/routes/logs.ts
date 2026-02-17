import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { CONFIG } from "../config";

const app = new Hono();

// Stream logs via SSE (from the single openclaw service)
app.get("/instances/:id/logs", async (c) => {
  const lines = parseInt(c.req.query("lines") || "100");

  return streamSSE(c, async (stream) => {
    const proc = Bun.spawn(
      [
        "journalctl",
        "-f",
        "-u",
        `${CONFIG.serviceName}.service`,
        "-n",
        String(lines),
        "-o",
        "json",
        "--no-pager",
      ],
      { stdout: "pipe", stderr: "pipe" },
    );

    const reader = proc.stdout.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        for (const line of text.split("\n").filter(Boolean)) {
          try {
            const parsed = JSON.parse(line);
            await stream.writeSSE({
              data: JSON.stringify({
                timestamp: parsed.__REALTIME_TIMESTAMP
                  ? new Date(
                      parseInt(parsed.__REALTIME_TIMESTAMP) / 1000,
                    ).toISOString()
                  : new Date().toISOString(),
                message: parsed.MESSAGE || "",
                priority: parsed.PRIORITY,
                unit: parsed._SYSTEMD_UNIT,
              }),
              event: "log",
            });
          } catch {
            await stream.writeSSE({
              data: JSON.stringify({
                timestamp: new Date().toISOString(),
                message: line,
              }),
              event: "log",
            });
          }
        }
      }
    } catch (error) {
      if (
        error instanceof Error &&
        !error.message.includes("abort")
      ) {
        console.error("Log streaming error:", error);
      }
    } finally {
      proc.kill();
    }
  });
});

export default app;

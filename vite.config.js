import { defineConfig } from "vite";
import { writeFile, mkdir } from "node:fs/promises";
export default defineConfig({
  base: "./",
  plugins: [
    {
      name: "local-survey-still-export",
      configureServer(server) {
        server.middlewares.use("/__qa-export", async (req, res) => {
          const name = new URL(req.url, "http://localhost").pathname.slice(1);
          if (
            req.method !== "POST" ||
            !/^[-a-zA-Z0-9]+\.(zip|png|csv|json|md|html)$/.test(name) ||
            !/^http:\/\/(127\.0\.0\.1|localhost):4173$/.test(
              req.headers.origin || "",
            )
          ) {
            res.writeHead(403);
            res.end();
            return;
          }
          try {
            const chunks = [];
            let size = 0;
            for await (const chunk of req) {
              size += chunk.length;
              if (size > 60_000_000) throw Error("Export too large");
              chunks.push(chunk);
            }
            await mkdir(new URL("qa/browser-exports/", import.meta.url), {
              recursive: true,
            });
            await writeFile(
              new URL("qa/browser-exports/" + name, import.meta.url),
              Buffer.concat(chunks),
            );
            res.writeHead(200);
            res.end("QA export saved");
          } catch (error) {
            res.writeHead(400);
            res.end(error.message);
          }
        });
        // Local authoring only. This endpoint is absent from production builds.
        server.middlewares.use("/__save-still", async (req, res) => {
          const name = new URL(req.url, "http://localhost").pathname.slice(1);
          if (
            req.method !== "POST" ||
            !/^(2024-09-27|2024-10-18|2024-11-27)(-mobile)?\.webp$/.test(name)
          ) {
            res.writeHead(400);
            res.end();
            return;
          }
          if (
            req.headers.origin &&
            !/^http:\/\/(127\.0\.0\.1|localhost):4173$/.test(req.headers.origin)
          ) {
            res.writeHead(403);
            res.end();
            return;
          }
          try {
            const chunks = [];
            let size = 0;
            for await (const chunk of req) {
              size += chunk.length;
              if (size > 10_000_000) throw new Error("Image too large");
              chunks.push(chunk);
            }
            const bytes = Buffer.concat(chunks);
            if (
              bytes.toString("ascii", 0, 4) !== "RIFF" ||
              bytes.toString("ascii", 8, 12) !== "WEBP"
            )
              throw new Error("Invalid WebP");
            await writeFile(
              new URL(`public/data/surveys/${name}`, import.meta.url),
              bytes,
            );
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end(`Saved ${name}`);
          } catch (error) {
            res.writeHead(500);
            res.end(error.message);
          }
        });
      },
    },
  ],
  build: {
    chunkSizeWarningLimit: 1800,
    rollupOptions: {
      input: { workspace: "index.html", survey: "survey.html" },
    },
  },
});

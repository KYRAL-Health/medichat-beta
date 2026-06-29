import http from "http";
import { parse } from "url";
import path from "path";
import fs from "fs";
import { handleVoiceUpgrade } from "./voiceProxy";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);
const hostname = process.env.HOSTNAME || "0.0.0.0";
const dir = path.resolve(".");

// In production standalone mode, Next.js embeds the resolved config in
// .next/required-server-files.json and expects __NEXT_PRIVATE_STANDALONE_CONFIG
// to be set BEFORE any Next.js module is loaded. Without it, Next.js tries to
// load next.config.ts (which isn't copied to the runner image) and ends up with
// an empty config, causing path.join(undefined) errors deep in the router.
if (!dev) {
  const requiredFilesPath = path.join(dir, ".next", "required-server-files.json");
  if (fs.existsSync(requiredFilesPath)) {
    const { config } = JSON.parse(fs.readFileSync(requiredFilesPath, "utf8"));
    process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(config);
  } else {
    console.warn(
      "Warning: .next/required-server-files.json not found. Next.js may fail to start in standalone mode."
    );
  }
}

async function main() {
  // Dynamic import so the env var above is set before Next.js internals load.
  const nextModule = await import("next");
  const next = (nextModule as any).default ?? nextModule;
  const app = next({ dev, dir, hostname, port });

  const handle = app.getRequestHandler();
  await app.prepare();

  const server = http.createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  server.on("upgrade", (req, socket, head) => {
    if (req.url?.startsWith("/api/voice/live")) {
      handleVoiceUpgrade(req, socket, head);
    }
  });

  server.listen(port, hostname, () => {
    console.log(
      `> MediChat ready on http://${hostname}:${port} (${dev ? "dev" : "prod"})`
    );
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

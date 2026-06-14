import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { handleVoiceUpgrade } from "./voiceProxy";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  server.on("upgrade", (req, socket, head) => {
    if (req.url?.startsWith("/api/voice/live")) {
      handleVoiceUpgrade(req, socket, head);
    }
  });

  server.listen(port, () => {
    console.log(`> MediChat ready on http://localhost:${port} (${dev ? "dev" : "prod"})`);
  });
});

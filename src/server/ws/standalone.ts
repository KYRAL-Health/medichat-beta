import { createServer } from "http";
import { handleVoiceUpgrade } from "./voiceProxy";

const port = parseInt(process.env.VOICE_WS_PORT || "3001", 10);

const server = createServer((req, res) => {
  // Health check
  if (req.url === "/health") {
    res.writeHead(200);
    res.end("ok");
    return;
  }
  res.writeHead(404);
  res.end();
});

server.on("upgrade", (req, socket, head) => {
  if (req.url?.startsWith("/api/voice/live")) {
    handleVoiceUpgrade(req, socket, head);
  }
});

server.listen(port, () => {
  console.log(`> Voice WebSocket server ready on ws://localhost:${port}`);
});

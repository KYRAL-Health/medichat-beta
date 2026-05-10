# Voice Capabilities Plan — MediChat Beta

## Problem
Users can only interact with MediChat via typed text. Adding voice input (speak → transcribe → auto-send) and voice output (AI response → auto-play TTS) would make the app more accessible and natural, especially for patients.

## Approach
- **STT**: Self-hosted `faster-whisper-server` (OpenAI-compatible `/v1/audio/transcriptions`)
- **TTS**: Self-hosted `kokoro-fastapi` (OpenAI-compatible `/v1/audio/speech`, high-quality neural voices)
- Both added as Docker Compose services on the existing host (alongside `vllm`)
- Two new Next.js API routes proxy audio through to the services (so the client never calls the services directly — all auth-gated)
- A new `useVoice` hook encapsulates MediaRecorder + TTS playback
- `ChatPanel.tsx` gets a mic button + auto-play on AI responses
- Voice mode is toggle-able — users can stay text-only if they prefer

## UX Decisions
- After recording stops → auto-transcribe → auto-send (no review step)
- AI responses → auto-play via TTS
- Voice mode toggle button in chat toolbar (persists per session, not saved to DB)
- Pulsing red indicator while recording
- Mic disabled while AI is loading/responding

## Risk Classification
- `docker-compose.yml` 🟡 — adding new services
- `.env.example` 🟢 — additive
- `src/server/ai/voice.ts` 🟢 — new file, no existing logic changed
- `src/app/api/voice/transcribe/route.ts` 🟢 — new file
- `src/app/api/voice/speak/route.ts` 🟢 — new file
- `src/hooks/useVoice.ts` 🟢 — new file
- `src/components/ChatPanel.tsx` 🟡 — modifying existing component

## Todos (in dependency order)

### 1. `docker-services` — Add STT + TTS Docker services
Add two new services to `docker-compose.yml`:

**STT — faster-whisper-server**
```yaml
whisper:
  image: fedirz/faster-whisper-server:latest-cpu
  ports:
    - "8001:8001"
  environment:
    - WHISPER__MODEL=${STT_MODEL:-Systran/faster-whisper-base.en}
  restart: unless-stopped
```

**TTS — kokoro-fastapi**
```yaml
kokoro:
  image: ghcr.io/remsky/kokoro-fastapi-cpu:latest
  ports:
    - "8002:8080"
  restart: unless-stopped
```

Also add `STT_API_BASE` and `TTS_API_BASE` to the `app` service environment block.

---

### 2. `env-vars` — Add voice env vars
Add to `.env.example`:
```
# Voice (STT / TTS) — self-hosted
STT_API_BASE="http://whisper:8001"
STT_MODEL="Systran/faster-whisper-base.en"
TTS_API_BASE="http://kokoro:8080"
TTS_VOICE="af_bella"
```

---

### 3. `server-voice` — Create `src/server/ai/voice.ts`
New module:
```ts
export async function sttTranscribe(audioBlob: Buffer, mimeType: string): Promise<string>
export async function ttsSpeak(text: string, voice?: string): Promise<ReadableStream>
```
- `sttTranscribe`: multipart POST to `STT_API_BASE/v1/audio/transcriptions` with the audio file + `model=whisper-1`
- `ttsSpeak`: POST to `TTS_API_BASE/v1/audio/speech` with `{ model, input: text, voice }`, returns streaming response body

---

### 4. `api-transcribe` — Create `src/app/api/voice/transcribe/route.ts`
```
POST /api/voice/transcribe
Content-Type: multipart/form-data
Body: { audio: Blob }
Response: { text: string }
```
- Requires auth (`requireAuthenticatedUser`)
- Reads `audio` from FormData, forwards as Buffer to `sttTranscribe`
- Returns `{ text }`

---

### 5. `api-speak` — Create `src/app/api/voice/speak/route.ts`
```
POST /api/voice/speak
Content-Type: application/json
Body: { text: string }
Response: audio/mpeg stream
```
- Requires auth
- Validates text (non-empty, max 4000 chars)
- Calls `ttsSpeak`, pipes the stream back to the client with `Content-Type: audio/mpeg`

---

### 6. `use-voice-hook` — Create `src/hooks/useVoice.ts`
State machine:
```
idle → recording → transcribing → idle
         ↓ (on stop)
       transcribing → (callback with text) → idle
```
Separate parallel concern: `speak(text)` function
- Fetches `/api/voice/speak`
- Creates blob URL, plays via `new Audio(url)`
- Sets `speaking` state, cleans up blob URL after playback

API:
```ts
const {
  voiceEnabled,       // boolean
  toggleVoice,        // () => void
  status,             // 'idle' | 'recording' | 'transcribing' | 'speaking'
  startRecording,     // () => void
  stopRecording,      // () => void
  speak,              // (text: string) => Promise<void>
  error,              // string | null
} = useVoice({ onTranscript: (text) => void send(text) });
```

Uses `MediaRecorder` with `audio/webm` (falling back to `audio/ogg`). Stops recording after `stopRecording()` is called, then POSTs to `/api/voice/transcribe`.

---

### 7. `chat-panel-voice` — Modify `src/components/ChatPanel.tsx`
- Import `useVoice`, pass `onTranscript: (t) => void send(t)` 
- Add voice toggle button in header toolbar (🎙️ / icon)
- Add mic button in input area (next to file attach); show pulsing red dot while recording
- After each new assistant message arrives, if `voiceEnabled`, call `speak(message.content)` — strip markdown first with a simple regex before speaking
- Disable mic button while `loading` or `status === 'transcribing'`
- Show `error` from `useVoice` alongside the existing chat error display

## Notes / Considerations
- The `kokoro-fastapi` CPU image is slow for long responses. For production, consider the GPU variant or truncating TTS to the first ~500 chars of long responses.
- `faster-whisper-server` downloads the model on first start — add a volume mount for model caching in prod.
- Markdown must be stripped before TTS (e.g., remove `**`, `*`, `#`, backticks, links) so the AI doesn't literally say "asterisk asterisk".
- Browser mic permission: `useVoice` should catch `NotAllowedError` and set a user-friendly error.
- The `/api/voice/speak` endpoint streams audio — use `runtime = 'nodejs'` (not edge) in the route.

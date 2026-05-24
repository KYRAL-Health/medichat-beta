import OpenAI from "openai";
import type { Stream } from "openai/streaming";
import { ChatCompletionRequest, ChatCompletionResponse, ChatCompletionChunk } from "./types";

interface ProviderConfig {
  baseURL: string;
  apiKey: string;
}

function getProviderConfig(): ProviderConfig {
  return {
    baseURL: process.env.AI_API_BASE || "https://openrouter.ai/api/v1",
    apiKey: process.env.AI_API_KEY || "dummy-key",
  };
}

function buildClient(): OpenAI {
  const { baseURL, apiKey } = getProviderConfig();
  return new OpenAI({
    baseURL,
    apiKey,
    defaultHeaders: {
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "MediChat Beta",
    },
  });
}

export async function chatCompletion(req: ChatCompletionRequest): Promise<ChatCompletionResponse> {
  return await buildClient().chat.completions.create(req);
}

export async function chatCompletionStream(
  req: ChatCompletionRequest
): Promise<Stream<ChatCompletionChunk>> {
  return buildClient().chat.completions.create({ ...req, stream: true });
}

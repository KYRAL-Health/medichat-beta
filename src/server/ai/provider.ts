import OpenAI from "openai";
import { ChatCompletionRequest, ChatCompletionResponse } from "./types";

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

export async function chatCompletion(req: ChatCompletionRequest): Promise<ChatCompletionResponse> {
  const { baseURL, apiKey } = getProviderConfig();

  const openai = new OpenAI({
    baseURL,
    apiKey,
    defaultHeaders: {
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "MediChat Beta",
    },
  });

  return await openai.chat.completions.create(req);
}

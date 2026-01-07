import { chatCompletion as providerChatCompletion } from "./provider";
import { ChatCompletionRequest, ChatCompletionResponse } from "./types";

export * from "./types";

export function getChatModel() {
  return process.env.AI_MODEL_CHAT || "openai/gpt-4o";
}

export function getExtractModel() {
  return process.env.AI_MODEL_EXTRACT || process.env.AI_MODEL_CHAT || "openai/gpt-4o-mini";
}

export function getDashboardModel() {
  return process.env.AI_MODEL_DASHBOARD || process.env.AI_MODEL_CHAT || "openai/gpt-4o-mini";
}

export async function chatCompletion(req: ChatCompletionRequest): Promise<ChatCompletionResponse> {
  return providerChatCompletion(req);
}

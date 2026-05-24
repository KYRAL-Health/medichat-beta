import { chatCompletion as providerChatCompletion, chatCompletionStream as providerChatCompletionStream } from "./provider";
import { ChatCompletionRequest, ChatCompletionResponse, ChatCompletionChunk } from "./types";
import type { Stream } from "openai/streaming";

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

export async function chatCompletionStream(req: ChatCompletionRequest): Promise<Stream<ChatCompletionChunk>> {
  return providerChatCompletionStream(req);
}

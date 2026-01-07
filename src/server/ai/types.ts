import OpenAI from "openai";

export type ChatMessage = OpenAI.Chat.ChatCompletionMessageParam;
export type AiTool = OpenAI.Chat.ChatCompletionTool;
export type ChatCompletionRequest = OpenAI.Chat.ChatCompletionCreateParamsNonStreaming;
export type ToolCall = OpenAI.Chat.ChatCompletionMessageToolCall;
export type ChatCompletionResponse = OpenAI.Chat.ChatCompletion;

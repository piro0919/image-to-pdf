// 提供元ごとの呼び出し。どれも「画像とプロンプトを渡し、テキストとトークン数を返す」だけにそろえる
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

export type Image = { data: string; mediaType: "image/png" | "image/jpeg" | "image/webp" };
export type Reading = { text: string; inputTokens: number; outputTokens: number; stopReason: string };
type Provider = "anthropic" | "openai" | "google";

// 料金は USD / 100万トークン。2026-11-20 に各社の料金表で確認
// Gemini 3.8 Flash は 2026-12-31 までの値（2027-01-01 から $1.50 / $7.50）
export const MODELS = {
  "claude-sonnet": { provider: "anthropic", id: "claude-sonnet-5-5", inUsd: 2, outUsd: 10 },
  "claude-haiku": { provider: "anthropic", id: "claude-haiku-5-5", inUsd: 0.1, outUsd: 0.5 },
  "openai-sol": { provider: "openai", id: "gpt-6.2-sol", inUsd: 2, outUsd: 10 },
  "openai-luna": { provider: "openai", id: "gpt-6-luna", inUsd: 0.1, outUsd: 0.5 },
  "gemini-flash": { provider: "google", id: "gemini-3.8-flash", inUsd: 0.75, outUsd: 3.75 },
  "gemini-flash-lite": { provider: "google", id: "gemini-3.5-flash-lite", inUsd: 0.3, outUsd: 2.5 },
} as const satisfies Record<string, { provider: Provider; id: string; inUsd: number; outUsd: number }>;
export type ModelKey = keyof typeof MODELS;

export const KEY_ENV: Record<Provider, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GEMINI_API_KEY",
};

const PROMPT = "Rebuild this page.";

export async function read(key: ModelKey, image: Image, system: string): Promise<Reading> {
  const model = MODELS[key];
  switch (model.provider) {
    case "anthropic": {
      const client = new Anthropic();
      const message = await client.messages
        .stream({
          model: model.id,
          max_tokens: 64000,
          system,
          messages: [
            {
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } },
                { type: "text", text: PROMPT },
              ],
            },
          ],
        })
        .finalMessage();
      return {
        text: message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join(""),
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
        stopReason: String(message.stop_reason),
      };
    }
    case "openai": {
      const client = new OpenAI();
      const response = await client.responses.create({
        model: model.id,
        instructions: system,
        input: [
          {
            role: "user",
            content: [
              { type: "input_image", image_url: `data:${image.mediaType};base64,${image.data}`, detail: "high" },
              { type: "input_text", text: PROMPT },
            ],
          },
        ],
      });
      return {
        text: response.output_text,
        inputTokens: response.usage?.input_tokens ?? 0,
        // output_tokens は推論のトークンを含む
        outputTokens: response.usage?.output_tokens ?? 0,
        stopReason: response.status ?? "unknown",
      };
    }
    case "google": {
      const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await client.models.generateContent({
        model: model.id,
        contents: [{ inlineData: { mimeType: image.mediaType, data: image.data } }, { text: PROMPT }],
        config: { systemInstruction: system },
      });
      const usage = response.usageMetadata;
      return {
        text: response.text ?? "",
        inputTokens: usage?.promptTokenCount ?? 0,
        // 思考のトークンは candidates と別に数えられ、どちらも出力として課金される
        outputTokens: (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0),
        stopReason: String(response.candidates?.[0]?.finishReason ?? "unknown"),
      };
    }
  }
}

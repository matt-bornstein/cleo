import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

import { aiLockManager } from "@/lib/ai/lock";
import { getModelConfig } from "@/lib/ai/models";
import { applyParsedEditsToHtml, parseAIResponse } from "@/lib/ai/parseResponse";
import { getSystemPrompt } from "@/lib/ai/prompts";
import {
  htmlToProsemirrorJson,
  prosemirrorJsonToHtml,
} from "@/lib/editor/serialization";

export const runtime = "nodejs";

type StreamRequestPayload = {
  documentId: string;
  model: string;
  prompt: string;
  documentContent: string;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get("documentId");
  if (!documentId) {
    return Response.json({ error: "documentId is required" }, { status: 400 });
  }

  const status = aiLockManager.getStatus(documentId);
  return Response.json(status);
}


function buildPrompt(payload: StreamRequestPayload, documentHtml: string) {
  const history = payload.messages
    .slice(-5)
    .map((message) => `[${message.role}]: ${message.content}`)
    .join("\n");

  return [
    "Current document HTML:",
    documentHtml,
    "",
    "Recent chat history:",
    history || "(none)",
    "",
    `User prompt: ${payload.prompt}`,
  ].join("\n");
}

async function callModel(
  model: string,
  systemPrompt: string,
  prompt: string,
  userPrompt: string,
): Promise<string> {
  const config = getModelConfig(model);
  const fallback = `I reviewed your request: "${userPrompt}". Keeping the current document unchanged in local fallback mode.`;

  try {
    if (config.provider === "openai" && process.env.OPENAI_API_KEY) {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await client.chat.completions.create({
        model: config.id,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
      });
      return response.choices[0]?.message?.content ?? fallback;
    }

    if (config.provider === "anthropic" && process.env.ANTHROPIC_API_KEY) {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const response = await client.messages.create({
        model: config.id,
        max_tokens: 1200,
        system: systemPrompt,
        messages: [{ role: "user", content: prompt }],
      });
      const content = response.content
        .map((block) => ("text" in block ? block.text : ""))
        .join("\n");
      return content || fallback;
    }

    if (config.provider === "google" && process.env.GEMINI_API_KEY) {
      const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await client.models.generateContent({
        model: config.id,
        contents: `${systemPrompt}\n\n${prompt}`,
      });
      return response.text ?? fallback;
    }
  } catch {
    return fallback;
  }

  return fallback;
}

export async function POST(request: Request) {
  const payload = (await request.json()) as StreamRequestPayload;
  const userId = request.headers.get("x-user-id") ?? "local-dev-user";
  const lockResult = aiLockManager.acquire(payload.documentId, userId);

  if (!lockResult.acquired) {
    return Response.json({ error: lockResult.reason }, { status: 409 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const writeEvent = (eventPayload: object) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(eventPayload)}\n`));
      };

      try {
        const documentHtml = prosemirrorJsonToHtml(payload.documentContent);
        const fullPrompt = buildPrompt(payload, documentHtml);
        const systemPrompt = getSystemPrompt();
        const modelResponse = await callModel(
          payload.model,
          systemPrompt,
          fullPrompt,
          payload.prompt,
        );
        const parsed = parseAIResponse(modelResponse);
        const nextHtml = applyParsedEditsToHtml(documentHtml, parsed);
        const nextContent = htmlToProsemirrorJson(nextHtml);
        const assistantMessage = parsed.explanation || modelResponse;

        for (const token of assistantMessage.split(" ")) {
          writeEvent({ type: "token", text: `${token} ` });
        }

        writeEvent({
          type: "done",
          assistantMessage,
          nextContent,
        });
      } catch (error) {
        writeEvent({
          type: "error",
          error: error instanceof Error ? error.message : "Unknown AI stream error",
        });
      } finally {
        aiLockManager.release(payload.documentId, userId);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

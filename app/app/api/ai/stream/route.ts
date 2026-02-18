import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

import {
  MAX_MESSAGE_CONTENT_LENGTH,
  MAX_MESSAGE_COUNT,
  MAX_PROMPT_LENGTH,
  MAX_USER_ID_LENGTH,
} from "@/lib/ai/constraints";
import { isValidDocumentContentJson } from "@/lib/ai/documentContent";
import { isValidDocumentId, normalizeDocumentId } from "@/lib/ai/documentId";
import { aiLockManager } from "@/lib/ai/lock";
import { normalizeAIUserId } from "@/lib/ai/identity";
import { getModelConfig, isSupportedModel } from "@/lib/ai/models";
import { applyParsedEditsToHtml, parseAIResponse } from "@/lib/ai/parseResponse";
import { getSystemPrompt } from "@/lib/ai/prompts";
import {
  htmlToProsemirrorJson,
  prosemirrorJsonToHtml,
} from "@/lib/editor/serialization";
import {
  hasControlChars,
  hasDisallowedTextControlChars,
} from "@/lib/validators/controlChars";

export const runtime = "nodejs";

type StreamRequestPayload = {
  documentId: string;
  model: string;
  prompt: string;
  documentContent: string;
  messages: Array<{
    role: "user" | "assistant" | "system";
    content: string;
    userId?: string;
  }>;
};

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parsePayload(value: unknown): StreamRequestPayload | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const rawDocumentId = safeReadProperty(candidate, "documentId");
  const rawModel = safeReadProperty(candidate, "model");
  const rawPrompt = safeReadProperty(candidate, "prompt");
  const rawDocumentContent = safeReadProperty(candidate, "documentContent");

  if (
    !hasText(rawDocumentId) ||
    !hasText(rawModel) ||
    !hasText(rawPrompt) ||
    !isValidDocumentContentJson(rawDocumentContent)
  ) {
    return null;
  }

  const rawMessages = safeReadProperty(candidate, "messages");
  const documentId = normalizeDocumentId(rawDocumentId);
  if (!isValidDocumentId(documentId)) {
    return null;
  }
  const model = rawModel.trim();
  const prompt = rawPrompt.trim();
  if (
    prompt.length > MAX_PROMPT_LENGTH ||
    hasDisallowedTextControlChars(prompt)
  ) {
    return null;
  }
  if (!isSupportedModel(model)) {
    return null;
  }

  if (rawMessages === undefined) {
    return {
      documentId,
      model,
      prompt,
      documentContent: rawDocumentContent,
      messages: [],
    };
  }

  const messages = normalizeMessageHistory(rawMessages);
  if (!messages) return null;

  return {
    documentId,
    model,
    prompt,
    documentContent: rawDocumentContent,
    messages,
  };
}

export async function GET(request: Request) {
  const normalizedUrl = readRequestUrl(request);
  if (typeof normalizedUrl !== "string") {
    return Response.json({ error: "documentId is required" }, { status: 400 });
  }
  let searchParams: URLSearchParams;
  try {
    searchParams = new URL(normalizedUrl).searchParams;
  } catch {
    return Response.json({ error: "documentId is required" }, { status: 400 });
  }

  const documentId = normalizeDocumentId(searchParams.get("documentId") ?? "");
  if (!isValidDocumentId(documentId)) {
    return Response.json({ error: "documentId is required" }, { status: 400 });
  }

  const status = aiLockManager.getStatus(documentId);
  return Response.json(status);
}


function buildPrompt(payload: StreamRequestPayload, documentHtml: string) {
  const history = payload.messages
    .slice(-5)
    .map((message) => {
      if (message.role === "user") {
        const author = message.userId ?? "User";
        return `[${author}]: ${message.content}`;
      }

      if (message.role === "assistant") {
        return `[Assistant]: ${message.content}`;
      }

      return `[System]: ${message.content}`;
    })
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
  documentHtml: string,
): Promise<string> {
  const fallback = buildLocalFallbackEditResponse(userPrompt, documentHtml);
  const config = readModelConfigSafely(model);
  if (!config) {
    return fallback;
  }

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
  const rawPayload = await parseJsonBody(request);
  const payload = parsePayload(rawPayload);

  if (!payload) {
    return Response.json({ error: "Invalid request payload" }, { status: 400 });
  }

  const userId = normalizeAIUserId(readRequestHeader(request, "x-user-id"));
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
          documentHtml,
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

async function parseJsonBody(request: unknown) {
  if (!request || typeof request !== "object") {
    return null;
  }

  const jsonFn = readJsonFunction(request);
  if (!jsonFn) {
    return null;
  }

  try {
    return await jsonFn();
  } catch {
    return null;
  }
}

function readJsonFunction(request: unknown) {
  if (
    !request ||
    typeof request !== "object" ||
    !("json" in request)
  ) {
    return undefined;
  }

  try {
    const candidate = (request as { json?: unknown }).json;
    if (typeof candidate !== "function") {
      return undefined;
    }

    const owner = request as { json: () => Promise<unknown> };
    return () => Reflect.apply(candidate, owner, []);
  } catch {
    return undefined;
  }
}

function readRequestHeader(request: unknown, headerName: string) {
  if (!request || typeof request !== "object" || !("headers" in request)) {
    return null;
  }

  try {
    const headers = (request as { headers?: unknown }).headers;
    if (
      !headers ||
      typeof headers !== "object" ||
      !("get" in headers) ||
      typeof headers.get !== "function"
    ) {
      return null;
    }

    return headers.get(headerName);
  } catch {
    return null;
  }
}

function readRequestUrl(request: unknown) {
  if (
    !request ||
    typeof request !== "object" ||
    !("url" in request)
  ) {
    return "";
  }

  try {
    return (request as { url?: unknown }).url;
  } catch {
    return undefined;
  }
}

function readModelConfigSafely(model: string) {
  try {
    return getModelConfig(model);
  } catch {
    return null;
  }
}

function buildLocalFallbackEditResponse(userPrompt: string, documentHtml: string) {
  const normalizedPrompt = userPrompt.trim();
  const escapedPrompt = escapeHtml(normalizedPrompt.length > 0 ? normalizedPrompt : "No prompt");
  const nextHtml = appendFallbackNote(documentHtml, escapedPrompt);

  return [
    "No provider API key is configured, so I applied a local fallback edit by appending a note.",
    "```html",
    nextHtml,
    "```",
  ].join("\n");
}

function appendFallbackNote(documentHtml: string, escapedPrompt: string) {
  const normalizedDocumentHtml = documentHtml.trim();
  const fallbackNote = `<p><strong>AI note:</strong> ${escapedPrompt}</p>`;
  if (!normalizedDocumentHtml) {
    return fallbackNote;
  }
  return `${normalizedDocumentHtml}\n${fallbackNote}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeReadProperty(record: Record<string, unknown>, key: string) {
  try {
    return record[key];
  } catch {
    return undefined;
  }
}

function normalizeMessageHistory(rawMessages: unknown) {
  if (!Array.isArray(rawMessages)) {
    return null;
  }

  let messageCount = 0;
  try {
    messageCount = rawMessages.length;
  } catch {
    return null;
  }
  if (messageCount > MAX_MESSAGE_COUNT) {
    return null;
  }

  const normalizedMessages: StreamRequestPayload["messages"] = [];
  for (let index = 0; index < messageCount; index++) {
    let message: unknown;
    try {
      message = rawMessages[index];
    } catch {
      return null;
    }

    const normalizedMessage = normalizeMessageEntry(message);
    if (!normalizedMessage) {
      return null;
    }
    normalizedMessages.push(normalizedMessage);
  }

  return normalizedMessages;
}

function normalizeMessageEntry(message: unknown) {
  if (!message || typeof message !== "object") {
    return null;
  }

  const item = message as Record<string, unknown>;
  const role = safeReadProperty(item, "role");
  if (role !== "user" && role !== "assistant" && role !== "system") {
    return null;
  }
  const normalizedRole: "user" | "assistant" | "system" = role;

  const content = safeReadProperty(item, "content");
  if (!hasText(content)) {
    return null;
  }
  if (content.length > MAX_MESSAGE_CONTENT_LENGTH) {
    return null;
  }
  if (hasDisallowedTextControlChars(content)) {
    return null;
  }

  const userId = safeReadProperty(item, "userId");
  if (userId !== undefined && !hasText(userId)) {
    return null;
  }
  if (
    typeof userId === "string" &&
    userId.trim().length > MAX_USER_ID_LENGTH
  ) {
    return null;
  }
  if (
    typeof userId === "string" &&
    hasControlChars(userId.trim())
  ) {
    return null;
  }

  return {
    role: normalizedRole,
    content,
    userId: typeof userId === "string" ? userId.trim() : undefined,
  };
}

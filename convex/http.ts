import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

// Auth routes
auth.addHttpRoutes(http);

// AI streaming endpoint
http.route({
  path: "/ai/stream",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // CORS headers
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    };

    try {
      const body = await request.json();
      const { documentId, prompt, model } = body;

      if (!documentId || !prompt || !model) {
        return new Response(
          JSON.stringify({ error: "Missing required fields" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Get document content
      const doc = await ctx.runQuery(api.documents.get, { id: documentId });
      if (!doc) {
        return new Response(
          JSON.stringify({ error: "Document not found" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }

      // Get chat history
      const messages = await ctx.runQuery(api.ai.getMessages, { documentId });

      // Get the AI model configuration
      const modelConfig = getModelConfig(model);
      if (!modelConfig) {
        return new Response(
          JSON.stringify({ error: "Invalid model" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Build the document content (ProseMirror JSON -> simple text representation)
      const documentHtml = doc.content;

      // Build messages for the AI
      const systemPrompt = getSystemPrompt();
      const chatHistory = (messages || []).map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      }));

      const aiMessages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Here is the current document:\n\n\`\`\`html\n${documentHtml}\n\`\`\`` },
        ...chatHistory.slice(-5).map((m: { role: string; content: string }) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        })),
        { role: "user", content: prompt },
      ];

      // Call the AI provider
      let fullResponse = "";
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

      // Start streaming in background
      (async () => {
        try {
          fullResponse = await callAIProvider(
            modelConfig,
            aiMessages,
            async (chunk: string) => {
              await writer.write(
                encoder.encode(`data: ${JSON.stringify({ type: "token", content: chunk })}\n\n`)
              );
            }
          );

          // Signal completion
          await writer.write(
            encoder.encode(
              `data: ${JSON.stringify({ type: "done", content: fullResponse })}\n\n`
            )
          );
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : "AI request failed";
          await writer.write(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", content: errMsg })}\n\n`
            )
          );
        } finally {
          // Save the AI assistant message
          try {
            if (fullResponse) {
              await ctx.runMutation(api.ai.saveMessage, {
                documentId,
                role: "assistant",
                content: fullResponse,
                model,
              });
            }
          } catch (e) {
            console.error("Failed to save AI message:", e);
          }

          // Release the lock
          try {
            await ctx.runMutation(api.ai.releaseLock, { documentId });
          } catch (e) {
            console.error("Failed to release lock:", e);
          }

          await writer.close();
        }
      })();

      // Return the readable stream immediately
      return new Response(readable, { status: 200, headers });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Internal error";
      return new Response(JSON.stringify({ error: errMsg }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

// CORS preflight
http.route({
  path: "/ai/stream",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }),
});

function getSystemPrompt(): string {
  return `You are an AI writing assistant helping edit a rich text document collaboratively.

The document is provided as HTML.

RESPONSE FORMAT:
- For small, targeted changes, use SEARCH/REPLACE blocks operating on the HTML:

<<<SEARCH
<p>exact HTML to find in the document</p>
===
<p>replacement HTML</p>
>>>

- For large-scale changes or rewrites, return the FULL updated HTML inside a code fence:

\`\`\`html
(full document HTML here)
\`\`\`

RULES:
- SEARCH blocks must match the document HTML EXACTLY (including tags, attributes, and whitespace).
- You may use multiple SEARCH/REPLACE blocks in one response.
- Only return the changed portions — do not include unchanged HTML outside of blocks.
- If you return a full document, it replaces the entire current document.
- Always preserve the document's existing structure and formatting unless asked to change it.
- Use standard HTML elements: <h1>-<h3>, <p>, <strong>, <em>, <u>, <s>, <ul>, <ol>, <li>, <blockquote>, <pre><code>, <a>, <img>, <table>, <tr>, <td>, <th>, <hr>.
- Briefly explain what you changed before the blocks.`;
}

interface ModelConfig {
  provider: "openai" | "anthropic" | "google";
  modelId: string;
}

function getModelConfig(model: string): ModelConfig | null {
  const models: Record<string, ModelConfig> = {
    "gpt-4o": { provider: "openai", modelId: "gpt-4o" },
    "gpt-4.1": { provider: "openai", modelId: "gpt-4.1" },
    "claude-sonnet-4-20250514": { provider: "anthropic", modelId: "claude-sonnet-4-20250514" },
    "gemini-2.5-pro": { provider: "google", modelId: "gemini-2.5-pro" },
  };
  return models[model] || null;
}

async function callAIProvider(
  config: ModelConfig,
  messages: { role: string; content: string }[],
  onChunk: (chunk: string) => Promise<void>
): Promise<string> {
  switch (config.provider) {
    case "openai":
      return callOpenAI(config.modelId, messages, onChunk);
    case "anthropic":
      return callAnthropic(config.modelId, messages, onChunk);
    case "google":
      return callGoogle(config.modelId, messages, onChunk);
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

async function callOpenAI(
  model: string,
  messages: { role: string; content: string }[],
  onChunk: (chunk: string) => Promise<void>
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured. Set it via: npx convex env set OPENAI_API_KEY <key>");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: messages.map((m) => ({
        role: m.role as "system" | "user" | "assistant",
        content: m.content,
      })),
      stream: true,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${err}`);
  }

  let fullContent = "";
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value, { stream: true });
    const lines = text.split("\n").filter((l) => l.startsWith("data: "));

    for (const line of lines) {
      const data = line.slice(6);
      if (data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) {
          fullContent += content;
          await onChunk(content);
        }
      } catch {
        // Skip malformed
      }
    }
  }

  return fullContent;
}

async function callAnthropic(
  model: string,
  messages: { role: string; content: string }[],
  onChunk: (chunk: string) => Promise<void>
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured. Set it via: npx convex env set ANTHROPIC_API_KEY <key>");

  const systemMsg = messages.find((m) => m.role === "system")?.content || "";
  const nonSystemMsgs = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: m.content,
    }));

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      system: systemMsg,
      messages: nonSystemMsgs,
      stream: true,
      max_tokens: 8192,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${err}`);
  }

  let fullContent = "";
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value, { stream: true });
    const lines = text.split("\n").filter((l) => l.startsWith("data: "));

    for (const line of lines) {
      const data = line.slice(6);
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === "content_block_delta") {
          const content = parsed.delta?.text;
          if (content) {
            fullContent += content;
            await onChunk(content);
          }
        }
      } catch {
        // Skip malformed
      }
    }
  }

  return fullContent;
}

async function callGoogle(
  model: string,
  messages: { role: string; content: string }[],
  onChunk: (chunk: string) => Promise<void>
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured. Set it via: npx convex env set GEMINI_API_KEY <key>");

  const systemMsg = messages.find((m) => m.role === "system")?.content || "";
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemMsg }] },
        contents,
        generationConfig: { maxOutputTokens: 8192 },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Google API error: ${response.status} ${err}`);
  }

  let fullContent = "";
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value, { stream: true });
    const lines = text.split("\n").filter((l) => l.startsWith("data: "));

    for (const line of lines) {
      const data = line.slice(6);
      try {
        const parsed = JSON.parse(data);
        const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
        if (content) {
          fullContent += content;
          await onChunk(content);
        }
      } catch {
        // Skip malformed
      }
    }
  }

  return fullContent;
}

export default http;

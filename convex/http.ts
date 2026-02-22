import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { prosemirrorJsonToHtml } from "./lib/htmlSerializer";
import { htmlToProsemirrorJson } from "./lib/htmlToJson";
import { getServerSchema } from "./lib/schema";
import { prosemirrorSync } from "./prosemirrorSync";
import { Node } from "@tiptap/pm/model";
import { Transform } from "@tiptap/pm/transform";

const http = httpRouter();

// Auth routes
auth.addHttpRoutes(http);

// CORS headers shared by AI streaming endpoint responses
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// AI streaming endpoint
http.route({
  path: "/ai/stream",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const streamHeaders = {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    };

    try {
      const body = await request.json();
      const { documentId, prompt, model, thinkHarder, verbose } = body;

      if (!documentId || !prompt || !model) {
        return jsonError("Missing required fields", 400);
      }

      // Get document content (use internal queries to bypass auth in HTTP actions)
      const doc = await ctx.runQuery(internal.documents.getInternal, { id: documentId });
      if (!doc) {
        return jsonError("Document not found", 404);
      }

      // Get chat history
      const messages = await ctx.runQuery(internal.ai.getMessagesInternal, { documentId });

      // Get the AI model configuration
      const modelConfig = getModelConfig(model);
      if (!modelConfig) {
        return new Response(
          JSON.stringify({ error: "Invalid model" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Build the document HTML from ProseMirror JSON
      let documentHtml: string;
      try {
        const parsed = JSON.parse(doc.content);
        documentHtml = prosemirrorJsonToHtml(parsed);
      } catch {
        documentHtml = doc.content; // fallback to raw content
      }

      // Build messages for the AI
      const systemPrompt = getSystemPrompt();
      const chatHistory = (messages || []).slice(-5).map((m: { role: string; content: string; userName?: string }) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        // Prefix user messages with their name for multi-user context
        content: m.role === "user" && m.userName
          ? `[${m.userName}]: ${m.content}`
          : m.content,
      }));

      const aiMessages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Here is the current document:\n\n\`\`\`html\n${documentHtml}\n\`\`\`` },
        ...chatHistory,
        { role: "user", content: prompt },
      ];

      // Store the rendered prompt on the user message for debugging
      const renderedPrompt = aiMessages
        .map((m) => `[${m.role}]\n${m.content}`)
        .join("\n\n---\n\n");
      try {
        await ctx.runMutation(internal.ai.setRenderedPromptInternal, {
          documentId,
          renderedPrompt,
        });
      } catch (e) {
        console.error("Failed to save rendered prompt:", e);
      }

      // Call the AI provider
      let fullResponse = "";
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

      const sendEvent = async (type: string, content: string) => {
        await writer.write(
          encoder.encode(`data: ${JSON.stringify({ type, content })}\n\n`)
        );
      };

      // Incremental edit state: tracks accumulated text and applies
      // search/replace blocks to the document as each one completes.
      let accumulated = "";
      let blocksApplied = 0;
      let runningHtml = documentHtml;
      const schema = getServerSchema();
      const highlightFragments: string[] = [];

      const applyBlockToDocument = async (search: string, replace: string) => {
        if (!runningHtml.includes(search)) {
          console.warn("Search block not found in document:", search.substring(0, 80));
          return;
        }
        const updatedHtml = runningHtml.replace(search, replace);
        try {
          const newDocJson = htmlToProsemirrorJson(updatedHtml);
          await prosemirrorSync.transform(ctx, documentId, schema, (currentDoc) => {
            const targetDoc = Node.fromJSON(schema, newDocJson);
            const tr = new Transform(currentDoc);
            tr.replaceWith(0, currentDoc.content.size, targetDoc.content);
            if (tr.steps.length === 0) return null;
            return tr;
          });
          runningHtml = updatedHtml;
          blocksApplied++;
          if (replace.trim()) highlightFragments.push(replace);
          await sendEvent("changes_applied", JSON.stringify({
            diffType: "search_replace",
            search,
            replace,
          }));
        } catch (e) {
          console.error("Failed to apply incremental block:", e);
          try {
            const newDocJson = htmlToProsemirrorJson(updatedHtml);
            await ctx.runMutation(internal.documents.updateContentInternal, {
              id: documentId,
              content: JSON.stringify(newDocJson),
            });
            runningHtml = updatedHtml;
            blocksApplied++;
            if (replace.trim()) highlightFragments.push(replace);
            await sendEvent("changes_applied", JSON.stringify({
              diffType: "search_replace",
              search,
              replace,
            }));
          } catch (fallbackErr) {
            console.error("Fallback content update also failed:", fallbackErr);
          }
        }
      };

      // Scan accumulated text for newly completed search/replace blocks
      let lastScannedEnd = 0;
      const tryApplyNewBlocks = async () => {
        const regex = /<<<SEARCH\n([\s\S]*?)\n===\n([\s\S]*?)\n>>>/g;
        regex.lastIndex = lastScannedEnd;
        let match;
        while ((match = regex.exec(accumulated)) !== null) {
          const blockEnd = match.index + match[0].length;
          if (blockEnd > lastScannedEnd) {
            lastScannedEnd = blockEnd;
            await applyBlockToDocument(match[1].trim(), match[2].trim());
          }
        }
      };

      // Incremental full HTML streaming: apply complete elements as they arrive
      let inHtmlFence = false;
      let htmlFenceStart = -1;
      let lastAppliedElementCount = 0;

      let previousHtmlSnapshot = "";
      const applyHtmlToDocument = async (html: string) => {
        const prevHtml = previousHtmlSnapshot;
        try {
          const newDocJson = htmlToProsemirrorJson(html);
          await prosemirrorSync.transform(ctx, documentId, schema, (currentDoc) => {
            const targetDoc = Node.fromJSON(schema, newDocJson);
            const tr = new Transform(currentDoc);
            tr.replaceWith(0, currentDoc.content.size, targetDoc.content);
            if (tr.steps.length === 0) return null;
            return tr;
          });
          runningHtml = html;
          previousHtmlSnapshot = html;
          if (html.trim()) highlightFragments.push(html);
          await sendEvent("changes_applied", JSON.stringify({
            diffType: "full_html",
            newHtml: html,
            previousHtml: prevHtml,
          }));
        } catch (e) {
          console.error("Failed to apply incremental HTML:", e);
          try {
            const newDocJson = htmlToProsemirrorJson(html);
            await ctx.runMutation(internal.documents.updateContentInternal, {
              id: documentId,
              content: JSON.stringify(newDocJson),
            });
            runningHtml = html;
            previousHtmlSnapshot = html;
          } catch (fallbackErr) {
            console.error("HTML fallback also failed:", fallbackErr);
          }
        }
      };

      const tryApplyHtmlElements = async () => {
        if (!inHtmlFence && accumulated.includes("```html\n")) {
          inHtmlFence = true;
          htmlFenceStart = accumulated.indexOf("```html\n") + "```html\n".length;
        }
        if (!inHtmlFence) return;

        const closingIdx = accumulated.indexOf("\n```", htmlFenceStart);
        const fenceContent = closingIdx !== -1
          ? accumulated.substring(htmlFenceStart, closingIdx)
          : accumulated.substring(htmlFenceStart);

        const { count, endPos } = findCompleteTopLevelElements(fenceContent);
        if (count > lastAppliedElementCount && endPos > 0) {
          const completeHtml = fenceContent.substring(0, endPos).trim();
          if (completeHtml) {
            await applyHtmlToDocument(completeHtml);
            blocksApplied = count;
            lastAppliedElementCount = count;
          }
        }
      };

      // Start streaming in background
      (async () => {
        try {
          fullResponse = await callAIProvider(
            modelConfig,
            aiMessages,
            { thinkHarder: !!thinkHarder, verbose: !!verbose },
            async (chunk: string) => {
              accumulated += chunk;
              await sendEvent("token", chunk);
              await tryApplyNewBlocks();
              await tryApplyHtmlElements();
            }
          );

          await sendEvent("done", fullResponse);
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : "AI request failed";
          await sendEvent("error", errMsg);
        } finally {
          // Save the AI assistant message
          try {
            if (fullResponse) {
              await ctx.runMutation(internal.ai.saveMessageInternal, {
                documentId,
                role: "assistant",
                content: fullResponse,
                model,
              });
            }
          } catch (e) {
            console.error("Failed to save AI message:", e);
          }

          // Final pass: apply any remaining HTML elements or full HTML fallback
          if (inHtmlFence && fullResponse) {
            // One final element check now that streaming is complete
            await tryApplyHtmlElements();

            // If the fence is closed, apply the complete content as a final pass
            // to catch any trailing elements the incremental parser missed
            const fullHtml = extractFullHtmlFromResponse(fullResponse);
            if (fullHtml && fullHtml.trim() !== runningHtml.trim()) {
              await applyHtmlToDocument(fullHtml);
              blocksApplied++;
            }
          } else if (blocksApplied === 0 && fullResponse && documentHtml) {
            // No search/replace blocks and no HTML fence detected —
            // check for a full HTML fence we might have missed
            try {
              const fullHtml = extractFullHtmlFromResponse(fullResponse);
              if (fullHtml) {
                await applyHtmlToDocument(fullHtml);
                blocksApplied++;
              }
            } catch (e) {
              console.error("Failed to apply full HTML:", e);
            }
          }

          // Save final state for version history and cached content
          if (blocksApplied > 0 && runningHtml !== documentHtml) {
            try {
              const finalDocJson = htmlToProsemirrorJson(runningHtml);
              const finalContent = JSON.stringify(finalDocJson);
              await ctx.runMutation(internal.documents.updateContentInternal, {
                id: documentId,
                content: finalContent,
              });
              const diffId = await ctx.runMutation(internal.diffs.createAiDiffInternal, {
                documentId,
                content: finalContent,
                snapshotBefore: doc.content,
                highlightData: highlightFragments.length > 0 ? highlightFragments : undefined,
                aiPrompt: prompt,
                aiModel: model,
              });
              // Link the diff to the AI assistant message
              await ctx.runMutation(internal.ai.updateDiffIdInternal, {
                documentId,
                diffId,
              });
            } catch (e) {
              console.error("Failed to save final state:", e);
            }
          }

          // Release the lock
          try {
            await ctx.runMutation(internal.ai.releaseLockInternal, { documentId });
          } catch (e) {
            console.error("Failed to release lock:", e);
          }

          await writer.close();
        }
      })();

      // Return the readable stream immediately
      return new Response(readable, { status: 200, headers: streamHeaders });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Internal error";
      return jsonError(errMsg, 500);
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
        ...corsHeaders,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }),
});

function getSystemPrompt(): string {
  return `You are an AI writing assistant helping edit a rich text document collaboratively.

The document is provided as HTML.

RESPONSE FORMAT:
Use SEARCH/REPLACE blocks to make changes to the HTML. Each block targets one specific change:

<<<SEARCH
<p>exact HTML to find in the document</p>
===
<p>replacement HTML</p>
>>>

IMPORTANT — changes are applied to the document in real time as you produce each block. Follow these rules:
- Use one SEARCH/REPLACE block per logical change (e.g. one block per paragraph, heading, or list item being modified).
- Keep blocks small and focused. Do NOT combine unrelated changes into a single block.
- SEARCH text must match the document HTML EXACTLY (including tags, attributes, and whitespace).
- To delete content, use an empty replacement (nothing between === and >>>).
- To insert new content, SEARCH for the element immediately before the insertion point and include the new content after it in the replacement.
- Only for complete rewrites where most of the document changes, return full HTML in a code fence:

\`\`\`html
(full document HTML here)
\`\`\`

- Always preserve the document's existing structure and formatting unless asked to change it.
- Use standard HTML elements: <h1>-<h3>, <p>, <strong>, <em>, <u>, <s>, <ul>, <ol>, <li>, <blockquote>, <pre><code>, <a>, <img>, <table>, <tr>, <td>, <th>, <hr>.
- Briefly explain what you will change before the blocks, then provide a short summary after.`;
}

interface ModelConfig {
  provider: "openai" | "anthropic" | "google";
  modelId: string;
}

function getModelConfig(model: string): ModelConfig | null {
  const models: Record<string, ModelConfig> = {
    "gpt-5.2": { provider: "openai", modelId: "gpt-5.2" },
    "gpt-5-mini": { provider: "openai", modelId: "gpt-5-mini" },
    "gpt-4o": { provider: "openai", modelId: "gpt-4o" },
    "claude-sonnet-4-20250514": { provider: "anthropic", modelId: "claude-sonnet-4-20250514" },
    "gemini-2.5-pro": { provider: "google", modelId: "gemini-2.5-pro" },
  };
  return models[model] || null;
}

interface AIOptions {
  thinkHarder: boolean;
  verbose: boolean;
}

async function callAIProvider(
  config: ModelConfig,
  messages: { role: string; content: string }[],
  options: AIOptions,
  onChunk: (chunk: string) => Promise<void>
): Promise<string> {
  switch (config.provider) {
    case "openai":
      return callOpenAI(config.modelId, messages, options, onChunk);
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
  options: AIOptions,
  onChunk: (chunk: string) => Promise<void>
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured. Set it via: npx convex env set OPENAI_API_KEY <key>");

  const isGpt5 = model.startsWith("gpt-5");

  const body: Record<string, unknown> = {
    model,
    messages: messages.map((m) => ({
      role: m.role as "system" | "user" | "assistant",
      content: m.content,
    })),
    stream: true,
    max_completion_tokens: isGpt5 ? 16384 : 4096,
  };

  if (isGpt5) {
    body.reasoning_effort = options.thinkHarder ? "high" : "low";
    body.verbosity = options.verbose ? "high" : "low";
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
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

function extractFullHtmlFromResponse(response: string): string | null {
  const regex = /```html\n([\s\S]*?)\n```/;
  const match = regex.exec(response);
  return match ? match[1].trim() : null;
}

const VOID_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img",
  "input", "link", "meta", "param", "source", "track", "wbr",
]);

/**
 * Walk HTML and count complete top-level elements, returning how many
 * were found and the string position just past the last one. This lets
 * us incrementally apply elements to the document as they stream in.
 */
function findCompleteTopLevelElements(html: string): { count: number; endPos: number } {
  let count = 0;
  let endPos = 0;
  let depth = 0;
  let i = 0;

  while (i < html.length && /\s/.test(html[i])) i++;

  while (i < html.length) {
    if (html[i] !== "<") {
      if (depth === 0) {
        while (i < html.length && html[i] !== "<") i++;
        continue;
      }
      i++;
      continue;
    }

    if (html[i + 1] === "/") {
      const closeMatch = html.substring(i).match(/^<\/([a-zA-Z][a-zA-Z0-9]*)\s*>/);
      if (!closeMatch) break;

      depth--;
      i += closeMatch[0].length;

      if (depth === 0) {
        count++;
        endPos = i;
        while (i < html.length && /\s/.test(html[i])) i++;
      }
    } else if (html[i + 1] === "!") {
      // Comment or doctype — skip
      const commentEnd = html.indexOf("-->", i);
      if (commentEnd === -1) break;
      i = commentEnd + 3;
      while (i < html.length && /\s/.test(html[i])) i++;
    } else {
      const openMatch = html.substring(i).match(/^<([a-zA-Z][a-zA-Z0-9]*)([^>]*?)(\/?)>/);
      if (!openMatch) break;

      const tagName = openMatch[1].toLowerCase();
      const selfClosing = openMatch[3] === "/";
      const isVoid = VOID_ELEMENTS.has(tagName);

      i += openMatch[0].length;

      if (selfClosing || isVoid) {
        if (depth === 0) {
          count++;
          endPos = i;
          while (i < html.length && /\s/.test(html[i])) i++;
        }
      } else {
        depth++;
      }
    }
  }

  return { count, endPos };
}

export default http;

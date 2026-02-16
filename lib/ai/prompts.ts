export const SYSTEM_PROMPT = `You are an AI writing assistant helping edit a rich text document collaboratively. Multiple users may be working on this document. Each message in the conversation is prefixed with the user's name (e.g., "[Alice]: fix the grammar"). Pay attention to who is asking — different users may have different requests.

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

export function buildContext(
  documentHtml: string,
  chatHistory: { role: string; content: string }[],
  userPrompt: string,
  userName: string
): { role: string; content: string }[] {
  const messages: { role: string; content: string }[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Here is the current document:\n\n\`\`\`html\n${documentHtml}\n\`\`\``,
    },
  ];

  // Add chat history (last 5 messages for context)
  for (const msg of chatHistory.slice(-5)) {
    messages.push({
      role: msg.role === "assistant" ? "assistant" : "user",
      content: msg.content,
    });
  }

  // Add the new user prompt
  messages.push({
    role: "user",
    content: `[${userName}]: ${userPrompt}`,
  });

  return messages;
}

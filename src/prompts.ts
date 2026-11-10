// Prompts live in Langfuse prompt management. This file holds:
//  - the two versions we seed (v1 "simple" → production, v2 "improved" → staging),
//  - getPrompt(), which fetches a version by label at run time.
// Variables use the Langfuse {{variable}} syntax and are the same in both versions,
// so the code does not change when the prompt does.
import { LangfuseClient, type ChatPromptClient } from "@langfuse/client";

export type PromptName = "summarize" | "linkedin-post";
// "production" (v1) and "staging" (v2) after `npm run setup`, or any label you add in the UI.
export type PromptLabel = string;

interface PromptVersion {
  commitMessage: string;
  system: string;
  user: string;
  // max_tokens is a ceiling, not a target: you pay for the tokens generated. Keep it high,
  // reasoning models (Claude Haiku 5.5 thinks by default) spend part of it on thinking.
  config: { max_tokens: number };
}

export const PROMPT_VERSIONS: Record<PromptName, { v1: PromptVersion; v2: PromptVersion }> = {
  summarize: {
    v1: {
      commitMessage: "v1: simple",
      config: { max_tokens: 8000 },
      system: "You summarize technical blog posts accurately. Never invent facts.",
      user: `Summarize the blog post below in 5 bullet points for a developer audience.
Keep names, numbers and the main takeaway. Write in {{language}}.

Title: {{title}}

{{article}}`,
    },
    v2: {
      commitMessage: "v2: structured summary (main claim, facts, audience)",
      config: { max_tokens: 8000 },
      system:
        "You summarize technical blog posts for developers. Be precise and never invent facts: " +
        "if something is not in the post, leave it out.",
      user: `Summarize the blog post below. Write in {{language}}.

Use exactly this structure:
Main point: one sentence, what changed or what the post teaches.
Key facts: 3 to 5 bullet points, with the exact names, numbers and versions from the post.
Who should care: one sentence.
Most surprising detail: one sentence, a good opening for a social post.

Title: {{title}}

{{article}}`,
    },
  },

  "linkedin-post": {
    v1: {
      commitMessage: "v1: simple",
      config: { max_tokens: 8000 },
      system: "You write LinkedIn posts for a developer advocate.",
      user: `Write a LinkedIn post about this blog post.

Tone: {{tone}}
Language: {{language}}
Maximum length: {{max_chars}} characters, including the link.
End with the link: {{url}}
Use at most 3 hashtags.

Summary:
{{summary}}`,
    },
    v2: {
      commitMessage: "v2: hook, structure, call to action",
      config: { max_tokens: 8000 },
      system:
        "You are a developer advocate who writes LinkedIn posts that engineers actually read: " +
        "concrete, specific, no buzzwords. Return only the post, nothing before or after it.",
      user: `Write a LinkedIn post about the blog post summarized below.

Structure:
1. Hook: the first line, 15 words at most, built on a surprising fact, number or question
   from the summary. Never start with "I'm excited" or "Big news".
2. Body: 2 to 4 short paragraphs or a short list. What changed, why it matters to developers,
   one concrete detail.
3. Call to action: one question to the reader, or an invitation to read the post.
4. The link, on its own line: {{url}}
5. Last line: at most 3 relevant hashtags.

Rules:
- Tone: {{tone}}. Language: {{language}}.
- Hard limit: {{max_chars}} characters in total, link and hashtags included. Aim for 20% less.
- Plain text only, LinkedIn does not render Markdown: no **bold**, no headings.

Summary:
{{summary}}`,
    },
  },
};

/** The chat messages Langfuse stores for one version. */
export function toChatMessages(version: PromptVersion) {
  return [
    { role: "system", content: version.system },
    { role: "user", content: version.user },
  ];
}

let langfuse: LangfuseClient | undefined;

/**
 * Fetches the prompt version that has this label. If Langfuse cannot be reached,
 * the SDK returns v1 from this file instead (isFallback = true, visible in the trace).
 */
export async function getPrompt(name: PromptName, label: PromptLabel): Promise<ChatPromptClient> {
  langfuse ??= new LangfuseClient();
  return langfuse.prompt.get(name, {
    label,
    type: "chat",
    fallback: toChatMessages(PROMPT_VERSIONS[name].v1),
  });
}

/** Fills the {{variables}} and splits the result into what our providers expect. */
export function compilePrompt(prompt: ChatPromptClient, variables: Record<string, string | number>) {
  const stringVariables = Object.fromEntries(Object.entries(variables).map(([k, v]) => [k, String(v)]));
  const messages = prompt.compile(stringVariables) as { role: string; content: string }[];
  const config = (prompt.config ?? {}) as { max_tokens?: number };
  return {
    system: messages.find((m) => m.role === "system")?.content ?? "",
    user: messages.find((m) => m.role === "user")?.content ?? "",
    maxTokens: config.max_tokens ?? 8000,
  };
}

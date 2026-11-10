// Prompt templates. Step 2 moves them to Langfuse prompt management;
// for now they live in code, with {{variables}} in the Langfuse syntax.
export const PROMPTS = {
  summarize: {
    system: "You summarize technical blog posts accurately. Never invent facts.",
    user: `Summarize the blog post below in 5 bullet points for a developer audience.
Keep names, numbers and the main takeaway. Write in {{language}}.

Title: {{title}}

{{article}}`,
  },
  "linkedin-post": {
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
} as const;

export type PromptName = keyof typeof PROMPTS;

export function compile(template: string, variables: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => String(variables[key] ?? match));
}

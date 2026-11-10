// Seeds the two prompts in Langfuse: v1 "simple" with label production, v2 "improved" with
// label staging. Safe to re-run: a version whose content already exists is reused (its label
// is moved back if needed), so re-running never piles up identical versions.
import { LangfuseClient, type ChatPromptClient } from "@langfuse/client";
import { PROMPT_VERSIONS, toChatMessages, type PromptName } from "../prompts.js";

const SEED: { version: "v1" | "v2"; label: string }[] = [
  { version: "v1", label: "production" },
  { version: "v2", label: "staging" },
];

export async function seedPrompts(langfuse: LangfuseClient) {
  for (const name of Object.keys(PROMPT_VERSIONS) as PromptName[]) {
    for (const { version, label } of SEED) {
      const wanted = PROMPT_VERSIONS[name][version];
      const messages = toChatMessages(wanted);
      const existing = (await listVersions(langfuse, name)).find(
        (p) => sameContent(p, messages, wanted.config),
      );

      if (!existing) {
        const created = await langfuse.prompt.create({
          name,
          type: "chat",
          prompt: messages,
          config: wanted.config,
          labels: [label],
          tags: ["linkedin-demo"],
          commitMessage: wanted.commitMessage,
        });
        console.log(`  ${name} v${created.version} created, label ${label}`);
      } else if (!existing.labels.includes(label)) {
        await langfuse.prompt.update({ name, version: existing.version, newLabels: [...existing.labels, label] });
        console.log(`  ${name} v${existing.version} already there, label ${label} moved back to it`);
      } else {
        console.log(`  ${name} v${existing.version} already there with label ${label}`);
      }
    }
  }
}

/** All versions of a prompt, oldest first (empty if the prompt does not exist yet). */
async function listVersions(langfuse: LangfuseClient, name: string): Promise<ChatPromptClient[]> {
  const { data } = await langfuse.api.prompts.list({ name });
  const versionNumbers = data.find((p) => p.name === name)?.versions ?? [];
  return Promise.all(
    [...versionNumbers]
      .sort((a, b) => a - b)
      .map((version) => langfuse.prompt.get(name, { version, type: "chat", cacheTtlSeconds: 0 })),
  );
}

function sameContent(prompt: ChatPromptClient, messages: { role: string; content: string }[], config: unknown) {
  const stored = (prompt.prompt as { role: string; content: string }[]).map(({ role, content }) => ({ role, content }));
  return JSON.stringify(stored) === JSON.stringify(messages) && JSON.stringify(prompt.config) === JSON.stringify(config);
}

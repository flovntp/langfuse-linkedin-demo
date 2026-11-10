// Rule checks in plain code: free, instant and deterministic.
import { startActiveObservation } from "@langfuse/tracing";

export interface CheckResult {
  passed: boolean;
  length: number;
  hashtags: number;
  rules: { lengthOk: boolean; hasLink: boolean; hashtagsOk: boolean };
}

export const MAX_HASHTAGS = 3;

export function checkPost(post: string, url: string, maxChars: number): CheckResult {
  const length = post.length;
  const hashtags = post.match(/(^|\s)#[\p{L}\p{N}_]+/gu)?.length ?? 0;
  const rules = {
    lengthOk: length <= maxChars,
    hasLink: post.includes(url),
    hashtagsOk: hashtags <= MAX_HASHTAGS,
  };
  return { passed: Object.values(rules).every(Boolean), length, hashtags, rules };
}

export async function tracedCheckPost(post: string, url: string, maxChars: number) {
  return startActiveObservation(
    "check-post",
    async (span) => {
      span.update({ input: { post, url, maxChars } });
      const result = checkPost(post, url, maxChars);
      span.update({ output: result, ...(!result.passed && { level: "WARNING", statusMessage: "Post breaks a rule" }) });
      return result;
    },
    { asType: "guardrail" },
  );
}

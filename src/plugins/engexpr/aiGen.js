import { isDesktop, desktopFetch } from "../../core/desktop";

const SYSTEM_PROMPT =
  "You are an English learning content generator. " +
  "Return ONLY a valid JSON array. No explanation, no markdown, no code blocks.";

const USER_PROMPT =
  `Generate 30 diverse English learning expressions for conversation practice. ` +
  `Include a balanced mix of phrasal verbs, sentence structures, and idioms/expressions. ` +
  `Return a JSON array where each item has exactly these fields:\n` +
  `- "id": string following these rules:\n` +
  `    Phrasal Verb → "pv-" + main verb + "-" + particle(s), e.g. "pv-give-up", "pv-come-up-with"\n` +
  `    Sentence Structure → "ss-" + 1-2 keywords, e.g. "ss-not-only", "ss-given-that"\n` +
  `    Expression/idiom → "ex-" + first 2-3 content words hyphenated, e.g. "ex-on-fence", "ex-bite-off"\n` +
  `- "type": exactly one of "Phrasal Verb", "Sentence Structure", "Expression"\n` +
  `- "expression": the expression or pattern itself\n` +
  `- "usage": one concise English sentence explaining when or why you use it\n` +
  `- "example": one natural, realistic example sentence\n\n` +
  `Rules:\n` +
  `- All text in English only\n` +
  `- usage must start with "When" or "Use this when"\n` +
  `- No ellipsis ("...") in the expression field — write the full pattern\n` +
  `- Return only the JSON array, nothing else`;

async function request(url, options) {
  if (isDesktop()) return desktopFetch(url, options);
  return fetch(url, options);
}

async function callClaude(apiKey, model) {
  const res = await request("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: USER_PROMPT }],
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? `Claude error (HTTP ${res.status})`);
  return (json.content ?? []).filter((b) => b.type === "text").map((b) => b.text).join("");
}

async function callOpenAI(apiKey, model) {
  const options = {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: USER_PROMPT },
      ],
    }),
  };
  const res = isDesktop()
    ? await desktopFetch("https://api.openai.com/v1/chat/completions", options)
    : await fetch("/openai/v1/chat/completions", options);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? `OpenAI error (HTTP ${res.status})`);
  return json.choices?.[0]?.message?.content ?? "";
}

function parseExpressions(raw) {
  // JSON 배열만 추출 (마크다운 코드블록 등 감싸진 경우 대응)
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("No JSON array found in response.");
  const items = JSON.parse(match[0]);
  if (!Array.isArray(items)) throw new Error("Response is not an array.");
  return items.filter(
    (item) =>
      typeof item.id === "string" &&
      typeof item.type === "string" &&
      typeof item.expression === "string" &&
      typeof item.usage === "string" &&
      typeof item.example === "string" &&
      ["Phrasal Verb", "Sentence Structure", "Expression"].includes(item.type)
  );
}

/**
 * AI로부터 새 표현 목록을 받아 existingIds에 없는 것만 반환.
 * @param {{ provider: string, apiKey: string, model: string }} opts
 * @param {string[]} existingIds - 현재 풀의 id 목록 (중복 제거용)
 * @returns {Promise<{ added: object[], skipped: number }>}
 */
export async function generateExpressions({ provider, apiKey, model }, existingIds) {
  if (!apiKey) throw new Error("API key is required. Enter it in Settings (⚙).");

  const raw = provider === "openai"
    ? await callOpenAI(apiKey, model)
    : await callClaude(apiKey, model);

  const parsed = parseExpressions(raw);
  const existingSet = new Set(existingIds);
  const added = parsed.filter((item) => !existingSet.has(item.id));
  const skipped = parsed.length - added.length;

  return { added, skipped };
}

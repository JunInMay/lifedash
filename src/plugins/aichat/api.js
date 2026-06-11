// AI 채팅 provider 추상화. Claude(Anthropic) / GPT(OpenAI) 지원.
// - Claude: 브라우저 CORS 허용 헤더가 있어 어디서든 직접 호출
// - OpenAI: 브라우저 CORS 불가 → dev는 vite 프록시 /openai, Tauri는 plugin-http
// 키/모델/시스템 프롬프트는 플러그인 인스턴스 storage에만 저장된다.

const isTauri = () => typeof window !== "undefined" && !!window.__TAURI_INTERNALS__;

export const PROVIDERS = [
  {
    id: "claude",
    label: "Claude",
    defaultModel: "claude-haiku-4-5",
    keyPlaceholder: "sk-ant-...",
    modelHint: "claude-haiku-4-5 / claude-sonnet-4-6 / claude-opus-4-8",
  },
  {
    id: "openai",
    label: "GPT (OpenAI)",
    defaultModel: "gpt-5-mini",
    keyPlaceholder: "sk-...",
    modelHint: "gpt-5-mini / gpt-5 / gpt-4o-mini",
  },
];

export const DEFAULT_SYSTEM =
  "You are a friendly English conversation partner. Chat naturally in casual English, " +
  "like a messenger conversation — keep replies short (1-3 sentences). " +
  "If the user makes a noticeable English mistake, gently mention the correction in one short parenthesis, " +
  "then continue the conversation.";

// 대화가 길어져도 요청이 비대해지지 않도록 최근 N개만 보낸다
const SEND_WINDOW = 20;

async function request(url, options) {
  if (isTauri()) {
    try {
      const { fetch: httpFetch } = await import("@tauri-apps/plugin-http");
      return await httpFetch(url, options);
    } catch {
      // tauri dev에서는 vite 프록시 경로로 fallback 가능
    }
  }
  return fetch(url, options);
}

async function claudeChat({ apiKey, model, system, messages }) {
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
      max_tokens: 1024,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? `Claude API 오류 (HTTP ${res.status})`);
  return (json.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
}

async function openaiChat({ apiKey, model, system, messages }) {
  const path = "/v1/chat/completions";
  const options = {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  };
  const res = isTauri()
    ? await request(`https://api.openai.com${path}`, options)
    : await fetch(`/openai${path}`, options);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? `OpenAI API 오류 (HTTP ${res.status})`);
  return json.choices?.[0]?.message?.content ?? "";
}

export async function sendChat({ provider, apiKey, model, system, messages }) {
  if (!apiKey) throw new Error("설정(⚙)에서 API 키를 입력해주세요.");
  const recent = messages.slice(-SEND_WINDOW);
  const params = { apiKey, model, system, messages: recent };
  return provider === "openai" ? openaiChat(params) : claudeChat(params);
}

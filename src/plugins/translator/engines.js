// 번역 엔진 추상화.
// - google: 비공식 무료 엔드포인트 (키 불필요, 언젠가 막힐 수 있음)
// - claude: Anthropic Messages API (사용자 API 키 필요)
// 네트워크 경로는 markets 플러그인과 동일: Electron은 메인 프로세스 fetch, 브라우저 dev는 vite 프록시.
import { isDesktop, desktopFetch } from "../../core/desktop";

export const LANGS = [
  { code: "auto", name: "자동 감지", en: null },
  { code: "ko", name: "한국어", en: "Korean" },
  { code: "en", name: "영어", en: "English" },
  { code: "ja", name: "일본어", en: "Japanese" },
  { code: "zh-CN", name: "중국어(간체)", en: "Chinese (Simplified)" },
  { code: "es", name: "스페인어", en: "Spanish" },
  { code: "fr", name: "프랑스어", en: "French" },
  { code: "de", name: "독일어", en: "German" },
  { code: "vi", name: "베트남어", en: "Vietnamese" },
  { code: "ru", name: "러시아어", en: "Russian" },
];

export const CLAUDE_MODELS = [
  { id: "claude-haiku-4-5", name: "Haiku 4.5 — 빠름·저렴 (기본)" },
  { id: "claude-sonnet-4-6", name: "Sonnet 4.6 — 균형" },
  { id: "claude-opus-4-8", name: "Opus 4.8 — 최고 품질" },
];

export function langName(code) {
  return LANGS.find((l) => l.code === code)?.name ?? code;
}

// CORS 가능한 API(Anthropic)는 어디서든 직접 fetch, 그 외는 데스크탑 브리지/프록시
async function request(url, options) {
  if (isDesktop()) return desktopFetch(url, options);
  return fetch(url, options);
}

async function googleTranslate(text, src, tgt) {
  const qs = `client=gtx&sl=${src}&tl=${tgt}&dt=t&q=${encodeURIComponent(text)}`;
  const res = isDesktop()
    ? await desktopFetch(`https://translate.googleapis.com/translate_a/single?${qs}`)
    : await fetch(`/gtx/translate_a/single?${qs}`);
  if (!res.ok) throw new Error(`구글 번역 오류 (HTTP ${res.status})`);
  const json = await res.json();
  const translated = (json[0] ?? []).map((seg) => seg[0]).join("");
  return { text: translated, detected: json[2] ?? null };
}

async function claudeTranslate(text, src, tgt, apiKey, model) {
  if (!apiKey) throw new Error("설정(⚙)에서 Claude API 키를 입력해주세요.");
  const srcEn = LANGS.find((l) => l.code === src)?.en;
  const tgtEn = LANGS.find((l) => l.code === tgt)?.en ?? "Korean";

  const res = await request("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      // 브라우저에서 API 직접 호출(CORS) 허용 — 키가 로컬 클라이언트에 있음을 전제로 함
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system:
        `You are a professional translator. Translate the user's text` +
        `${srcEn ? ` from ${srcEn}` : ""} into ${tgtEn}. ` +
        `Preserve the original meaning, tone, and formatting. ` +
        `Output only the translated text — no explanations, no quotes.`,
      messages: [{ role: "user", content: text }],
    }),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message ?? `Claude API 오류 (HTTP ${res.status})`);
  }
  const translated = (json.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  return { text: translated, detected: null };
}

export async function translate({ engine, text, src, tgt, apiKey, model }) {
  if (engine === "claude") return claudeTranslate(text, src, tgt, apiKey, model);
  return googleTranslate(text, src, tgt);
}

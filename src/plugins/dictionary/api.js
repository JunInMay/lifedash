// 사전 조회 API.
// - 영영(enen): Free Dictionary API (dictionaryapi.dev) — 키 불필요
// - 영한(enko): 구글 번역 비공식 엔드포인트의 사전 모드(dt=bd) — 키 불필요
// 네트워크 경로는 다른 플러그인과 동일: Tauri는 plugin-http, 브라우저 dev는 vite 프록시.

const isTauri = () => typeof window !== "undefined" && !!window.__TAURI_INTERNALS__;

export const MODES = [
  { id: "enen", label: "영영" },
  { id: "enko", label: "영한" },
];

const POS_KO = {
  noun: "명사",
  verb: "동사",
  adjective: "형용사",
  adverb: "부사",
  pronoun: "대명사",
  preposition: "전치사",
  conjunction: "접속사",
  interjection: "감탄사",
  exclamation: "감탄사",
  abbreviation: "약어",
  prefix: "접두사",
  suffix: "접미사",
};

export function posLabel(pos) {
  return POS_KO[String(pos).toLowerCase()] ?? pos;
}

async function request(url) {
  if (isTauri()) {
    try {
      const { fetch: httpFetch } = await import("@tauri-apps/plugin-http");
      return await httpFetch(url, { method: "GET" });
    } catch {
      // tauri dev에서는 vite 프록시 경로로 fallback 가능
    }
  }
  return null;
}

/** 영영 사전: { word, phonetic, audio, meanings: [{pos, definitions: [{definition, example}], synonyms}] } */
async function lookupEnEn(word) {
  const path = `/api/v2/entries/en/${encodeURIComponent(word)}`;
  const res =
    (await request(`https://api.dictionaryapi.dev${path}`)) ?? (await fetch(`/dict${path}`));
  if (res.status === 404) throw new Error(`'${word}' — 단어를 찾을 수 없습니다.`);
  if (!res.ok) throw new Error(`사전 API 오류 (HTTP ${res.status})`);
  const entries = await res.json();

  // 동일 단어의 entry 여러 개를 하나로 합친다
  const first = entries[0] ?? {};
  const phonetic =
    first.phonetic ?? entries.flatMap((e) => e.phonetics ?? []).find((p) => p.text)?.text ?? null;
  const audio =
    entries.flatMap((e) => e.phonetics ?? []).find((p) => p.audio)?.audio ?? null;
  const meanings = entries.flatMap((e) =>
    (e.meanings ?? []).map((m) => ({
      pos: m.partOfSpeech,
      definitions: (m.definitions ?? []).slice(0, 4).map((d) => ({
        definition: d.definition,
        example: d.example ?? null,
      })),
      synonyms: (m.synonyms ?? []).slice(0, 6),
    }))
  );
  return { mode: "enen", word: first.word ?? word, phonetic, audio, meanings };
}

/** 영한 사전: { word, translation, meanings: [{pos, terms}] } */
async function lookupEnKo(word) {
  const qs = `client=gtx&sl=en&tl=ko&dt=t&dt=bd&q=${encodeURIComponent(word)}`;
  const res = isTauri()
    ? await request(`https://translate.googleapis.com/translate_a/single?${qs}`)
    : await fetch(`/gtx/translate_a/single?${qs}`);
  if (!res.ok) throw new Error(`사전 API 오류 (HTTP ${res.status})`);
  const json = await res.json();

  const translation = (json[0] ?? []).map((seg) => seg[0]).join("");
  const meanings = (json[1] ?? []).map((d) => ({
    pos: d[0],
    terms: d[1] ?? [],
  }));
  if (!translation && meanings.length === 0) {
    throw new Error(`'${word}' — 단어를 찾을 수 없습니다.`);
  }
  return { mode: "enko", word, translation, meanings };
}

export async function lookup(word, mode) {
  return mode === "enko" ? lookupEnKo(word) : lookupEnEn(word);
}

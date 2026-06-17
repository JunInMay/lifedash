#!/usr/bin/env node
/**
 * AI로 영어 표현을 생성해 src/plugins/engexpr/data.js에 직접 추가하는 개발용 스크립트.
 *
 * 사용법:
 *   node scripts/gen-expressions.js --key sk-ant-xxx
 *   node scripts/gen-expressions.js --key sk-xxx --provider openai --model gpt-4o-mini
 *   node scripts/gen-expressions.js --key sk-ant-xxx --count 50
 *
 * 옵션:
 *   --key       API 키 (필수)
 *   --provider  claude (기본) | openai
 *   --model     모델명 (기본: claude-haiku-4-5 / gpt-4o-mini)
 *   --count     요청할 표현 수 (기본: 30)
 */

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = resolve(__dirname, "../src/plugins/engexpr/data.js");

// ── CLI 파싱 ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const get = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
};

const apiKey = get("--key");
const provider = get("--provider") ?? "claude";
const count = parseInt(get("--count") ?? "30", 10);
const model = get("--model") ?? (provider === "openai" ? "gpt-4o-mini" : "claude-haiku-4-5");

if (!apiKey) {
  console.error("❌  --key 옵션으로 API 키를 입력하세요.");
  process.exit(1);
}

// ── 기존 ID 추출 ──────────────────────────────────────────────────────────────
function getExistingIds() {
  const src = readFileSync(DATA_PATH, "utf-8");
  const matches = [...src.matchAll(/id:\s*"([^"]+)"/g)];
  return new Set(matches.map((m) => m[1]));
}

// ── 프롬프트 ──────────────────────────────────────────────────────────────────
const SYSTEM = "You are an English learning content generator. Return ONLY a valid JSON array. No explanation, no markdown, no code blocks.";

const buildPrompt = (n) =>
  `Generate ${n} diverse English learning expressions for conversation practice. ` +
  `Include a balanced mix of phrasal verbs, sentence structures, and idioms/expressions. ` +
  `Return a JSON array where each item has exactly these fields:\n` +
  `- "id": string following these rules:\n` +
  `    Phrasal Verb → "pv-" + main verb + "-" + particle(s), e.g. "pv-give-up"\n` +
  `    Sentence Structure → "ss-" + 1-2 keywords, e.g. "ss-not-only"\n` +
  `    Expression/idiom → "ex-" + first 2-3 content words hyphenated, e.g. "ex-on-fence"\n` +
  `- "type": exactly one of "Phrasal Verb", "Sentence Structure", "Expression"\n` +
  `- "expression": the expression or pattern itself (no ellipsis)\n` +
  `- "usage": one concise English sentence starting with "When" explaining when to use it\n` +
  `- "example": one natural, realistic example sentence\n\n` +
  `Rules: all text in English only. Return only the JSON array, nothing else.`;

// ── API 호출 ──────────────────────────────────────────────────────────────────
async function callClaude() {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      system: SYSTEM,
      messages: [{ role: "user", content: buildPrompt(count) }],
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? `Claude HTTP ${res.status}`);
  return json.content.filter((b) => b.type === "text").map((b) => b.text).join("");
}

async function callOpenAI() {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: buildPrompt(count) },
      ],
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? `OpenAI HTTP ${res.status}`);
  return json.choices?.[0]?.message?.content ?? "";
}

// ── 파싱 + 검증 ───────────────────────────────────────────────────────────────
function parseItems(raw) {
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("응답에서 JSON 배열을 찾을 수 없습니다.");
  const items = JSON.parse(match[0]);
  if (!Array.isArray(items)) throw new Error("응답이 배열이 아닙니다.");
  return items.filter(
    (item) =>
      typeof item.id === "string" &&
      ["Phrasal Verb", "Sentence Structure", "Expression"].includes(item.type) &&
      typeof item.expression === "string" &&
      typeof item.usage === "string" &&
      typeof item.example === "string"
  );
}

// ── data.js 업데이트 ──────────────────────────────────────────────────────────
function formatItem(item, section) {
  const sectionComment = {
    "Phrasal Verb": "// ── Phrasal Verbs",
    "Sentence Structure": "// ── Sentence Structures",
    Expression: "// ── Expressions & Idioms",
  };
  const lines = [];
  if (section) lines.push(`\n  ${sectionComment[item.type]} (AI generated) ─────────────────────`);
  lines.push(`  {`);
  lines.push(`    id: "${item.id}",`);
  lines.push(`    type: "${item.type}",`);
  lines.push(`    expression: "${item.expression.replace(/"/g, '\\"')}",`);
  lines.push(`    usage: "${item.usage.replace(/"/g, '\\"')}",`);
  lines.push(`    example: "${item.example.replace(/"/g, '\\"')}",`);
  lines.push(`  },`);
  return lines.join("\n");
}

function appendToDataFile(newItems) {
  const src = readFileSync(DATA_PATH, "utf-8");
  // EXPRESSIONS 배열의 마지막 ]; 직전에 삽입
  const insertPoint = src.lastIndexOf("];\n\nexport const TYPE_COLORS");
  if (insertPoint === -1) throw new Error("data.js 삽입 위치를 찾지 못했습니다.");

  const header = `\n  // ── AI Generated (${new Date().toISOString().slice(0, 10)}) ────────────────────────────────────────\n`;
  const block = newItems.map((item) => formatItem(item, false)).join("\n");
  const updated = src.slice(0, insertPoint) + header + block + "\n" + src.slice(insertPoint);
  writeFileSync(DATA_PATH, updated, "utf-8");
}

// ── 메인 ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🔍  기존 표현 ID 읽는 중...`);
  const existingIds = getExistingIds();
  console.log(`    현재 ${existingIds.size}개`);

  console.log(`\n🤖  ${provider} (${model})로 ${count}개 생성 요청 중...`);
  const raw = provider === "openai" ? await callOpenAI() : await callClaude();

  console.log(`\n📦  파싱 중...`);
  const parsed = parseItems(raw);
  console.log(`    응답: ${parsed.length}개`);

  const newItems = parsed.filter((item) => !existingIds.has(item.id));
  const skipped = parsed.length - newItems.length;
  console.log(`    중복 제거: ${skipped}개 스킵 → 신규 ${newItems.length}개`);

  if (newItems.length === 0) {
    console.log(`\n⚠️   추가할 새 표현이 없습니다.`);
    return;
  }

  console.log(`\n✍️   data.js에 추가 중...`);
  appendToDataFile(newItems);

  console.log(`\n✅  완료! ${newItems.length}개 추가됨.`);
  console.log(`    git diff src/plugins/engexpr/data.js 로 검수 후 커밋하세요.\n`);

  // 추가된 표현 미리보기
  console.log("── 추가된 표현 ──────────────────────────");
  newItems.forEach((item) => console.log(`  [${item.type}] ${item.expression}`));
  console.log("");
}

main().catch((e) => {
  console.error(`\n❌  오류: ${e.message}`);
  process.exit(1);
});

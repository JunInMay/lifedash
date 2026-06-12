// Google News RSS 기반 국가별 실시간 헤드라인. (무료, 키 불필요)
// 네트워크 경로는 다른 플러그인과 동일: Electron은 메인 프로세스 fetch, 브라우저 dev는 /gnews 프록시.
import { isDesktop, desktopFetch } from "../../core/desktop";

export const COUNTRIES = [
  { code: "KR", label: "한국", flag: "🇰🇷", params: "hl=ko&gl=KR&ceid=KR:ko" },
  { code: "US", label: "미국", flag: "🇺🇸", params: "hl=en-US&gl=US&ceid=US:en" },
  { code: "JP", label: "일본", flag: "🇯🇵", params: "hl=ja&gl=JP&ceid=JP:ja" },
  { code: "GB", label: "영국", flag: "🇬🇧", params: "hl=en-GB&gl=GB&ceid=GB:en" },
  { code: "DE", label: "독일", flag: "🇩🇪", params: "hl=de&gl=DE&ceid=DE:de" },
];

async function fetchRssXml(path) {
  const res = isDesktop()
    ? await desktopFetch(`https://news.google.com${path}`)
    : await fetch(`/gnews${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function parseItems(xml, country) {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  return [...doc.querySelectorAll("item")].map((it) => {
    const source = it.querySelector("source")?.textContent?.trim() ?? "";
    let title = it.querySelector("title")?.textContent?.trim() ?? "";
    // 구글 뉴스 제목은 "기사제목 - 매체명" 형식이라 매체명 중복 제거
    if (source && title.endsWith(` - ${source}`)) {
      title = title.slice(0, -(source.length + 3));
    }
    return {
      country: country.code,
      flag: country.flag,
      title,
      source,
      link: it.querySelector("link")?.textContent?.trim() ?? "",
      pubDate: new Date(it.querySelector("pubDate")?.textContent ?? Date.now()),
    };
  });
}

/**
 * 선택 국가들의 헤드라인을 국가당 동일 개수로 가져와 라운드로빈으로 교차 배치한다.
 * (기사량이 많은 국가가 목록을 독점하지 않도록 공평 배분)
 */
export async function fetchHeadlines(codes, totalCount = 24) {
  const selected = COUNTRIES.filter((c) => codes.includes(c.code));
  if (selected.length === 0) return [];
  const perCountry = Math.max(3, Math.ceil(totalCount / selected.length));

  const lists = await Promise.all(
    selected.map(async (c) => {
      try {
        const xml = await fetchRssXml(`/rss?${c.params}`);
        return parseItems(xml, c).slice(0, perCountry);
      } catch {
        return []; // 한 국가 실패가 전체를 막지 않게
      }
    })
  );

  const interleaved = [];
  const max = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < max; i++) {
    for (const list of lists) {
      if (list[i]) interleaved.push(list[i]);
    }
  }
  return interleaved.slice(0, totalCount);
}

export function timeAgo(date) {
  const m = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

// Yahoo Finance 심볼 기준 지표 목록.
// 지표 추가/제거는 이 파일만 수정하면 된다.

export const SYMBOL_GROUPS = [
  {
    name: "국내",
    items: [
      { symbol: "^KS11", name: "코스피" },
      { symbol: "^KQ11", name: "코스닥" },
      { symbol: "^KS200", name: "코스피200" },
    ],
  },
  {
    name: "미국",
    items: [
      { symbol: "^IXIC", name: "나스닥" },
      { symbol: "^GSPC", name: "S&P 500" },
      { symbol: "^DJI", name: "다우존스" },
      { symbol: "^RUT", name: "러셀 2000" },
      { symbol: "^SOX", name: "필라델피아 반도체" },
      { symbol: "^VIX", name: "VIX (공포지수)" },
      { symbol: "^TNX", name: "미국채 10년물" },
      { symbol: "^TYX", name: "미국채 30년물" },
    ],
  },
  {
    name: "아시아 · 유럽",
    items: [
      { symbol: "^N225", name: "닛케이 225" },
      { symbol: "^HSI", name: "항셍" },
      { symbol: "000001.SS", name: "상해종합" },
      { symbol: "^TWII", name: "대만 가권" },
      { symbol: "^GDAXI", name: "독일 DAX" },
      { symbol: "^FTSE", name: "영국 FTSE 100" },
      { symbol: "^FCHI", name: "프랑스 CAC 40" },
      { symbol: "^STOXX50E", name: "유로스톡스 50" },
    ],
  },
  {
    name: "환율",
    items: [
      { symbol: "KRW=X", name: "달러/원" },
      { symbol: "EURKRW=X", name: "유로/원" },
      { symbol: "JPYKRW=X", name: "엔/원" },
      { symbol: "EURUSD=X", name: "유로/달러" },
      { symbol: "DX-Y.NYB", name: "달러 인덱스" },
    ],
  },
  {
    name: "원자재",
    items: [
      { symbol: "CL=F", name: "WTI 원유" },
      { symbol: "BZ=F", name: "브렌트유" },
      { symbol: "NG=F", name: "천연가스" },
      { symbol: "GC=F", name: "금" },
      { symbol: "SI=F", name: "은" },
      { symbol: "HG=F", name: "구리" },
    ],
  },
  {
    name: "크립토",
    items: [
      { symbol: "BTC-USD", name: "비트코인" },
      { symbol: "ETH-USD", name: "이더리움" },
    ],
  },
];

export const ALL_SYMBOLS = SYMBOL_GROUPS.flatMap((g) => g.items);

export function symbolName(symbol) {
  return ALL_SYMBOLS.find((s) => s.symbol === symbol)?.name ?? symbol;
}

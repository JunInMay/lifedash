// 한국 주요 종목 내장 테이블 (한글명 검색용).
//
// 이게 필요한 이유: Yahoo 검색 API(v1/finance/search)는 한글 쿼리를 400
// (Invalid Search Query)으로 거부하고, lookup은 200이지만 한글명 매칭 결과가 없다.
// 네이버 증권 자동완성(ac.stock.naver.com)이 대안이지만 사용자의 회사망이
// 증권 사이트를 차단해서 쓸 수 없다 (Yahoo Finance API는 차단 안 됨).
// → 주요 종목만 내장하고, 여기 없는 종목은 영문명("samsung")이나
//   종목코드("005930")로 Yahoo 검색이 커버한다. 필요하면 자유롭게 추가할 것.
//
// 코드 검증: 종목 선택 시 Yahoo chart API가 실패하면 화면에 에러가 표시되므로
// 잘못된 코드는 바로 드러난다.

export const KR_SYMBOLS = [
  // KOSPI 대형주
  { symbol: "005930.KS", name: "삼성전자", type: "EQUITY" },
  { symbol: "000660.KS", name: "SK하이닉스", type: "EQUITY" },
  { symbol: "373220.KS", name: "LG에너지솔루션", type: "EQUITY" },
  { symbol: "207940.KS", name: "삼성바이오로직스", type: "EQUITY" },
  { symbol: "005380.KS", name: "현대차", type: "EQUITY" },
  { symbol: "000270.KS", name: "기아", type: "EQUITY" },
  { symbol: "068270.KS", name: "셀트리온", type: "EQUITY" },
  { symbol: "035420.KS", name: "NAVER", type: "EQUITY" },
  { symbol: "035720.KS", name: "카카오", type: "EQUITY" },
  { symbol: "005490.KS", name: "POSCO홀딩스", type: "EQUITY" },
  { symbol: "051910.KS", name: "LG화학", type: "EQUITY" },
  { symbol: "006400.KS", name: "삼성SDI", type: "EQUITY" },
  { symbol: "012330.KS", name: "현대모비스", type: "EQUITY" },
  { symbol: "028260.KS", name: "삼성물산", type: "EQUITY" },
  { symbol: "066570.KS", name: "LG전자", type: "EQUITY" },
  { symbol: "009150.KS", name: "삼성전기", type: "EQUITY" },
  { symbol: "105560.KS", name: "KB금융", type: "EQUITY" },
  { symbol: "055550.KS", name: "신한지주", type: "EQUITY" },
  { symbol: "086790.KS", name: "하나금융지주", type: "EQUITY" },
  { symbol: "316140.KS", name: "우리금융지주", type: "EQUITY" },
  { symbol: "032830.KS", name: "삼성생명", type: "EQUITY" },
  { symbol: "017670.KS", name: "SK텔레콤", type: "EQUITY" },
  { symbol: "030200.KS", name: "KT", type: "EQUITY" },
  { symbol: "015760.KS", name: "한국전력", type: "EQUITY" },
  { symbol: "033780.KS", name: "KT&G", type: "EQUITY" },
  { symbol: "096770.KS", name: "SK이노베이션", type: "EQUITY" },
  { symbol: "034730.KS", name: "SK", type: "EQUITY" },
  { symbol: "003550.KS", name: "LG", type: "EQUITY" },
  { symbol: "034020.KS", name: "두산에너빌리티", type: "EQUITY" },
  { symbol: "012450.KS", name: "한화에어로스페이스", type: "EQUITY" },
  { symbol: "011200.KS", name: "HMM", type: "EQUITY" },
  { symbol: "042660.KS", name: "한화오션", type: "EQUITY" },
  { symbol: "010140.KS", name: "삼성중공업", type: "EQUITY" },
  { symbol: "259960.KS", name: "크래프톤", type: "EQUITY" },
  { symbol: "352820.KS", name: "하이브", type: "EQUITY" },
  { symbol: "003670.KS", name: "포스코퓨처엠", type: "EQUITY" },
  { symbol: "010130.KS", name: "고려아연", type: "EQUITY" },
  { symbol: "090430.KS", name: "아모레퍼시픽", type: "EQUITY" },
  { symbol: "051900.KS", name: "LG생활건강", type: "EQUITY" },
  { symbol: "097950.KS", name: "CJ제일제당", type: "EQUITY" },
  { symbol: "003490.KS", name: "대한항공", type: "EQUITY" },
  { symbol: "000720.KS", name: "현대건설", type: "EQUITY" },
  { symbol: "326030.KS", name: "SK바이오팜", type: "EQUITY" },
  { symbol: "000100.KS", name: "유한양행", type: "EQUITY" },
  { symbol: "454910.KS", name: "두산로보틱스", type: "EQUITY" },
  // KOSDAQ
  { symbol: "247540.KQ", name: "에코프로비엠", type: "EQUITY" },
  { symbol: "086520.KQ", name: "에코프로", type: "EQUITY" },
  { symbol: "196170.KQ", name: "알테오젠", type: "EQUITY" },
  { symbol: "068760.KQ", name: "셀트리온제약", type: "EQUITY" },
  { symbol: "263750.KQ", name: "펄어비스", type: "EQUITY" },
  { symbol: "293490.KQ", name: "카카오게임즈", type: "EQUITY" },
  // 인기 ETF
  { symbol: "069500.KS", name: "KODEX 200", type: "ETF" },
  { symbol: "122630.KS", name: "KODEX 레버리지", type: "ETF" },
  { symbol: "229200.KS", name: "KODEX 코스닥150", type: "ETF" },
  { symbol: "360750.KS", name: "TIGER 미국S&P500", type: "ETF" },
  { symbol: "133690.KS", name: "TIGER 미국나스닥100", type: "ETF" },
  { symbol: "305720.KS", name: "KODEX 2차전지산업", type: "ETF" },
];

const HANGUL = /[ㄱ-ㅎㅏ-ㅣ가-힣]/;

export function hasHangul(text) {
  return HANGUL.test(text);
}

export function searchKrSymbols(query) {
  const q = query.replace(/\s+/g, "").toLowerCase();
  return KR_SYMBOLS.filter((s) =>
    s.name.replace(/\s+/g, "").toLowerCase().includes(q)
  ).map((s) => ({ ...s, exchange: s.symbol.endsWith(".KQ") ? "KOSDAQ" : "KOSPI" }));
}

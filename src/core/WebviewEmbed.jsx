import { isDesktop } from "./desktop";

// Electron <webview> 임베드. Tauri child webview(useChildWebview)의 대체물.
//
// Tauri와의 결정적 차이: <webview>는 DOM 요소로 합성되므로
// z-index, overflow/border-radius 클리핑, 드로어/카드 겹침이 전부
// 일반 카드 콘텐츠처럼 동작한다 (tasks/MIGRATION.MD의 PoC로 검증).
// rAF 위치 추적, 동적 수축, corner inset 같은 우회 장치가 전혀 필요 없다.
//
// partition: "persist:" 접두사를 주면 로그인 세션이 앱 재시작 후에도 유지된다.
function WebviewEmbed({ url, partition = "persist:webview" }) {
  if (!isDesktop()) {
    return (
      <div className="webview-fallback">
        <div>
          <div style={{ fontSize: 28 }}>🌐</div>
          웹 임베드는 데스크탑 앱에서 동작합니다.
          <br />
          <code>npm run electron:dev</code>로 실행해 주세요.
        </div>
      </div>
    );
  }
  return <webview src={url} partition={partition} allowpopups="true" className="webview-el" />;
}

export default WebviewEmbed;

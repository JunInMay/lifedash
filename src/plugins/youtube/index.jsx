import { useChildWebview } from "../../core/useChildWebview";

// 진짜 youtube.com을 child webview로 카드 안에 표시.
// 웹뷰는 .webview-host(frame 안쪽)를 추적하므로 카드 가장자리 리사이즈 핸들이 가려지지 않는다.
function YoutubePlugin({ instanceId }) {
  const { hostRef, status, errorMsg } = useChildWebview(
    instanceId,
    "https://www.youtube.com",
    "yt"
  );

  return (
    <div className="webview-frame">
      <div ref={hostRef} className="webview-host">
        {status === "loading" && <div>유튜브 로딩 중...</div>}
        {status === "ready" && <div>유튜브가 이 위에 표시됩니다</div>}
        {status === "error" && <div className="webview-error">웹뷰 생성 실패: {errorMsg}</div>}
        {status === "browser" && (
          <div>
            <div style={{ fontSize: 28 }}>📺</div>
            유튜브 플러그인은 데스크탑 앱에서 동작합니다.
            <br />
            <code>npm run tauri dev</code>로 실행해 주세요.
          </div>
        )}
      </div>
    </div>
  );
}

export default YoutubePlugin;

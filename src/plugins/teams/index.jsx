import WebviewEmbed from "../../core/WebviewEmbed";

// 진짜 teams.microsoft.com을 카드 안에 표시.
// persist 파티션이라 로그인 세션이 앱 재시작 후에도 유지된다.
function TeamsPlugin() {
  return (
    <div className="webview-fill">
      <WebviewEmbed url="https://teams.microsoft.com" partition="persist:teams" />
    </div>
  );
}

export default TeamsPlugin;

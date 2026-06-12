import WebviewEmbed from "../../core/WebviewEmbed";

// 진짜 youtube.com을 카드 안에 표시 (Electron <webview> — DOM 합성이라
// 다른 카드/드로어와의 겹침이 일반 콘텐츠처럼 동작한다).
function YoutubePlugin() {
  return (
    <div className="webview-fill">
      <WebviewEmbed url="https://www.youtube.com" partition="persist:youtube" />
    </div>
  );
}

export default YoutubePlugin;

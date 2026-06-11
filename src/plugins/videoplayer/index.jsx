import { useEffect, useRef, useState } from "react";
import "./videoplayer.css";

const isTauri = () => typeof window !== "undefined" && !!window.__TAURI_INTERNALS__;
const VIDEO_EXTENSIONS = ["mp4", "webm", "mkv", "mov", "avi", "m4v"];

function fileName(path) {
  return path.split(/[\\/]/).pop();
}

function VideoPlayerPlugin({ storage }) {
  const [videos, setVideos] = useState(() => storage.get("videos", []));
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [maximized, setMaximized] = useState(false);
  const [missing, setMissing] = useState({});
  const [srcMap, setSrcMap] = useState({});
  const videoRef = useRef(null);

  // 마운트/목록 변경 시 각 동영상의 실제 존재 여부 확인 + asset URL 변환
  useEffect(() => {
    if (!isTauri()) return;
    let alive = true;
    (async () => {
      const [{ exists }, { convertFileSrc }] = await Promise.all([
        import("@tauri-apps/plugin-fs"),
        import("@tauri-apps/api/core"),
      ]);
      const nextMissing = {};
      const nextSrc = {};
      for (const v of videos) {
        try {
          nextMissing[v.path] = !(await exists(v.path));
        } catch {
          nextMissing[v.path] = true;
        }
        nextSrc[v.path] = convertFileSrc(v.path);
      }
      if (alive) {
        setMissing(nextMissing);
        setSrcMap(nextSrc);
      }
    })();
    return () => {
      alive = false;
    };
  }, [videos]);

  const persist = (next) => {
    setVideos(next);
    storage.set("videos", next);
  };

  const addVideos = async () => {
    if (!isTauri()) return;
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      multiple: true,
      filters: [{ name: "동영상", extensions: VIDEO_EXTENSIONS }],
    });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    const existing = new Set(videos.map((v) => v.path));
    const added = paths
      .filter((p) => !existing.has(p))
      .map((p) => ({ path: p, name: fileName(p) }));
    if (added.length) persist([...videos, ...added]);
  };

  const removeVideo = (path) => {
    const idx = videos.findIndex((v) => v.path === path);
    const next = videos.filter((v) => v.path !== path);
    persist(next);
    if (idx === current && idx >= next.length) setCurrent(Math.max(0, next.length - 1));
  };

  const gotoIndex = (i) => {
    if (videos.length === 0) return;
    const n = ((i % videos.length) + videos.length) % videos.length;
    setCurrent(n);
    setPlaying(true);
  };

  const togglePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play();
      setPlaying(true);
    } else {
      el.pause();
      setPlaying(false);
    }
  };

  if (!isTauri()) {
    return (
      <div className="vp-root">
        <div className="vp-stage">
          <div className="vp-empty">
            🎬
            <br />
            동영상 재생기는 데스크탑 앱에서 동작합니다.
            <br />
            <code>npm run tauri dev</code>로 실행해 주세요.
          </div>
        </div>
      </div>
    );
  }

  const cur = videos[current];
  const curMissing = cur && missing[cur.path];
  const curSrc = cur && srcMap[cur.path];

  return (
    <div className="vp-root">
      <div className="vp-stage">
        {!cur && <div className="vp-empty">우측 목록에서 동영상을 추가하세요</div>}
        {cur && curMissing && (
          <div className="vp-missing">파일을 찾을 수 없습니다:<br />{cur.name}</div>
        )}
        {cur && !curMissing && (
          <video
            key={cur.path}
            ref={videoRef}
            src={curSrc}
            autoPlay
            loop
            onEnded={() => gotoIndex(current + 1)}
          />
        )}

        {videos.length > 0 && (
          <div className="vp-overlay-controls">
            <button title="이전 동영상" onClick={() => gotoIndex(current - 1)}>
              ⏮
            </button>
            <button title={playing ? "일시정지" : "재생"} onClick={togglePlay}>
              {playing ? "⏸" : "▶"}
            </button>
            <button title="다음 동영상" onClick={() => gotoIndex(current + 1)}>
              ⏭
            </button>
          </div>
        )}

        <button
          className="vp-maximize-btn"
          title={maximized ? "축소" : "전체화면"}
          onClick={() => setMaximized((m) => !m)}
        >
          {maximized ? "⤡" : "⤢"}
        </button>
      </div>

      {!maximized && (
        <div className="vp-sidebar">
          <button className="vp-add-btn" onClick={addVideos}>
            + 동영상 추가
          </button>
          <div className="vp-list">
            {videos.map((v, i) => (
              <div
                key={v.path}
                className={`vp-item ${i === current ? "active" : ""}`}
                onClick={() => gotoIndex(i)}
              >
                <span
                  className={`vp-item-name ${missing[v.path] ? "missing" : ""}`}
                  title={v.path}
                >
                  {v.name}
                </span>
                <button
                  className="vp-remove-btn"
                  title="목록에서 제거"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeVideo(v.path);
                  }}
                >
                  🗑
                </button>
              </div>
            ))}
            {videos.length === 0 && <div className="vp-list-empty">동영상이 없습니다</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export default VideoPlayerPlugin;

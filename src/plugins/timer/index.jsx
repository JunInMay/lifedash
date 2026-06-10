import { useEffect, useRef, useState } from "react";

function TimerPlugin({ bus }) {
  const [ms, setMs] = useState(0);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (running) {
      const startedAt = Date.now() - ms;
      intervalRef.current = setInterval(() => setMs(Date.now() - startedAt), 31);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps

  const format = (ms) => {
    const m = String(Math.floor(ms / 60000)).padStart(2, "0");
    const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, "0");
    const millis = String(ms % 1000).padStart(3, "0");
    return `${m}:${s}.${millis}`;
  };

  const reset = () => {
    setRunning(false);
    setMs(0);
    bus.emit("timer:reset", {});
  };

  return (
    <div className="widget-pad" style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontSize: 32, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
        {format(ms)}
      </div>
      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button className="widget-btn" onClick={() => setRunning((r) => !r)}>
          {running ? "일시정지" : "시작"}
        </button>
        <button className="widget-btn" onClick={reset}>
          초기화
        </button>
      </div>
    </div>
  );
}

export default TimerPlugin;

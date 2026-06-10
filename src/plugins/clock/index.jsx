import { useEffect, useState } from "react";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

function ClockPlugin() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const pad = (n) => String(n).padStart(2, "0");
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const date = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())} (${DAYS[now.getDay()]})`;

  return (
    <div className="widget-pad" style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontSize: 40, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
        {time}
      </div>
      <div style={{ marginTop: 6, color: "#8b93a3" }}>{date}</div>
    </div>
  );
}

export default ClockPlugin;

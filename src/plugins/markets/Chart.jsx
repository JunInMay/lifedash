import { useEffect, useRef, useState } from "react";
import { fmtPrice } from "./api";

function useSize(ref) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

// SVG 라인 차트. 전일 종가가 표시 범위 안에 있으면 점선 기준선을 그린다.
function Chart({ points, prevClose, color }) {
  const ref = useRef(null);
  const { w, h } = useSize(ref);

  let svg = null;
  if (w > 10 && h > 10 && points.length > 1) {
    const pad = { top: 10, right: 56, bottom: 10, left: 8 };
    const iw = w - pad.left - pad.right;
    const ih = h - pad.top - pad.bottom;

    const values = points.map((p) => p.v);
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (min === max) {
      min -= 1;
      max += 1;
    }

    const x = (i) => pad.left + (i / (points.length - 1)) * iw;
    const y = (v) => pad.top + ((max - v) / (max - min)) * ih;

    const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
    const area = `${pad.left},${pad.top + ih} ${line} ${(pad.left + iw).toFixed(1)},${pad.top + ih}`;
    const last = points.at(-1);
    const showPrev = prevClose != null && prevClose >= min && prevClose <= max;

    svg = (
      <svg width={w} height={h}>
        <polygon points={area} fill={color} opacity="0.08" />
        <polyline points={line} fill="none" stroke={color} strokeWidth="1.5" />
        {showPrev && (
          <line
            x1={pad.left}
            x2={pad.left + iw}
            y1={y(prevClose)}
            y2={y(prevClose)}
            stroke="#5b6270"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        )}
        <circle cx={x(points.length - 1)} cy={y(last.v)} r="3" fill={color} />
        <text x={w - pad.right + 6} y={pad.top + 4} fill="#8b93a3" fontSize="10">
          {fmtPrice(max)}
        </text>
        <text x={w - pad.right + 6} y={pad.top + ih + 4} fill="#8b93a3" fontSize="10">
          {fmtPrice(min)}
        </text>
        <text
          x={w - pad.right + 6}
          y={Math.min(Math.max(y(last.v) + 3, pad.top + 16), pad.top + ih - 8)}
          fill={color}
          fontSize="10"
          fontWeight="700"
        >
          {fmtPrice(last.v)}
        </text>
      </svg>
    );
  }

  return (
    <div ref={ref} style={{ flex: 1, minHeight: 0 }}>
      {svg}
    </div>
  );
}

export default Chart;

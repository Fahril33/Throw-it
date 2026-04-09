import React, { useEffect, useRef } from "react";

export default function SpeedGraph(props: { samples: number[] }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const values = props.samples.slice(-24);
    const max = Math.max(1, ...values);

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h - 0.5);
    ctx.lineTo(w, h - 0.5);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,47,214,0.95)";
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let i = 0; i < values.length; i++) {
      const x = (i / Math.max(1, values.length - 1)) * (w - 8) + 4;
      const y = h - (values[i] / max) * (h - 8) - 4;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }, [props.samples]);

  return <canvas className="spark" ref={ref} width={110} height={28} />;
}

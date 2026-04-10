import React, { useEffect } from "react";

export default function Toast(props: { text: string; show: boolean; onDone: () => void }) {
  useEffect(() => {
    if (!props.show) return;
    const t = window.setTimeout(() => props.onDone(), 900);
    return () => window.clearTimeout(t);
  }, [props.show, props.onDone]);

  if (!props.show) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        bottom: 18,
        transform: "translateX(-50%)",
        padding: "10px 12px",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(15,20,32,0.94)",
        backdropFilter: "blur(10px)",
        color: "rgba(255,255,255,0.9)",
        fontWeight: 800,
        fontSize: 13,
        zIndex: 12000
      }}
    >
      {props.text}
    </div>
  );
}


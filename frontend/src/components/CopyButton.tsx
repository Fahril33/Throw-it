import React, { useRef, useState } from "react";
import { copyText } from "../utils/clipboard";

export default function CopyButton(props: { text: string; title?: string }) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    const res = await copyText(props.text);
    if (!res.ok) {
      window.prompt("Copy ke clipboard:", props.text);
      return;
    }

    setCopied(true);
    // Trigger CSS state for mouse/touch users.
    buttonRef.current?.focus({ preventScroll: true });
    window.setTimeout(() => {
      setCopied(false);
      buttonRef.current?.blur();
    }, 900);
  };

  return (
    <button
      ref={buttonRef}
      className={`btn-copy ${copied ? "copied" : ""}`}
      onClick={() => void onCopy()}
      title={props.title ?? "Copy to clipboard"}
      aria-label="Copy to clipboard"
      type="button"
    >
      <span data-text-end="Copied!" data-text-initial="Copy to clipboard" className="cp-tooltip" />
      <span>
        <svg
          xmlSpace="preserve"
          style={{ enableBackground: "new 0 0 512 512" }}
          viewBox="0 0 6.35 6.35"
          y="0"
          x="0"
          height="20"
          width="20"
          version="1.1"
          xmlns="http://www.w3.org/2000/svg"
          className="cp-clipboard"
        >
          <g>
            <path
              fill="currentColor"
              d="M2.43.265c-.3 0-.548.236-.573.53h-.328a.74.74 0 0 0-.735.734v3.822a.74.74 0 0 0 .735.734H4.82a.74.74 0 0 0 .735-.734V1.529a.74.74 0 0 0-.735-.735h-.328a.58.58 0 0 0-.573-.53zm0 .529h1.49c.032 0 .049.017.049.049v.431c0 .032-.017.049-.049.049H2.43c-.032 0-.05-.017-.05-.049V.843c0-.032.018-.05.05-.05zm-.901.53h.328c.026.292.274.528.573.528h1.49a.58.58 0 0 0 .573-.529h.328a.2.2 0 0 1 .206.206v3.822a.2.2 0 0 1-.206.205H1.53a.2.2 0 0 1-.206-.205V1.529a.2.2 0 0 1 .206-.206z"
            ></path>
          </g>
        </svg>
        <svg
          xmlSpace="preserve"
          style={{ enableBackground: "new 0 0 512 512" }}
          viewBox="0 0 24 24"
          y="0"
          x="0"
          height="18"
          width="18"
          version="1.1"
          xmlns="http://www.w3.org/2000/svg"
          className="cp-check-mark"
        >
          <g>
            <path
              data-original="#000000"
              fill="currentColor"
              d="M9.707 19.121a.997.997 0 0 1-1.414 0l-5.646-5.647a1.5 1.5 0 0 1 0-2.121l.707-.707a1.5 1.5 0 0 1 2.121 0L9 14.171l9.525-9.525a1.5 1.5 0 0 1 2.121 0l.707.707a1.5 1.5 0 0 1 0 2.121z"
            ></path>
          </g>
        </svg>
      </span>
    </button>
  );
}


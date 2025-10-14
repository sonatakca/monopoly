// components/GoToGameButton.tsx
"use client";
import React from "react";

type ShowWhen = "above-target" | "below-target" | "always";

type Props = {
  targetId?: string;
  showBeforePx?: number;   // distance from target where we hide (for "above-target")
  scrollOffset?: number;   // offset when scrolling to target
  sticky?: boolean;        // ← NEW: fixed to viewport or not
  showWhen?: ShowWhen;     // ← NEW: visibility rule
  className?: string;      // optional extra classes when non-sticky
};

export default function GoToGameButton({
  targetId = "game",
  showBeforePx = 200,
  scrollOffset = 0,
  sticky = true,          // default: behaves like a floating button
  showWhen = "above-target",
  className,
}: Props) {
  const [visible, setVisible] = React.useState(showWhen === "always");

  React.useEffect(() => {
    if (showWhen === "always") { setVisible(true); return; }

    const compute = () => {
      const t = document.getElementById(targetId);
      if (!t) { setVisible(window.scrollY < 800); return; }
      const targetTop = t.getBoundingClientRect().top + window.scrollY;

      if (showWhen === "above-target") {
        setVisible(window.scrollY < targetTop - showBeforePx);
      } else {
        // below-target
        setVisible(window.scrollY >= targetTop - 10);
      }
    };

    compute();
    window.addEventListener("scroll", compute, { passive: true });
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", compute);
      window.removeEventListener("resize", compute);
    };
  }, [targetId, showBeforePx, showWhen]);

  const onClick = () => {
    const t = document.getElementById(targetId);
    if (!t) return;
    const y = t.getBoundingClientRect().top + window.scrollY + scrollOffset;
    window.scrollTo({ top: y, behavior: "smooth" });
  };

  return (
    <>
      <button
        id="backtotop"
        className={`${visible ? "visible" : ""} ${sticky ? "" : "non-sticky"} ${className ?? ""}`}
        onClick={onClick}
        aria-label="Oyuna Git"
        type="button"
      >
        {/* Down arrow */}
        <svg className="svgIcon" viewBox="0 0 384 512" aria-hidden="true">
          <path d="M169.4 470.6c12.5 12.5 32.8 12.5 45.3 0l160-160c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 370.8V64c0-17.7-14.3-32-32-32s-32 14.3-32 32v306.8L54.6 265.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160z" />
        </svg>
      </button>

      <style jsx>{`
 #backtotop.visible { opacity: 1; pointer-events: auto; }

/* one source of truth for timing */
#backtotop,
#backtotop.non-sticky::before,
#backtotop::before,
#backtotop .svgIcon {
  --expand-to: 110px;
  --expand-ms: 900ms;
  --ease: cubic-bezier(.22,.61,.36,1);
}

/* STICKY (fixed) */
#backtotop {
  position: fixed;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  width: 50px; height: 50px; border-radius: 50%;
  background: #000; border: 1px solid #000;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  cursor: pointer; overflow: hidden; z-index: 999;
  opacity: 0; pointer-events: none;
  transition:
    width var(--expand-ms) var(--ease),
    border-radius calc(var(--expand-ms)*0.9) var(--ease),
    background-color 220ms ease;
  will-change: width, border-radius;
}

/* NON-STICKY (flows in layout) */
#backtotop.non-sticky {
  position: static; left: auto; bottom: auto; transform: none; z-index: auto;
  opacity: 1; pointer-events: auto;
  margin: 16px auto; /* centered in container */
}

/* icon + hover behaviors (shared) */
.svgIcon { width: 15px; transition: transform var(--expand-ms) var(--ease); }
.svgIcon path { fill: #fff; }

#backtotop:hover {
  width: var(--expand-to);
  border-radius: 50px;
  background: #232323;
}
#backtotop:hover .svgIcon { transform: translateY(200%); } /* use -200% if your arrow is up */

/* label in sync with width */
#backtotop::before {
  position: absolute;
  content: "Oyuna Git";
  color: #fff;
  font-size: 0px;
  opacity: 0;
  transition:
    font-size var(--expand-ms) var(--ease),
    opacity var(--expand-ms) var(--ease),
    bottom var(--expand-ms) var(--ease);
}
#backtotop:hover::before {
  font-size: 13px;
  opacity: 1;
  bottom: unset;
}



`}</style>
    </>
  );
}

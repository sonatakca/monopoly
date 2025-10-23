"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Tippy from '@tippyjs/react';
import { followCursor } from "tippy.js";

const MUSIC_URL = "/music/Monopoly - Main Theme.mp3";

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  // @ts-ignore - webkit prefix for iOS Safari
  const Ctx = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctx) return null;
  return new Ctx();
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

type Props = {
  mode?: 'floating' | 'toolbar' | 'inline';
};

export default function BackgroundMusic({ mode = 'floating' }: Props) {
  // Persisted preferences
  const initialVolume = useMemo(() => {
    if (typeof window === "undefined") return 0.1;
    const s = localStorage.getItem("musicVolume");
    const v = s != null ? Number(s) : NaN;
    return Number.isFinite(v) ? clamp01(v) : 0.1;
  }, []);
  const initialMuted = useMemo(() => {
    if (typeof window === "undefined") return false;
    const m = localStorage.getItem("musicMuted");
    if (m != null) return m === "true";
    // Back-compat with old flag if present
    const old = localStorage.getItem("musicEnabled");
    if (old != null) return old !== "true"; // enabled=false -> muted=true
    return false;
  }, []);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState<number>(initialVolume);
  const [muted, setMuted] = useState<boolean>(initialMuted);
  const lastNonZeroVolRef = useRef<number>(initialVolume || 0.1);

  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const srcRef = useRef<AudioBufferSourceNode | null>(null);

  const sliderRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  const applyGain = useCallback((mutedVal: boolean, vol: number) => {
    const gain = gainRef.current;
    if (!gain) return;
    gain.gain.value = mutedVal ? 0 : clamp01(vol);
  }, []);

  const teardownSource = useCallback(() => {
    const src = srcRef.current;
    if (src) {
      try {
        src.stop();
      } catch { }
      try {
        src.disconnect();
      } catch { }
    }
    srcRef.current = null;
  }, []);

  const startSource = useCallback(() => {
    const ctx = ctxRef.current;
    const buf = bufferRef.current;
    const gain = gainRef.current;
    if (!ctx || !buf || !gain) return;

    teardownSource();
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true; // gapless loop via Web Audio
    src.connect(gain);
    src.start(0);
    srcRef.current = src;
    setPlaying(true);
  }, [teardownSource]);

  // Fetch + decode audio, set up graph
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const url = encodeURI(MUSIC_URL);
        const res = await fetch(url, { cache: "force-cache" });
        const arr = await res.arrayBuffer();

        const ctx = getAudioContext();
        if (!ctx) return;
        ctxRef.current = ctx;

        const audioBuffer = await ctx.decodeAudioData(arr);
        if (cancelled) return;
        bufferRef.current = audioBuffer;

        const gain = ctx.createGain();
        gain.connect(ctx.destination);
        gainRef.current = gain;

        // Apply initial gain
        applyGain(initialMuted, initialVolume);

        setReady(true);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("BackgroundMusic: failed to prepare audio", e);
      }
    })();
    return () => {
      cancelled = true;
      teardownSource();
      try {
        gainRef.current?.disconnect();
      } catch { }
      gainRef.current = null;
      if (ctxRef.current) {
        try {
          ctxRef.current.close();
        } catch { }
      }
      ctxRef.current = null;
    };
  }, [applyGain, initialMuted, initialVolume, teardownSource]);

  // Unlock/resume on first user gesture once ready
  useEffect(() => {
    if (!ready) return;
    const handler = async () => {
      const ctx = ctxRef.current;
      if (!ctx) return;
      try {
        if (ctx.state !== "running") {
          await ctx.resume();
        }
        if (!srcRef.current) startSource();
      } catch { }
      window.removeEventListener("pointerdown", handler, { capture: true } as any);
      document.removeEventListener("keydown", handler);
    };
    window.addEventListener("pointerdown", handler, { capture: true } as any);
    document.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("pointerdown", handler, { capture: true } as any);
      document.removeEventListener("keydown", handler);
    };
  }, [ready, startSource]);

  // Persist + apply gain on changes
  useEffect(() => {
    applyGain(muted, volume);
    try {
      localStorage.setItem("musicVolume", String(volume));
      localStorage.setItem("musicMuted", String(muted));
    } catch { }
  }, [muted, volume, applyGain]);

  const toggleMute = useCallback(() => {
    if (muted) {
      // Unmute -> restore previous volume or default 10%
      setMuted(false);
      const restore = lastNonZeroVolRef.current || 0.1;
      setVolume(restore);
    } else {
      // Mute -> remember current volume, then set to 0 so slider moves to 0
      if (volume > 0) lastNonZeroVolRef.current = volume;
      setMuted(true);
      setVolume(0);
    }
  }, [muted, volume]);

  const updateVolumeFromClientX = useCallback((clientX: number) => {
    const el = sliderRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const v = clamp01((clientX - rect.left) / rect.width);
    const stepped = Math.round(v * 100) / 100; // fine steps
    setVolume(stepped);
    if (stepped > 0) lastNonZeroVolRef.current = stepped;
    if (stepped === 0) setMuted(true);
    else setMuted(false);
  }, []);

  const onSliderPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Start dragging from anywhere within the slider area (or its container)
    draggingRef.current = true;
    e.preventDefault();
    // Capture on the actual slider element if available for consistent moves
    try { sliderRef.current?.setPointerCapture?.(e.pointerId); } catch { }
    updateVolumeFromClientX(e.clientX);
  }, [updateVolumeFromClientX]);

  // Attach hover/transition handlers to the containing volume button to manage
  // the `.open-ready` class for delayed close only after fully opened.
  useEffect(() => {
    if (mode !== 'inline') return;
    const el = sliderRef.current;
    if (!el) return;
    const btn = el.closest('button#volume') as HTMLButtonElement | null;
    if (!btn) return;

    const onEnter = () => {
      try { btn.classList.remove('open-ready'); } catch { }
    };
    const onTransitionEnd = (ev: Event) => {
      const e = ev as TransitionEvent;
      if (e.target !== btn) return;
      if (e.propertyName !== 'width') return;
      try {
        if (btn.matches(':hover')) btn.classList.add('open-ready');
      } catch { }
    };
    btn.addEventListener('mouseenter', onEnter);
    btn.addEventListener('transitionend', onTransitionEnd);
    return () => {
      btn.removeEventListener('mouseenter', onEnter);
      btn.removeEventListener('transitionend', onTransitionEnd);
    };
  }, [mode]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      updateVolumeFromClientX(e.clientX);
    };
    const onUp = () => {
      draggingRef.current = false;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [updateVolumeFromClientX]);

  const onSliderKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const key = e.key;
    if (key === "ArrowLeft" || key === "ArrowDown") {
      e.preventDefault();
      setMuted(false);
      setVolume((v) => clamp01(v - 0.05));
    } else if (key === "ArrowRight" || key === "ArrowUp") {
      e.preventDefault();
      setMuted(false);
      setVolume((v) => clamp01(v + 0.05));
    } else if (key === "Home") {
      e.preventDefault();
      setVolume(0);
      setMuted(true);
    } else if (key === "End") {
      e.preventDefault();
      setMuted(false);
      setVolume(1);
    } else if (key.toLowerCase() === "m") {
      e.preventDefault();
      toggleMute();
    }
  }, [toggleMute]);

  const volPct = Math.round(volume * 100);
  const showSmallRipple = !muted && volume > 0 && volume <= 0.66;
  const showBigRipple = !muted && volume > 0.66;

  const sliderTrack = (
    <div
      className="ytp-volume-slider"
      onKeyDown={onSliderKeyDown}
      ref={sliderRef}
      onPointerDown={onSliderPointerDown}
      style={{
        position: "relative",
        width: "100%",
        // Make hit area larger while keeping a thin visual bar
        height: 40,
        background: "transparent",
        borderRadius: 4,
        userSelect: "none",
        touchAction: "none",
        cursor: "pointer",
      }}
    >
      {/* Visual track bar */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: "50%",
          transform: "translateY(-50%)",
          height: 3,
          width: "100%",
          background: "rgba(255,255,255,0.35)",
          borderRadius: 2,
          pointerEvents: "none",
        }}
      />
      {/* Filled progress */}
      <div
        className="ytp-volume-slider-fill"
        style={{
          position: "absolute",
          left: 0,
          top: "50%",
          transform: "translateY(-50%)",
          height: 3,
          width: `${volPct}%`,
          background: "#000",
          borderRadius: 2,
          pointerEvents: "none",
        }}
      />
      {/* Handle */}
      <div
        className="ytp-volume-slider-handle"
        style={{
          position: "absolute",
          top: "50%",
          left: `calc(${volPct}% - 3px)`,
          transform: "translateY(-50%)",
          width: 9,
          height: 9,
          background: "#000",
          borderRadius: 999,
          boxShadow: "0 1px 2px rgba(0,0,0,0.4)",
          pointerEvents: "none",
        }}
      />
    </div>
  );

  if (mode === 'toolbar') {
    return (
      <Tippy
        content={
          <div style={{ width: 140, padding: 8, cursor: 'pointer' }} onPointerDown={onSliderPointerDown}>
            {sliderTrack}
          </div>
        }
        interactive={true}
        placement="right"
        offset={[0, 0]}
        arrow={false}
        appendTo={() => document.querySelector('#game') || document.body}
        theme="custom"
        hideOnClick={false}
      >
        <button
          className={'no-style modernButton'}
          onClick={toggleMute}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Tippy content={'Sesi Kapat'}
            followCursor={true}
            plugins={[followCursor]}
            offset={[70, -50]}
            arrow={false}
            appendTo={() => document.querySelector('#game') || document.body}
            theme="custom">
            <svg width="24" height="24" viewBox="0 0 24 24">
              <path
                className="ytp-svg-volume-animation-speaker"
                d="M 11.60 2.08 L 11.48 2.14 L 3.91 6.68 C 3.02 7.21 2.28 7.97 1.77 8.87 C 1.26 9.77 1.00 10.79 1 11.83 V 12.16 L 1.01 12.56 C 1.07 13.52 1.37 14.46 1.87 15.29 C 2.38 16.12 3.08 16.81 3.91 17.31 L 11.48 21.85 C 11.63 21.94 11.80 21.99 11.98 21.99 C 12.16 22.00 12.33 21.95 12.49 21.87 C 12.64 21.78 12.77 21.65 12.86 21.50 C 12.95 21.35 13 21.17 13 21 V 3 C 12.99 2.83 12.95 2.67 12.87 2.52 C 12.80 2.37 12.68 2.25 12.54 2.16 C 12.41 2.07 12.25 2.01 12.08 2.00 C 11.92 1.98 11.75 2.01 11.60 2.08 Z"
                fill="#000"
              />
              <path
                className="ytp-svg-volume-animation-small-ripple"
                d=" M 15.53 7.05 C 15.35 7.22 15.25 7.45 15.24 7.70 C 15.23 7.95 15.31 8.19 15.46 8.38 L 15.53 8.46 L 15.70 8.64 C 16.09 9.06 16.39 9.55 16.61 10.08 L 16.70 10.31 C 16.90 10.85 17 11.42 17 12 L 16.99 12.24 C 16.96 12.73 16.87 13.22 16.70 13.68 L 16.61 13.91 C 16.36 14.51 15.99 15.07 15.53 15.53 C 15.35 15.72 15.25 15.97 15.26 16.23 C 15.26 16.49 15.37 16.74 15.55 16.92 C 15.73 17.11 15.98 17.21 16.24 17.22 C 16.50 17.22 16.76 17.12 16.95 16.95 C 17.6 16.29 18.11 15.52 18.46 14.67 L 18.59 14.35 C 18.82 13.71 18.95 13.03 18.99 12.34 L 19 12 C 18.99 11.19 18.86 10.39 18.59 9.64 L 18.46 9.32 C 18.15 8.57 17.72 7.89 17.18 7.3 L 16.95 7.05 L 16.87 6.98 C 16.68 6.82 16.43 6.74 16.19 6.75 C 15.94 6.77 15.71 6.87 15.53 7.05"
                fill="#000"
                style={{ opacity: showSmallRipple ? 1 : (showBigRipple ? 1 : 0) }}
                transform="translate(18, 12) scale(1) translate(-18,-12)"
              />
              <path
                className="ytp-svg-volume-animation-big-ripple"
                d="M18.36 4.22C18.18 4.39 18.08 4.62 18.07 4.87C18.05 5.12 18.13 5.36 18.29 5.56L18.36 5.63L18.66 5.95C19.36 6.72 19.91 7.60 20.31 8.55L20.47 8.96C20.82 9.94 21 10.96 21 11.99L20.98 12.44C20.94 13.32 20.77 14.19 20.47 15.03L20.31 15.44C19.86 16.53 19.19 17.52 18.36 18.36C18.17 18.55 18.07 18.80 18.07 19.07C18.07 19.33 18.17 19.59 18.36 19.77C18.55 19.96 18.80 20.07 19.07 20.07C19.33 20.07 19.59 19.96 19.77 19.77C20.79 18.75 21.61 17.54 22.16 16.20L22.35 15.70C22.72 14.68 22.93 13.62 22.98 12.54L23 12C22.99 10.73 22.78 9.48 22.35 8.29L22.16 7.79C21.67 6.62 20.99 5.54 20.15 4.61L19.77 4.22L19.70 4.15C19.51 3.99 19.26 3.91 19.02 3.93C18.77 3.94 18.53 4.04 18.36 4.22 Z"
                fill="#000"
                style={{ opacity: showBigRipple ? 1 : 0 }}
                transform="translate(22, 12) scale(1) translate(-22,-12)"
              />
            </svg>
          </Tippy>

        </button>
      </Tippy>
    );
  }

  if (mode === 'inline') {
    return (
      <div className="volume-inline" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', height: 40, width: '100%' }}>
        <Tippy
          content={muted ? 'Sesi Aç' : 'Sesi Kapat'}
          followCursor={true}
          plugins={[followCursor]}
          offset={[70, -50]}
          arrow={false}
          appendTo={() => document.querySelector('#game') || document.body}
          theme="custom"
          delay={[800, 0]}
        >
          <div
            onClick={toggleMute}
            style={{
              position: 'absolute',
              left: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'grid',
              placeItems: 'center',
              width: 40,
              height: 40,
              pointerEvents: 'auto',
              cursor: 'pointer'
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24">
              <path
                className="ytp-svg-volume-animation-speaker"
                d="M 11.60 2.08 L 11.48 2.14 L 3.91 6.68 C 3.02 7.21 2.28 7.97 1.77 8.87 C 1.26 9.77 1.00 10.79 1 11.83 V 12.16 L 1.01 12.56 C 1.07 13.52 1.37 14.46 1.87 15.29 C 2.38 16.12 3.08 16.81 3.91 17.31 L 11.48 21.85 C 11.63 21.94 11.80 21.99 11.98 21.99 C 12.16 22.00 12.33 21.95 12.49 21.87 C 12.64 21.78 12.77 21.65 12.86 21.50 C 12.95 21.35 13 21.17 13 21 V 3 C 12.99 2.83 12.95 2.67 12.87 2.52 C 12.80 2.37 12.68 2.25 12.54 2.16 C 12.41 2.07 12.25 2.01 12.08 2.00 C 11.92 1.98 11.75 2.01 11.60 2.08 Z"
                fill="#000"
              />
              <path
                className="ytp-svg-volume-animation-small-ripple"
                d=" M 15.53 7.05 C 15.35 7.22 15.25 7.45 15.24 7.70 C 15.23 7.95 15.31 8.19 15.46 8.38 L 15.53 8.46 L 15.70 8.64 C 16.09 9.06 16.39 9.55 16.61 10.08 L 16.70 10.31 C 16.90 10.85 17 11.42 17 12 L 16.99 12.24 C 16.96 12.73 16.87 13.22 16.70 13.68 L 16.61 13.91 C 16.36 14.51 15.99 15.07 15.53 15.53 C 15.35 15.72 15.25 15.97 15.26 16.23 C 15.26 16.49 15.37 16.74 15.55 16.92 C 15.73 17.11 15.98 17.21 16.24 17.22 C 16.50 17.22 16.76 17.12 16.95 16.95 C 17.6 16.29 18.11 15.52 18.46 14.67 L 18.59 14.35 C 18.82 13.71 18.95 13.03 18.99 12.34 L 19 12 C 18.99 11.19 18.86 10.39 18.59 9.64 L 18.46 9.32 C 18.15 8.57 17.72 7.89 17.18 7.3 L 16.95 7.05 L 16.87 6.98 C 16.68 6.82 16.43 6.74 16.19 6.75 C 15.94 6.77 15.71 6.87 15.53 7.05"
                fill="#000"
                style={{ opacity: showSmallRipple ? 1 : (showBigRipple ? 1 : 0) }}
                transform="translate(18, 12) scale(1) translate(-18,-12)"
              />
              <path
                className="ytp-svg-volume-animation-big-ripple"
                d="M18.36 4.22C18.18 4.39 18.08 4.62 18.07 4.87C18.05 5.12 18.13 5.36 18.29 5.56L18.36 5.63L18.66 5.95C19.36 6.72 19.91 7.60 20.31 8.55L20.47 8.96C20.82 9.94 21 10.96 21 11.99L20.98 12.44C20.94 13.32 20.77 14.19 20.47 15.03L20.31 15.44C19.86 16.53 19.19 17.52 18.36 18.36C18.17 18.55 18.07 18.80 18.07 19.07C18.07 19.33 18.17 19.59 18.36 19.77C18.55 19.96 18.80 20.07 19.07 20.07C19.33 20.07 19.59 19.96 19.77 19.77C20.79 18.75 21.61 17.54 22.16 16.20L22.35 15.70C22.72 14.68 22.93 13.62 22.98 12.54L23 12C22.99 10.73 22.78 9.48 22.35 8.29L22.16 7.79C21.67 6.62 20.99 5.54 20.15 4.61L19.77 4.22L19.70 4.15C19.51 3.99 19.26 3.91 19.02 3.93C18.77 3.94 18.53 4.04 18.36 4.22 Z"
                fill="#000"
                style={{ opacity: showBigRipple ? 1 : 0 }}
                transform="translate(22, 12) scale(1) translate(-22,-12)"
              />

            </svg>
          </div>
        </Tippy>
        <div className="volume-slider-inline" style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onPointerDown={onSliderPointerDown}>
          <Tippy
            content={`${volPct}%`}
            followCursor={false}
            plugins={[followCursor]}
            offset={[90, -40]}
            arrow={false}
            appendTo={() => document.querySelector('#game') || document.body}
            theme="transparent"
            delay={[300, 0]}
          >
            {sliderTrack}
          </Tippy>
        </div>
      </div>
    );
  }

  // Floating default UI (bottom-right)
  return (
    <div
      className="ytp-volume-area"
      style={{
        position: "fixed",
        right: 12,
        bottom: 12,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: 6,
        background: "rgba(0,0,0,0.55)",
        border: "1px solid rgba(255,255,255,0.2)",
        borderRadius: 10,
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
      }}
    >
      <button
        onClick={toggleMute}
        style={{
          appearance: "none",
          background: "transparent",
          border: 0,
          padding: 4,
          cursor: "pointer",
          display: "inline-flex",
          color: "#000",
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24">
          <path
            className="ytp-svg-volume-animation-speaker"
            d="M 11.60 2.08 L 11.48 2.14 L 3.91 6.68 C 3.02 7.21 2.28 7.97 1.77 8.87 C 1.26 9.77 1.00 10.79 1 11.83 V 12.16 L 1.01 12.56 C 1.07 13.52 1.37 14.46 1.87 15.29 C 2.38 16.12 3.08 16.81 3.91 17.31 L 11.48 21.85 C 11.63 21.94 11.80 21.99 11.98 21.99 C 12.16 22.00 12.33 21.95 12.49 21.87 C 12.64 21.78 12.77 21.65 12.86 21.50 C 12.95 21.35 13 21.17 13 21 V 3 C 12.99 2.83 12.95 2.67 12.87 2.52 C 12.80 2.37 12.68 2.25 12.54 2.16 C 12.41 2.07 12.25 2.01 12.08 2.00 C 11.92 1.98 11.75 2.01 11.60 2.08 Z"
            fill="#000"
          />
          <path
            className="ytp-svg-volume-animation-small-ripple"
            d=" M 15.53 7.05 C 15.35 7.22 15.25 7.45 15.24 7.70 C 15.23 7.95 15.31 8.19 15.46 8.38 L 15.53 8.46 L 15.70 8.64 C 16.09 9.06 16.39 9.55 16.61 10.08 L 16.70 10.31 C 16.90 10.85 17 11.42 17 12 L 16.99 12.24 C 16.96 12.73 16.87 13.22 16.70 13.68 L 16.61 13.91 C 16.36 14.51 15.99 15.07 15.53 15.53 C 15.35 15.72 15.25 15.97 15.26 16.23 C 15.26 16.49 15.37 16.74 15.55 16.92 C 15.73 17.11 15.98 17.21 16.24 17.22 C 16.50 17.22 16.76 17.12 16.95 16.95 C 17.6 16.29 18.11 15.52 18.46 14.67 L 18.59 14.35 C 18.82 13.71 18.95 13.03 18.99 12.34 L 19 12 C 18.99 11.19 18.86 10.39 18.59 9.64 L 18.46 9.32 C 18.15 8.57 17.72 7.89 17.18 7.3 L 16.95 7.05 L 16.87 6.98 C 16.68 6.82 16.43 6.74 16.19 6.75 C 15.94 6.77 15.71 6.87 15.53 7.05"
            fill="#000"
            style={{ opacity: showSmallRipple ? 1 : (showBigRipple ? 1 : 0) }}
            transform="translate(18, 12) scale(1) translate(-18,-12)"
          />
          <path
            className="ytp-svg-volume-animation-big-ripple"
            d="M18.36 4.22C18.18 4.39 18.08 4.62 18.07 4.87C18.05 5.12 18.13 5.36 18.29 5.56L18.36 5.63L18.66 5.95C19.36 6.72 19.91 7.60 20.31 8.55L20.47 8.96C20.82 9.94 21 10.96 21 11.99L20.98 12.44C20.94 13.32 20.77 14.19 20.47 15.03L20.31 15.44C19.86 16.53 19.19 17.52 18.36 18.36C18.17 18.55 18.07 18.80 18.07 19.07C18.07 19.33 18.17 19.59 18.36 19.77C18.55 19.96 18.80 20.07 19.07 20.07C19.33 20.07 19.59 19.96 19.77 19.77C20.79 18.75 21.61 17.54 22.16 16.20L22.35 15.70C22.72 14.68 22.93 13.62 22.98 12.54L23 12C22.99 10.73 22.78 9.48 22.35 8.29L22.16 7.79C21.67 6.62 20.99 5.54 20.15 4.61L19.77 4.22L19.70 4.15C19.51 3.99 19.26 3.91 19.02 3.93C18.77 3.94 18.53 4.04 18.36 4.22 Z"
            fill="#000"
            style={{ opacity: showBigRipple ? 1 : 0 }}
            transform="translate(22, 12) scale(1) translate(-22,-12)"
          />

        </svg>
      </button>
      {sliderContent}
    </div>
  );
}

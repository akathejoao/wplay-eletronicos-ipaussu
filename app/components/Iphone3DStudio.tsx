"use client";

import React, { useEffect, useRef, useState } from "react";
import { RotateCw, Sparkles } from "lucide-react";
import { IphoneFinish, IphoneModelSpec } from "@/lib/iphone-models";

type Iphone3DStudioProps = {
  model: IphoneModelSpec;
  finish: IphoneFinish;
  storage: string;
  compact?: boolean;
};

export function Iphone3DStudio({
  model,
  finish,
  storage,
  compact = false,
}: Iphone3DStudioProps) {
  const [rotY, setRotY] = useState<number>(32);
  const [rotX, setRotX] = useState<number>(-7);
  const [autoSpin, setAutoSpin] = useState<boolean>(false);
  const [isInteracting, setIsInteracting] = useState<boolean>(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => {
      setReducedMotion(preference.matches);
      if (preference.matches) setAutoSpin(false);
    };
    updatePreference();
    preference.addEventListener("change", updatePreference);
    return () => preference.removeEventListener("change", updatePreference);
  }, []);

  // Subtle entrance / model change pose
  useEffect(() => {
    if (!autoSpin && !isInteracting) {
      setRotY((prev) => (Math.abs(prev) < 15 ? 32 : prev));
    }
  }, [model.id, finish.id, autoSpin, isInteracting]);

  // Optional continuous 360 turntable spin
  useEffect(() => {
    if (!autoSpin || isInteracting || reducedMotion) return;
    let raf = 0;
    const step = () => {
      setRotY((prev) => {
        const next = prev + 0.75;
        return next > 180 ? next - 360 : next;
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [autoSpin, isInteracting, reducedMotion]);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reducedMotion || (e.target as HTMLElement).closest("button, input")) return;
    const drag = dragRef.current;
    if (drag && drag.pointerId === e.pointerId) {
      const deltaX = e.clientX - drag.x;
      const deltaY = e.clientY - drag.y;
      drag.x = e.clientX;
      drag.y = e.clientY;
      setRotY((current) => current + deltaX * 0.8);
      setRotX((current) => Math.max(-30, Math.min(30, current - deltaY * 0.2)));
      return;
    }
    if (e.pointerType === "touch") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const normX = (e.clientX - rect.left) / rect.width; // 0 to 1
    const normY = (e.clientY - rect.top) / rect.height; // 0 to 1
    // Map horizontal pointer across full 360 degrees (-180deg to +180deg) so user sees front, sides, and back cameras
    const nextY = (normX - 0.5) * 340;
    const nextX = (0.5 - normY) * 32;
    setIsInteracting(true);
    setAutoSpin(false);
    setRotY(Number(nextY.toFixed(1)));
    setRotX(Number(nextX.toFixed(1)));
  };

  const handlePointerLeave = () => {
    if (!dragRef.current) setIsInteracting(false);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch" || reducedMotion || (event.target as HTMLElement).closest("button, input") || event.button !== 0) return;
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    setAutoSpin(false);
    setIsInteracting(true);
  };

  const finishDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setIsInteracting(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const setPresetAngle = (targetY: number, targetX = -6) => {
    setAutoSpin(false);
    setIsInteracting(false);
    setRotY(targetY);
    setRotX(targetX);
  };

  const isProMaxOrPlus =
    model.tier === "promax" || model.tier === "plus" || model.tier === "air";

  return (
    <div
      className={compact ? "iphone3d-stage compact" : "iphone3d-stage"}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onLostPointerCapture={finishDrag}
      onPointerLeave={handlePointerLeave}
      style={
        {
          "--body-hex": finish.bodyHex,
          "--frame-hex": finish.frameHex,
          "--accent-hex": finish.accentHex,
          "--screen-glow": finish.screenGlow,
        } as React.CSSProperties
      }
    >
      {/* Top Studio HUD */}
      <div className="iphone3d-hud-top">
        <span className="iphone3d-badge">
          <Sparkles size={12} /> Modelo ilustrativo · Arraste para girar
        </span>
        <button
          type="button"
          className={autoSpin ? "iphone3d-spin-btn active" : "iphone3d-spin-btn"}
          disabled={reducedMotion}
          aria-pressed={autoSpin}
          onClick={(e) => {
            e.stopPropagation();
            setAutoSpin((prev) => !prev);
          }}
        >
          <RotateCw size={12} /> {autoSpin ? "Girando 360°" : "Auto-Giro"}
        </button>
      </div>

      {/* 3D Perspective Viewport */}
      <div className="iphone3d-viewport">
        <div
          className={
            isProMaxOrPlus
              ? "iphone3d-rig iphone3d-rig-large"
              : "iphone3d-rig"
          }
          style={{
            transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`,
          }}
        >
          {/* Metallic Depth Extrusion Layers */}
          {[-7, -5, -3, -1, 1, 3, 5, 7].map((zOffset) => (
            <div
              key={zOffset}
              className="iphone3d-slice"
              style={{
                transform: `translateZ(${zOffset}px)`,
              }}
            />
          ))}

          {/* Side Rails (Left & Right Titanium/Aluminum Frames with Buttons) */}
          <div className="iphone3d-rail-left">
            <span className="rail-btn rail-btn-action" />
            <span className="rail-btn rail-btn-vol" />
            <span className="rail-btn rail-btn-vol" />
          </div>
          <div className="iphone3d-rail-right">
            <span className="rail-btn rail-btn-power" />
            {model.generation >= 16 && (
              <span className="rail-btn rail-btn-capture" />
            )}
          </div>

          {/* FRONT FACE (Screen + Dynamic Island / Notch + Live Wallpaper) */}
          <div className="iphone3d-face iphone3d-front">
            <div className="iphone3d-screen">
              <div className="iphone3d-wallpaper-aurora" />
              <div className="iphone3d-wallpaper-grid" />

              {model.frontFeature === "notch" ? (
                <div className="iphone3d-notch">
                  <span className="sensor-speaker" />
                  <span className="sensor-cam" />
                </div>
              ) : (
                <div className="iphone3d-island">
                  <span className="sensor-pill" />
                  <span className="sensor-cam" />
                </div>
              )}

              <div className="iphone3d-lockscreen">
                <span className="lock-gen">WPLAY · {model.chipset}</span>
                <strong className="lock-model">{model.shortName}</strong>
                <span className="lock-meta">
                  {storage} · {finish.name}
                </span>
              </div>

              <div className="iphone3d-screen-footer">
                <span>{model.displaySize}</span>
                <span className="home-bar" />
                <span>5G</span>
              </div>
            </div>
          </div>

          {/* BACK FACE (Matte Glass + Accurate Camera Module for 13 to 18 Pro Max) */}
          <div className="iphone3d-face iphone3d-back">
            <div className="iphone3d-back-sheen" />

            {/* Camera Module */}
            <div
              className={`iphone3d-cam-island layout-${model.cameraLayout}`}
            >
              {model.cameraLayout === "diagonal-dual" && (
                <>
                  <div className="cam-lens lens-tl" />
                  <div className="cam-lens lens-br" />
                  <div className="cam-flash flash-tr" />
                  <div className="cam-mic mic-bl" />
                </>
              )}

              {model.cameraLayout === "vertical-dual" && (
                <div className="cam-vertical-pill">
                  <div className="cam-lens" />
                  <div className="cam-lens" />
                  <div className="cam-flash-side" />
                </div>
              )}

              {model.cameraLayout === "single-bar" && (
                <div className="cam-air-bar">
                  <div className="cam-lens" />
                  <div className="cam-air-mesh" />
                  <div className="cam-flash" />
                </div>
              )}

              {model.cameraLayout === "pro-triple" && (
                <>
                  <div className="cam-lens lens-pro-tl" />
                  <div className="cam-lens lens-pro-bl" />
                  <div className="cam-lens lens-pro-r" />
                  <div className="cam-flash lens-pro-flash" />
                  <div className="cam-lidar lens-pro-lidar" />
                </>
              )}

              {model.cameraLayout === "pro-plateau" && (
                <div className="cam-pro-plateau-bar">
                  <div className="plateau-lenses">
                    <div className="cam-lens lens-sm" />
                    <div className="cam-lens lens-sm" />
                    <div className="cam-lens lens-sm" />
                  </div>
                  <div className="plateau-sensors">
                    <div className="cam-flash" />
                    <div className="cam-lidar" />
                    <span className="plateau-tag">PRO</span>
                  </div>
                </div>
              )}
            </div>

            {/* Center MagSafe Ring & Brand Mark */}
            <div className="iphone3d-magsafe">
              <div className="magsafe-circle">
                <span>W</span>
              </div>
              <div className="magsafe-tail" />
            </div>

            <div className="iphone3d-back-label">
              <strong>{model.name}</strong>
              <span>
                {storage} · {finish.name}
              </span>
            </div>
          </div>
        </div>

        {/* Studio Floor Shadow & Neon Reflection */}
        <div className="iphone3d-floor-shadow" />
      </div>

      {/* Angle Quick Controls + Interactive Degree Scrubber */}
      <div className="iphone3d-controls">
        <div className="iphone3d-angle-pills">
          <button
            type="button"
            className={Math.abs(rotY) < 45 ? "active" : ""}
            onClick={() => setPresetAngle(24, -6)}
          >
            Frente
          </button>
          <button
            type="button"
            className={Math.abs(rotY) >= 45 && Math.abs(rotY) < 135 ? "active" : ""}
            onClick={() => setPresetAngle(78, -4)}
          >
            Lateral
          </button>
          <button
            type="button"
            className={Math.abs(rotY) >= 135 ? "active" : ""}
            onClick={() => setPresetAngle(162, -6)}
          >
            Traseira
          </button>
        </div>

        <div className="iphone3d-scrubber">
          <span>Ângulo: {Math.round(rotY)}°</span>
          <input
            type="range"
            min={-180}
            max={180}
            value={rotY}
            aria-label="Girar aparelho em 360 graus"
            onChange={(e) => {
              setAutoSpin(false);
              setRotY(Number(e.target.value));
            }}
          />
        </div>
      </div>
    </div>
  );
}

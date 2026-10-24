"use client";

import { useEffect, useRef } from "react";

export function StoreAtmosphere({ paused }: { paused: boolean }) {
  const atmosphereRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const atmosphere = atmosphereRef.current;
    if (!atmosphere) return;
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointerPreference = window.matchMedia("(hover: hover) and (pointer: fine)");
    let animationFrame = 0;
    let offsetX = 0;
    let offsetY = 0;

    const resetPointer = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      atmosphere.style.setProperty("--ambient-pointer-x", "0px");
      atmosphere.style.setProperty("--ambient-pointer-y", "0px");
    };

    const syncPreference = () => {
      atmosphere.dataset.suspended = String(document.hidden || motionPreference.matches);
      resetPointer();
    };

    const updatePointer = () => {
      animationFrame = 0;
      atmosphere.style.setProperty("--ambient-pointer-x", `${offsetX.toFixed(1)}px`);
      atmosphere.style.setProperty("--ambient-pointer-y", `${offsetY.toFixed(1)}px`);
    };

    const handlePointer = (event: PointerEvent) => {
      if (paused || document.hidden || motionPreference.matches || !pointerPreference.matches) return;
      offsetX = (event.clientX / window.innerWidth - 0.5) * 90;
      offsetY = (event.clientY / window.innerHeight - 0.5) * 65;
      if (!animationFrame) animationFrame = requestAnimationFrame(updatePointer);
    };

    syncPreference();
    document.addEventListener("visibilitychange", syncPreference);
    document.documentElement.addEventListener("pointerleave", resetPointer);
    window.addEventListener("pointermove", handlePointer, { passive: true });
    motionPreference.addEventListener("change", syncPreference);
    pointerPreference.addEventListener("change", syncPreference);
    return () => {
      resetPointer();
      document.removeEventListener("visibilitychange", syncPreference);
      document.documentElement.removeEventListener("pointerleave", resetPointer);
      window.removeEventListener("pointermove", handlePointer);
      motionPreference.removeEventListener("change", syncPreference);
      pointerPreference.removeEventListener("change", syncPreference);
    };
  }, [paused]);

  return (
    <div ref={atmosphereRef} className="chromatic-backdrop store-atmosphere" data-paused={paused} aria-hidden="true">
      <div className="atmosphere-scene" />
      <div className="atmosphere-light atmosphere-light-lime" />
      <div className="atmosphere-light atmosphere-light-emerald" />
      <div className="atmosphere-pointer" />
      <div className="atmosphere-vignette" />
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";

export type InstallPlatform = "android" | "ios";

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function detectInstallPlatform(
  device: Pick<Navigator, "userAgent" | "platform" | "maxTouchPoints">
): InstallPlatform {
  return /iPad|iPhone|iPod/i.test(device.userAgent) ||
    (device.platform === "MacIntel" && device.maxTouchPoints > 1)
    ? "ios"
    : "android";
}

export function isStandaloneApp(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export function isInAppBrowser(ua?: string): boolean {
  if (typeof window === "undefined" && !ua) return false;
  const userAgent = ua || (typeof navigator !== "undefined" ? navigator.userAgent : "");
  return /Instagram|FBAN|FBAV|BytedanceWebview|musical_ly|TikTok|Line\/|Snapchat/i.test(
    userAgent
  );
}

export function getInAppBrowserName(ua?: string): string | null {
  if (typeof window === "undefined" && !ua) return null;
  const userAgent = ua || (typeof navigator !== "undefined" ? navigator.userAgent : "");
  if (/Instagram/i.test(userAgent)) return "Instagram";
  if (/FBAN|FBAV/i.test(userAgent)) return "Facebook";
  if (/BytedanceWebview|musical_ly|TikTok/i.test(userAgent)) return "TikTok";
  if (/Line\//i.test(userAgent)) return "Line";
  if (/Snapchat/i.test(userAgent)) return "Snapchat";
  if (/wv|WebView/i.test(userAgent)) return "Navegador interno";
  return null;
}

export function useAppInstall() {
  const [isStandalone, setIsStandalone] = useState(false);
  const [platform, setPlatform] = useState<InstallPlatform>("android");
  const [inApp, setInApp] = useState(false);
  const [inAppName, setInAppName] = useState<string | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [initialModalPlatform, setInitialModalPlatform] = useState<InstallPlatform | undefined>(
    undefined
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const standalone = isStandaloneApp();
    setIsStandalone(standalone);
    setPlatform(detectInstallPlatform(navigator));
    setInApp(isInAppBrowser(navigator.userAgent));
    setInAppName(getInAppBrowserName(navigator.userAgent));

    const displayModeMedia = window.matchMedia("(display-mode: standalone)");
    const handleDisplayChange = (e: MediaQueryListEvent) => {
      setIsStandalone(e.matches || isStandaloneApp());
    };
    displayModeMedia.addEventListener("change", handleDisplayChange);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      if (!isStandaloneApp()) {
        setDeferredPrompt(e as BeforeInstallPromptEvent);
      }
    };

    const handleAppInstalled = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
      setIsInstallModalOpen(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      displayModeMedia.removeEventListener("change", handleDisplayChange);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const triggerNativePrompt = useCallback(async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    if (!deferredPrompt) return "unavailable";
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setDeferredPrompt(null);
        setIsStandalone(true);
        setIsInstallModalOpen(false);
      }
      return choice.outcome;
    } catch {
      return "unavailable";
    }
  }, [deferredPrompt]);

  const openInstallModal = useCallback(
    (targetPlatform?: InstallPlatform) => {
      setInitialModalPlatform(targetPlatform || platform);
      setIsInstallModalOpen(true);
    },
    [platform]
  );

  const closeInstallModal = useCallback(() => {
    setIsInstallModalOpen(false);
  }, []);

  return {
    isStandalone,
    isIos: platform === "ios",
    isAndroid: platform === "android",
    platform,
    isInApp: inApp,
    inAppBrowserName: inAppName,
    hasNativePrompt: Boolean(deferredPrompt),
    triggerNativePrompt,
    isInstallModalOpen,
    initialModalPlatform,
    openInstallModal,
    closeInstallModal,
  };
}

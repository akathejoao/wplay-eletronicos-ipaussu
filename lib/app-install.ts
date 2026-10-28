export type InstallPlatform = "android" | "ios";

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function detectInstallPlatform(device: Pick<Navigator, "userAgent" | "platform" | "maxTouchPoints">): InstallPlatform {
  return /iPad|iPhone|iPod/i.test(device.userAgent) ||
    (device.platform === "MacIntel" && device.maxTouchPoints > 1)
    ? "ios"
    : "android";
}

export function isStandaloneApp(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

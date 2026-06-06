// VAPID public keys are base64url; the Push API wants a Uint8Array.
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export type PushEnvironment = {
  // Push API actually usable (Android/desktop always; iOS only in installed PWA).
  pushAvailable: boolean;
  isStandalone: boolean;
  isIOS: boolean;
};

export function detectPushEnvironment(): PushEnvironment {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { pushAvailable: false, isStandalone: false, isIOS: false };
  }
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  const isIOS =
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPadOS reports as Mac; detect touch to disambiguate.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  // On iOS Safari tabs, PushManager is absent — the signal to "install first".
  const pushAvailable =
    "serviceWorker" in navigator && "PushManager" in window;
  return { pushAvailable, isStandalone, isIOS };
}

import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";
import { writeActiveBabyId } from "~/lib/baby/active";

const HEX_24 = /^[a-fA-F0-9]{24}$/;

// Notification deep-link: the SW opens `/?baby=<id>`. The app picks the active
// baby from localStorage (x-active-baby-id), and nothing reads `?baby=` on its
// own — so without this, the click would land on the previously-active baby.
// Run BEFORE hydration so the first clientLoader already sees the right baby.
function captureBabyFromUrl() {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const baby = params.get("baby");
    if (baby && HEX_24.test(baby)) {
      writeActiveBabyId(baby);
      params.delete("baby");
      const qs = params.toString();
      const clean = window.location.pathname + (qs ? `?${qs}` : "");
      window.history.replaceState(null, "", clean);
    }
  } catch {
    /* URL/history unavailable — ignore */
  }
}

function registerServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }
  const register = () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("[sw] registration failed", err);
    });
  };
  // This module runs at hydration, by which point `load` has usually already
  // fired — so an addEventListener("load") callback would never run. Register
  // immediately if the document is ready, otherwise wait for load.
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}

captureBabyFromUrl();
registerServiceWorker();

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>,
  );
});

const GOOGLE_MAPS_URL_BASE = "https://maps.googleapis.com/maps/api/js";

const LIBRARIES = ["places"];

let loadPromise: Promise<typeof google> | null = null;

declare global {
  interface Window {
    __googleMapsLoadPromise__?: Promise<typeof google>;
  }
}

function createScriptSrc(apiKey: string) {
  const params = new URLSearchParams({
    key: apiKey,
    libraries: LIBRARIES.join(","),
    v: "weekly",
    language: "vi",
  });
  return `${GOOGLE_MAPS_URL_BASE}?${params.toString()}`;
}

export function loadGoogleMapsPlaces(): Promise<typeof google> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps loader should only run in the browser"));
  }

  if (window.google?.maps?.places) {
    return Promise.resolve(window.google);
  }

  if (window.__googleMapsLoadPromise__) {
    return window.__googleMapsLoadPromise__;
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return Promise.reject(new Error("Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"));
  }

  loadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-google-maps]");
    if (existing) {
      if (window.google?.maps?.places) {
        resolve(window.google);
        return;
      }
      existing.addEventListener("load", () => {
        if (window.google?.maps?.places) {
          resolve(window.google);
        } else {
          reject(new Error("Google Maps script loaded without places library"));
        }
      });
      existing.addEventListener("error", () => {
        window.__googleMapsLoadPromise__ = undefined;
        reject(new Error("Failed to load Google Maps script"));
      });
      return;
    }

    const script = document.createElement("script");
    script.src = createScriptSrc(apiKey);
    script.async = true;
    script.defer = true;
    script.dataset.googleMaps = "true";
    script.onerror = () => {
      window.__googleMapsLoadPromise__ = undefined;
      reject(new Error("Failed to load Google Maps script"));
    };
    script.onload = () => {
      if (window.google?.maps?.places) {
        resolve(window.google);
      } else {
        window.__googleMapsLoadPromise__ = undefined;
        reject(new Error("Google Maps script loaded without places library"));
      }
    };

    document.head.appendChild(script);
  });

  window.__googleMapsLoadPromise__ = loadPromise;
  return loadPromise;
}

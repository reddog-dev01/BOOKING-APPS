const GOOGLE_MAPS_URL_BASE = "https://maps.googleapis.com/maps/api/js";

const LIBRARIES = ["places"];
const CALLBACK_NAME = "__initGoogleMapsPlaces__";
const MISSING_PLACES_ERROR =
  "Google Maps script đã tải nhưng thiếu Places library. Hãy xác nhận tham số libraries=places và quyền truy cập Places API.";

declare global {
  interface Window {
    __googleMapsLoadPromise__?: Promise<any>;
    gm_authFailure?: () => void;
    __initGoogleMapsPlaces__?: () => void;
    google?: any;
  }
}

function createScriptSrc(apiKey: string) {
  const params = new URLSearchParams({
    key: apiKey,
    libraries: LIBRARIES.join(","),
    v: "weekly",
    language: "vi",
    loading: "async",
    callback: CALLBACK_NAME,
  });
  return `${GOOGLE_MAPS_URL_BASE}?${params.toString()}`;
}

function findExistingScript() {
  return (
    document.querySelector<HTMLScriptElement>("script[data-google-maps]") ??
    null
  );
}

export function loadGoogleMapsPlaces(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(
      new Error("Google Maps loader should only run in the browser")
    );
  }

  if (window.google?.maps?.places) {
    return Promise.resolve(window.google);
  }

  if (window.__googleMapsLoadPromise__) {
    return window.__googleMapsLoadPromise__;
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return Promise.reject(
      new Error("Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY")
    );
  }

  const loadPromise = new Promise<any>((resolve, reject) => {
    const existing = findExistingScript();
    const scriptEl = existing ?? document.createElement("script");

    const previousCallback = window[CALLBACK_NAME];
    const previousAuthFailure = window.gm_authFailure;

    function cleanup() {
      if (previousCallback) {
        window[CALLBACK_NAME] = previousCallback;
      } else {
        delete window[CALLBACK_NAME];
      }

      if (previousAuthFailure) {
        window.gm_authFailure = previousAuthFailure;
      } else {
        delete window.gm_authFailure;
      }
    }

    let settled = false;
    let fallbackTimeout: number | null = null;

    const clearFallback = () => {
      if (fallbackTimeout !== null) {
        window.clearTimeout(fallbackTimeout);
        fallbackTimeout = null;
      }
    };

    const setState = (state: "loading" | "ready" | "error") => {
      scriptEl.dataset.googleMapsState = state;
      if (state !== "error") {
        delete scriptEl.dataset.googleMapsError;
      }
    };

    const markError = (message: string) => {
      scriptEl.dataset.googleMapsState = "error";
      scriptEl.dataset.googleMapsError = message;
    };

    const resolveWith = (googleObject: any) => {
      if (settled) return;
      settled = true;
      clearFallback();
      setState("ready");
      cleanup();
      resolve(googleObject);
    };

    const rejectWith = (message: string) => {
      if (settled) return;
      settled = true;
      clearFallback();
      markError(message);
      cleanup();
      window.__googleMapsLoadPromise__ = undefined;
      reject(new Error(message));
    };

    const startFallback = (delay: number, message = MISSING_PLACES_ERROR) => {
      clearFallback();
      fallbackTimeout = window.setTimeout(() => {
        if (!window.google?.maps?.places) {
          rejectWith(message);
        }
      }, delay);
    };

    window.gm_authFailure = () => {
      rejectWith(
        "Google Maps API key bị từ chối. Kiểm tra hạn mức Billing, domain được phép và đảm bảo đã bật Places API."
      );
    };

    window[CALLBACK_NAME] = () => {
      const googleObject = window.google;
      if (!googleObject?.maps) {
        rejectWith(
          "Google Maps SDK không khả dụng sau khi tải. Vui lòng kiểm tra lại cấu hình API key."
        );
        return;
      }

      const ensurePlacesLibrary = async () => {
        if (!googleObject.maps.places && typeof googleObject.maps.importLibrary === "function") {
          await googleObject.maps.importLibrary("places");
        }

        if (!googleObject.maps.places) {
          throw new Error(MISSING_PLACES_ERROR);
        }
      };

      ensurePlacesLibrary()
        .then(() => {
          resolveWith(googleObject);
        })
        .catch((err) => {
          rejectWith(
            err instanceof Error
              ? err.message
              : "Không thể khởi tạo Google Maps Places library."
          );
        });
    };

    const attachListeners = (script: HTMLScriptElement) => {
      script.addEventListener("error", () => {
        rejectWith("Failed to load Google Maps script");
      });

      script.addEventListener("load", () => {
        if (window.google?.maps?.places) {
          resolveWith(window.google);
          return;
        }

        startFallback(2500);
      });
    };

    attachListeners(scriptEl);

    if (existing) {
      if (scriptEl.dataset.googleMapsState === "error") {
        rejectWith(scriptEl.dataset.googleMapsError ?? MISSING_PLACES_ERROR);
        return;
      }

      if (window.google?.maps?.places) {
        resolveWith(window.google);
        return;
      }

      if (!scriptEl.dataset.googleMapsState) {
        setState("loading");
      }

      startFallback(1500);
      return;
    }

    setState("loading");
    scriptEl.src = createScriptSrc(apiKey);
    scriptEl.async = true;
    scriptEl.defer = true;
    scriptEl.dataset.googleMaps = "true";

    document.head.appendChild(scriptEl);
    startFallback(3000);
  });

  window.__googleMapsLoadPromise__ = loadPromise;
  return loadPromise;
}

"use client";

import React, {
  FocusEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { loadGoogleMapsPlaces } from "../lib/googleMapsLoader";
import {
  fetchAutocomplete as fetchRestAutocomplete,
  fetchPlaceDetails as fetchRestPlaceDetails,
} from "../lib/googlePlacesRest";

type AddressValue = { text: string; lat?: number; lng?: number };

type Prediction = {
  description: string;
  place_id: string;
  structured_formatting: {
    main_text: string;
    secondary_text?: string;
  };
};

type AddressInputProps = {
  value: string;
  placeholder?: string;
  disabled?: boolean;
  inputClassName?: string;
  inputRef?: React.Ref<HTMLInputElement> | React.RefObject<HTMLInputElement | null>;
  onChange: (v: AddressValue) => void;
};

const COUNTRIES = ["vn"];
const DEBOUNCE_MS = 250;
const COUNTRY_CODE = "VN";
const LANGUAGE_CODE = "vi";
type LoaderMode = "sdk" | "rest";
const STATUS_ERROR_MESSAGES: Partial<Record<string, string>> = {
  REQUEST_DENIED:
    "Google Maps từ chối yêu cầu. Kiểm tra API key, hạn mức Billing và quyền Places API.",
  OVER_QUERY_LIMIT:
    "Quá giới hạn truy vấn Google Maps. Vui lòng thử lại sau ít phút.",
  INVALID_REQUEST: "Tham số tìm kiếm chưa hợp lệ. Vui lòng nhập lại địa chỉ.",
  UNKNOWN_ERROR:
    "Google Maps gặp sự cố tạm thời. Thử tìm lại sau giây lát.",
};

function setExternalRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (!ref) return;
  if (typeof ref === "function") {
    (ref as (val: T | null) => void)(value);
  } else {
    (ref as React.MutableRefObject<T | null>).current = value;
  }
}

function getGoogle() {
  if (typeof window === "undefined") return undefined;
  return (window as typeof window & { google?: any }).google;
}

const AddressInput = React.forwardRef<HTMLInputElement, AddressInputProps>(
  ({ value, placeholder, disabled, inputClassName, inputRef, onChange }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const internalInputRef = useRef<HTMLInputElement | null>(null);
    const placesServiceContainerRef = useRef<HTMLDivElement | null>(null);

    const autocompleteServiceRef = useRef<any>(null);
    const placesServiceRef = useRef<any>(null);
    const sessionTokenRef = useRef<any>(null);
    const restSessionTokenRef = useRef<string | null>(null);
    const latestQueryRef = useRef<string>("");

    const [mode, setMode] = useState<LoaderMode>("sdk");
    const [ready, setReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [suggestions, setSuggestions] = useState<Prediction[]>([]);
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);

    const debounceRef = useRef<number | null>(null);

    const ensureSdkSessionToken = useCallback(() => {
      const google = getGoogle();
      if (!google?.maps?.places) return null;
      if (!sessionTokenRef.current) {
        sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
      }
      return sessionTokenRef.current;
    }, []);

    const ensureRestSessionToken = useCallback(() => {
      if (!restSessionTokenRef.current) {
        restSessionTokenRef.current =
          globalThis.crypto?.randomUUID?.() ??
          `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      }
      return restSessionTokenRef.current;
    }, []);

    useEffect(() => {
      setExternalRef(inputRef as any, internalInputRef.current);
    }, [inputRef]);

    useEffect(() => {
      if (typeof window === "undefined") return;
      let cancelled = false;

      loadGoogleMapsPlaces()
        .then((google) => {
          if (cancelled) return;
          if (!google?.maps?.places?.AutocompleteService) {
            console.warn(
              "Google Maps Places SDK loaded but missing AutocompleteService. Falling back to REST API."
            );
            setMode("rest");
            setReady(true);
            setError(null);
            return;
          }

          autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
          const host = document.createElement("div");
          placesServiceContainerRef.current = host;
          placesServiceRef.current = new google.maps.places.PlacesService(host);
          sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
          restSessionTokenRef.current = null;
          setMode("sdk");
          setReady(true);
          setError(null);
        })
        .catch((err) => {
          if (cancelled) return;
          console.warn("Falling back to Google Places REST API", err);
          const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
          if (!apiKey) {
            setError(
              err instanceof Error
                ? err.message
                : "Không thể khởi tạo Google Maps." 
            );
            setReady(false);
            return;
          }
          setMode("rest");
          restSessionTokenRef.current = null;
          setReady(true);
          setError(null);
        });

      return () => {
        cancelled = true;
        if (placesServiceContainerRef.current?.parentNode) {
          placesServiceContainerRef.current.parentNode.removeChild(
            placesServiceContainerRef.current
          );
        }
      };
    }, []);

    const clearSuggestions = useCallback(() => {
      setSuggestions([]);
      setOpen(false);
      setActiveIndex(-1);
    }, []);

    const fetchPredictions = useCallback(
      async (query: string) => {
        const trimmed = query.trim();
        latestQueryRef.current = trimmed;
        if (!trimmed) {
          clearSuggestions();
          setError(null);
          return;
        }

        setError(null);

        if (mode === "sdk") {
          const google = getGoogle();
          if (!ready || !autocompleteServiceRef.current || !google?.maps?.places) {
            return;
          }
          const token = ensureSdkSessionToken();
          autocompleteServiceRef.current.getPlacePredictions(
            {
              input: trimmed,
              language: LANGUAGE_CODE,
              sessionToken: token ?? undefined,
              componentRestrictions: { country: COUNTRIES },
            },
            (predictions: any[] | null, status: any) => {
              const googleLocal = getGoogle();
              if (!googleLocal?.maps?.places) {
                return;
              }
              const okStatus = googleLocal.maps.places.PlacesServiceStatus.OK;
              if (status === okStatus && predictions && predictions.length > 0) {
                setSuggestions(predictions as Prediction[]);
                setOpen(true);
                setActiveIndex(-1);
              } else {
                clearSuggestions();
                const zeroResults =
                  googleLocal.maps.places.PlacesServiceStatus.ZERO_RESULTS;
                if (status === zeroResults) {
                  setError(null);
                  return;
                }

                const statusKey = typeof status === "string" ? status : String(status);
                const customMessage = STATUS_ERROR_MESSAGES[statusKey];
                setError(
                  customMessage ?? `Không thể gợi ý địa chỉ (mã lỗi: ${statusKey}).`
                );
              }
            }
          );
          return;
        }

        try {
          const token = ensureRestSessionToken();
          const predictions = await fetchRestAutocomplete(
            trimmed,
            token ?? undefined,
            COUNTRY_CODE,
            LANGUAGE_CODE
          );

          if (latestQueryRef.current !== trimmed) {
            return;
          }

          if (predictions.length === 0) {
            clearSuggestions();
            return;
          }

          const normalized: Prediction[] = predictions.map((p) => ({
            description: p.description || p.mainText,
            place_id: p.placeId,
            structured_formatting: {
              main_text: p.mainText,
              secondary_text: p.secondaryText,
            },
          }));
          setSuggestions(normalized);
          setOpen(true);
          setActiveIndex(-1);
        } catch (err) {
          clearSuggestions();
          const message =
            err instanceof Error
              ? err.message
              : "Không thể gợi ý địa chỉ từ Google.";
          setError(message);
        }
      },
      [
        clearSuggestions,
        ensureRestSessionToken,
        ensureSdkSessionToken,
        mode,
        ready,
      ]
    );

    const scheduleFetch = useCallback(
      (query: string) => {
        if (debounceRef.current) {
          window.clearTimeout(debounceRef.current);
        }
        if (!ready) return;
        debounceRef.current = window.setTimeout(() => {
          fetchPredictions(query).catch((err) => {
            console.error("Google Places prediction error", err);
          });
        }, DEBOUNCE_MS);
      },
      [fetchPredictions, ready]
    );

    useEffect(() => {
      return () => {
        if (debounceRef.current) {
          window.clearTimeout(debounceRef.current);
        }
      };
    }, []);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (!containerRef.current) return;
        if (!containerRef.current.contains(event.target as Node)) {
          clearSuggestions();
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [clearSuggestions]);

    const mergeRef = useCallback(
      (node: HTMLInputElement | null) => {
        internalInputRef.current = node;
        setExternalRef(ref, node);
        setExternalRef(inputRef as any, node);
      },
      [ref, inputRef]
    );

    const handleInputChange = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        const next = event.target.value;
        onChange({ text: next });
        if (!ready) return;
        scheduleFetch(next);
      },
      [onChange, ready, scheduleFetch]
    );

    const resolvePlaceDetails = useCallback(
      (prediction: Prediction) => {
        if (mode === "sdk") {
          const google = getGoogle();
          if (!placesServiceRef.current || !google?.maps?.places) {
            onChange({ text: prediction.description });
            return;
          }

          const token = ensureSdkSessionToken();
          placesServiceRef.current.getDetails(
            {
              placeId: prediction.place_id,
              sessionToken: token ?? undefined,
              fields: ["geometry", "formatted_address", "name"],
            },
            (place: any, status: any) => {
              const googleLocal = getGoogle();
              if (googleLocal?.maps?.places && status !== googleLocal.maps.places.PlacesServiceStatus.OK) {
                const statusKey = typeof status === "string" ? status : String(status);
                const customMessage = STATUS_ERROR_MESSAGES[statusKey];
                if (customMessage) {
                  setError(customMessage);
                } else {
                  setError(`Không thể lấy chi tiết địa điểm (mã lỗi: ${statusKey}).`);
                }
                onChange({ text: prediction.description });
                return;
              }
              if (!place) {
                onChange({ text: prediction.description });
                return;
              }
              const location = place.geometry?.location;
              if (location) {
                onChange({
                  text: place.formatted_address ?? prediction.description,
                  lat: location.lat(),
                  lng: location.lng(),
                });
              } else {
                onChange({ text: place.formatted_address ?? prediction.description });
              }
              setError(null);
              sessionTokenRef.current = null;
            }
          );
          return;
        }

        const token = ensureRestSessionToken();
        fetchRestPlaceDetails(
          prediction.place_id,
          token ?? undefined,
          LANGUAGE_CODE
        )
          .then((details) => {
            const text =
              details.formattedAddress ?? details.name ?? prediction.description;
            onChange({
              text,
              lat: details.lat,
              lng: details.lng,
            });
            setError(null);
            restSessionTokenRef.current = null;
          })
          .catch((err) => {
            setError(
              err instanceof Error
                ? err.message
                : "Không thể lấy chi tiết địa điểm."
            );
            onChange({ text: prediction.description });
          });
      },
      [ensureRestSessionToken, ensureSdkSessionToken, mode, onChange, setError]
    );

    const selectPrediction = useCallback(
      (prediction: Prediction) => {
        clearSuggestions();
        const description = prediction.description;
        onChange({ text: description });
        if (internalInputRef.current) {
          internalInputRef.current.value = description;
        }
        resolvePlaceDetails(prediction);
      },
      [clearSuggestions, onChange, resolvePlaceDetails]
    );

    const handleKeyDown = useCallback(
      (event: KeyboardEvent<HTMLInputElement>) => {
        if (!open || suggestions.length === 0) return;

        if (event.key === "ArrowDown") {
          event.preventDefault();
          const next = (activeIndex + 1) % suggestions.length;
          setActiveIndex(next);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          const next = (activeIndex - 1 + suggestions.length) % suggestions.length;
          setActiveIndex(next);
        } else if (event.key === "Enter") {
          if (activeIndex >= 0 && activeIndex < suggestions.length) {
            event.preventDefault();
            selectPrediction(suggestions[activeIndex]);
          }
        } else if (event.key === "Escape") {
          clearSuggestions();
        }
      },
      [activeIndex, clearSuggestions, open, selectPrediction, suggestions]
    );

    const handleFocus = useCallback(
      (_event: FocusEvent<HTMLInputElement>) => {
        if (suggestions.length > 0) {
          setOpen(true);
        }
      },
      [suggestions.length]
    );

    const highlightedId = activeIndex >= 0 ? `suggestion-${activeIndex}` : undefined;

    return (
      <div ref={containerRef} className="relative">
        <input
          ref={mergeRef}
          disabled={disabled}
          className={inputClassName}
          placeholder={placeholder}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-activedescendant={highlightedId}
        />

        {open && suggestions.length > 0 && (
          <ul
            role="listbox"
            className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg"
          >
            {suggestions.map((prediction, index) => {
              const active = index === activeIndex;
              const { main_text: mainText, secondary_text: secondaryText } =
                prediction.structured_formatting;
              return (
                <li key={prediction.place_id} role="option" aria-selected={active}>
                  <button
                    type="button"
                    className={`w-full px-3 py-2 text-left text-sm transition hover:bg-brand/10 focus:bg-brand/10 focus:outline-none ${
                      active ? "bg-brand/10" : ""
                    }`}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      selectPrediction(prediction);
                    }}
                    onMouseEnter={() => setActiveIndex(index)}
                    id={`suggestion-${index}`}
                  >
                    <div className="font-medium text-gray-900">{mainText}</div>
                    {secondaryText && (
                      <div className="text-xs text-gray-500">{secondaryText}</div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {error && (
          <p className="mt-1 text-xs text-rose-600" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

AddressInput.displayName = "AddressInput";

export type { AddressInputProps };
export default AddressInput;

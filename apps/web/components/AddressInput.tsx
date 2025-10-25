"use client";

import React, {
  FocusEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  fetchAutocomplete as fetchRestAutocomplete,
  fetchPlaceDetails as fetchRestPlaceDetails,
  type RestPrediction,
} from "../lib/googlePlacesRest";

type AddressValue = { text: string; lat?: number; lng?: number };

type AddressInputProps = {
  value: string;
  placeholder?: string;
  disabled?: boolean;
  inputClassName?: string;
  inputRef?: React.Ref<HTMLInputElement> | React.RefObject<HTMLInputElement | null>;
  onChange: (v: AddressValue) => void;
};

const DEBOUNCE_MS = 250;
const COUNTRY_CODE = "VN";
const LANGUAGE_CODE = "vi";

function setExternalRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (!ref) return;
  if (typeof ref === "function") {
    (ref as (val: T | null) => void)(value);
  } else {
    (ref as React.MutableRefObject<T | null>).current = value;
  }
}

const AddressInput = React.forwardRef<HTMLInputElement, AddressInputProps>(
  ({ value, placeholder, disabled, inputClassName, inputRef, onChange }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const internalInputRef = useRef<HTMLInputElement | null>(null);
    const restSessionTokenRef = useRef<string | null>(null);
    const latestQueryRef = useRef<string>("");

    const [ready, setReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [suggestions, setSuggestions] = useState<RestPrediction[]>([]);
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);

    const debounceRef = useRef<number | null>(null);

    const ensureRestSessionToken = useCallback(() => {
      if (!restSessionTokenRef.current) {
        restSessionTokenRef.current =
          globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      }
      return restSessionTokenRef.current;
    }, []);

    useEffect(() => {
      setExternalRef(inputRef as any, internalInputRef.current);
    }, [inputRef]);

    useEffect(() => {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        setError(
          "Thiếu NEXT_PUBLIC_GOOGLE_MAPS_API_KEY. Thiết lập API key Google Maps/Places để kích hoạt gợi ý."
        );
        setReady(false);
        return;
      }
      setReady(true);
      setError(null);
    }, []);

    const clearSuggestions = useCallback(() => {
      setSuggestions([]);
      setOpen(false);
      setActiveIndex(-1);
    }, []);

    const fetchPredictions = useCallback(
      async (query: string) => {
        if (!ready) return;
        const trimmed = query.trim();
        latestQueryRef.current = trimmed;
        if (!trimmed) {
          clearSuggestions();
          setError(null);
          return;
        }

        setError(null);

        try {
          const token = ensureRestSessionToken();
          const predictions = await fetchRestAutocomplete(
            trimmed,
            token ?? undefined,
            COUNTRY_CODE,
            LANGUAGE_CODE,
          );

          if (latestQueryRef.current !== trimmed) {
            return;
          }

          if (predictions.length === 0) {
            clearSuggestions();
            return;
          }

          setSuggestions(predictions);
          setOpen(true);
          setActiveIndex(-1);
        } catch (err) {
          clearSuggestions();
          const message =
            err instanceof Error ? err.message : "Không thể gợi ý địa chỉ từ Google.";
          setError(message);
        }
      },
      [clearSuggestions, ensureRestSessionToken, ready],
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
      [fetchPredictions, ready],
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
      [ref, inputRef],
    );

    const handleInputChange = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        const next = event.target.value;
        onChange({ text: next });
        if (!ready) return;
        scheduleFetch(next);
      },
      [onChange, ready, scheduleFetch],
    );

    const resolvePlaceDetails = useCallback(
      async (prediction: RestPrediction) => {
        const token = ensureRestSessionToken();
        try {
          const details = await fetchRestPlaceDetails(
            prediction.placeId,
            token ?? undefined,
            LANGUAGE_CODE,
          );
          onChange({
            text: details.formattedAddress ?? prediction.description ?? prediction.mainText,
            lat: details.lat,
            lng: details.lng,
          });
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "Không thể lấy chi tiết địa điểm.",
          );
          onChange({
            text: prediction.description ?? prediction.mainText,
          });
        } finally {
          restSessionTokenRef.current = null;
        }
      },
      [ensureRestSessionToken, onChange],
    );

    const selectPrediction = useCallback(
      (prediction: RestPrediction) => {
        clearSuggestions();
        const description = prediction.description ?? prediction.mainText;
        onChange({ text: description });
        if (internalInputRef.current) {
          internalInputRef.current.value = description;
        }
        resolvePlaceDetails(prediction).catch((err) => {
          console.error("Google Places detail error", err);
        });
      },
      [clearSuggestions, onChange, resolvePlaceDetails],
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
      [activeIndex, clearSuggestions, open, selectPrediction, suggestions],
    );

    const handleFocus = useCallback(
      (_event: FocusEvent<HTMLInputElement>) => {
        if (suggestions.length > 0) {
          setOpen(true);
        }
      },
      [suggestions.length],
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
              const mainText = prediction.mainText;
              const secondaryText = prediction.secondaryText;
              return (
                <li key={prediction.placeId} role="option" aria-selected={active}>
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
  },
);

AddressInput.displayName = "AddressInput";

export type { AddressInputProps };
export default AddressInput;

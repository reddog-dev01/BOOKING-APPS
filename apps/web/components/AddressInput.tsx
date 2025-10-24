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
  createSessionToken,
  fetchAutocompleteSuggestions,
  fetchPlaceDetails,
  PlacesApiError,
  type PlaceSuggestion,
} from "../lib/googlePlacesApi";

type AddressValue = { text: string; lat?: number; lng?: number };

type AddressInputProps = {
  value: string;
  placeholder?: string;
  disabled?: boolean;
  inputClassName?: string;
  inputRef?: React.Ref<HTMLInputElement> | React.RefObject<HTMLInputElement | null>;
  onChange: (v: AddressValue) => void;
};

const COUNTRIES = ["VN"];
const DEBOUNCE_MS = 250;

function setExternalRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (!ref) return;
  if (typeof ref === "function") {
    (ref as (val: T | null) => void)(value);
  } else if ("current" in (ref as React.MutableRefObject<T | null>)) {
    (ref as React.MutableRefObject<T | null>).current = value;
  }
}

const AddressInput = React.forwardRef<HTMLInputElement, AddressInputProps>(
  ({ value, placeholder, disabled, inputClassName, inputRef, onChange }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const internalInputRef = useRef<HTMLInputElement | null>(null);

    const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [error, setError] = useState<string | null>(null);

    const debounceRef = useRef<number | null>(null);
    const sessionTokenRef = useRef<string | null>(null);
    const requestCounterRef = useRef(0);

    useEffect(() => {
      setExternalRef(inputRef as any, internalInputRef.current);
    }, [inputRef]);

    const ensureSessionToken = useCallback(() => {
      if (!sessionTokenRef.current) {
        sessionTokenRef.current = createSessionToken();
      }
      return sessionTokenRef.current;
    }, []);

    const clearSuggestions = useCallback(() => {
      setSuggestions([]);
      setOpen(false);
      setActiveIndex(-1);
    }, []);

    const fetchPredictions = useCallback(
      async (query: string) => {
        const trimmed = query.trim();
        if (!trimmed) {
          clearSuggestions();
          setError(null);
          return;
        }

        setError(null);
        const token = ensureSessionToken();
        const requestId = ++requestCounterRef.current;
        try {
          const predictions = await fetchAutocompleteSuggestions(
            trimmed,
            token,
            "vi",
            COUNTRIES
          );
          if (requestCounterRef.current !== requestId) {
            return;
          }
          if (predictions.length > 0) {
            setSuggestions(predictions);
            setOpen(true);
            setActiveIndex(-1);
          } else {
            clearSuggestions();
          }
        } catch (err) {
          if (requestCounterRef.current !== requestId) {
            return;
          }
          clearSuggestions();
          if (err instanceof PlacesApiError) {
            setError(`Không thể gợi ý địa chỉ (${err.message}).`);
          } else {
            setError("Không thể gợi ý địa chỉ.");
          }
        }
      },
      [clearSuggestions, ensureSessionToken]
    );

    const scheduleFetch = useCallback(
      (query: string) => {
        if (debounceRef.current) {
          window.clearTimeout(debounceRef.current);
        }
        debounceRef.current = window.setTimeout(() => {
          void fetchPredictions(query);
        }, DEBOUNCE_MS);
      },
      [fetchPredictions]
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
        scheduleFetch(next);
      },
      [onChange, scheduleFetch]
    );

    const resolvePlaceDetails = useCallback(
      async (suggestion: PlaceSuggestion) => {
        const token = sessionTokenRef.current ?? undefined;
        try {
          const details = await fetchPlaceDetails(
            suggestion.placeId,
            "vi",
            COUNTRIES[0],
            token
          );
          if (!details) {
            onChange({ text: suggestion.description });
            return;
          }
          onChange({
            text: details.formattedAddress ?? suggestion.description,
            lat: details.lat,
            lng: details.lng,
          });
        } catch (err) {
          if (err instanceof PlacesApiError) {
            setError(`Không thể lấy chi tiết địa chỉ (${err.message}).`);
          }
          onChange({ text: suggestion.description });
        } finally {
          sessionTokenRef.current = null;
        }
      },
      [onChange]
    );

    const selectSuggestion = useCallback(
      (suggestion: PlaceSuggestion) => {
        clearSuggestions();
        onChange({ text: suggestion.description });
        void resolvePlaceDetails(suggestion);
      },
      [clearSuggestions, onChange, resolvePlaceDetails]
    );

    const handleKeyDown = useCallback(
      (event: KeyboardEvent<HTMLInputElement>) => {
        if (!open || suggestions.length === 0) return;

        if (event.key === "ArrowDown") {
          event.preventDefault();
          setActiveIndex((prev) => (prev + 1) % suggestions.length);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          setActiveIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        } else if (event.key === "Enter") {
          if (activeIndex >= 0 && activeIndex < suggestions.length) {
            event.preventDefault();
            selectSuggestion(suggestions[activeIndex]);
          }
        } else if (event.key === "Escape") {
          clearSuggestions();
        }
      },
      [activeIndex, clearSuggestions, open, selectSuggestion, suggestions]
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
            {suggestions.map((suggestion, index) => {
              const active = index === activeIndex;
              return (
                <li key={suggestion.placeId} role="option" aria-selected={active}>
                  <button
                    type="button"
                    className={`w-full px-3 py-2 text-left text-sm transition hover:bg-brand/10 focus:bg-brand/10 focus:outline-none ${
                      active ? "bg-brand/10" : ""
                    }`}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      selectSuggestion(suggestion);
                    }}
                    onMouseEnter={() => setActiveIndex(index)}
                    id={`suggestion-${index}`}
                  >
                    <div className="font-medium text-gray-900">{suggestion.mainText}</div>
                    {suggestion.secondaryText && (
                      <div className="text-xs text-gray-500">{suggestion.secondaryText}</div>
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

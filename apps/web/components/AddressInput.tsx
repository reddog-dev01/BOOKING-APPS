/// <reference types="google.maps" />
// apps/web/components/AddressInput.tsx
"use client";

import React, {
  useRef,
  useEffect,
  useCallback,
  useState,
  KeyboardEvent,
  FocusEvent,
} from "react";
import { loadGoogleMapsPlaces } from "../lib/googleMapsLoader";

type AddressValue = { text: string; lat?: number; lng?: number };

type Prediction = google.maps.places.AutocompletePrediction;

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
    const placesServiceContainerRef = useRef<HTMLDivElement | null>(null);

    const autocompleteServiceRef =
      useRef<google.maps.places.AutocompleteService | null>(null);
    const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
    const sessionTokenRef =
      useRef<google.maps.places.AutocompleteSessionToken | null>(null);

    const [ready, setReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [suggestions, setSuggestions] = useState<Prediction[]>([]);
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);

    const debounceRef = useRef<number | null>(null);

    const ensureSessionToken = useCallback(() => {
      if (!sessionTokenRef.current && window.google?.maps?.places) {
        sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
      }
      return sessionTokenRef.current;
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
          autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
          const host = document.createElement("div");
          placesServiceContainerRef.current = host;
          placesServiceRef.current = new google.maps.places.PlacesService(host);
          sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
          setReady(true);
          setError(null);
        })
        .catch((err) => {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : String(err));
          setReady(false);
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
      (query: string) => {
        if (!ready || !autocompleteServiceRef.current || !window.google?.maps?.places) {
          return;
        }
        const trimmed = query.trim();
        if (!trimmed) {
          clearSuggestions();
          setError(null);
          return;
        }

        setError(null);
        const token = ensureSessionToken();
        autocompleteServiceRef.current.getPlacePredictions(
          {
            input: trimmed,
            language: "vi",
            sessionToken: token ?? undefined,
            componentRestrictions: { country: COUNTRIES },
          },
          (predictions, status) => {
            if (!window.google?.maps?.places) {
              return;
            }
            const okStatus = window.google.maps.places.PlacesServiceStatus.OK;
            if (status === okStatus && predictions && predictions.length > 0) {
              setSuggestions(predictions);
              setOpen(true);
              setActiveIndex(-1);
            } else {
              clearSuggestions();
              if (
                status !== window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS &&
                status !== window.google.maps.places.PlacesServiceStatus.OK
              ) {
                setError(`Không thể gợi ý địa chỉ (${status}).`);
              }
            }
          }
        );
      },
      [clearSuggestions, ensureSessionToken, ready]
    );

    const scheduleFetch = useCallback(
      (query: string) => {
        if (debounceRef.current) {
          window.clearTimeout(debounceRef.current);
        }
        if (!ready) return;
        debounceRef.current = window.setTimeout(() => {
          fetchPredictions(query);
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
        if (!placesServiceRef.current || !window.google?.maps?.places) {
          onChange({ text: prediction.description });
          return;
        }

        const token = ensureSessionToken();
        placesServiceRef.current.getDetails(
          {
            placeId: prediction.place_id,
            sessionToken: token ?? undefined,
            fields: ["geometry", "formatted_address", "name"],
          },
          (place, status) => {
            if (status !== window.google.maps.places.PlacesServiceStatus.OK || !place) {
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
            sessionTokenRef.current = null;
          }
        );
      },
      [ensureSessionToken, onChange]
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

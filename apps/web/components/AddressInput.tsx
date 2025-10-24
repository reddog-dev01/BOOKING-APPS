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

type AddressValue = { text: string; lat?: number; lng?: number };

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const PLACES_API_BASE_URL = "https://places.googleapis.com/v1";

type Suggestion = {
  placeId: string;
  mainText: string;
  secondaryText?: string;
  fullText: string;
};

type AutocompleteResponse = {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
    };
  }>;
};

type PlaceDetailsResponse = {
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
};

type AddressInputProps = {
  value: string;
  placeholder?: string;
  disabled?: boolean;
  inputClassName?: string;
  inputRef?: React.Ref<HTMLInputElement> | React.RefObject<HTMLInputElement | null>;
  onChange: (v: AddressValue) => void;
};

const DEBOUNCE_MS = 250;

async function readErrorMessage(response: Response, fallback: string) {
  const raw = await response.text();
  if (!raw) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(raw) as {
      error?: { message?: string };
      message?: string;
    };
    return parsed.error?.message ?? parsed.message ?? fallback;
  } catch {
    return raw;
  }
}

function generateSessionToken() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

async function fetchAutocompleteSuggestions(
  input: string,
  sessionToken: string,
  signal: AbortSignal
): Promise<Suggestion[]> {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error("Chưa cấu hình NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.");
  }

  const response = await fetch(`${PLACES_API_BASE_URL}/places:autocomplete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
      "X-Goog-FieldMask": "placePrediction.placeId,placePrediction.text,placePrediction.structuredFormat",
    },
    body: JSON.stringify({
      input,
      languageCode: "vi",
      regionCode: "VN",
      sessionToken,
    }),
    signal,
  });

  if (!response.ok) {
    const message = await readErrorMessage(
      response,
      "Không thể tải gợi ý địa chỉ. Vui lòng thử lại sau."
    );
    throw new Error(message);
  }

  const data = (await response.json()) as AutocompleteResponse;
  const suggestions = (data.suggestions ?? []).flatMap((item) => {
    const prediction = item.placePrediction;
    if (!prediction?.placeId) {
      return [] as Suggestion[];
    }
    const mainText =
      prediction.structuredFormat?.mainText?.text ??
      prediction.text?.text ??
      "";
    const secondaryText = prediction.structuredFormat?.secondaryText?.text;
    const fullText =
      prediction.text?.text ??
      [mainText, secondaryText].filter(Boolean).join(", ");
    return [
      {
        placeId: prediction.placeId,
        mainText,
        secondaryText,
        fullText,
      },
    ];
  });

  return suggestions;
}

async function fetchPlaceDetails(
  placeId: string,
  sessionToken: string | null,
  signal: AbortSignal
): Promise<PlaceDetailsResponse> {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error("Chưa cấu hình NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.");
  }

  const params = new URLSearchParams({ languageCode: "vi" });
  if (sessionToken) {
    params.set("sessionToken", sessionToken);
  }

  const response = await fetch(
    `${PLACES_API_BASE_URL}/places/${encodeURIComponent(placeId)}?${params.toString()}`,
    {
      headers: {
        "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask": "formattedAddress,location",
      },
      signal,
    }
  );

  if (!response.ok) {
    const message = await readErrorMessage(
      response,
      "Không thể lấy thông tin địa điểm. Vui lòng thử lại sau."
    );
    throw new Error(message);
  }

  return (await response.json()) as PlaceDetailsResponse;
}

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
    const sessionTokenRef = useRef<string | null>(null);
    const autocompleteControllerRef = useRef<AbortController | null>(null);
    const placeDetailsControllerRef = useRef<AbortController | null>(null);

    const [ready, setReady] = useState(() => Boolean(GOOGLE_MAPS_API_KEY));
    const [error, setError] = useState<string | null>(null);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);

    const debounceRef = useRef<number | null>(null);

    const ensureSessionToken = useCallback(() => {
      if (!sessionTokenRef.current) {
        sessionTokenRef.current = generateSessionToken();
      }
      return sessionTokenRef.current;
    }, []);

    useEffect(() => {
      setExternalRef(inputRef as any, internalInputRef.current);
    }, [inputRef]);

    useEffect(() => {
      if (!GOOGLE_MAPS_API_KEY) {
        setError("Chưa cấu hình NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.");
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
      (query: string) => {
        if (!ready) {
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
        autocompleteControllerRef.current?.abort();
        const controller = new AbortController();
        autocompleteControllerRef.current = controller;

        fetchAutocompleteSuggestions(trimmed, token, controller.signal)
          .then((results) => {
            setSuggestions(results);
            if (results.length > 0) {
              setOpen(true);
              setActiveIndex(-1);
            } else {
              clearSuggestions();
              sessionTokenRef.current = null;
            }
          })
          .catch((err) => {
            if (err instanceof DOMException && err.name === "AbortError") {
              return;
            }
            clearSuggestions();
            setError(err instanceof Error ? err.message : String(err));
          });
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
      (suggestion: Suggestion) => {
        const token = sessionTokenRef.current;
        placeDetailsControllerRef.current?.abort();
        const controller = new AbortController();
        placeDetailsControllerRef.current = controller;

        fetchPlaceDetails(suggestion.placeId, token ?? null, controller.signal)
          .then((details) => {
            sessionTokenRef.current = null;
            const latitude = details.location?.latitude;
            const longitude = details.location?.longitude;
            onChange({
              text: details.formattedAddress ?? suggestion.fullText,
              lat: latitude,
              lng: longitude,
            });
          })
          .catch((err) => {
            if (err instanceof DOMException && err.name === "AbortError") {
              return;
            }
            setError(err instanceof Error ? err.message : String(err));
            onChange({ text: suggestion.fullText });
          });
      },
      [onChange]
    );

    const selectPrediction = useCallback(
      (suggestion: Suggestion) => {
        clearSuggestions();
        const description = suggestion.fullText;
        onChange({ text: description });
        if (internalInputRef.current) {
          internalInputRef.current.value = description;
        }
        resolvePlaceDetails(suggestion);
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

    useEffect(() => {
      return () => {
        autocompleteControllerRef.current?.abort();
        placeDetailsControllerRef.current?.abort();
      };
    }, []);

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
                      selectPrediction(suggestion);
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

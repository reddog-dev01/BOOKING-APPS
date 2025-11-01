"use client";

import React, {
  FocusEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { MapPin } from "lucide-react";
import type { PlacePrediction } from "../lib/googlePlacesTypes";

type AddressValue = { text: string; lat?: number; lng?: number };

type AddressInputProps = {
  value: string;
  placeholder?: string;
  disabled?: boolean;
  inputClassName?: string;
  inputRef?: React.Ref<HTMLInputElement> | React.RefObject<HTMLInputElement | null>;
  inputProps?: Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "onKeyDown" | "onFocus" | "ref" | "disabled">;
  onChange: (v: AddressValue) => void;
};

const DEBOUNCE_MS = 250;
const COUNTRY_CODE = "VN";
const LANGUAGE_CODE = "vi";
const MISSING_KEY_MESSAGE =
  "Thiếu Google Maps API key. Thiết lập PLACES_API_KEY cho server để kích hoạt gợi ý.";

const HIGHLIGHT_CLASS_PRIMARY = "font-semibold text-brand-dark";
const HIGHLIGHT_CLASS_SECONDARY = "font-semibold text-brand-dark";

const COUNTRY_SUFFIX_PATTERN = /,\s*(?:Việt Nam|Vietnam)$/i;
const POSTAL_CODE_PATTERN = /(?:,\s*)?\b\d{5,6}\b(?:(?=,)|$)/g;

function cleanPlaceText(fragment?: string | null): string {
  if (!fragment) return "";

  let normalized = fragment.trim();

  if (!normalized) return "";

  normalized = normalized.replace(COUNTRY_SUFFIX_PATTERN, "");
  normalized = normalized.replace(POSTAL_CODE_PATTERN, (match, offset, original) => {
    const before = original.slice(0, offset);
    const after = original.slice(offset + match.length);

    const hasCommaBefore = /,\s*$/.test(before);
    const hasCommaAfter = /^\s*,/.test(after);

    if (hasCommaBefore && hasCommaAfter) {
      return ",";
    }

    return "";
  });

  normalized = normalized.replace(/,\s*,/g, ", ");
  normalized = normalized.replace(/\s+,/g, ", ");
  normalized = normalized.replace(/\s{2,}/g, " ");
  normalized = normalized.replace(/,\s*$/, "");

  return normalized.trim();
}

function normalizePrediction(prediction: PlacePrediction): PlacePrediction {
  const cleanedDescription = cleanPlaceText(prediction.description);
  const cleanedMain = cleanPlaceText(prediction.mainText);
  const cleanedSecondary = cleanPlaceText(prediction.secondaryText);

  const description = cleanedDescription || prediction.description;
  const mainText = cleanedMain || prediction.mainText;
  const secondaryTextCandidate = cleanedSecondary || prediction.secondaryText;
  const secondaryText =
    secondaryTextCandidate && secondaryTextCandidate !== mainText
      ? secondaryTextCandidate
      : undefined;

  return {
    ...prediction,
    description,
    mainText,
    secondaryText,
  };
}

function setExternalRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (!ref) return;
  if (typeof ref === "function") {
    (ref as (val: T | null) => void)(value);
  } else {
    (ref as React.MutableRefObject<T | null>).current = value;
  }
}

function renderHighlightedText(
  text: string,
  query: string,
  highlightClass: string,
): React.ReactNode {
  const trimmed = query.trim();
  if (!trimmed) return text;

  const segments: React.ReactNode[] = [];
  const lowerText = text.toLocaleLowerCase();
  const lowerQuery = trimmed.toLocaleLowerCase();
  let lastIndex = 0;
  let key = 0;

  let matchIndex = lowerText.indexOf(lowerQuery, lastIndex);

  while (matchIndex !== -1) {
    if (matchIndex > lastIndex) {
      segments.push(text.slice(lastIndex, matchIndex));
    }

    const endIndex = matchIndex + trimmed.length;
    segments.push(
      <span key={`highlight-${key++}-${matchIndex}`} className={highlightClass}>
        {text.slice(matchIndex, endIndex)}
      </span>,
    );

    lastIndex = endIndex;
    matchIndex = lowerText.indexOf(lowerQuery, lastIndex);
  }

  if (lastIndex < text.length) {
    segments.push(text.slice(lastIndex));
  }

  return segments.length > 0 ? segments : text;
}

type DropdownStyle = Pick<React.CSSProperties, "width" | "left">;

const AddressInput = React.forwardRef<HTMLInputElement, AddressInputProps>(
  ({
    value,
    placeholder,
    disabled,
    inputClassName,
    inputRef,
    inputProps,
    onChange,
  }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const internalInputRef = useRef<HTMLInputElement | null>(null);
    const restSessionTokenRef = useRef<string | null>(null);
    const dropdownHostRef = useRef<HTMLElement | null>(null);
    const lastPredictionsRef = useRef<PlacePrediction[]>([]);
    const lastSelectedDescriptionRef = useRef<string | null>(null);
    const lastUserQueryRef = useRef<string>(value);

    const [query, setQuery] = useState(value);

    const [error, setError] = useState<string | null>(null);
    const [suggestions, setSuggestions] = useState<PlacePrediction[]>([]);
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [apiUnavailableMessage, setApiUnavailableMessage] = useState<string | null>(null);
    const [dropdownStyle, setDropdownStyle] = useState<DropdownStyle>({ left: 0 });

    const debounceRef = useRef<number | null>(null);
    const latestQueryRef = useRef<string>("");

    const ensureRestSessionToken = useCallback(() => {
      if (!restSessionTokenRef.current) {
        restSessionTokenRef.current =
          globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      }
      return restSessionTokenRef.current;
    }, []);

    const updateDropdownMetrics = useCallback(() => {
      const container = containerRef.current;
      if (!container) return;

      const host =
        dropdownHostRef.current ??
        container.closest<HTMLElement>("[data-address-dropdown-parent]") ??
        container;

      dropdownHostRef.current = host;

      const parentRect = host.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      const next: DropdownStyle = {
        width: parentRect.width,
        left: parentRect.left - containerRect.left,
      };

      setDropdownStyle((prev) => {
        if (prev.left === next.left && prev.width === next.width) {
          return prev;
        }
        return next;
      });
    }, []);

    useEffect(() => {
      setExternalRef(inputRef as any, internalInputRef.current);
    }, [inputRef]);

    useEffect(() => {
      updateDropdownMetrics();

      const container = containerRef.current;
      const host = dropdownHostRef.current;
      if (!container || !host) return;

      if (typeof window !== "undefined" && "ResizeObserver" in window) {
        const observer = new ResizeObserver(() => {
          updateDropdownMetrics();
        });
        observer.observe(host);
        if (host !== container) {
          observer.observe(container);
        }
        return () => {
          observer.disconnect();
        };
      }

      const handleResize = () => {
        updateDropdownMetrics();
      };

      if (typeof window === "undefined") {
        return undefined;
      }

      const maybeWindow = window as unknown as {
        addEventListener?: (type: string, listener: () => void) => void;
        removeEventListener?: (type: string, listener: () => void) => void;
      };

      // Cast keeps DOM-less TypeScript builds happy while still binding in browsers.
      maybeWindow.addEventListener?.("resize", handleResize);
      return () => {
        maybeWindow.removeEventListener?.("resize", handleResize);
      };
    }, [updateDropdownMetrics]);

    useEffect(() => {
      if (open) {
        updateDropdownMetrics();
      }
    }, [open, updateDropdownMetrics]);

    const clearSuggestions = useCallback(() => {
      setSuggestions([]);
      setOpen(false);
      setActiveIndex(-1);
    }, []);

    const hideSuggestions = useCallback(() => {
      setOpen(false);
      setActiveIndex(-1);
    }, []);

    const fetchPredictions = useCallback(
      async (trimmedQuery: string) => {
        const normalized = trimmedQuery.trim();
        latestQueryRef.current = normalized;

        if (!normalized) {
          clearSuggestions();
          setError(null);
          return;
        }

        try {
          const token = ensureRestSessionToken();
          const response = await fetch("/api/places/autocomplete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              input: normalized,
              sessionToken: token ?? undefined,
              country: COUNTRY_CODE,
              languageCode: LANGUAGE_CODE,
            }),
          });

          const payload = (await response.json().catch(() => null)) as
            | { predictions: PlacePrediction[] }
            | { error?: { message?: string } }
            | null;

          if (!response.ok) {
            const rawMessage = (payload as { error?: { message?: string } } | null)?.error?.message;
            const fallbackMessage = (() => {
              if (response.status === 503) return MISSING_KEY_MESSAGE;
              if (response.status === 403)
                return "Google Places đang từ chối yêu cầu. Kiểm tra Billing và hạn chế API key.";
              return "Không thể gợi ý địa chỉ từ Google.";
            })();
            const message = rawMessage && rawMessage.length > 0 ? rawMessage : fallbackMessage;

            if (response.status === 503 || response.status === 403) {
              setApiUnavailableMessage(message);
              clearSuggestions();
              setError(message);
              return;
            }

            throw new Error(message);
          }

          const predictions = (payload as { predictions: PlacePrediction[] } | null)?.predictions;

          if (latestQueryRef.current !== normalized) {
            return;
          }

          if (!predictions || predictions.length === 0) {
            clearSuggestions();
            lastPredictionsRef.current = [];
            return;
          }

          const normalizedPredictions = predictions.map(normalizePrediction);
          lastPredictionsRef.current = normalizedPredictions;
          setSuggestions(normalizedPredictions);
          setOpen(true);
          setActiveIndex(-1);
        } catch (err) {
          clearSuggestions();
          lastPredictionsRef.current = [];
          const message =
            err instanceof Error ? err.message : "Không thể gợi ý địa chỉ từ Google.";
          setError(message);
        }
      },
      [clearSuggestions, ensureRestSessionToken, setApiUnavailableMessage],
    );

    const scheduleFetch = useCallback(
      (rawQuery: string, options?: { immediate?: boolean }) => {
        if (debounceRef.current) {
          window.clearTimeout(debounceRef.current);
          debounceRef.current = null;
        }

        if (apiUnavailableMessage) {
          const trimmed = rawQuery.trim();
          clearSuggestions();
          setError(trimmed ? apiUnavailableMessage : null);
          return;
        }

        const trimmed = rawQuery.trim();

        if (!trimmed) {
          clearSuggestions();
          lastPredictionsRef.current = [];
          setError(null);
          return;
        }

        setError(null);
        setOpen(true);
        setActiveIndex(-1);

        const run = () => {
          fetchPredictions(trimmed).catch((err) => {
            console.error("Google Places prediction error", err);
          });
        };

        if (options?.immediate) {
          run();
        } else {
          debounceRef.current = window.setTimeout(run, DEBOUNCE_MS);
        }
      },
      [apiUnavailableMessage, clearSuggestions, fetchPredictions],
    );

    useEffect(() => {
      return () => {
        if (debounceRef.current) {
          window.clearTimeout(debounceRef.current);
          debounceRef.current = null;
        }
      };
    }, []);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (!containerRef.current) return;
        if (!containerRef.current.contains(event.target as Node)) {
          hideSuggestions();
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [hideSuggestions]);

    const mergeRef = useCallback(
      (node: HTMLInputElement | null) => {
        internalInputRef.current = node;
        setExternalRef(ref, node);
        setExternalRef(inputRef as any, node);
      },
      [ref, inputRef],
    );

    useEffect(() => {
      const node = internalInputRef.current;
      if (node && node.value !== value) {
        node.value = value;
      }

      const trimmedValue = value.trim();
      if (lastSelectedDescriptionRef.current && trimmedValue === lastSelectedDescriptionRef.current) {
        return;
      }

      if (!trimmedValue) {
        lastSelectedDescriptionRef.current = null;
        lastUserQueryRef.current = "";
      }

      setQuery((prev) => (prev === value ? prev : value));
    }, [value]);

    const handleInputChange = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        const next = event.target.value;
        onChange({ text: next });
        setQuery(next);
        lastUserQueryRef.current = next;
        lastSelectedDescriptionRef.current = null;
        lastPredictionsRef.current = [];
        scheduleFetch(next);
      },
      [onChange, scheduleFetch, setQuery],
    );

    const resolvePlaceDetails = useCallback(
      async (prediction: PlacePrediction) => {
        const token = ensureRestSessionToken();
        try {
          const response = await fetch("/api/places/details", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              placeId: prediction.placeId,
              sessionToken: token ?? undefined,
              languageCode: LANGUAGE_CODE,
            }),
          });

          const payload = (await response.json().catch(() => null)) as
            | { details?: {
                formattedAddress?: string;
                name?: string;
                lat?: number;
                lng?: number;
              } }
            | { error?: { message?: string } }
            | null;

          if (!response.ok) {
            const rawMessage = (payload as { error?: { message?: string } } | null)?.error?.message;
            const fallbackMessage =
              response.status === 503
                ? MISSING_KEY_MESSAGE
                : "Không thể lấy chi tiết địa điểm.";
            const message = rawMessage && rawMessage.length > 0 ? rawMessage : fallbackMessage;

            if (response.status === 503) {
              setApiUnavailableMessage(message);
              setError(message);
              return;
            }

            throw new Error(message);
          }

          const details = (payload as {
            details?: {
              formattedAddress?: string;
              name?: string;
              lat?: number;
              lng?: number;
            };
          } | null)?.details;

          const resolvedTextRaw =
            details?.formattedAddress ?? prediction.description ?? prediction.mainText;
          const resolvedText = cleanPlaceText(resolvedTextRaw) || resolvedTextRaw;
          const highlightQuery =
            lastUserQueryRef.current.trim() || cleanPlaceText(prediction.mainText) || resolvedText;

          lastSelectedDescriptionRef.current = resolvedText;
          onChange({
            text: resolvedText,
            lat: details?.lat,
            lng: details?.lng,
          });
          setQuery(highlightQuery);
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "Không thể lấy chi tiết địa điểm.",
          );
          const fallbackRaw = prediction.description ?? prediction.mainText;
          const fallbackText = cleanPlaceText(fallbackRaw) || fallbackRaw;
          const highlightQuery =
            lastUserQueryRef.current.trim() || cleanPlaceText(prediction.mainText) || fallbackText;

          lastSelectedDescriptionRef.current = fallbackText;
          onChange({
            text: fallbackText,
          });
          setQuery(highlightQuery);
        } finally {
          restSessionTokenRef.current = null;
        }
      },
      [ensureRestSessionToken, onChange],
    );

    const selectPrediction = useCallback(
      (prediction: PlacePrediction) => {
        if (debounceRef.current) {
          window.clearTimeout(debounceRef.current);
          debounceRef.current = null;
        }
        const description = prediction.description ?? prediction.mainText;
        const sanitizedDescription = cleanPlaceText(description) || description;
        const highlightQuery =
          lastUserQueryRef.current.trim() || cleanPlaceText(prediction.mainText) || sanitizedDescription;

        if (suggestions.length > 0) {
          lastPredictionsRef.current = [...suggestions];
        }

        lastSelectedDescriptionRef.current = sanitizedDescription;
        clearSuggestions();
        setQuery(highlightQuery);
        onChange({ text: sanitizedDescription });
        if (internalInputRef.current) {
          internalInputRef.current.value = sanitizedDescription;
        }
        resolvePlaceDetails(prediction).catch((err) => {
          console.error("Google Places detail error", err);
        });
      },
      [clearSuggestions, onChange, resolvePlaceDetails, setQuery, suggestions],
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
          hideSuggestions();
        }
      },
      [activeIndex, hideSuggestions, open, selectPrediction, suggestions],
    );

    const handleFocus = useCallback(
      (_event: FocusEvent<HTMLInputElement>) => {
        const trimmed = value.trim();
        if (!trimmed) {
          return;
        }

        if (suggestions.length > 0) {
          setOpen(true);
          return;
        }

        if (apiUnavailableMessage) {
          setError(apiUnavailableMessage);
          return;
        }

        const lastSelected = lastSelectedDescriptionRef.current;
        const lastManualQuery = lastUserQueryRef.current.trim();

        if (lastSelected && trimmed === lastSelected) {
          if (lastPredictionsRef.current.length > 0) {
            setSuggestions([...lastPredictionsRef.current]);
            setActiveIndex(-1);
            setOpen(true);
          }
          scheduleFetch(lastManualQuery || trimmed, { immediate: true });
          return;
        }

        scheduleFetch(trimmed, { immediate: true });
      },
      [apiUnavailableMessage, scheduleFetch, suggestions.length, value],
    );

    const highlightedId = activeIndex >= 0 ? `suggestion-${activeIndex}` : undefined;

    useEffect(() => {
      if (typeof document !== "undefined") {
        const node = internalInputRef.current;
        if (node && node === document.activeElement && value.trim()) {
          const lastSelected = lastSelectedDescriptionRef.current;
          const lastManualQuery = lastUserQueryRef.current.trim();
          const trimmedValue = value.trim();
          const nextQuery =
            lastSelected && trimmedValue === lastSelected ? lastManualQuery || trimmedValue : trimmedValue;

          scheduleFetch(nextQuery, { immediate: true });
        }
      }
    }, [scheduleFetch, value]);

    return (
      <div ref={containerRef} className="relative w-full">
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
          {...inputProps}
        />

        {open && suggestions.length > 0 && (
          <ul
            role="listbox"
            className="absolute top-full z-50 mt-1 max-h-64 min-w-full overflow-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
            style={dropdownStyle}
          >
            {suggestions.map((prediction, index) => {
              const active = index === activeIndex;
              const mainText = prediction.mainText;
              const secondaryText = prediction.secondaryText;
              return (
                <li key={prediction.placeId} role="option" aria-selected={active}>
                  <button
                    type="button"
                    className={`flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-brand/10 focus:bg-brand/10 focus:outline-none ${
                      active ? "bg-brand/10" : ""
                    }`}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      selectPrediction(prediction);
                    }}
                    onMouseEnter={() => setActiveIndex(index)}
                    id={`suggestion-${index}`}
                  >
                    <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-brand/10 text-brand">
                      <MapPin aria-hidden className="h-3.5 w-3.5" />
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-sm text-gray-900">
                        {renderHighlightedText(mainText, query, HIGHLIGHT_CLASS_PRIMARY)}
                      </span>
                      {secondaryText && (
                        <span className="text-xs text-gray-500">
                          {renderHighlightedText(
                            secondaryText,
                            query,
                            HIGHLIGHT_CLASS_SECONDARY,
                          )}
                        </span>
                      )}
                    </span>
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

export type { AddressInputProps, AddressValue };
export default AddressInput;

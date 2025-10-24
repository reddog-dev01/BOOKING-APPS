// apps/web/components/AddressInput.tsx
"use client";

import React, { useRef, useEffect, useCallback } from "react";

type AddressValue = { text: string; lat?: number; lng?: number };

export type AddressInputProps = {
  value: string;
  placeholder?: string;
  disabled?: boolean;
  inputClassName?: string;
  // NEW: nhận inputRef từ cha (BookingForm đang dùng)
  inputRef?: React.Ref<HTMLInputElement> | React.RefObject<HTMLInputElement | null>;
  onChange: (v: AddressValue) => void;
};

function setExternalRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (!ref) return;
  if (typeof ref === "function") (ref as (val: T | null) => void)(value);
  else (ref as React.MutableRefObject<T | null>).current = value;
}

const AddressInput = React.forwardRef<HTMLInputElement, AddressInputProps>(
  ({ value, placeholder, disabled, inputClassName, inputRef, onChange }, ref) => {
    const internalRef = useRef<HTMLInputElement | null>(null);

    // gộp ref forwardRef + inputRef prop
    const mergeRef = useCallback(
      (node: HTMLInputElement | null) => {
        internalRef.current = node;
        setExternalRef(ref, node);
        setExternalRef(inputRef as any, node);
      },
      [ref, inputRef]
    );

    useEffect(() => {
      // đảm bảo prop inputRef luôn nhận được node hiện tại nếu mount sau
      setExternalRef(inputRef as any, internalRef.current);
    }, [inputRef]);

    return (
      <input
        ref={mergeRef}
        disabled={disabled}
        className={inputClassName}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange({ text: e.target.value })}
        // (nếu bạn có logic autocomplete thì gắn vào đây)
      />
    );
  }
);

AddressInput.displayName = "AddressInput";
export default AddressInput;

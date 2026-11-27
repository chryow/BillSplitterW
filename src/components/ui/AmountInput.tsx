"use client";

import { useState } from "react";
import {
  formatEditableAmount,
  getCurrencyConfig,
  parseAmountInput,
} from "@/lib/currency";
import type { CurrencyCode } from "@/lib/types";

interface AmountInputProps {
  value: number;
  currency: CurrencyCode;
  onChange: (nextValue: number) => void;
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
}

/**
 * Draft-aware currency input that lets users type decimals ("0.50", "12.", "12.05", "12,50")
 * in 2-decimal currencies (USD, SGD, MYR, EUR) and thousand-formatted values in IDR/JPY
 * without eating decimal points or leading zeroes while typing.
 */
export function AmountInput({
  value,
  currency,
  onChange,
  ariaLabel,
  placeholder = "0",
  className = "",
}: AmountInputProps) {
  const config = getCurrencyConfig(currency);
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState("");

  const displayValue = focused ? draft : formatEditableAmount(value, currency);

  const handleFocus = () => {
    setDraft(formatEditableAmount(value, currency));
    setFocused(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow only digits, dots, and commas while typing
    const filtered = raw.replace(/[^\d.,]/g, "");
    setDraft(filtered);
    onChange(parseAmountInput(filtered, currency));
  };

  const handleBlur = () => {
    const parsed = parseAmountInput(draft, currency);
    onChange(parsed);
    setFocused(false);
  };

  return (
    <input
      type="text"
      inputMode={config.decimals === 0 ? "numeric" : "decimal"}
      value={displayValue}
      onFocus={handleFocus}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={className}
    />
  );
}

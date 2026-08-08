import { useState, useRef, useEffect, useCallback } from "react";
import styles from "./Select.module.css";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  size?: "small" | "middle" | "large";
  className?: string;
}

export function Select({
  value,
  options,
  onChange,
  disabled = false,
  placeholder,
  size,
  className,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selectedLabel = options.find((o) => o.value === value)?.label || "";

  const handleSelect = useCallback(
    (val: string) => {
      onChange(val);
      setOpen(false);
    },
    [onChange]
  );

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const cls = [
    styles.select,
    disabled && styles.disabled,
    size === "small" && styles.sm,
    size === "large" && styles.lg,
    className,
  ].filter(Boolean).join(" ");

  return (
    <div className={cls} ref={ref}>
      <button
        className={styles.trigger}
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        type="button"
      >
        <span className={styles.value}>
          {selectedLabel || (placeholder && <span className={styles.placeholder}>{placeholder}</span>)}
        </span>
        <svg className={styles.arrow} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className={styles.dropdown}>
          {options.map((opt) => (
            <div
              key={opt.value}
              className={`${styles.option}${opt.value === value ? ` ${styles.active}` : ""}${opt.disabled ? ` ${styles.disabledOption}` : ""}`}
              onClick={() => !opt.disabled && handleSelect(opt.value)}
            >
              <span className={styles.indicator} />
              <span>{opt.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

Select.displayName = "Select";

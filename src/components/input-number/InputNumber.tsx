import { type InputHTMLAttributes, forwardRef } from "react";
import inputStyles from "../input/Input.module.css";

export interface InputNumberProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange" | "value"> {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  fallback?: number;
}

const InputNumber = forwardRef<HTMLInputElement, InputNumberProps>(
  ({ value, onChange, min, max, fallback = 0, className, ...rest }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      if (raw === "" || raw === "-") return;
      let num = parseInt(raw, 10);
      if (isNaN(num)) {
        num = fallback;
      }
      if (min !== undefined && num < min) num = min;
      if (max !== undefined && num > max) num = max;
      onChange(num);
    };

    const cls = [inputStyles.input, className].filter(Boolean).join(" ");

    return (
      <input
        ref={ref}
        className={cls}
        type="number"
        value={value}
        onChange={handleChange}
        min={min}
        max={max}
        {...rest}
      />
    );
  }
);

InputNumber.displayName = "InputNumber";

export default InputNumber;

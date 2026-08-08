import { type InputHTMLAttributes, type ReactNode, forwardRef } from "react";
import styles from "./Input.module.css";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  /** 输入框后缀图标/内容 */
  suffix?: ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ suffix, className, ...rest }, ref) => {
    const cls = [
      styles.input,
      className,
    ].filter(Boolean).join(" ");

    if (!suffix) {
      return (
        <input
          ref={ref}
          className={cls}
          {...rest}
        />
      );
    }

    return (
      <div className={styles.wrapper}>
        <input
          ref={ref}
          className={cls}
          {...rest}
        />
        <span className={styles.suffix}>{suffix}</span>
      </div>
    );
  }
);

Input.displayName = "Input";

export default Input;

import { useState, type InputHTMLAttributes } from "react";
import { useTranslation } from "react-i18next";
import InternalInput from "./Input";
import styles from "./Input.module.css";

type PasswordProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "prefix">;

function Password(props: PasswordProps) {
  const { t } = useTranslation("components");
  const [visible, setVisible] = useState(false);

  const icon = (
    <button
      type="button"
      className={styles.passwordToggle}
      onClick={() => setVisible((v) => !v)}
      tabIndex={-1}
      aria-label={visible ? t("password.hide") : t("password.show")}
    >
      {visible ? <EyeOpenIcon /> : <EyeClosedIcon />}
    </button>
  );

  return <InternalInput {...props} type={visible ? "text" : "password"} suffix={icon} />;
}

Password.displayName = "Input.Password";

export default Password;

function EyeOpenIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  );
}

function EyeClosedIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 2l12 12" />
      <path d="M6.5 6.5a2 2 0 0 0 2.8 2.8" />
      <path d="M3.5 5.5C2.3 6.7 1 8 1 8s2.5 5 7 5c1.2 0 2.3-.4 3.2-.9" />
      <path d="M10.7 4.3C9.9 3.5 9 3 8 3c-4.5 0-7 5-7 5s1 1.8 2.8 3.2" />
    </svg>
  );
}

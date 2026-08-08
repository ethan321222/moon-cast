import { useState, useCallback, useMemo, useRef } from "react";
import type {
  MessageConfig,
  MessageInstance,
  MessageItem,
  MessageType,
} from "./interface";
import styles from "./Message.module.css";

const DEFAULT_DURATION = 3000;
const DEFAULT_MAX_COUNT = 3;

let idCounter = 0;

const iconClassMap: Record<MessageType, string> = {
  success: styles.iconSuccess,
  error: styles.iconError,
  info: styles.iconInfo,
  warning: styles.iconWarning,
};

// Inline SVG icons matching Ant Design's filled icon style
const icons: Record<MessageType, React.ReactNode> = {
  success: (
    <svg viewBox="64 64 896 896" focusable="false" aria-hidden="true">
      <path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm193.5 301.7l-210.6 292a31.8 31.8 0 01-51.7 0L318.5 484.9c-3.8-5.3 0-12.7 6.5-12.7h46.9c10.2 0 19.9 4.9 25.9 13.3l71.2 98.8 157.2-218c6-8.3 15.6-13.3 25.9-13.3H699c6.5 0 10.3 7.4 6.5 12.7z" />
    </svg>
  ),
  error: (
    <svg viewBox="64 64 896 896" focusable="false" aria-hidden="true">
      <path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm165.4 618.2l-66-.3L512 563.4l-99.3 118.4-66.1.3c-4.4 0-8-3.5-8-8 0-1.9.7-3.7 1.9-5.2l130.1-155L340.5 359a8.32 8.32 0 01-1.9-5.2c0-4.4 3.6-8 8-8l66.1.3L512 464.6l99.3-118.4 66-.3c4.4 0 8 3.5 8 8 0 1.9-.7 3.7-1.9 5.2L553.5 514l130 155c1.2 1.5 1.9 3.3 1.9 5.2 0 4.4-3.6 8-8 8z" />
    </svg>
  ),
  info: (
    <svg viewBox="64 64 896 896" focusable="false" aria-hidden="true">
      <path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm32 664c0 4.4-3.6 8-8 8h-48c-4.4 0-8-3.6-8-8V456c0-4.4 3.6-8 8-8h48c4.4 0 8 3.6 8 8v272zm-32-344a48.01 48.01 0 010-96 48.01 48.01 0 010 96z" />
    </svg>
  ),
  warning: (
    <svg viewBox="64 64 896 896" focusable="false" aria-hidden="true">
      <path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm-32 232c0-4.4 3.6-8 8-8h48c4.4 0 8 3.6 8 8v272c0 4.4-3.6 8-8 8h-48c-4.4 0-8-3.6-8-8V296zm32 440a48.01 48.01 0 010-96 48.01 48.01 0 010 96z" />
    </svg>
  ),
};

export function useMessage(
  config?: MessageConfig
): [MessageInstance, React.ReactNode] {
  const { duration = DEFAULT_DURATION, maxCount = DEFAULT_MAX_COUNT } =
    config || {};
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  const remove = useCallback((id: number) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const add = useCallback(
    (content: React.ReactNode, type: MessageType, customDuration?: number) => {
      const id = ++idCounter;
      setMessages((prev) => [
        ...prev.slice(-(maxCount - 1)),
        { id, content, type },
      ]);
      const timer = setTimeout(() => remove(id), customDuration ?? duration);
      timersRef.current.set(id, timer);
    },
    [duration, maxCount, remove]
  );

  const destroy = useCallback(() => {
    setMessages([]);
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
  }, []);

  const api: MessageInstance = useMemo(
    () => ({
      success: (content, d) => add(content, "success", d),
      error: (content, d) => add(content, "error", d),
      info: (content, d) => add(content, "info", d),
      warning: (content, d) => add(content, "warning", d),
      destroy,
    }),
    [add, destroy]
  );

  const contextHolder =
    messages.length > 0 ? (
      <div className={styles.container}>
        {messages.map((msg) => (
          <div key={msg.id} className={styles.notice}>
            <div className={styles.message}>
              <span className={`${styles.icon} ${iconClassMap[msg.type]}`}>
                {icons[msg.type]}
              </span>
              <span className={styles.content}>{msg.content}</span>
            </div>
          </div>
        ))}
      </div>
    ) : null;

  return [api, contextHolder];
}

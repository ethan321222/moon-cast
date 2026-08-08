import { useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { PreviewProps } from "./interface";
import styles from "./Image.module.css";
import Button from "../button";

export function Preview({
  open,
  src,
  items = [],
  current = 0,
  onClose,
  onChange,
  countRender,
}: PreviewProps) {
  const { t } = useTranslation("components");
  const overlayRef = useRef<HTMLDivElement>(null);
  const total = items.length;
  const hasPrev = total > 1 && current > 0;
  const hasNext = total > 1 && current < total - 1;

  const goPrev = useCallback(() => {
    if (hasPrev && onChange) onChange(current - 1, current);
  }, [hasPrev, current, onChange]);

  const goNext = useCallback(() => {
    if (hasNext && onChange) onChange(current + 1, current);
  }, [hasNext, current, onChange]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, goPrev, goNext]);

  if (!open) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const displaySrc = items.length > 0 ? items[current] : src;

  return (
    <div className={styles.overlay} ref={overlayRef} onClick={handleOverlayClick}>
      <div className={styles.previewWrap}>
        <Button
          type="text"
          shape="circle"
          className={styles.closeBtn}
          icon={
            <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          }
          onClick={onClose}
          aria-label={t("image.close")}
        />

        {total > 1 && (
          <>
            <Button
              type="text"
              shape="circle"
              className={`${styles.navBtn} ${styles.navPrev}`}
              icon={
                <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              }
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
              disabled={!hasPrev}
              aria-label={t("image.prev")}
            />
            <Button
              type="text"
              shape="circle"
              className={`${styles.navBtn} ${styles.navNext}`}
              icon={
                <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              }
              onClick={(e) => { e.stopPropagation(); goNext(); }}
              disabled={!hasNext}
              aria-label={t("image.next")}
            />
          </>
        )}

        <div className={styles.previewBody}>
          <img src={displaySrc} alt="" className={styles.previewImage} />
        </div>

        {total > 1 && (
          <div className={styles.counter}>
            {countRender
              ? countRender(current + 1, total)
              : `${current + 1} / ${total}`}
          </div>
        )}
      </div>
    </div>
  );
}

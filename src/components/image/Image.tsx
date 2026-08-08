import { useState, useCallback } from "react";
import type { ImageProps } from "./interface";
import { Preview } from "./Preview";
import { PreviewGroup } from "./PreviewGroup";
import styles from "./Image.module.css";

function ImageComponent({
  src,
  alt,
  width,
  height,
  fallback,
  preview = true,
  className,
  style,
  onClick,
}: ImageProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [imgSrc, setImgSrc] = useState(src);
  const [errored, setErrored] = useState(false);

  const previewConfig = typeof preview === "object" ? preview : null;
  const previewDisabled = preview === false;
  const isControlled = previewConfig?.open !== undefined;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      onClick?.(e);
      if (!previewDisabled) {
        if (!isControlled) setPreviewOpen(true);
        previewConfig?.onOpenChange?.(true);
      }
    },
    [onClick, previewDisabled, isControlled, previewConfig]
  );

  const handleClose = useCallback(() => {
    if (!isControlled) setPreviewOpen(false);
    previewConfig?.onOpenChange?.(false);
  }, [isControlled, previewConfig]);

  const handleError = useCallback(() => {
    if (fallback && !errored) {
      setImgSrc(fallback);
      setErrored(true);
    }
  }, [fallback, errored]);

  const open = isControlled ? previewConfig!.open! : previewOpen;
  const previewSrc = previewConfig?.src || src;

  return (
    <>
      <img
        src={imgSrc}
        alt={alt}
        width={width}
        height={height}
        className={`${styles.image}${!previewDisabled ? ` ${styles.previewable}` : ""}${className ? ` ${className}` : ""}`}
        style={style}
        onClick={handleClick}
        onError={handleError}
      />
      {!previewDisabled && (
        <Preview
          open={open}
          src={previewSrc}
          onClose={handleClose}
        />
      )}
    </>
  );
}

ImageComponent.PreviewGroup = PreviewGroup;
ImageComponent.displayName = "Image";

export const Image = ImageComponent;

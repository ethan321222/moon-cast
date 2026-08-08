import { useState, useCallback } from "react";
import type { PreviewGroupProps, GroupPreviewConfig } from "./interface";
import { Preview } from "./Preview";

export function PreviewGroup({ items = [], preview, children }: PreviewGroupProps) {
  const config = typeof preview === "object" ? preview : ({} as GroupPreviewConfig);
  const disabled = preview === false;

  const isControlled = config.open !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const [internalCurrent, setInternalCurrent] = useState(0);

  const open = isControlled ? config.open! : internalOpen;
  const current = config.current ?? internalCurrent;

  const handleClose = useCallback(() => {
    if (!isControlled) setInternalOpen(false);
    config.onOpenChange?.(false);
  }, [isControlled, config]);

  const handleChange = useCallback(
    (next: number, prev: number) => {
      if (config.current === undefined) setInternalCurrent(next);
      config.onChange?.(next, prev);
    },
    [config]
  );

  if (disabled) return <>{children}</>;

  return (
    <>
      {children}
      <Preview
        open={open}
        src={items[current] || ""}
        items={items}
        current={current}
        onClose={handleClose}
        onChange={handleChange}
        countRender={config.countRender}
      />
    </>
  );
}

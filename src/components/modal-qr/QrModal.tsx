import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import QRCode from "qrcode";
import Modal from "@/components/modal";
import Button from "@/components/button";

export type QrType = "canvas" | "img";

interface QrModalProps {
  url: string;
  visible: boolean;
  onClose: () => void;
  /** 渲染方式，默认 canvas */
  type?: QrType;
}

export function QrModal({ url, visible, onClose, type = "canvas" }: QrModalProps) {
  const { t } = useTranslation("control");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    if (!visible || !url) return;

    if (type === "canvas" && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, url, {
        width: 256,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      });
    } else if (type === "img") {
      QRCode.toDataURL(url, {
        width: 256,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      }).then(setDataUrl).catch(() => {});
    }
  }, [url, visible, type]);

  const copyUrl = useCallback(() => {
    navigator.clipboard.writeText(url).catch(() => {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    });
  }, [url]);

  return (
    <Modal open={visible} onClose={onClose} title={t("qrModal.title")} width={340}>
      <div className="flex w-full flex-col items-center">
        {type === "canvas" ? (
          <canvas ref={canvasRef} className="rounded-lg block max-w-full h-auto object-contain" />
        ) : (
          dataUrl && (
            <img
              src={dataUrl}
              alt="QR Code"
              className="rounded-lg block max-w-full h-auto"
            />
          )
        )
        }
        <div className="mt-3 w-full text-xs text-[var(--color-text-secondary)] text-center break-all">{url}</div>
        <Button type="primary" className="mt-3" onClick={copyUrl}>
          {t("common:copyLink")}
        </Button>
      </div>
    </Modal>
  );
}

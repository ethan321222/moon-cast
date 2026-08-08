import { Image } from "@/components/image";
import Button from "@/components/button";

export interface MediaEntry {
  /** 文件名 */
  name: string;
  /** 媒体类型（完整 MIME） */
  media_type: string;
}

export interface MediaPreviewProps<T extends MediaEntry = MediaEntry> {
  /** 当前预览的条目 */
  previewEntry: T | null;
  /** 所有条目（用于提取图片列表） */
  entries: T[];
  /** 根据条目获取资源 URL */
  getHref: (entry: T) => string;
  /** 关闭预览 */
  onClose: () => void;
  /** 切换预览条目 */
  onChange: (entry: T) => void;
}

export function MediaPreview<T extends MediaEntry>({ previewEntry, entries, getHref, onClose, onChange }: MediaPreviewProps<T>) {
  const imageEntries = entries.filter((e) => e.media_type.startsWith("image/"));
  const imageUrls = imageEntries.map((e) => getHref(e));
  const currentImageIndex = previewEntry ? imageEntries.findIndex((e) => e.name === previewEntry.name) : -1;

  return (
    <>
      {/* 图片预览 */}
      <Image.PreviewGroup
        items={imageUrls}
        preview={{
          open: !!previewEntry && previewEntry.media_type.startsWith("image/"),
          current: currentImageIndex >= 0 ? currentImageIndex : 0,
          onOpenChange: (open) => { if (!open) onClose(); },
          onChange: (current) => onChange(imageEntries[current]),
        }}
      />

      {/* 视频/音频预览 */}
      {previewEntry && (previewEntry.media_type.startsWith("video/") || previewEntry.media_type.startsWith("audio/")) && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70"
          onClick={onClose}
        >
          <div
            className="relative max-w-[90vw] max-h-[90vh] rounded-lg overflow-hidden bg-black"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              type="text"
              shape="circle"
              className="absolute top-3 right-3 z-10 !bg-black/50 !text-white hover:!bg-black/70"
              icon={
                <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              }
              onClick={onClose}
            />
            {previewEntry.media_type.startsWith("video/") && (
              <video src={getHref(previewEntry)} controls autoPlay className="max-w-[90vw] max-h-[90vh]" />
            )}
            {previewEntry.media_type.startsWith("audio/") && (
              <div className="flex flex-col items-center gap-4 px-10 py-8">
                <div className="text-white text-sm font-medium">{previewEntry.name}</div>
                <audio src={getHref(previewEntry)} controls autoPlay className="w-[320px]" />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

import React from "react";

export interface FileIconEntry {
  is_dir: boolean;
  media_type: string;
}

interface IconProps {
  size?: number;
}

// Windows 11 风格文件夹图标
function FolderIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path
        d="M3 7.5C3 6.12 4.12 5 5.5 5h7.88a2 2 0 0 1 1.41.59L16.7 7.5H26.5C27.88 7.5 29 8.62 29 10v15.5c0 1.38-1.12 2.5-2.5 2.5h-21C4.12 28 3 26.88 3 25.5V7.5Z"
        fill="url(#folder-grad)"
      />
      <path
        d="M3 12h26v13.5c0 1.38-1.12 2.5-2.5 2.5h-21C4.12 28 3 26.88 3 25.5V12Z"
        fill="url(#folder-front)"
      />
      <defs>
        <linearGradient id="folder-grad" x1="16" y1="5" x2="16" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFD060" />
          <stop offset="1" stopColor="#F0A030" />
        </linearGradient>
        <linearGradient id="folder-front" x1="16" y1="12" x2="16" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFE088" />
          <stop offset="1" stopColor="#F5C040" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// Windows 11 风格视频图标
function VideoIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect x="3" y="6" width="26" height="20" rx="3" fill="url(#video-grad)" />
      <path d="M13 11.5v9l7.5-4.5L13 11.5Z" fill="#fff" />
      <defs>
        <linearGradient id="video-grad" x1="16" y1="6" x2="16" y2="26" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#6D28D9" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// Windows 11 风格音频图标
function AudioIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect x="3" y="4" width="26" height="24" rx="3" fill="url(#audio-grad)" />
      <path d="M12 22V12l10-2v10" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="10" cy="22" r="2.5" fill="#fff" />
      <circle cx="20" cy="20" r="2.5" fill="#fff" />
      <defs>
        <linearGradient id="audio-grad" x1="16" y1="4" x2="16" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F472B6" />
          <stop offset="1" stopColor="#DB2777" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// Windows 11 风格图片图标
function ImageIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect x="3" y="5" width="26" height="22" rx="3" fill="url(#image-grad)" />
      <circle cx="11" cy="13" r="2.5" fill="#FDE68A" />
      <path d="M3 22l7-6 4 3 8-7 7 6v6.5A2.5 2.5 0 0 1 26.5 27h-21A2.5 2.5 0 0 1 3 24.5V22Z" fill="rgba(255,255,255,0.3)" />
      <defs>
        <linearGradient id="image-grad" x1="16" y1="5" x2="16" y2="27" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34D399" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// Windows 11 风格 PDF 图标
function PdfIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path d="M7 3h12l7 7v19a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" fill="url(#pdf-grad)" />
      <path d="M19 3v5a2 2 0 0 0 2 2h5" fill="#B91C1C" />
      <text x="16" y="23" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#fff">PDF</text>
      <defs>
        <linearGradient id="pdf-grad" x1="16" y1="3" x2="16" y2="31" gradientUnits="userSpaceOnUse">
          <stop stopColor="#EF4444" />
          <stop offset="1" stopColor="#B91C1C" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// Windows 11 风格压缩包图标
function ArchiveIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path d="M7 3h18a2 2 0 0 1 2 2v22a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" fill="url(#archive-grad)" />
      <rect x="14" y="5" width="4" height="3" rx="0.5" fill="#FDE68A" />
      <rect x="14" y="9" width="4" height="3" rx="0.5" fill="#FDE68A" />
      <rect x="14" y="13" width="4" height="3" rx="0.5" fill="#FDE68A" />
      <rect x="13" y="18" width="6" height="7" rx="1" fill="#FDE68A" />
      <rect x="15" y="19" width="2" height="2" rx="0.5" fill="#92400E" />
      <defs>
        <linearGradient id="archive-grad" x1="16" y1="3" x2="16" y2="29" gradientUnits="userSpaceOnUse">
          <stop stopColor="#60A5FA" />
          <stop offset="1" stopColor="#2563EB" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// Windows 11 风格代码文件图标
function CodeIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path d="M7 3h12l7 7v19a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" fill="url(#code-grad)" />
      <path d="M19 3v5a2 2 0 0 0 2 2h5" fill="#1E40AF" />
      <path d="M12 17l-3 3 3 3M20 17l3 3-3 3M17 15l-2 10" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="code-grad" x1="16" y1="3" x2="16" y2="31" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3B82F6" />
          <stop offset="1" stopColor="#1E40AF" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// Windows 11 风格文本文件图标
function TextIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path d="M7 3h12l7 7v19a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" fill="url(#text-grad)" />
      <path d="M19 3v5a2 2 0 0 0 2 2h5" fill="#0369A1" />
      <path d="M10 16h12M10 20h10M10 24h8" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
      <defs>
        <linearGradient id="text-grad" x1="16" y1="3" x2="16" y2="31" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38BDF8" />
          <stop offset="1" stopColor="#0284C7" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// Windows 11 风格默认文件图标
function DefaultFileIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path d="M7 3h12l7 7v19a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" fill="url(#default-grad)" />
      <path d="M19 3v5a2 2 0 0 0 2 2h5" fill="#4B5563" />
      <defs>
        <linearGradient id="default-grad" x1="16" y1="3" x2="16" y2="31" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9CA3AF" />
          <stop offset="1" stopColor="#6B7280" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/**
 * 根据 MIME type 判断对应图标类别
 */
function getIconCategory(mediaType: string): string {
  if (mediaType === "directory") return "folder";

  const [type, subtype] = mediaType.split("/");

  switch (type) {
    case "video":
      return "video";
    case "audio":
      return "audio";
    case "image":
      return "image";
    case "text":
      // 代码类 MIME
      if (["javascript", "typescript", "x-python", "x-java", "x-c", "x-rust", "html", "css", "xml"].some(s => subtype?.includes(s))) {
        return "code";
      }
      return "text";
    case "application":
      if (subtype === "pdf") return "pdf";
      if (["zip", "x-tar", "gzip", "x-bzip2", "x-xz", "x-7z-compressed", "x-rar-compressed", "vnd.rar"].includes(subtype)) return "archive";
      if (["json", "x-sh", "x-httpd-php", "xml", "yaml", "toml", "wasm"].some(s => subtype?.includes(s))) return "code";
      if (["msword", "vnd.openxmlformats-officedocument.wordprocessingml", "vnd.oasis.opendocument.text", "rtf"].some(s => subtype?.includes(s))) return "document";
      if (["vnd.ms-excel", "vnd.openxmlformats-officedocument.spreadsheetml", "vnd.oasis.opendocument.spreadsheet"].some(s => subtype?.includes(s))) return "spreadsheet";
      if (["vnd.ms-powerpoint", "vnd.openxmlformats-officedocument.presentationml", "vnd.oasis.opendocument.presentation"].some(s => subtype?.includes(s))) return "presentation";
      return "file";
    default:
      return "file";
  }
}

const ICON_COMPONENTS: Record<string, React.FC<IconProps>> = {
  video: VideoIcon,
  audio: AudioIcon,
  image: ImageIcon,
  pdf: PdfIcon,
  archive: ArchiveIcon,
  code: CodeIcon,
  text: TextIcon,
};

/**
 * 根据文件条目的 media_type（MIME 字符串）返回对应的 Windows 11 风格 SVG 图标
 */
export function getFileIcon(entry: FileIconEntry, size = 20): React.ReactNode {
  if (entry.is_dir) return <FolderIcon size={size} />;
  const category = getIconCategory(entry.media_type);
  const IconComp = ICON_COMPONENTS[category];
  if (IconComp) return <IconComp size={size} />;
  return <DefaultFileIcon size={size} />;
}

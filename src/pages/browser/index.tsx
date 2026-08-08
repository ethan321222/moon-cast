import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import type {
  DirResponse,
  DirEntry,
  SortField,
  SortDirection,
  ViewMode,
} from "../../types";
import { listDirectory, uploadFile, deletePath, renamePath, createDirectory } from "../../api/client";
import { List } from "../../components/list";
import { Breadcrumb } from "../../components/breadcrumb";
import { Upload } from "../../components/upload";
import type { CustomRequestOptions, UploadChangeParam } from "../../components/upload";
import { useMessage } from "../../components/message";
import { useTheme, initTheme } from "../../hooks/useTheme";
import Button from "../../components/button";
import { CreateFolderModal, type CreateFolderModalRef } from "./create-folder-modal";
import { MediaPreview } from "./media-preview";
import { ContextMenu } from "../../components/context-menu";
import { getStorage, setStorage } from "../../utils/storage";
import { getFileIcon } from "../../utils/file-icon";
import { formatSize, formatDate } from "../../utils/format";

export function Browser() {
  const { t } = useTranslation("browser");
  const { theme: colorMode, toggleTheme } = useTheme();
  const [viewMode, setViewMode] = useState<ViewMode>(getStorage<ViewMode>("viewMode", "detail"));
  const [dirData, setDirData] = useState<DirResponse | null>(null);
  const [currentPath, setCurrentPath] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewEntry, setPreviewEntry] = useState<DirEntry | null>(null);
  const [messageApi, contextHolder] = useMessage();
  const [renaming, setRenaming] = useState<DirEntry | null>(null);
  const [newName, setNewName] = useState("");
  const createFolderModalRef = useRef<CreateFolderModalRef>(null);

  const loadDir = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await listDirectory(path);
      setDirData(data);
      setCurrentPath(path);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { initTheme(); }, []);
  useEffect(() => { loadDir(""); }, [loadDir]);

  useEffect(() => {
    const handler = () => {
      const path = window.location.pathname.slice(1);
      loadDir(path);
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [loadDir]);

  useEffect(() => {
    if (currentPath) {
      const parts = currentPath.split("/");
      document.title = `${parts[parts.length - 1]} — MoonCast`;
    } else {
      document.title = "MoonCast";
    }
  }, [currentPath]);

  const navigate = useCallback(
    (path: string) => {
      const normalized = path.startsWith("/") ? path : `/${path}`;
      window.history.pushState(null, "", normalized);
      loadDir(path.replace(/^\//, ""));
    },
    [loadDir]
  );

  const handleEntryClick = useCallback(
    (entry: DirEntry) => {
      const href = `/${entry.rel_path}`;
      if (entry.is_dir) {
        navigate(href);
      } else if (entry.media_type.startsWith("image/")) {
        setPreviewEntry(entry);
      } else if (entry.media_type.startsWith("video/") || entry.media_type.startsWith("audio/")) {
        setPreviewEntry(entry);
      } else {
        window.open(href, "_blank");
      }
    },
    [navigate]
  );

  const sortedEntries = dirData
    ? [...dirData.entries].sort((a, b) => {
        if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
        let cmp = 0;
        switch (sortField) {
          case "name": cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" }); break;
          case "size": cmp = a.size - b.size; break;
          case "created": cmp = a.created_ts - b.created_ts; break;
          case "modified": cmp = a.modified_ts - b.modified_ts; break;
        }
        return sortDir === "asc" ? cmp : -cmp;
      })
    : [];

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDir("asc");
      }
    },
    [sortField]
  );

  const handleViewModeChange = useCallback((v: ViewMode) => { setViewMode(v); setStorage("viewMode", v); }, []);

  const customRequest = useCallback(
    ({ file, onSuccess, onError, onProgress }: CustomRequestOptions) => {
      uploadFile(currentPath, file, (loaded, total) => {
        onProgress({ percent: Math.round((loaded / total) * 100) });
      })
        .then(() => onSuccess())
        .catch((e) => onError(e instanceof Error ? e : new Error(t("action.upload.error"))));
    },
    [currentPath]
  );

  const handleUploadChange = useCallback(
    ({ file }: UploadChangeParam) => {
      if (file.status === "done") {
        messageApi.success(t("action.upload.success", { name: file.name }));
        loadDir(currentPath);
      } else if (file.status === "error") {
        messageApi.error(file.error?.message || t("action.upload.error"));
      }
    },
    [messageApi, loadDir, currentPath]
  );

  // --- 文件操作 ---

  const handleDelete = useCallback(
    async (entry: DirEntry) => {
      if (!confirm(t("action.delete.confirm", { name: entry.name }))) return;
      try {
        await deletePath(entry.rel_path);
        messageApi.success(t("action.delete.success", { name: entry.name }));
        loadDir(currentPath);
      } catch (e) {
        messageApi.error(e instanceof Error ? e.message : t("action.delete.error"));
      }
    },
    [messageApi, currentPath, loadDir]
  );

  const handleRename = useCallback((entry: DirEntry) => {
    setRenaming(entry);
    setNewName(entry.name);
  }, []);

  const submitRename = useCallback(async () => {
    if (!renaming || !newName || newName === renaming.name) {
      setRenaming(null);
      return;
    }
    try {
      await renamePath(renaming.rel_path, newName);
      messageApi.success(t("action.rename.success", { name: newName }));
      loadDir(currentPath);
    } catch (e) {
      messageApi.error(e instanceof Error ? e.message : t("action.rename.error"));
    }
    setRenaming(null);
  }, [renaming, newName, messageApi, currentPath, loadDir]);

  const handleMkdir = useCallback(async (folderName: string) => {
    try {
      const basePath = currentPath ? `${currentPath}/${folderName}` : folderName;
      await createDirectory(basePath);
      messageApi.success(t("action.mkdir.success", { name: folderName }));
      loadDir(currentPath);
    } catch (e) {
      messageApi.error(e instanceof Error ? e.message : t("action.mkdir.error"));
    }
  }, [currentPath, messageApi, loadDir]);

  const sortIndicator = (field: SortField) => {
    if (sortField !== field) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  };

  // --- RENDER ---

  return (
    <div className="h-screen flex flex-col bg-[var(--color-bg-sunken)] text-[var(--color-text)]">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-[var(--color-bg-elevated)] border-b border-[var(--color-border)] shadow-[var(--shadow-sm)] z-10">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="MoonCast" className="w-6 h-6" />
          <h1 className="hidden sm:block text-lg font-semibold">MoonCast</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            icon={
              <svg viewBox="64 64 896 896" width="1em" height="1em" fill="currentColor" aria-hidden="true">
                <path d="M484 443.1V528h-84.5c-4.1 0-7.5 3.1-7.5 7v42c0 3.8 3.4 7 7.5 7H484v84.9c0 3.9 3.2 7.1 7 7.1h42c3.9 0 7-3.2 7-7.1V584h84.5c4.1 0 7.5-3.2 7.5-7v-42c0-3.9-3.4-7-7.5-7H540v-84.9c0-3.9-3.1-7.1-7-7.1h-42c-3.8 0-7 3.2-7 7.1zM880 298.4H521L403.7 186.2a8.15 8.15 0 00-5.5-2.2H144c-17.7 0-32 14.3-32 32v592c0 17.7 14.3 32 32 32h736c17.7 0 32-14.3 32-32V330.4c0-17.7-14.3-32-32-32z" />
              </svg>
            }
            onClick={() => createFolderModalRef.current?.open()}
            title={t("header.newFolder")}
          />
          <Button
            icon={
              viewMode === "detail" ? (
                <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true">
                  <rect x="3" y="3" width="8" height="8" rx="1" />
                  <rect x="13" y="3" width="8" height="8" rx="1" />
                  <rect x="3" y="13" width="8" height="8" rx="1" />
                  <rect x="13" y="13" width="8" height="8" rx="1" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="3" rx="1" />
                  <rect x="3" y="10.5" width="18" height="3" rx="1" />
                  <rect x="3" y="17" width="18" height="3" rx="1" />
                </svg>
              )
            }
            onClick={() => handleViewModeChange(viewMode === "detail" ? "grid" : "detail")}
            title={viewMode === "detail" ? t("header.switchToGrid") : t("header.switchToDetail")}
          />
          <Button
            icon={
              <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.39 5.39 0 0 1-5.4-5.4c0-.46-.04-.92-.1-1.36A9 9 0 0 0 12 3z" />
              </svg>
            }
            onClick={toggleTheme}
            title={colorMode === "light" ? t("header.themeDark") : t("header.themeLight")}
          />
          <Upload
            multiple
            showUploadList={false}
            customRequest={customRequest}
            onChange={handleUploadChange}
          >
            <Button
              icon={
                <svg viewBox="64 64 896 896" width="1em" height="1em" fill="currentColor" aria-hidden="true">
                  <path d="M400 317.7h73.9V656c0 4.4 3.6 8 8 8h60c4.4 0 8-3.6 8-8V317.7H624c6.7 0 10.4-7.7 6.3-12.9L518.3 163a8 8 0 00-12.6 0l-112 141.7c-4.1 5.3-.4 13 6.3 13zM878 626h-60c-4.4 0-8 3.6-8 8v154H214V634c0-4.4-3.6-8-8-8h-60c-4.4 0-8 3.6-8 8v198c0 17.7 14.3 32 32 32h684c17.7 0 32-14.3 32-32V634c0-4.4-3.6-8-8-8z" />
                </svg>
              }
              title={t("header.upload")}
            />
          </Upload>
          <Button
            icon={
              <svg viewBox="64 64 896 896" width="1em" height="1em" fill="currentColor" aria-hidden="true">
                <path d="M909.1 209.3l-56.4 44.1C775.8 155.1 656.2 92 521.9 92 290 92 102.3 279.5 102 511.5 101.7 743.7 289.8 932 521.9 932c181.3 0 335.8-115 394.6-276.1 1.5-4.2-.7-8.9-4.9-10.3l-56.7-19.5a8 8 0 00-10.1 4.8c-1.8 5-3.8 10-5.9 14.9-17.3 41-42.1 77.8-73.7 109.4A344.77 344.77 0 01521.9 836C346.8 836 204 693.2 204 518S346.8 200 521.9 200c130.1 0 245.1 78.3 294.5 199.4l-60.2 47a8 8 0 003 14.1l175.7 43c5 1.2 9.9-2.6 9.9-7.7l.8-180.9c-.1-6.6-7.8-10.3-13-6.2z" />
              </svg>
            }
            onClick={() => loadDir(currentPath)}
            title={t("header.refresh")}
          />
        </div>
      </header>

      {dirData && <Breadcrumb path={dirData.path} onNavigate={navigate} />}


      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {error && (
          <div className="mx-4 my-4 px-4 py-4 rounded-md border border-[var(--color-danger)] bg-[var(--color-primary-soft)] text-[var(--color-danger)]">
            {error}
          </div>
        )}
        {dirData && (
          <List
            dataSource={sortedEntries}
            loading={loading}
            grid={viewMode === "grid" ? { column: 4, gutter: 12 } : undefined}
            locale={{ emptyText: t("list.empty") }}
            footer={
              <span>
                {t("list.folders", { count: dirData.entries.filter((e) => e.is_dir).length })},{" "}
                {t("list.files", { count: dirData.entries.filter((e) => !e.is_dir).length })}
              </span>
            }
            header={
              viewMode === "detail" ? (
                <div className="flex items-center justify-between">
                  <span className="flex-1 min-w-0 cursor-pointer select-none hover:text-[var(--color-primary)]" onClick={() => handleSort("name")}>{t("sort.name")}{sortIndicator("name")}</span>
                  <span className="shrink-0 w-20 text-right cursor-pointer select-none hover:text-[var(--color-primary)]" onClick={() => handleSort("size")}>{t("sort.size")}{sortIndicator("size")}</span>
                  <span className="shrink-0 w-[140px] text-right cursor-pointer select-none hover:text-[var(--color-primary)]" onClick={() => handleSort("modified")}>{t("sort.modified")}{sortIndicator("modified")}</span>
                </div>
              ) : undefined
            }
            renderItem={(entry) => (
              <ContextMenu
                items={[
                  { key: "rename", label: t("contextMenu.rename") },
                  { key: "delete", label: t("contextMenu.delete"), danger: true },
                ]}
                onClick={(key) => {
                  if (key === "rename") handleRename(entry);
                  if (key === "delete") handleDelete(entry);
                }}
              >
                <List.Item
                  onClick={() => handleEntryClick(entry)}
                  extra={viewMode === "detail" ? (
                    <span className="flex items-center shrink-0">
                      <span className="w-20 text-right text-xs text-[var(--color-text-secondary)]">{entry.is_dir ? "-" : formatSize(entry.size)}</span>
                      <span className="w-[140px] text-right text-xs text-[var(--color-text-secondary)]">{formatDate(entry.modified_ts)}</span>
                    </span>
                  ) : undefined}
                >
                  {renaming?.rel_path === entry.rel_path ? (
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onBlur={submitRename}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitRename();
                        if (e.key === "Escape") setRenaming(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      className="px-1.5 py-0.5 border border-[var(--color-primary)] rounded text-[13px] bg-[var(--color-bg-elevated)] text-[var(--color-text)] outline-none"
                    />
                  ) : (
                    <List.Item.Meta
                      avatar={<span className="file-icon text-base shrink-0">{getFileIcon(entry)}</span>}
                      title={entry.name}
                      description={viewMode !== "detail" ? (entry.is_dir ? t("list.folder") : `${formatSize(entry.size)} · ${formatDate(entry.modified_ts)}`) : undefined}
                    />
                  )}
                </List.Item>
              </ContextMenu>
            )}
          />
        )}

        {/* 新建文件夹对话框 */}
        <CreateFolderModal ref={createFolderModalRef} onCreate={handleMkdir} />
      </main>

      {/* 媒体预览 */}
      {dirData && (
        <MediaPreview
          previewEntry={previewEntry}
          entries={dirData.entries}
          getHref={(entry) => `/${entry.rel_path}`}
          onClose={() => setPreviewEntry(null)}
          onChange={(entry) => setPreviewEntry(entry)}
        />
      )}

      {contextHolder}
    </div>
  );
}

import type { UploadFile } from "./interface";
import { useTranslation } from "react-i18next";
import styles from "./Upload.module.css";

interface UploadListProps {
  files: UploadFile[];
  onRemove: (file: UploadFile) => void;
}

export function UploadList({ files, onRemove }: UploadListProps) {
  const { t } = useTranslation("common");
  if (files.length === 0) return null;

  return (
    <div className={styles.list}>
      {files.map((file) => (
        <div key={file.uid} className={`${styles.item} ${file.status ? styles[file.status] : ""}`}>
          <span className={styles.fileIcon}>
            {file.status === "uploading" ? (
              <svg className={styles.spinning} viewBox="0 0 1024 1024" width="1em" height="1em" fill="currentColor">
                <path d="M988 548c-19.9 0-36-16.1-36-36 0-59.4-11.6-117-34.6-171.3a440.45 440.45 0 00-94.3-139.9 437.71 437.71 0 00-139.9-94.3C629 83.6 571.4 72 512 72c-19.9 0-36-16.1-36-36s16.1-36 36-36c69.1 0 136.2 13.5 199.3 40.3C772.3 66 827 103 874 150c47 47 83.9 101.8 109.7 162.7 26.7 63.1 40.2 130.2 40.3 199.3 0 19.9-16.1 36-36 36z" />
              </svg>
            ) : (
              <svg viewBox="64 64 896 896" width="1em" height="1em" fill="currentColor">
                <path d="M779.3 196.6c-94.2-94.2-247.6-94.2-341.7 0l-261 260.8c-1.7 1.7-2.6 4-2.6 6.4s.9 4.7 2.6 6.4l36.9 36.9a9 9 0 0012.7 0l261-260.8c32.4-32.4 75.5-50.2 121.3-50.2s88.9 17.8 121.2 50.2c32.4 32.4 50.2 75.5 50.2 121.2 0 45.8-17.8 88.8-50.2 121.2l-266 265.9-43.1 43.1c-40.3 40.3-105.8 40.3-146.1 0-19.5-19.5-30.2-45.4-30.2-73s10.7-53.5 30.2-73l263.9-263.8c6.7-6.6 15.5-10.3 24.9-10.3h.1c9.4 0 18.1 3.7 24.7 10.3 6.7 6.7 10.3 15.5 10.3 24.9 0 9.3-3.7 18.1-10.3 24.7L372.4 653c-1.7 1.7-2.6 4-2.6 6.4s.9 4.7 2.6 6.4l36.9 36.9a9 9 0 0012.7 0l215.6-215.6c19.9-19.9 30.8-46.3 30.8-74.4s-11-54.6-30.8-74.4c-41.1-41.1-107.9-41-149 0L463 364 224.8 602.1A172.22 172.22 0 00174 724.8c0 46.3 18.1 89.8 50.8 122.5 33.9 33.8 78.3 50.7 122.7 50.7 44.4 0 88.8-16.9 122.6-50.7l309.2-309c94.1-94.2 94.1-247.6 0-341.8z" />
              </svg>
            )}
          </span>
          <span className={styles.fileName}>{file.name}</span>
          <span className={styles.actions}>
            <button
              className={styles.removeBtn}
              onClick={(e) => { e.stopPropagation(); onRemove(file); }}
              title={t("delete")}
            >
              <svg viewBox="64 64 896 896" width="1em" height="1em" fill="currentColor">
                <path d="M360 184h-8c4.4 0 8-3.6 8-8v8h304v-8c0 4.4 3.6 8 8 8h-8v72h72v-80c0-35.3-28.7-64-64-64H352c-35.3 0-64 28.7-64 64v80h72v-72zm504 72H160c-17.7 0-32 14.3-32 32v32c0 4.4 3.6 8 8 8h60.4l24.7 523c1.6 34.1 29.8 61 63.9 61h454c34.2 0 62.3-26.8 63.9-61l24.7-523H888c4.4 0 8-3.6 8-8v-32c0-17.7-14.3-32-32-32zM731.3 840H292.7l-24.2-512h487l-24.2 512z" />
              </svg>
            </button>
          </span>
          {file.status === "uploading" && file.percent != null && (
            <div className={styles.progress}>
              <div
                className={styles.progressBar}
                style={{ width: `${file.percent}%` }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

import { useState, useCallback, useRef } from "react";
import type { DraggerProps, UploadFile } from "./interface";
import { Upload } from "./Upload";
import type { UploadRef } from "./Upload";
import { UploadList } from "./UploadList";
import styles from "./Upload.module.css";

export function Dragger({ height, children, disabled, showUploadList = true, onChange, ...rest }: DraggerProps) {
  const [dragOver, setDragOver] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const uploadRef = useRef<UploadRef>(null);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) setDragOver(true);
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      if (disabled) return;

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        uploadRef.current?.processFiles(files);
      }
    },
    [disabled]
  );

  const handleChange = useCallback(
    (info: { file: UploadFile; fileList: UploadFile[] }) => {
      setFileList(info.fileList);
      onChange?.(info);
    },
    [onChange]
  );

  const handleRemove = useCallback((file: UploadFile) => {
    uploadRef.current?.removeFile(file);
  }, []);

  return (
    <div className={styles.draggerWrapper}>
      <div
        className={`${styles.dragger} ${dragOver ? styles.dragOver : ""} ${disabled ? styles.disabled : ""}`}
        style={height ? { height } : undefined}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Upload ref={uploadRef} {...rest} disabled={disabled} onChange={handleChange} showUploadList={false}>
          <div className={styles.draggerContent}>
            {children}
          </div>
        </Upload>
      </div>
      {showUploadList && fileList.length > 0 && (
        <UploadList files={fileList} onRemove={handleRemove} />
      )}
    </div>
  );
}

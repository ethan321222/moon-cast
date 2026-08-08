import { useState, useCallback, useRef, useImperativeHandle, forwardRef } from "react";
import type { UploadProps, UploadFile } from "./interface";
import { UploadList } from "./UploadList";
import styles from "./Upload.module.css";

let uid = 0;
function genUid() {
  return `upload-${Date.now()}-${++uid}`;
}

function file2UploadFile(file: File): UploadFile {
  return {
    uid: genUid(),
    name: file.name,
    size: file.size,
    type: file.type,
    status: "uploading",
    percent: 0,
    originFileObj: file,
  };
}

export interface UploadRef {
  processFiles: (files: File[]) => void;
  getFileList: () => UploadFile[];
  removeFile: (file: UploadFile) => void;
}

export const Upload = forwardRef<UploadRef, UploadProps>(function Upload(
  {
    fileList: controlledFileList,
    defaultFileList,
    onChange,
    customRequest,
    beforeUpload,
    onRemove,
    multiple = false,
    accept,
    disabled = false,
    maxCount,
    showUploadList = true,
    children,
  },
  ref
) {
  const [internalFileList, setInternalFileList] = useState<UploadFile[]>(
    defaultFileList || []
  );
  const inputRef = useRef<HTMLInputElement>(null);

  const isControlled = controlledFileList !== undefined;
  const fileList = isControlled ? controlledFileList : internalFileList;
  const fileListRef = useRef(fileList);
  fileListRef.current = fileList;

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const triggerChange = useCallback(
    (nextList: UploadFile[], triggerFile: UploadFile) => {
      if (!isControlled) setInternalFileList(nextList);
      onChangeRef.current?.({ file: triggerFile, fileList: nextList });
    },
    [isControlled]
  );

  const startUpload = useCallback(
    (uploadFile: UploadFile) => {
      if (!customRequest || !uploadFile.originFileObj) return;

      customRequest({
        file: uploadFile.originFileObj,
        onProgress: ({ percent }) => {
          const updated = { ...uploadFile, percent, status: "uploading" as const };
          const next = fileListRef.current.map((f) =>
            f.uid === uploadFile.uid ? updated : f
          );
          triggerChange(next, updated);
        },
        onSuccess: (response) => {
          const updated = { ...uploadFile, status: "done" as const, percent: 100, response };
          const next = fileListRef.current.map((f) =>
            f.uid === uploadFile.uid ? updated : f
          );
          triggerChange(next, updated);
        },
        onError: (error) => {
          const updated = { ...uploadFile, status: "error" as const, error };
          const next = fileListRef.current.map((f) =>
            f.uid === uploadFile.uid ? updated : f
          );
          triggerChange(next, updated);
        },
      });
    },
    [customRequest, triggerChange]
  );

  const processFiles = useCallback(
    async (files: File[]) => {
      if (disabled) return;

      let filesToAdd = files;
      if (maxCount) {
        const remaining = maxCount - fileListRef.current.length;
        if (remaining <= 0) return;
        filesToAdd = files.slice(0, remaining);
      }

      for (const file of filesToAdd) {
        if (beforeUpload) {
          try {
            const result = await beforeUpload(file, filesToAdd);
            if (result === false) continue;
          } catch {
            continue;
          }
        }

        const uploadFile = file2UploadFile(file);
        const next = [...fileListRef.current, uploadFile];
        triggerChange(next, uploadFile);
        fileListRef.current = next;
        startUpload(uploadFile);
      }
    },
    [disabled, maxCount, beforeUpload, triggerChange, startUpload]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        processFiles(Array.from(e.target.files));
      }
      e.target.value = "";
    },
    [processFiles]
  );

  const handleRemove = useCallback(
    async (file: UploadFile) => {
      if (onRemove) {
        const result = await onRemove(file);
        if (result === false) return;
      }
      const removed = { ...file, status: "removed" as const };
      const next = fileListRef.current.filter((f) => f.uid !== file.uid);
      triggerChange(next, removed);
    },
    [onRemove, triggerChange]
  );

  useImperativeHandle(ref, () => ({ processFiles, getFileList: () => fileListRef.current, removeFile: handleRemove }), [processFiles, handleRemove]);

  const handleClick = useCallback(() => {
    if (!disabled) {
      inputRef.current?.click();
    }
  }, [disabled]);

  return (
    <div className={`${styles.wrapper} ${disabled ? styles.disabled : ""}`}>
      <div className={styles.trigger} onClick={handleClick}>
        {children}
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        onChange={handleFileSelect}
        className={styles.input}
      />
      {showUploadList && (
        <UploadList files={fileList} onRemove={handleRemove} />
      )}
    </div>
  );
});

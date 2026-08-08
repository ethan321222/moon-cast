import type React from "react";

export interface UploadFile {
  uid: string;
  name: string;
  size?: number;
  type?: string;
  status?: "uploading" | "done" | "error" | "removed";
  percent?: number;
  originFileObj?: File;
  response?: any;
  error?: any;
}

export interface UploadChangeParam {
  file: UploadFile;
  fileList: UploadFile[];
}

export interface CustomRequestOptions {
  file: File;
  onSuccess: (response?: any) => void;
  onError: (error: Error) => void;
  onProgress: (event: { percent: number }) => void;
}

export interface UploadProps {
  fileList?: UploadFile[];
  defaultFileList?: UploadFile[];
  onChange?: (info: UploadChangeParam) => void;
  customRequest?: (options: CustomRequestOptions) => void;
  beforeUpload?: (file: File, fileList: File[]) => boolean | Promise<boolean>;
  onRemove?: (file: UploadFile) => boolean | void | Promise<boolean | void>;
  multiple?: boolean;
  accept?: string;
  disabled?: boolean;
  maxCount?: number;
  showUploadList?: boolean;
  children?: React.ReactNode;
}

export interface DraggerProps extends UploadProps {
  height?: number;
}

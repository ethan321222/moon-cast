import { useState, useCallback, useImperativeHandle, forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "../../../components/modal";
import { Input } from "../../../components/input";
import Button from "../../../components/button";

export interface CreateFolderModalRef {
  open: () => void;
}

interface CreateFolderModalProps {
  onCreate: (name: string) => void;
}

export const CreateFolderModal = forwardRef<CreateFolderModalRef, CreateFolderModalProps>(
  ({ onCreate }, ref) => {
    const { t } = useTranslation("browser");
    const [visible, setVisible] = useState(false);
    const [name, setName] = useState("");

    useImperativeHandle(ref, () => ({
      open: () => {
        setName("");
        setVisible(true);
      },
    }));

    const handleCreate = useCallback(() => {
      if (!name.trim()) return;
      onCreate(name.trim());
      setVisible(false);
      setName("");
    }, [name, onCreate]);

    const handleClose = useCallback(() => {
      setVisible(false);
      setName("");
    }, []);

    return (
      <Modal open={visible} onClose={handleClose} title={t("createFolder.title")} width={360} centered={false}>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("createFolder.placeholder")}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          autoFocus
        />
        <div className="flex flex-wrap items-center justify-end gap-2 mt-4 w-full">
          <Button onClick={handleClose}>{t("common:cancel")}</Button>
          <Button type="primary" onClick={handleCreate} disabled={!name.trim()}>{t("common:create")}</Button>
        </div>
      </Modal>
    );
  },
);

CreateFolderModal.displayName = "CreateFolderModal";

import type { ReactNode } from "react";
import { Card } from "../../../components/card";

interface SettingBoxProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function SettingBox({ title, description, children }: SettingBoxProps) {
  return (
    <Card
      title={title}
      description={description}
      className="mb-2.5 overflow-visible [&_.card-head]:px-4 [&_.card-head]:pt-2.5 [&_.card-head]:pb-1.5"
    >
      {children}
    </Card>
  );
}

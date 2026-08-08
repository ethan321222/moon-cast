import Control from "./pages/control";
import { Browser } from "./pages/browser";
import "./styles/theme.css";
import "./styles/global.css";

export default function App() {
  // Tauri 窗口 → 控制面板；外部浏览器 → 文件浏览器
  if ("__TAURI_INTERNALS__" in window) {
    return <Control />;
  }
  return <Browser />;
}

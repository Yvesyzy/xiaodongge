import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import StorageGate from "../../mobile/src/codex_StorageGate";
import { installTheme } from "../../mobile/src/abu_theme";
import DesktopApp from "./codex_App";
import "../../mobile/src/styles.css";
import "../../mobile/src/codex_neumorphism.css";
import "../../mobile/src/abu_theme.css";
import "./codex_desktop.css";

installTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <StorageGate>
        <DesktopApp />
      </StorageGate>
    </HashRouter>
  </StrictMode>,
);

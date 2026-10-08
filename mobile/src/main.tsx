import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import StorageGate from "./codex_StorageGate";
import PrivacyGate from "./codex_PrivacyGate";
import { installPressHaptics } from "./abu_haptics";
import { installTheme } from "./abu_theme";
import "./styles.css";
import "./codex_neumorphism.css";
import "./abu_theme.css";
import "./codex_privacy.css";

installPressHaptics();
installTheme();

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <HashRouter>
      <PrivacyGate><StorageGate><App /></StorageGate></PrivacyGate>
    </HashRouter>
  </StrictMode>,
);

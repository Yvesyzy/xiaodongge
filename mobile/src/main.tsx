import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { installPressHaptics } from "./abu_haptics";
import "./styles.css";
import "./codex_neumorphism.css";

installPressHaptics();

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);

/**
 * Global appearance preference.
 *
 * The reader keeps its own independent light/dark switch (it is a full-screen
 * immersive view), so this theme only governs the rest of the app.
 */
export type ThemeChoice = "system" | "light" | "dark";

const KEY = "abu-theme-choice-v1";
const CHANGED = "abu:theme-changed";

export function readThemeChoice(): ThemeChoice {
  const stored = localStorage.getItem(KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
}

export function resolveDark(choice: ThemeChoice): boolean {
  if (choice === "dark") return true;
  if (choice === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyTheme(choice: ThemeChoice = readThemeChoice()) {
  document.documentElement.dataset.theme = resolveDark(choice) ? "dark" : "light";
}

export function setThemeChoice(choice: ThemeChoice) {
  localStorage.setItem(KEY, choice);
  applyTheme(choice);
  window.dispatchEvent(new CustomEvent(CHANGED));
}

/** Applies the stored choice now and keeps "system" in sync with the OS. */
export function installTheme(): () => void {
  applyTheme();
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const sync = () => { if (readThemeChoice() === "system") applyTheme("system"); };
  media.addEventListener("change", sync);
  return () => media.removeEventListener("change", sync);
}

export const THEME_CHANGED_EVENT = CHANGED;

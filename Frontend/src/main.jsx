import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { applyTheme, getTheme } from "./services/theme";

/* A new deploy replaces hashed chunks; a tab still running the previous
   build then fails to lazy-load a page (Vite "vite:preloadError").
   Reload once to pick up the current build; if it fails again, the
   error is left to surface normally. */
window.addEventListener("vite:preloadError", (event) => {
  const key = "chunk-reload-at";
  const last = Number(sessionStorage.getItem(key) || 0);
  if (Date.now() - last < 60000) return;
  sessionStorage.setItem(key, String(Date.now()));
  event.preventDefault();
  window.location.reload();
});

// Restore the saved theme before the first paint
applyTheme(getTheme());

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

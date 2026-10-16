/* =========================================================
   THEME — Tailwind `darkMode: "class"` on <html>, persisted.
========================================================= */
const KEY = "theme";

export const getTheme = () => {
  try {
    return localStorage.getItem(KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
};

export const applyTheme = (theme) => {
  const next = theme === "dark" ? "dark" : "light";
  document.documentElement.classList.toggle("dark", next === "dark");
  document.documentElement.style.colorScheme = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* private mode — still applied for this session */
  }
  return next;
};

const STORAGE_KEY = "drawmaid-auto-mode";

export function loadAutoModePreference(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) {
      localStorage.setItem(STORAGE_KEY, "true");
      return true;
    }
    return stored === "true";
  } catch {
    return true;
  }
}

export function saveAutoModePreference(isAutoMode: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, String(isAutoMode));
  } catch {
    // localStorage unavailable
  }
}

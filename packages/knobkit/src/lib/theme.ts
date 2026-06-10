export type Theme = "system" | "light" | "dark" | (string & {});
export type Density = "xs" | "sm" | "md" | "lg" | "xl" | (string & {});

export function setTheme(theme: Theme): void {
  if (typeof document !== "undefined") document.documentElement.dataset.theme = theme;
}

export function setDensity(density: Density): void {
  if (typeof document !== "undefined") document.documentElement.dataset.density = density;
}

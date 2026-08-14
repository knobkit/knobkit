// The K-Tile logo (design/logo.svg) as a data URI, so served and mounted apps get a favicon
// without serving an extra file.
const SVG = [
  "%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E",
  "%3Crect x='4' y='4' width='56' height='56' rx='14' fill='%232563eb'/%3E",
  "%3Cg stroke='%23fff' stroke-width='7' stroke-linecap='round'%3E",
  "%3Cline x1='23' y1='16' x2='23' y2='48'/%3E",
  "%3Cline x1='23' y1='33' x2='42' y2='18'/%3E",
  "%3Cline x1='23' y1='33' x2='42' y2='46'/%3E",
  "%3C/g%3E",
  "%3Ccircle cx='23' cy='33' r='6.5' fill='%23fff'/%3E",
  "%3Ccircle cx='23' cy='33' r='2.8' fill='%231d4ed8'/%3E",
  "%3C/svg%3E",
].join("");

export const FAVICON_TAG = `<link rel="icon" href="data:image/svg+xml,${SVG}" />`;

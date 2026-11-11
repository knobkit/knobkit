import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

export interface Site {
  /** address of a page: `ok` can be embedded, `deny` and `csp` refuse it by their headers */
  url(page: "ok" | "deny" | "csp"): string;
  /** how many times each page was requested */
  hits: Record<string, number>;
  close(): Promise<void>;
}

/** A small site of our own to embed: what it answers, and how often it is asked, is known. */
export async function startSite(): Promise<Site> {
  const hits: Record<string, number> = {};
  const server = createServer((req, res) => {
    const path = (req.url ?? "/").split("?")[0]!;
    if (req.method === "GET") hits[path] = (hits[path] ?? 0) + 1;
    res.setHeader("content-type", "text/html; charset=utf-8");
    if (path === "/deny") res.setHeader("x-frame-options", "DENY");
    if (path === "/csp") res.setHeader("content-security-policy", "frame-ancestors 'none'");
    if (!["/ok", "/deny", "/csp"].includes(path)) res.statusCode = 404;
    res.end(req.method === "HEAD" ? undefined : `<!doctype html><title>${path}</title><h1 id="where">page ${path}</h1>`);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as AddressInfo).port;
  return {
    url: (page) => `http://127.0.0.1:${port}/${page}`,
    hits,
    close: () => new Promise((r) => server.close(() => r())),
  };
}

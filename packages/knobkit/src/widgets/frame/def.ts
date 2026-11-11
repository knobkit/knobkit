import { bound, defineWidget, idOf, raise, runBound, t, viewRef } from "@knobkit/core";

/**
 * Whether the page may be shown inside another: `checking` while the server asks the site,
 * `unknown` where nothing can ask (browser-only mode, or the site did not answer).
 */
export type EmbedStatus = "unknown" | "checking" | "allowed" | "refused";

/**
 * A site says in its response headers whether it may be embedded. The browser does not pass that
 * on to the page that embeds it — a refused page and a shown one give the same `load` — and does
 * not let that page read another site's headers. Code running on a server can simply ask.
 */
async function embeddable(url: string): Promise<boolean | undefined> {
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(4000) });
    void res.body?.cancel();
    const frameOptions = (res.headers.get("x-frame-options") ?? "").toLowerCase();
    if (/deny|sameorigin/.test(frameOptions)) return false;
    const ancestors = /(?:^|;)\s*frame-ancestors\s+([^;]*)/i.exec(res.headers.get("content-security-policy") ?? "")?.[1];
    // 'none', 'self' or a list of named sites: none of them is this app, as far as can be known here
    if (ancestors !== undefined && !/(^|\s)(\*|https?:)(\s|$)/.test(ancestors)) return false;
    return true;
  } catch {
    return undefined;
  }
}

// the latest address asked about, per session and frame: an answer to an earlier one is dropped
const asked = new Map<string, number>();
let askN = 0;

export const frame = defineWidget({
  type: "frame",
  size: { y: "fill" },
  state: {
    src: { initial: "" },
    // counts reload() calls: setting the same address again is no change, so it cannot ask for one
    reloads: { initial: 0 },
    embed: { initial: "unknown" as EmbedStatus },
  },
  events: {
    /** the page is showing. In browser-only mode it is also sent for a page that refused. */
    loaded: { payload: t<{ src: string }>() },
    /** server mode: the site does not allow being shown inside another page */
    refused: { payload: t<{ src: string }>() },
  },
  ops: (at) => ({
    /** Load the page again, from the same address. */
    reload: at("reloads").op("inc", 1),
  }),
  methods: (self) => ({
    set(url: string): void {
      const canAsk = typeof window === "undefined" && /^https?:\/\//i.test(url);
      self.at().patch({ src: url, embed: canAsk ? "checking" : "unknown" });
      if (!canAsk) return;
      const b = bound();
      const key = `${b.session} ${idOf(self)}`;
      const mine = ++askN;
      asked.set(key, mine);
      void embeddable(url).then((ok) => {
        if (asked.get(key) !== mine) return;
        asked.delete(key);
        runBound(b, () => {
          self.at("embed").set(ok === undefined ? "unknown" : ok ? "allowed" : "refused");
          if (ok === false) raise(self.refused({ src: url }));
        });
      });
    },
  }),
  view: viewRef(import.meta.url, "./view.js"),
});

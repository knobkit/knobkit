import { defineWidget, internalOf, mediaBytes, raise, t, viewRef } from "@knobkit/core";
import type { MediaRef } from "@knobkit/core";
import { inside, subfolders } from "./inside.js";

/** A file of a folder picked in the browser: where it is inside the folder, and how big. */
export interface FolderFile {
  /** "/"-separated, without the folder's own name: `notes/a.txt` */
  path: string;
  size: number;
  ref: MediaRef;
}

export interface PickedFolder {
  name: string;
  /** the folder's full path on the server; "" for one picked in the browser, which does not tell */
  path: string;
  /** the files in it, for one picked in the browser; none for a server folder — read it there */
  files: FolderFile[];
}

/** What the server-side list shows: a folder inside the starting folder, and the folders in it. */
export interface FolderListing {
  /** inside the starting folder, "/"-separated; "" for the starting folder */
  path: string;
  /** the starting folder's name: what the path is shown under */
  start: string;
  folders: string[];
  /** why the folder asked for could not be opened; the listing is then of the one before */
  error?: string;
}

// where the app is defined is where its handlers run: Node for a served app, the page for a mounted one
const onServer = (): boolean => typeof window === "undefined" && typeof process !== "undefined" && Boolean(process.versions?.node);

const folderPickerDef = defineWidget({
  type: "folderPicker",
  state: {
    picked: { initial: null as PickedFolder | null },
    listing: { initial: null as FolderListing | null },
  },
  props: {
    root: { default: "" }, // server: the folder the list starts at and cannot leave; the working directory when not set
    label: { default: "" },
    server: { default: false }, // set by the factory: the app runs on a server, so its folders are listed
  },
  events: {
    picked: { payload: t<PickedFolder>() },
    // the view's own requests, answered by the handlers below
    browse: { payload: t<{ path: string }>() },
    choose: { payload: t<{ path: string }>() },
  },
  ops: (at) => ({ clear: at("picked").op("set", null) }),
  methods: (self) => ({
    value: () => self.at("picked").get(),
    /** The bytes of a file of a folder picked in the browser, by its path inside the folder. */
    async read(path: string): Promise<Uint8Array<ArrayBuffer>> {
      const picked = await self.at("picked").get();
      const file = picked?.files.find((f) => f.path === path);
      if (!file) throw new Error(`knobkit: folderPicker.read("${path}") — no such file in the picked folder`);
      return mediaBytes(file.ref);
    },
  }),
  handlers: (self) => {
    // the starting folder as the app set it — from the handle, not from the page, which could say anything
    const root = (): string => String(internalOf(self).props["root"] ?? "");
    return {
      async browse({ path }) {
        if (!onServer()) return;
        try {
          const at = await inside(root(), path);
          self.at("listing").set({ path: at.rel, start: at.start, folders: await subfolders(at.full) });
        } catch (err) {
          const shown = (await self.at("listing").get()) ?? { path: "", start: "", folders: [] };
          self.at("listing").set({ ...shown, error: err instanceof Error ? err.message : String(err) });
        }
      },
      async choose({ path }) {
        if (!onServer()) return;
        let at;
        try {
          at = await inside(root(), path);
        } catch {
          return; // not a folder inside the starting folder: nothing is picked
        }
        const picked: PickedFolder = { name: at.name, path: at.full, files: [] };
        self.at("picked").set(picked);
        raise(self.picked(picked));
      },
    };
  },
  view: viewRef(import.meta.url, "./view.js"),
});

/**
 * Pick a folder. In a mounted (browser-only) app the system's chooser opens, and the handler gets
 * the folder's files — path inside the folder, size, and `read(path)` for the bytes. In a served
 * app the widget lists the folders of the server's machine from `root` down, and the handler gets
 * the full path of the one picked.
 */
export const folderPicker = (opts: { root?: string; label?: string } = {}) =>
  folderPickerDef({ root: opts.root, label: opts.label, server: onServer() });

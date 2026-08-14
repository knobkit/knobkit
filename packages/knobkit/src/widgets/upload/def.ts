import { defineWidget, t, viewRef } from "@knobkit/core";
import type { MediaRef } from "@knobkit/core";

export interface UploadFile {
  name: string;
  type: string;
  size: number;
  ref: MediaRef;
}

export const upload = defineWidget({
  type: "upload",
  state: { files: { initial: [] as UploadFile[] } },
  props: {
    accept: { default: "*/*" },
    multiple: { default: false },
    label: { default: "" },
  },
  events: {
    picked: { payload: t<MediaRef>() },
    changed: { payload: t<UploadFile[]>() },
  },
  ops: (at) => ({
    set: at("files").op("set"),
    clear: at("files").op("set", []),
  }),
  methods: (self) => ({
    files: () => self.at("files").get(),
    value: async (): Promise<MediaRef | null> => (await self.at("files").get())[0]?.ref ?? null,
  }),
  view: viewRef(import.meta.url, "./view.js"),
});

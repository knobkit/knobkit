import { event } from "../event.js";
import { bound } from "../bound.js";
import { controls } from "../controls.js";
import type { EventCtor, Widget } from "../types.js";

export interface UploadFile {
  name: string;
  type: string;
  size: number;
  url: string;
}

export interface UploadWidget extends Widget<{ files: UploadFile[] }> {
  changed: EventCtor<UploadFile[]>;
  accept: string;
  multiple: boolean;
  files(): Promise<UploadFile[]>;
  value(): Promise<UploadFile | null>;
  set(files: UploadFile[]): void;
  clear(): void;
}

export function upload(opts: { accept?: string; multiple?: boolean } = {}): UploadWidget {
  return {
    type: "upload",
    state: { files: [] },
    changed: event<UploadFile[]>("upload.changed"),
    accept: opts.accept ?? "*/*",
    multiple: opts.multiple ?? false,
    ...controls,
    files(): Promise<UploadFile[]> {
      return bound(this).read<UploadFile[]>(this, ["files"]);
    },
    async value(): Promise<UploadFile | null> {
      const files = await bound(this).read<UploadFile[]>(this, ["files"]);
      return files[0] ?? null;
    },
    set(files: UploadFile[]): void {
      bound(this).edit(this, "set", ["files"], files);
    },
    clear(): void {
      bound(this).edit(this, "set", ["files"], []);
    },
  };
}

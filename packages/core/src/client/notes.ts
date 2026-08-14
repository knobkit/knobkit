export interface NoteEntry {
  key: number;
  level: "drop" | "error" | "warn";
  message: string;
  stack?: string;
  corr?: string;
}

export interface NotesHub {
  push(level: NoteEntry["level"], message: string, extra?: { stack?: string; corr?: string }): void;
  dismiss(key: number): void;
  list(): NoteEntry[];
  subscribe(fn: () => void): () => void;
  readonly dev: boolean;
}

export function createNotesHub(dev: boolean): NotesHub {
  let notes: NoteEntry[] = [];
  let nextKey = 0;
  const listeners = new Set<() => void>();
  const notify = (): void => listeners.forEach((fn) => fn());

  return {
    dev,
    push(level, message, extra) {
      if (level === "error") console.error(`knobkit: ${message}`, extra?.stack ?? "");
      else console.warn(`knobkit [${level}]: ${message}`);
      if (level === "drop" && !dev) return;
      notes = [...notes, { key: nextKey++, level, message, ...extra }];
      notify();
    },
    dismiss(key) {
      notes = notes.filter((n) => n.key !== key);
      notify();
    },
    list: () => notes,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

export declare const AMBIENT_DIRS: string[];
export declare function parseSheet(css: string): { defines: Set<string>; mentions: Set<string> };
/** path -> generated module source; `write: false` computes without touching disk (used by tests). */
export declare function generate(opts: {
  root: string;
  ambientDirs?: string[];
  write?: boolean;
}): Map<string, string>;

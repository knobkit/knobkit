// @vitest-environment node
import { mkdirSync, mkdtempSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { inside, subfolders } from "./inside.js";

const outer = realpathSync(mkdtempSync(join(tmpdir(), "knobkit-inside-")));
const root = join(outer, "start");
mkdirSync(join(root, "a", "b"), { recursive: true });
mkdirSync(join(outer, "secret"));
mkdirSync(join(outer, "start-too")); // shares the starting folder's name as a prefix
writeFileSync(join(root, "file.txt"), "x");
symlinkSync(join(outer, "secret"), join(root, "out"));

describe("folders inside a starting folder", () => {
  test("the starting folder and what is under it resolve", async () => {
    expect(await inside(root, "")).toEqual({ full: root, rel: "", name: "start", start: "start" });
    expect(await inside(root, "a/b")).toEqual({ full: join(root, "a", "b"), rel: "a/b", name: "b", start: "start" });
    expect(await inside(root, "a/b/..")).toMatchObject({ rel: "a" });
  });

  test("nothing above or beside it does", async () => {
    await expect(inside(root, "..")).rejects.toThrow(/outside/);
    await expect(inside(root, "a/../..")).rejects.toThrow(/outside/);
    await expect(inside(root, "../secret")).rejects.toThrow(/outside/);
    await expect(inside(root, "../start-too")).rejects.toThrow(/outside/);
    await expect(inside(root, join(outer, "secret"))).rejects.toThrow(/outside/); // an absolute path
    await expect(inside(root, "/")).rejects.toThrow(/outside/);
    await expect(inside(root, "out")).rejects.toThrow(/outside/); // a link that leads out
  });

  test("a file, or a folder that is not there, is not a folder to open", async () => {
    await expect(inside(root, "file.txt")).rejects.toThrow(/not a folder/);
    await expect(inside(root, "nope")).rejects.toThrow();
  });

  test("the list is the folders, sorted, without files or links", async () => {
    mkdirSync(join(root, "Z"));
    expect(await subfolders(root)).toEqual(["a", "Z"]);
    expect(await subfolders(join(root, "a", "b"))).toEqual([]);
  });
});

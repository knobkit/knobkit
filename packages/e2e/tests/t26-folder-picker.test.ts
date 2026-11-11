import { mkdirSync, mkdtempSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import type { Page } from "playwright";
import { journey, recorded, sleep, trigger, waitRecorded } from "../harness/index.js";

// A folder of 100 files, in four subfolders, each file with its own size and bytes.
const picked = join(mkdtempSync(join(tmpdir(), "knobkit-t26-")), "to-pick");
const files: { path: string; size: number }[] = [];
for (let i = 0; i < 100; i++) {
  const path = `part-${Math.floor(i / 25)}/file-${String(i).padStart(3, "0")}.bin`;
  mkdirSync(join(picked, `part-${Math.floor(i / 25)}`), { recursive: true });
  const bytes = Uint8Array.from({ length: 50 + i * 3 }, (_, k) => (i * 31 + k * 7) % 256);
  writeFileSync(join(picked, path), bytes);
  files.push({ path, size: bytes.length });
}

// The server's side: a starting folder with folders in it, beside things that must stay out of reach.
const outer = realpathSync(mkdtempSync(join(tmpdir(), "knobkit-t26-server-")));
const start = join(outer, "workspace");
for (const d of ["alpha/inner/deep", "alpha/other", "beta"]) mkdirSync(join(start, d), { recursive: true });
mkdirSync(join(outer, "secret"));
writeFileSync(join(start, "a-file.txt"), "not a folder");
symlinkSync(join(outer, "secret"), join(start, "way-out")); // a link out of the starting folder

const listed = (page: Page): Promise<string[]> => page.locator(".pu-folder-item").evaluateAll((els) => els.map((el) => (el.textContent ?? "").trim()));
const where = (page: Page): Promise<string> => page.locator(".pu-folder-path").innerText();

// KNOBKIT.md task 26: a folder picker
journey(
  "t26",
  (j) => {
    test("the user picks a folder of 100 files in the system's chooser: the handler receives each file's path inside the folder and its size", async () => {
      const page = await j.open();
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.locator(".pu-folder-pick").click()]);
      // it is a folder chooser
      expect(await chooser.element().evaluate((el) => (el as HTMLInputElement).webkitdirectory)).toBe(true);
      await chooser.setFiles(picked);
      const got = await waitRecorded(page, "picked");
      expect(got.name).toBe("to-pick");
      expect(got.files.length).toBe(100);
      const byPath = (a: { path: string }, b: { path: string }): number => a.path.localeCompare(b.path);
      expect([...got.files].sort(byPath)).toEqual([...files].sort(byPath));
      // and the page says what was picked
      await expect.poll(() => page.locator(".pu-folder-picked").innerText()).toContain("to-pick — 100 files");
    });

    test("a handler reads one of those files: the bytes equal the file's", async () => {
      const page = await j.open();
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.locator(".pu-folder-pick").click()]);
      await chooser.setFiles(picked);
      await waitRecorded(page, "picked");
      await trigger(page, "read-one");
      const bytes = await waitRecorded(page, "bytes");
      const onDisk = Array.from(readFileSync(join(picked, "part-1/file-042.bin")));
      expect(onDisk.length).toBe(50 + 42 * 3);
      expect(bytes).toEqual(onDisk);
    });
  },
  { modes: ["mount"] },
);

journey(
  "t26",
  (j) => {
    test("the widget lists the server's folders from the starting folder; the user opens a subfolder and picks it; the handler receives its full path", async () => {
      const page = await j.open();
      // the folders of the starting folder: not the file in it, not the link out of it
      await expect.poll(() => listed(page)).toEqual(["alpha", "beta"]);
      expect(await where(page)).toBe("workspace");
      await page.locator(".pu-folder-item", { hasText: "alpha" }).click();
      await expect.poll(() => listed(page)).toEqual(["inner", "other"]);
      expect(await where(page)).toBe("workspace/alpha");
      await page.locator(".pu-folder-item", { hasText: "inner" }).click();
      await expect.poll(() => listed(page)).toEqual(["deep"]);
      await page.getByRole("button", { name: "Choose this folder" }).click();
      expect(await waitRecorded(page, "picked")).toEqual({ name: "inner", path: join(start, "alpha", "inner"), files: [] });
      await expect.poll(() => page.locator(".pu-folder-picked").innerText()).toBe(join(start, "alpha", "inner"));
    });

    test("the user cannot go above the starting folder", async () => {
      const page = await j.open();
      const up = page.getByRole("button", { name: "Up to the folder above" });
      await expect.poll(() => listed(page)).toEqual(["alpha", "beta"]);
      // at the starting folder there is no way up
      expect(await up.isDisabled()).toBe(true);
      await up.click({ force: true });
      await sleep(300);
      expect(await listed(page)).toEqual(["alpha", "beta"]);
      expect(await where(page)).toBe("workspace");

      // one down, the way up leads back to the starting folder and stops there
      await page.locator(".pu-folder-item", { hasText: "beta" }).click();
      await expect.poll(() => where(page)).toBe("workspace/beta");
      expect(await up.isDisabled()).toBe(false);
      await up.click();
      await expect.poll(() => where(page)).toBe("workspace");
      expect(await up.isDisabled()).toBe(true);

      // picking here gives the starting folder itself, nothing above it
      await page.getByRole("button", { name: "Choose this folder" }).click();
      expect((await waitRecorded(page, "picked")).path).toBe(start);
      // nothing outside it was ever shown
      expect(await page.locator("#root").innerText()).not.toContain("secret");
      expect((await recorded(page)).filter((r) => r.name === "picked").length).toBe(1);
    });
  },
  { modes: ["serve"], env: { E2E_ROOT: start } },
);

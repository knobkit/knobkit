import { readFile, stat } from "node:fs/promises";
import { expect, test } from "vitest";
import type { Page } from "playwright";
import { journey, recorded, trigger, waitRecorded } from "../harness/index.js";
import { BOX, OPEN, dragOver, ink, locate, marks, openWatched, show, squash, warmth } from "../harness/docs.js";

const SENTENCE = "The method is remarkably robust to noisy gradients.";
const HYPHENATED = "The hyper-parameters have intuitive interpretations and typically require little tuning.";
const HEADED = process.env["E2E_HEADED"] === "1";

/** Computed style of the element that holds a piece of text. */
async function styleOf(page: Page, text: string, within = BOX): Promise<{ weight: number; italic: boolean; size: number }> {
  const found = await page.evaluate(
    ({ text, within }) => {
      const walker = document.createTreeWalker(document.querySelector(within)!, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!(n as Text).data.includes(text) || n.parentElement!.closest("style")) continue;
        const s = getComputedStyle(n.parentElement!);
        return { weight: Number(s.fontWeight), italic: s.fontStyle === "italic", size: parseFloat(s.fontSize) };
      }
      return null;
    },
    { text, within },
  );
  if (!found) throw new Error(`no text "${text}" in ${within}`);
  return found;
}

/** The grid's data cells, row by row (not its row-number column). */
const cells = (page: Page, grid: string): Promise<string[]> =>
  page.locator(`${grid} revo-grid .rgCell`).evaluateAll((els) => els.filter((e) => !e.closest(".rowHeaders")).map((e) => e.textContent?.trim() ?? ""));

/** After a mark: it is the passage, it is painted, and all of it is in view. Returns what is marked. */
async function expectMarked(page: Page, passage: string) {
  await expect.poll(async () => (await marks(page)).length).toBe(1);
  await expect.poll(async () => (await marks(page))[0]?.inView).toBe(true);
  const [m] = await marks(page);
  // the document may hold the passage with a line-break hyphen that the request did not have
  expect(squash(m!.text).replace("interpre-tations", "interpretations")).toBe(passage);
  for (const r of m!.rects) expect(await warmth(page, r)).toBeGreaterThan(0.5);
  return m!;
}

// KNOBKIT.md task 25: a document viewer
journey("t25", (j) => {
  test("1. a 15-page PDF is shown with its pages, with no PDF viewer in the browser", async () => {
    const { page, net } = await openWatched(j);
    if (j.engine === "chromium" && !HEADED) expect(await page.evaluate(() => navigator.pdfViewerEnabled)).toBe(false);
    await show(page, "paper.pdf");
    const pages = page.locator(`${BOX} [data-page]`);
    expect(await pages.count()).toBe(15);
    // each page holds its own text…
    expect(await pages.evaluateAll((els) => els.map((e) => /Section (\d+):/.exec(e.textContent ?? "")?.[1]))).toEqual(
      Array.from({ length: 15 }, (_, i) => String(i + 1)),
    );
    // …and is drawn by the widget itself, not handed to an embedded viewer
    expect(await page.locator("embed, object, iframe").count()).toBe(0);
    await expect.poll(() => ink(page, 1)).toBeGreaterThan(0.005);
    // the text sits on the drawing: the ink of a line starts and ends where its text does
    const line = (await locate(page, "requires maximization or minimization with respect to its parameters.", '[data-page="1"]'))!;
    expect(line.rects.length).toBe(1);
    const edges = await page.evaluate((r) => {
      const canvas = document.querySelector<HTMLCanvasElement>('[data-page="1"] canvas')!;
      const c = canvas.getBoundingClientRect();
      const k = canvas.width / c.width;
      const y = Math.round((r.y - c.top) * k);
      const h = Math.round(r.height * k);
      const { data, width } = canvas.getContext("2d")!.getImageData(0, y, canvas.width, h);
      let left = Infinity;
      let right = -Infinity;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i]! + data[i + 1]! + data[i + 2]! >= 380) continue;
        const x = (i / 4) % width;
        left = Math.min(left, x);
        right = Math.max(right, x);
      }
      return { left: c.left + left / k, right: c.left + right / k };
    }, line.rects[0]!);
    expect(Math.abs(edges.left - line.rects[0]!.x)).toBeLessThan(4);
    expect(Math.abs(edges.right - (line.rects[0]!.x + line.rects[0]!.width))).toBeLessThan(4);
    // the last page is reached by scrolling, and is drawn when it comes into view
    await page.locator(BOX).hover();
    expect(await ink(page, 15)).toBe(0);
    for (let i = 0; i < 60 && !(await locate(page, "page 15 of 15"))?.inView; i++) {
      await page.mouse.wheel(0, 1500);
      await page.waitForTimeout(50);
    }
    expect((await locate(page, "page 15 of 15"))?.inView).toBe(true);
    await expect.poll(() => ink(page, 15)).toBeGreaterThan(0.005);
    // pages far behind are let go of, so a long document does not hold every page's drawing
    expect(await ink(page, 1)).toBe(0);
    net.expectOwn();
  });

  test("2. a Word file is shown with its headings, bold and italic text and its table", async () => {
    const { page, net } = await openWatched(j);
    await show(page, "report.docx");
    const body = await styleOf(page, "This report has");
    const h1 = await styleOf(page, "Adam: a method for stochastic optimization");
    const h2 = await styleOf(page, "Results");
    expect(h1.size).toBeGreaterThan(h2.size);
    expect(h2.size).toBeGreaterThan(body.size);
    expect(h1.weight).toBeGreaterThanOrEqual(600);
    expect(body).toMatchObject({ italic: false });
    expect(body.weight).toBeLessThan(600);
    expect((await styleOf(page, "bold words")).weight).toBeGreaterThanOrEqual(600);
    expect((await styleOf(page, "italic words")).italic).toBe(true);
    const table = page.locator(`${BOX} table`);
    expect(await table.count()).toBe(1);
    expect(await table.locator("tr").evaluateAll((rows) => rows.map((r) => [...r.querySelectorAll("td")].map((c) => c.textContent?.trim())))).toEqual([
      ["Optimizer", "Loss", "Steps"],
      ["Adam", "0.12", "4000"],
      ["SGD", "0.31", "9000"],
    ]);
    // drawn as a table: the cells of a row side by side, the rows one under another, with borders
    const [a, b2, c] = await Promise.all(["Optimizer", "Loss", "Adam"].map(async (t) => (await locate(page, t, `${BOX} table`))!.rects[0]!));
    expect(b2!.x).toBeGreaterThan(a!.x + a!.width);
    expect(Math.abs(b2!.y - a!.y)).toBeLessThan(2);
    expect(c!.y).toBeGreaterThan(a!.y + a!.height - 1);
    expect(await table.locator("td").first().evaluate((td) => parseFloat(getComputedStyle(td).borderTopWidth))).toBeGreaterThan(0);
    net.expectOwn();
  });

  test("3. a three-slide deck is shown one slide after another, with titles, bullet text and a table", async () => {
    const { page, net } = await openWatched(j);
    await show(page, "deck.pptx");
    const slides = page.locator(`${BOX} .pptx-preview-slide-wrapper`);
    await expect.poll(() => slides.count()).toBe(3);
    const text = await slides.evaluateAll((els) => els.map((e) => e.textContent ?? ""));
    const want = [
      ["Adam in three slides", "Adaptive moment estimation", "First-order gradients only", "Little memory needed"],
      ["Results so far", "Lower loss than SGD", "Fewer steps to converge"],
      ["What we learned", "Bias correction matters early on", SENTENCE],
    ];
    want.forEach((lines, i) => lines.forEach((l) => expect(text[i]).toContain(l)));
    // one after another: each slide starts below the one before
    const boxes = await slides.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ top: r.top, bottom: r.bottom, height: r.height })));
    expect(boxes[0]!.height).toBeGreaterThan(100);
    expect(boxes[1]!.top).toBeGreaterThanOrEqual(boxes[0]!.bottom);
    expect(boxes[2]!.top).toBeGreaterThanOrEqual(boxes[1]!.bottom);
    // a title is larger than the bullets under it
    expect((await styleOf(page, "Adam in three slides")).size).toBeGreaterThan((await styleOf(page, "Adaptive moment estimation")).size);
    // the table is on slide 2, as rows and columns
    const second = `${BOX} .pptx-preview-slide-wrapper-1`;
    expect(await page.locator(`${second} table tr`).evaluateAll((rows) => rows.map((r) => [...r.querySelectorAll("td")].map((c) => c.textContent?.trim())))).toEqual([
      ["Optimizer", "Loss", "Steps"],
      ["Adam", "0.12", "4000"],
      ["SGD", "0.31", "9000"],
    ]);
    const [a, b2, c] = await Promise.all(["Optimizer", "Loss", "Adam"].map(async (t) => (await locate(page, t, `${second} table`))!.rects[0]!));
    expect(b2!.x).toBeGreaterThan(a!.x + a!.width);
    expect(c!.y).toBeGreaterThan(a!.y + a!.height - 1);
    net.expectOwn();
  });

  test("4. a workbook with two sheets is shown as a grid, the sheets can be switched, numbers are numbers", async () => {
    const { page, net } = await openWatched(j);
    await show(page, "book.xlsx");
    const tabs = page.locator(`${BOX} [role="tab"]`);
    expect(await tabs.allTextContents()).toEqual(["results", "budget"]);
    expect(await tabs.nth(0).getAttribute("aria-selected")).toBe("true");
    expect(await page.locator(`${BOX} revo-grid`).count()).toBe(1);
    expect(await cells(page, BOX)).toEqual(["optimizer", "loss", "steps", "code", "Adam", "0.12", "4000", "007", "SGD", "0.31", "9000", "012", "RMSProp", "0.2", "10500", "101"]);
    // what the grid holds: numbers where the file has numbers, text where it has text that looks like one
    const source = (): Promise<Record<string, unknown>[]> =>
      page.locator(`${BOX} revo-grid`).evaluate((g) => (g as unknown as { getSource(): Promise<Record<string, unknown>[]> }).getSource());
    expect(await source()).toEqual([
      { A: "optimizer", B: "loss", C: "steps", D: "code" },
      { A: "Adam", B: 0.12, C: 4000, D: "007" },
      { A: "SGD", B: 0.31, C: 9000, D: "012" },
      { A: "RMSProp", B: 0.2, C: 10500, D: "101" },
    ]);
    // the user switches to the second sheet
    await tabs.nth(1).click();
    await expect.poll(() => cells(page, BOX)).toEqual(["item", "cost", "compute", "1250.5", "storage", "300", "total", "1550.5"]);
    expect(await source()).toEqual([
      { A: "item", B: "cost" },
      { A: "compute", B: 1250.5 },
      { A: "storage", B: 300 },
      { A: "total", B: 1550.5 },
    ]);
    expect(await tabs.nth(1).getAttribute("aria-selected")).toBe("true");
    // and back
    await tabs.nth(0).click();
    await expect.poll(async () => (await cells(page, BOX))[4]).toBe("Adam");
    net.expectOwn();
  });

  test("5. Markdown, plain text, CSV and images are shown as the existing widgets show them", async () => {
    const { page, net } = await openWatched(j);
    const panel = OPEN;
    const existing = page.locator(".pu-tab", { hasText: "existing" });
    const document = page.locator(".pu-tab", { hasText: "document" });
    // what the viewer draws, then what the existing widget draws for the same content
    const both = async (file: string, root: string, read: (sel: string) => Promise<unknown>): Promise<[unknown, unknown]> => {
      await document.click();
      await show(page, file);
      // the viewer's own element is the existing widget's root element, not a box around one
      expect(await page.locator(`${panel} .pu-bounded > ${root}`).count()).toBe(1);
      expect(await page.locator(BOX).count()).toBe(0);
      const mine = await read(`${panel} ${root}`);
      await existing.click();
      await page.locator(`${panel} ${root}`).first().waitFor();
      expect(await page.locator(`${panel} ${root}`).count()).toBe(1);
      return [mine, await read(`${panel} ${root}`)];
    };
    const html = (sel: string): Promise<string> => page.locator(sel).first().evaluate((e) => e.outerHTML);

    const [md, mdWas] = await both("notes.md", ".pu-md", html);
    expect(md).toBe(mdWas);
    expect(md).toContain("<h1>Reading notes</h1>");
    expect(md).toContain("<strong>adaptive</strong>");
    expect((md as string).match(/<li>/g)?.length).toBe(2);

    const [txt, txtWas] = await both("plain.txt", ".pu-output", html);
    expect(txt).toBe(txtWas);
    expect(txt).toContain("first line of plain text\n  second line, indented\n");

    const grid = async (sel: string): Promise<unknown> => {
      await page.locator(`${sel} revo-grid .rgCell`).first().waitFor();
      return {
        headers: await page.locator(`${sel} revo-grid .rgHeaderCell`).evaluateAll((els) => els.map((e) => e.textContent?.trim()).filter(Boolean)),
        cells: await cells(page, sel),
      };
    };
    const [csv, csvWas] = await both("data.csv", ".pu-table", grid);
    expect(csv).toEqual(csvWas);
    expect(csv).toEqual({ headers: ["optimizer", "loss", "comment"], cells: ["Adam", "0.12", "fast, stable", "SGD", "0.31", "slow"] });

    const picture = async (sel: string): Promise<unknown> => {
      const img = page.locator(sel).first();
      await expect.poll(() => img.evaluate((e) => (e as HTMLImageElement).naturalWidth)).toBe(120);
      return img.evaluate((e) => ({ html: e.outerHTML, height: (e as HTMLImageElement).naturalHeight }));
    };
    const [png, pngWas] = await both("pic.png", "img.pu-image", picture);
    expect(png).toEqual(pngWas);
    expect((png as { height: number }).height).toBe(80);
    net.expectOwn();
  });

  test("6. any other type shows the file's name and size and a download link", async () => {
    const { page, net } = await openWatched(j);
    await show(page, "other.bin");
    const box = page.locator(BOX);
    expect(squash((await box.textContent()) ?? "")).toContain("t25-other.bin");
    expect(squash((await box.textContent()) ?? "")).toContain("1.5 KB");
    const link = box.locator("a[download]");
    expect(await link.getAttribute("download")).toBe("t25-other.bin");
    // the link saves the file itself
    const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
    expect(download.suggestedFilename()).toBe("t25-other.bin");
    const saved = await download.path();
    expect((await stat(saved)).size).toBe(1536);
    expect((await readFile(saved)).equals(await readFile(new URL("../fixtures/t25-other.bin", import.meta.url)))).toBe(true);
    net.expectOwn();
  });

  test("7. a handler goes to page 2 of the PDF, slide 2 of the deck and the second sheet of the workbook; each is in view", async () => {
    const { page, net } = await openWatched(j);
    const top = async (sel: string): Promise<{ page: number; box: number }> => ({
      page: await page.locator(sel).evaluate((e) => e.getBoundingClientRect().top),
      box: await page.locator(BOX).evaluate((e) => e.getBoundingClientRect().top),
    });

    await show(page, "paper.pdf");
    expect((await locate(page, "Section 2: results of run 2"))?.inView).toBe(false);
    await trigger(page, "go to 2");
    await expect.poll(async () => (await locate(page, "Section 2: results of run 2"))?.inView).toBe(true);
    expect((await locate(page, "Section 1: results of run 1"))?.inView).toBe(false);
    const pdf = await top(`${BOX} [data-page="2"]`);
    expect(Math.abs(pdf.page - pdf.box)).toBeLessThan(40); // the page starts at the top of the box
    await expect.poll(() => ink(page, 2)).toBeGreaterThan(0.005);

    await show(page, "deck.pptx");
    expect((await locate(page, "Results so far"))?.inView).toBe(false);
    await trigger(page, "go to 2");
    await expect.poll(async () => (await locate(page, "Results so far"))?.inView).toBe(true);
    expect((await locate(page, "Adam in three slides"))?.inView).toBe(false);
    const deck = await top(`${BOX} .pptx-preview-slide-wrapper-1`);
    expect(Math.abs(deck.page - deck.box)).toBeLessThan(40);

    await show(page, "book.xlsx");
    expect((await cells(page, BOX))[0]).toBe("optimizer");
    await trigger(page, "go to 2");
    await expect.poll(() => cells(page, BOX)).toEqual(["item", "cost", "compute", "1250.5", "storage", "300", "total", "1550.5"]);
    expect(await page.locator(`${BOX} [role="tab"]`).nth(1).getAttribute("aria-selected")).toBe("true");
    const cell = await page.locator(`${BOX} revo-grid .rgCell`, { hasText: "compute" }).first().boundingBox();
    const box = (await page.locator(BOX).boundingBox())!;
    expect(cell!.y).toBeGreaterThanOrEqual(box.y);
    expect(cell!.y + cell!.height).toBeLessThanOrEqual(Math.min(760, box.y + box.height));
    net.expectOwn();
  });

  for (const file of ["paper.pdf", "report.docx", "deck.pptx"]) {
    test(`8. a handler marks a sentence by its text in ${file}: it is highlighted and scrolled into view`, async () => {
      const { page, net } = await openWatched(j);
      await show(page, file);
      // it is further down than the box shows, and nothing is marked
      await expect.poll(async () => (await locate(page, "robust to noisy gradients."))?.inView).toBe(false);
      expect(await marks(page)).toEqual([]);
      await trigger(page, "mark");
      const m = await expectMarked(page, SENTENCE);
      // the highlight lies on the sentence as it is printed
      const printed = (await locate(page, "robust to noisy gradients."))!;
      const end = m.rects[m.rects.length - 1]!;
      expect(printed.inView).toBe(true);
      expect(Math.abs(end.x + end.width - (printed.rects[0]!.x + printed.rects[0]!.width))).toBeLessThan(2);
      expect(Math.abs(end.y - printed.rects[0]!.y)).toBeLessThan(2);
      net.expectOwn();
    });

    test(`9. marking works in ${file} when the sentence is split by formatting (one word in italics)`, async () => {
      const { page, net } = await openWatched(j);
      await show(page, file);
      await trigger(page, "mark");
      const m = await expectMarked(page, SENTENCE);
      // the sentence is three pieces in the document, the middle one in italics
      expect(m.pieces).toBeGreaterThanOrEqual(3);
      const word = (await locate(page, "remarkably"))!;
      expect(word.pieces).toBe(1);
      if (file === "paper.pdf") {
        // a PDF's text layer carries no font styles: the word is its own piece between two others
        const before = (await locate(page, "The method is "))!;
        expect(word.rects[0]!.x).toBeGreaterThan(before.rects[0]!.x + before.rects[0]!.width - 2);
      } else expect((await styleOf(page, "remarkably")).italic).toBe(true);
      expect((await styleOf(page, "The method is")).italic).toBe(false);
      // the word is highlighted along with the rest
      expect(await warmth(page, word.rects[0]!)).toBeGreaterThan(0.5);
      net.expectOwn();
    });

    test(`10. a handler clears the mark in ${file}`, async () => {
      const { page, net } = await openWatched(j);
      await show(page, file);
      await trigger(page, "mark");
      const m = await expectMarked(page, SENTENCE);
      await trigger(page, "clear mark");
      await expect.poll(async () => (await marks(page)).length).toBe(0);
      // nothing of it is left on the page, which has not moved
      for (const r of m.rects) expect(await warmth(page, r)).toBeLessThan(0.02);
      expect((await locate(page, "robust to noisy gradients."))?.inView).toBe(true);
      // and it can be marked again
      await trigger(page, "mark");
      await expectMarked(page, SENTENCE);
      net.expectOwn();
    });
  }

  test('9. marking works in the PDF when a word is hyphenated across a line ("interpre-tations")', async () => {
    const { page, net } = await openWatched(j);
    await show(page, "paper.pdf");
    // the file has the word broken over two lines, and not whole anywhere
    expect(await locate(page, "interpretations")).toBeNull();
    expect((await locate(page, "intuitive interpre-", '[data-page="7"]'))?.rects.length).toBe(1);
    expect((await locate(page, "tations and typically", '[data-page="7"]'))?.rects.length).toBe(1);
    await trigger(page, "mark hyphenated");
    const m = await expectMarked(page, HYPHENATED);
    expect(squash(m.text)).toContain("interpre-tations");
    // it runs over both lines: from "The hyper-parameters" on the first to "little tuning." on the second
    const lines = [...new Set(m.rects.map((r) => Math.round(r.y)))];
    expect(lines.length).toBe(2);
    const first = (await locate(page, "The hyper-parameters have intuitive interpre-", '[data-page="7"]'))!.rects[0]!;
    const second = (await locate(page, "tations and typically require little tuning.", '[data-page="7"]'))!.rects[0]!;
    expect(Math.abs(m.rects[0]!.x - first.x)).toBeLessThan(2);
    expect(Math.abs(m.rects[0]!.y - first.y)).toBeLessThan(2);
    const end = m.rects[m.rects.length - 1]!;
    expect(Math.abs(end.x + end.width - (second.x + second.width))).toBeLessThan(2);
    expect(Math.abs(end.y - second.y)).toBeLessThan(2);
    net.expectOwn();
  });

  const SELECT: Record<string, string> = {
    "paper.pdf": "cast as the optimization of some scalar",
    "report.docx": "Note 1. Stochastic gradient-based optimization",
    "deck.pptx": "Fewer steps to converge",
  };
  for (const [file, passage] of Object.entries(SELECT)) {
    test(`11. the user selects text in ${file}: the handler receives the text and the page or slide number`, async () => {
      const { page, net } = await openWatched(j);
      await show(page, file);
      await trigger(page, "go to 2");
      const second = file === "paper.pdf" ? '[data-page="2"]' : file === "deck.pptx" ? ".pptx-preview-slide-wrapper-1" : "section.docx:nth-of-type(2)";
      await expect.poll(async () => (await locate(page, passage, `${BOX} ${second}`))?.inView).toBe(true);
      await page.waitForTimeout(300); // the scroll has come to rest
      expect(await recorded(page)).toEqual([]);
      await dragOver(page, (await locate(page, passage, `${BOX} ${second}`))!);
      const got = await waitRecorded(page, "selected");
      expect(squash(got.text)).toBe(passage);
      expect(got.page).toBe(2);
      // it is what the browser shows as selected, and it was reported once
      expect(squash(await page.evaluate(() => getSelection()!.toString()))).toBe(passage);
      await page.waitForTimeout(600);
      expect((await recorded(page)).filter((r) => r.name === "selected").length).toBe(1);
      net.expectOwn();
    });
  }

  test("12. the file is not sent to any address other than the app's own", async () => {
    const { page, net } = await openWatched(j);
    // Each kind's library comes from the app, and only once a document of that kind is shown.
    const libraries = (): string[] =>
      ["pdfjs-dist", "docx-preview", "pptx-preview", "xlsx"].filter((lib) => net.urls.some((u) => !u.includes("/fixtures/") && new URL(u).pathname.replace("doc-view/xlsx", "").includes(lib)));
    expect(libraries()).toEqual([]);
    for (const file of ["notes.md", "plain.txt", "data.csv", "pic.png", "other.bin"]) await show(page, file);
    expect(libraries()).toEqual([]);
    await show(page, "paper.pdf");
    expect(libraries()).toEqual(["pdfjs-dist"]);
    await show(page, "report.docx");
    expect(libraries()).toEqual(["pdfjs-dist", "docx-preview"]);
    await show(page, "deck.pptx");
    expect(libraries()).toEqual(["pdfjs-dist", "docx-preview", "pptx-preview"]);
    await show(page, "book.xlsx");
    expect(libraries()).toEqual(["pdfjs-dist", "docx-preview", "pptx-preview", "xlsx"]);
    // every kind, each with what a handler can do to it, in one sitting
    for (const file of ["paper.pdf", "report.docx", "deck.pptx"]) {
      await show(page, file);
      await trigger(page, "go to 2");
      await trigger(page, "mark");
      await expect.poll(async () => (await marks(page))[0]?.inView).toBe(true);
      await trigger(page, "clear mark");
    }
    await show(page, "book.xlsx");
    await trigger(page, "go to 2");
    // a file given as an address is fetched from that address, here the app's own, and its type worked out from it
    await show(page, "paper by address");
    await expect.poll(() => ink(page, 1)).toBeGreaterThan(0.005);
    expect(net.urls.some((u) => new URL(u).pathname === "/fixtures/t25-paper.pdf")).toBe(true);
    await page.waitForTimeout(500);
    // the libraries were fetched (they are not in the page until a document needs them), and from the app
    expect(net.urls.some((u) => /pdf/i.test(u) && /worker/i.test(u))).toBe(true);
    net.expectOwn();
  });
});

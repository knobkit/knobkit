import { expect, test } from "vitest";
import { parseCsv } from "./csv.js";
import { kindOf, nameOf } from "./kind.js";

const ref = (mime: string) => ({ $m: "m1", mime, size: 1 });

test("the kind is the stated type, else worked out from the name, the address, the media type", () => {
  expect(kindOf({ src: "/files/a.bin", type: "application/pdf" })).toBe("pdf");
  expect(kindOf({ src: "/files/a.bin", type: ".DOCX" })).toBe("docx");
  expect(kindOf({ src: ref("application/octet-stream"), name: "deck.pptx" })).toBe("pptx");
  expect(kindOf({ src: "/files/book.xlsx?v=2#top" })).toBe("xlsx");
  expect(kindOf({ src: ref("text/markdown; charset=utf-8") })).toBe("markdown");
  expect(kindOf({ src: ref("image/webp") })).toBe("image");
  expect(kindOf({ src: "data:text/csv;base64,YQ==" })).toBe("csv");
  expect(kindOf({ src: "/notes.txt" })).toBe("text");
});

test("a type that is not one of these is shown as a file, whatever the name says", () => {
  expect(kindOf({ src: "/a.pdf", type: "application/zip" })).toBe("other");
  expect(kindOf({ src: ref("application/octet-stream") })).toBe("other");
  expect(kindOf({ src: "/download" })).toBe("other");
});

test("an address gives the file its name", () => {
  expect(nameOf("/files/my%20paper.pdf?x=1")).toBe("my paper.pdf");
  expect(nameOf("data:text/plain,hi")).toBe("");
  expect(nameOf(ref("text/plain"))).toBe("");
});

test("CSV: quoted fields, doubled quotes, line breaks in quotes, CRLF", () => {
  expect(parseCsv('a,b\r\n1,"x, y"\n"say ""hi""","two\nlines"\n')).toEqual([
    ["a", "b"],
    ["1", "x, y"],
    ['say "hi"', "two\nlines"],
  ]);
  expect(parseCsv("a,b\n1,")).toEqual([["a", "b"], ["1", ""]]);
  expect(parseCsv("")).toEqual([]);
});

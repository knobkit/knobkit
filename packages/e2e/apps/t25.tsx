import { button, col, docView, image, knobkit, output, row, table, tabs, toMedia } from "knobkit";
import { fixtureBytes } from "./_files.js";
import { recorder } from "./_rec.js";

// in every fixture document, with "remarkably" in italics
const SENTENCE = "The method is remarkably robust to noisy gradients.";
// in the PDF, where a line ends "interpre-" and the next begins "tations"
const HYPHENATED = "The hyper-parameters have intuitive interpretations and typically require little tuning.";

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  md: "text/markdown",
  txt: "text/plain",
  csv: "text/csv",
  png: "image/png",
  bin: "application/octet-stream",
};
const FILES = ["paper.pdf", "report.docx", "deck.pptx", "book.xlsx", "notes.md", "plain.txt", "data.csv", "pic.png", "other.bin"];

const doc = docView();
const rec = recorder();
const b = (label: string) => button({ label });
const open = FILES.map((file) => ({ file, button: b(file) }));
const byAddress = b("paper by address");
const goTo2 = b("go to 2");
const mark = b("mark");
const markHyphenated = b("mark hyphenated");
const clear = b("clear mark");

// the widgets that already show these kinds, given the same content, to compare against
const asText = output();
const asMarkdown = output({ format: "markdown" });
const asTable = table();
const asImage = image();

export const app = knobkit({
  title: "t25",
  fill: true,
  widgets: col(
    tabs([
      { label: "document", content: col(row(...open.map((o) => o.button), byAddress), row(goTo2, mark, markHyphenated, clear), doc) },
      { label: "existing", content: col(asText, asMarkdown, asTable, asImage) },
    ]),
    rec.widget,
  ),
});

for (const { file, button } of open) {
  app.on(button.clicked, async () => {
    const ext = file.split(".").pop()!;
    const bytes = await fixtureBytes(`t25-${file}`);
    const src = toMedia(bytes, MIME[ext]!);
    doc.show({ src, name: `t25-${file}` });
    if (ext === "txt") asText.set(new TextDecoder().decode(bytes));
    if (ext === "md") asMarkdown.set(new TextDecoder().decode(bytes));
    if (ext === "png") asImage.show(src);
    if (ext === "csv") {
      asTable.setColumns([
        { key: "c0", label: "optimizer" },
        { key: "c1", label: "loss" },
        { key: "c2", label: "comment" },
      ]);
      asTable.setRows([
        { c0: "Adam", c1: "0.12", c2: "fast, stable" },
        { c0: "SGD", c1: "0.31", c2: "slow" },
      ]);
    }
  });
}
// by address, with the type left to be worked out from it
app.on(byAddress.clicked, () => doc.show({ src: "/fixtures/t25-paper.pdf" }));
app.on(goTo2.clicked, () => doc.goTo(2));
app.on(mark.clicked, () => doc.mark(SENTENCE));
app.on(markHyphenated.clicked, () => doc.mark(HYPHENATED));
app.on(clear.clicked, () => doc.clearMark());
app.on(doc.selected, (e) => rec.push("selected", e));

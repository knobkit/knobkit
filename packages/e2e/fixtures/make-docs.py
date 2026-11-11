"""Writes the document fixtures for t25 (the document viewer) next to this file.

    python -m venv venv && venv/bin/pip install matplotlib python-docx python-pptx openpyxl pillow
    venv/bin/python make-docs.py

The files are made by these libraries, not saved from Word, PowerPoint or Excel.
"""

from pathlib import Path

import matplotlib

matplotlib.use("Agg")
matplotlib.rcParams["pdf.fonttype"] = 42  # embed the fonts as TrueType, as a typeset paper does
matplotlib.rcParams["font.family"] = "DejaVu Sans"

from docx import Document
from docx.enum.text import WD_BREAK
from matplotlib.backends.backend_agg import FigureCanvasAgg
from matplotlib.backends.backend_pdf import PdfPages
from matplotlib.figure import Figure
from openpyxl import Workbook
from PIL import Image, ImageDraw
from pptx import Presentation
from pptx.util import Inches

HERE = Path(__file__).parent

FILLER = [
    "Stochastic gradient-based optimization is of core practical importance",
    "in many fields of science and engineering. Many problems in these fields",
    "can be cast as the optimization of some scalar objective function that",
    "requires maximization or minimization with respect to its parameters.",
]


def pdf() -> None:
    """15 pages. Page 7 breaks a word over a line with a hyphen; page 11 has a word in italics."""
    left, top, step, size = 72, 700, 18, 11
    with PdfPages(HERE / "t25-paper.pdf", metadata={"CreationDate": None, "ModDate": None, "Title": "t25 paper"}) as out:
        for n in range(1, 16):
            fig = Figure(figsize=(8.5, 11), dpi=72)
            renderer = FigureCanvasAgg(fig).get_renderer()
            y = top

            def line(parts: list[tuple[str, str]]) -> None:
                nonlocal y
                x = left
                for text, style in parts:
                    fig.text(x / 612, y / 792, text, fontsize=size, style=style)
                    # a space at the end is not counted in the extent, so measure with a stop after it
                    probe = fig.text(0, 0, text + "|", fontsize=size, style=style)
                    bar = fig.text(0, 0, "|", fontsize=size, style=style)
                    x += probe.get_window_extent(renderer).width - bar.get_window_extent(renderer).width
                    probe.remove()
                    bar.remove()
                y -= step

            fig.text(left / 612, 740 / 792, f"Section {n}: results of run {n}", fontsize=16, weight="bold")
            for k in range(3):
                for text in FILLER:
                    line([(f"{text}", "normal")])
                y -= step
                if n == 7 and k == 0:
                    line([("We call the method Adam. The hyper-parameters have intuitive interpre-", "normal")])
                    line([("tations and typically require little tuning. Some connections to related", "normal")])
                    line([("algorithms are discussed below.", "normal")])
                    y -= step
                if n == 11 and k == 0:
                    line([("The method is ", "normal"), ("remarkably", "italic"), (" robust to noisy gradients.", "normal")])
                    y -= step
            fig.text(0.5, 40 / 792, f"page {n} of 15", fontsize=9, ha="center")
            out.savefig(fig)


def docx() -> None:
    """Headings, bold and italic text, a table; the second page has a sentence with one word in italics."""
    d = Document()
    d.add_heading("Adam: a method for stochastic optimization", level=1)
    p = d.add_paragraph("This report has ")
    p.add_run("bold words").bold = True
    p.add_run(" and ")
    p.add_run("italic words").italic = True
    p.add_run(" in one paragraph.")
    d.add_heading("Results", level=2)
    table = d.add_table(rows=3, cols=3)
    table.style = "Table Grid"
    for r, row in enumerate([["Optimizer", "Loss", "Steps"], ["Adam", "0.12", "4000"], ["SGD", "0.31", "9000"]]):
        for c, text in enumerate(row):
            table.cell(r, c).text = text
    d.add_heading("Background", level=2)
    for i in range(12):
        d.add_paragraph(f"Paragraph {i + 1}. " + " ".join(FILLER))
    d.add_paragraph().add_run().add_break(WD_BREAK.PAGE)
    d.add_heading("Discussion", level=2)
    for i in range(6):
        d.add_paragraph(f"Note {i + 1}. " + " ".join(FILLER))
    p = d.add_paragraph("We found one thing. The method is ")
    p.add_run("remarkably").italic = True
    p.add_run(" robust to noisy gradients. It also needs little memory.")
    d.add_paragraph("Closing paragraph. " + " ".join(FILLER))
    d.save(HERE / "t25-report.docx")


def pptx() -> None:
    """Three slides with titles and bullets; slide 2 has a table, slide 3 a sentence with one word in italics."""
    deck = Presentation()
    layout = deck.slide_layouts[1]  # title and content

    def slide(title: str, bullets: list[str]):
        s = deck.slides.add_slide(layout)
        s.shapes.title.text = title
        frame = s.placeholders[1].text_frame
        frame.text = bullets[0]
        for b in bullets[1:]:
            frame.add_paragraph().text = b
        return s

    slide("Adam in three slides", ["Adaptive moment estimation", "First-order gradients only", "Little memory needed"])
    s2 = slide("Results so far", ["Lower loss than SGD", "Fewer steps to converge"])
    body = s2.placeholders[1]
    body.left, body.top, body.width, body.height = Inches(0.5), Inches(1.6), Inches(9), Inches(1.6)
    shape = s2.shapes.add_table(3, 3, Inches(1), Inches(3.8), Inches(8), Inches(1.5))
    for r, row in enumerate([["Optimizer", "Loss", "Steps"], ["Adam", "0.12", "4000"], ["SGD", "0.31", "9000"]]):
        for c, text in enumerate(row):
            shape.table.cell(r, c).text = text
    s3 = slide("What we learned", ["Bias correction matters early on"])
    p = s3.placeholders[1].text_frame.add_paragraph()
    p.add_run().text = "The method is "
    r = p.add_run()
    r.text = "remarkably"
    r.font.italic = True
    p.add_run().text = " robust to noisy gradients."
    deck.save(HERE / "t25-deck.pptx")


def xlsx() -> None:
    """Two sheets with numbers; one cell is text that only looks like a number."""
    wb = Workbook()
    a = wb.active
    a.title = "results"
    for row in [["optimizer", "loss", "steps", "code"], ["Adam", 0.12, 4000, "007"], ["SGD", 0.31, 9000, "012"], ["RMSProp", 0.2, 10500, "101"]]:
        a.append(row)
    b = wb.create_sheet("budget")
    for row in [["item", "cost"], ["compute", 1250.5], ["storage", 300], ["total", 1550.5]]:
        b.append(row)
    wb.save(HERE / "t25-book.xlsx")


def others() -> None:
    (HERE / "t25-notes.md").write_text("# Reading notes\n\nAdam is **adaptive**.\n\n- first item\n- second item\n")
    (HERE / "t25-plain.txt").write_text("first line of plain text\n  second line, indented\n")
    (HERE / "t25-data.csv").write_text('optimizer,loss,comment\nAdam,0.12,"fast, stable"\nSGD,0.31,slow\n')
    img = Image.new("RGB", (120, 80), (30, 110, 220))
    ImageDraw.Draw(img).rectangle([20, 20, 100, 60], fill=(250, 200, 40))
    img.save(HERE / "t25-pic.png")
    (HERE / "t25-other.bin").write_bytes(bytes(i % 251 for i in range(1536)))


if __name__ == "__main__":
    pdf()
    docx()
    pptx()
    xlsx()
    others()

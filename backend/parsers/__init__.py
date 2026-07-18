from __future__ import annotations

from pathlib import Path

from backend.parsers.csv_parser import parse_csv
from backend.parsers.docx_parser import parse_docx
from backend.parsers.pdf_parser import parse_pdf
from backend.parsers.pptx_parser import parse_pptx
from backend.parsers.text_parser import parse_text
from backend.parsers.xlsx_parser import parse_xlsx
from backend.parsers.zip_parser import inspect_zip

SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".pptx", ".xlsx", ".csv", ".txt", ".md", ".json", ".zip", ".png", ".jpg", ".jpeg"}


def parse_document(filename: str, content: bytes, **limits) -> tuple[str, str]:
    extension = Path(filename).suffix.lower()
    if extension not in SUPPORTED_EXTENSIONS: raise ValueError(f"Unsupported file type: {extension or 'none'}")
    if extension in {".png", ".jpg", ".jpeg"}: raise ValueError("Images require browser OCR")
    if extension == ".pdf": return parse_pdf(content), "pypdf"
    if extension == ".docx": return parse_docx(content), "python-docx"
    if extension == ".pptx": return parse_pptx(content), "python-pptx"
    if extension == ".xlsx": return parse_xlsx(content), "openpyxl"
    if extension == ".csv": return parse_csv(content), "csv"
    if extension == ".zip": return inspect_zip(content, **limits), "safe_zip_inspection"
    return parse_text(content, extension), "text"


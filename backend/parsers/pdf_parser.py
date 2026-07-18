from io import BytesIO
from pypdf import PdfReader


def parse_pdf(content: bytes) -> str:
    reader = PdfReader(BytesIO(content), strict=False)
    if reader.is_encrypted:
        try: reader.decrypt("")
        except Exception as exc: raise ValueError("Encrypted PDFs are not supported") from exc
    pages = []
    for index, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        if text.strip(): pages.append(f"[Page {index + 1}]\n{text.strip()}")
    return "\n\n".join(pages)


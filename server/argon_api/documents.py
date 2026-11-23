from __future__ import annotations

from io import BytesIO

from pypdf import PdfReader


class DocumentError(ValueError):
    pass


def extract_pdf_text(data: bytes, *, max_pages: int, max_chars: int) -> str:
    if not data:
        raise DocumentError("The selected PDF is empty.")
    try:
        reader = PdfReader(BytesIO(data), strict=False)
        if reader.is_encrypted:
            try:
                unlocked = reader.decrypt("")
            except Exception as exc:
                raise DocumentError(
                    "Password-protected PDFs are not supported."
                ) from exc
            if not unlocked:
                raise DocumentError("Password-protected PDFs are not supported.")
        page_count = len(reader.pages)
        if page_count > max_pages:
            raise DocumentError(f"PDFs are limited to {max_pages} pages.")
        pieces: list[str] = []
        total = 0
        for page in reader.pages:
            text = page.extract_text() or ""
            if not text:
                continue
            remaining = max_chars - total
            if remaining <= 0:
                break
            excerpt = text[:remaining]
            pieces.append(excerpt)
            total += len(excerpt)
        result = "\n\n".join(pieces).strip()
        if not result:
            raise DocumentError(
                "No selectable text was found. Scanned-image PDFs need OCR before upload."
            )
        return result
    except DocumentError:
        raise
    except Exception as exc:
        raise DocumentError(
            "This PDF could not be read. Please try another file."
        ) from exc

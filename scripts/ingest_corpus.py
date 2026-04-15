#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import mimetypes
import os
import re
import subprocess
import tempfile
import unicodedata
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import quote
from xml.etree import ElementTree as ET
from zipfile import ZipFile

import requests
from bs4 import BeautifulSoup
from charset_normalizer import from_bytes
from dotenv import load_dotenv
from pypdf import PdfReader


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CORPUS_DIR = PROJECT_ROOT / "Biorce_Hackathon_Corpus-20260415T143420Z-3-001" / "Biorce_Hackathon_Corpus"
DOCUMENT_NAMESPACE = uuid.UUID("f46b0573-14b5-476f-833c-6a0b14a44c9d")
PIPELINE_NAMESPACE = uuid.UUID("7d028b47-a76b-4bde-af09-c9f07f4b03de")
CHUNK_NAMESPACE = uuid.UUID("3c0b0986-0fb1-4be1-a1d6-06238b6b9dc9")
WORD_NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}

LANGUAGE_STOPWORDS: dict[str, set[str]] = {
    "en": {"the", "and", "for", "with", "this", "that", "patient", "study", "protocol", "consent"},
    "es": {"el", "la", "de", "que", "para", "con", "estudio", "paciente", "consentimiento", "protocolo"},
    "fr": {"le", "la", "de", "et", "pour", "avec", "etude", "patient", "consentement", "protocole"},
    "de": {"der", "die", "und", "mit", "für", "studie", "patient", "einwilligung", "protokoll"},
    "it": {"il", "lo", "la", "di", "per", "con", "studio", "paziente", "consenso", "protocollo"},
}

HEADING_MAX_LENGTH = 140
MAX_CHUNK_CHARS = 1800
CHUNK_OVERLAP_CHARS = 200


@dataclass
class ExtractedDocument:
    raw_text: str
    normalized_text: str
    language: str
    ocr_quality_score: float
    extraction_status: str
    structure: dict[str, Any]
    chunks: list[dict[str, Any]]


def main() -> int:
    load_dotenv(PROJECT_ROOT / ".env")

    parser = argparse.ArgumentParser(description="Ingest the Biorce hackathon corpus into Supabase.")
    parser.add_argument("--corpus-dir", type=Path, default=DEFAULT_CORPUS_DIR)
    parser.add_argument("--upload-storage", action="store_true")
    parser.add_argument("--execute-sql", action="store_true")
    parser.add_argument("--skip-existing-storage", action="store_true")
    parser.add_argument("--sql-output", type=Path)
    parser.add_argument("--sql-batch-size", type=int, default=0)
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()

    required = {
        "NEXT_PUBLIC_SUPABASE_URL": os.getenv("NEXT_PUBLIC_SUPABASE_URL"),
        "SUPABASE_SERVICE_ROLE_KEY": os.getenv("SUPABASE_SERVICE_ROLE_KEY"),
    }
    missing = [key for key, value in required.items() if not value]
    if missing:
        raise SystemExit(f"Missing required environment variables: {', '.join(missing)}")

    corpus_dir = args.corpus_dir.resolve()
    if not corpus_dir.exists():
        raise SystemExit(f"Corpus directory not found: {corpus_dir}")

    files = sorted(path for path in corpus_dir.iterdir() if path.is_file())
    if args.limit > 0:
        files = files[: args.limit]

    supabase_url = required["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
    service_role_key = required["SUPABASE_SERVICE_ROLE_KEY"]

    run_id = str(uuid.uuid5(PIPELINE_NAMESPACE, f"milestone2:{datetime.now(timezone.utc).isoformat()}"))
    processed_documents: list[dict[str, Any]] = []
    processed_chunks: list[dict[str, Any]] = []
    verification_samples: list[dict[str, Any]] = []

    print(f"Processing {len(files)} files from {corpus_dir}")
    for index, file_path in enumerate(files, start=1):
        print(f"[{index:03d}/{len(files):03d}] {file_path.name}")
        record = build_document_record(file_path, corpus_dir, uploaded_to_storage=args.upload_storage)

        if args.upload_storage:
            upload_storage_objects(
                supabase_url=supabase_url,
                service_role_key=service_role_key,
                record=record,
                skip_existing=args.skip_existing_storage,
            )

        processed_documents.append(record["document_row"])
        processed_chunks.extend(record["chunk_rows"])
        verification_samples.append(record["verification_sample"])

    sql_paths = write_sql_outputs(
        run_id=run_id,
        documents=processed_documents,
        chunks=processed_chunks,
        sql_output=args.sql_output,
        sql_batch_size=args.sql_batch_size,
    )

    if len(sql_paths) == 1:
        print(f"Generated SQL at {sql_paths[0]}")
    else:
        print(f"Generated {len(sql_paths)} SQL files under {sql_paths[0].parent}")
    if args.execute_sql:
        for sql_path in sql_paths:
            execute_sql_file(sql_path)

    summary = {
        "run_id": run_id,
        "processed_files": len(processed_documents),
        "processed_chunks": len(processed_chunks),
        "sql_files": [str(path) for path in sql_paths],
        "files_by_extension": count_by_key((doc["extension"] for doc in processed_documents)),
        "languages": count_by_key((doc["language"] or "unknown" for doc in processed_documents)),
        "verification_samples": verification_samples[:8],
    }
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    return 0


def build_document_record(file_path: Path, corpus_dir: Path, *, uploaded_to_storage: bool) -> dict[str, Any]:
    relative_path = file_path.relative_to(corpus_dir).as_posix()
    raw_storage_object = f"corpus/{relative_path}"
    raw_storage_path = f"raw-documents/{raw_storage_object}"
    derived_storage_object = f"extractions/{file_path.stem}.json"
    derived_storage_path = f"derived-artifacts/{derived_storage_object}"

    file_bytes = file_path.read_bytes()
    sha256 = hashlib.sha256(file_bytes).hexdigest()
    extension = file_path.suffix.lower().lstrip(".")
    mime_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
    document_id = str(uuid.uuid5(DOCUMENT_NAMESPACE, raw_storage_path))
    file_id = str(uuid.uuid5(DOCUMENT_NAMESPACE, f"file:{raw_storage_path}"))

    extracted = extract_document(file_path, file_bytes, extension)

    derived_artifact = {
        "file_name": file_path.name,
        "relative_path": relative_path,
        "raw_storage_path": raw_storage_path,
        "derived_storage_path": derived_storage_path,
        "sha256": sha256,
        "byte_size": len(file_bytes),
        "mime_type": mime_type,
        "extension": extension,
        "language": extracted.language,
        "ocr_quality_score": extracted.ocr_quality_score,
        "extraction_status": extracted.extraction_status,
        "structure": extracted.structure,
        "raw_text_preview": extracted.raw_text[:2000],
        "normalized_text_preview": extracted.normalized_text[:2000],
        "chunk_count": len(extracted.chunks),
    }

    document_row = {
        "id": document_id,
        "file_id": file_id,
        "file_name": file_path.name,
        "storage_path": raw_storage_path,
        "extension": extension,
        "mime_type": mime_type,
        "byte_size": len(file_bytes),
        "sha256": sha256,
        "text_extraction_status": extracted.extraction_status,
        "ocr_quality_score": extracted.ocr_quality_score,
        "language": extracted.language,
        "metadata": {
            "source_relative_path": relative_path,
            "raw_storage_object": raw_storage_object,
            "derived_storage_object": derived_storage_object,
            "derived_storage_path": derived_storage_path,
            "structure": extracted.structure,
            "ingestion": {
                "pipeline_stage": "milestone_2",
                "uploaded_raw": uploaded_to_storage,
                "uploaded_derived": uploaded_to_storage,
            },
        },
    }

    chunk_rows = []
    for chunk in extracted.chunks:
        chunk_rows.append(
            {
                "id": str(uuid.uuid5(CHUNK_NAMESPACE, f"{document_id}:{chunk['chunk_index']}")),
                "document_id": document_id,
                "chunk_index": chunk["chunk_index"],
                "page_number": chunk.get("page_number"),
                "raw_text": chunk["raw_text"],
                "normalized_text": chunk["normalized_text"],
                "metadata": chunk["metadata"],
            }
        )

    verification_sample = {
        "file_name": file_path.name,
        "extension": extension,
        "language": extracted.language,
        "ocr_quality_score": extracted.ocr_quality_score,
        "char_count": len(extracted.normalized_text),
        "chunk_count": len(extracted.chunks),
        "headings": extracted.structure.get("headings", [])[:4],
        "table_count": extracted.structure.get("table_count", 0),
    }

    return {
        "file_bytes": file_bytes,
        "raw_storage_object": raw_storage_object,
        "derived_storage_object": derived_storage_object,
        "derived_artifact": derived_artifact,
        "document_row": document_row,
        "chunk_rows": chunk_rows,
        "verification_sample": verification_sample,
    }


def write_sql_outputs(
    *,
    run_id: str,
    documents: list[dict[str, Any]],
    chunks: list[dict[str, Any]],
    sql_output: Path | None,
    sql_batch_size: int,
) -> list[Path]:
    if sql_batch_size <= 0:
        sql = build_sql_script(run_id=run_id, documents=documents, chunks=chunks)
        return [write_sql_file(sql, sql_output)]

    sql_dir = resolve_sql_batch_directory(sql_output)
    chunk_map: dict[str, list[dict[str, Any]]] = {}
    for chunk in chunks:
        chunk_map.setdefault(chunk["document_id"], []).append(chunk)

    sql_paths: list[Path] = []
    for batch_index, start in enumerate(range(0, len(documents), sql_batch_size), start=1):
        batch_docs = documents[start : start + sql_batch_size]
        batch_chunks: list[dict[str, Any]] = []
        for document in batch_docs:
            batch_chunks.extend(chunk_map.get(document["id"], []))
        sql = build_sql_script(run_id=run_id, documents=batch_docs, chunks=batch_chunks)
        sql_path = sql_dir / f"milestone2_ingestion_{batch_index:03d}.sql"
        sql_path.write_text(sql, encoding="utf-8")
        sql_paths.append(sql_path)
    return sql_paths


def write_sql_file(sql: str, sql_output: Path | None) -> Path:
    if sql_output:
        sql_path = sql_output.resolve()
        sql_path.parent.mkdir(parents=True, exist_ok=True)
        sql_path.write_text(sql, encoding="utf-8")
        return sql_path

    with tempfile.NamedTemporaryFile("w", encoding="utf-8", suffix=".sql", delete=False) as sql_file:
        sql_file.write(sql)
        return Path(sql_file.name)


def resolve_sql_batch_directory(sql_output: Path | None) -> Path:
    if sql_output is None:
        sql_dir = Path(tempfile.mkdtemp(prefix="milestone2_sql_"))
    else:
        output = sql_output.resolve()
        if output.suffix.lower() == ".sql":
            sql_dir = output.parent / f"{output.stem}_parts"
        else:
            sql_dir = output
    sql_dir.mkdir(parents=True, exist_ok=True)
    return sql_dir


def extract_document(file_path: Path, file_bytes: bytes, extension: str) -> ExtractedDocument:
    if extension in {"md", "txt"}:
        raw_text = decode_bytes(file_bytes)
        structure = extract_text_structure(raw_text, extension=extension)
        normalized = normalize_text(raw_text)
        language = detect_language(normalized)
        chunks = chunk_text(normalized, raw_text, structure.get("headings", []))
        return ExtractedDocument(
            raw_text=raw_text,
            normalized_text=normalized,
            language=language,
            ocr_quality_score=estimate_ocr_quality(raw_text, normalized),
            extraction_status="completed" if normalized.strip() else "empty",
            structure=structure,
            chunks=chunks,
        )

    if extension == "html":
        raw_text, structure = extract_html(file_bytes)
        normalized = normalize_text(raw_text)
        language = structure.get("language_hint") or detect_language(normalized)
        chunks = chunk_text(normalized, raw_text, structure.get("headings", []))
        return ExtractedDocument(
            raw_text=raw_text,
            normalized_text=normalized,
            language=language,
            ocr_quality_score=estimate_ocr_quality(raw_text, normalized),
            extraction_status="completed" if normalized.strip() else "empty",
            structure=structure,
            chunks=chunks,
        )

    if extension == "csv":
        raw_text, structure = extract_csv(file_bytes)
        normalized = normalize_text(raw_text)
        language = detect_language(normalized)
        chunks = chunk_text(normalized, raw_text, structure.get("headings", []))
        return ExtractedDocument(
            raw_text=raw_text,
            normalized_text=normalized,
            language=language,
            ocr_quality_score=estimate_ocr_quality(raw_text, normalized),
            extraction_status="completed" if normalized.strip() else "empty",
            structure=structure,
            chunks=chunks,
        )

    if extension == "pdf":
        raw_text, structure, pages = extract_pdf(file_path)
        normalized = normalize_text(raw_text)
        language = detect_language(normalized)
        chunks = chunk_pages(pages) if pages else chunk_text(normalized, raw_text, structure.get("headings", []))
        return ExtractedDocument(
            raw_text=raw_text,
            normalized_text=normalized,
            language=language,
            ocr_quality_score=estimate_ocr_quality(raw_text, normalized),
            extraction_status="completed" if normalized.strip() else "empty",
            structure=structure,
            chunks=chunks,
        )

    if extension == "docx":
        raw_text, structure = extract_docx(file_path)
        normalized = normalize_text(raw_text)
        language = detect_language(normalized)
        chunks = chunk_text(normalized, raw_text, structure.get("headings", []))
        return ExtractedDocument(
            raw_text=raw_text,
            normalized_text=normalized,
            language=language,
            ocr_quality_score=estimate_ocr_quality(raw_text, normalized),
            extraction_status="completed" if normalized.strip() else "empty",
            structure=structure,
            chunks=chunks,
        )

    raise ValueError(f"Unsupported extension: {extension}")


def decode_bytes(raw_bytes: bytes) -> str:
    detection = from_bytes(raw_bytes).best()
    if detection is not None:
        return str(detection)
    return raw_bytes.decode("utf-8", errors="replace")


def extract_html(file_bytes: bytes) -> tuple[str, dict[str, Any]]:
    html = decode_bytes(file_bytes)
    soup = BeautifulSoup(html, "html.parser")
    headings = [node.get_text(" ", strip=True) for node in soup.find_all(re.compile(r"^h[1-6]$"))]
    tables: list[list[list[str]]] = []
    table_text_blocks: list[str] = []
    for table in soup.find_all("table"):
        rows: list[list[str]] = []
        for row in table.find_all("tr"):
            cells = [cell.get_text(" ", strip=True) for cell in row.find_all(["th", "td"])]
            if cells:
                rows.append(cells)
        if rows:
            tables.append(rows)
            table_text_blocks.append("\n".join("\t".join(row) for row in rows))
    text_blocks = []
    for element in soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6", "p", "li"]):
        value = element.get_text(" ", strip=True)
        if value:
            text_blocks.append(value)
    raw_text = "\n\n".join(text_blocks + table_text_blocks).strip()
    structure = {
        "headings": headings,
        "table_count": len(tables),
        "tables_preview": tables[:3],
        "language_hint": (soup.html.get("lang") if soup.html else None) or "",
        "field_labels": find_field_labels(raw_text),
        "line_count": len(raw_text.splitlines()),
    }
    return raw_text, structure


def extract_csv(file_bytes: bytes) -> tuple[str, dict[str, Any]]:
    text = decode_bytes(file_bytes)
    reader = csv.reader(text.splitlines())
    rows = list(reader)
    headers = rows[0] if rows else []
    data_rows = rows[1:] if len(rows) > 1 else []
    rendered_rows = []
    for row in data_rows:
        pairs = [f"{header}: {value}" for header, value in zip(headers, row)]
        rendered_rows.append(" | ".join(pair for pair in pairs if pair.strip()))
    raw_text = "\n".join(
        [
            f"CSV Columns: {', '.join(headers)}",
            f"Row Count: {len(data_rows)}",
            "",
            *rendered_rows,
        ]
    ).strip()
    structure = {
        "headings": ["CSV Columns"],
        "table_count": 1 if headers else 0,
        "columns": headers,
        "row_count": len(data_rows),
        "field_labels": headers,
        "line_count": len(raw_text.splitlines()),
    }
    return raw_text, structure


def extract_pdf(file_path: Path) -> tuple[str, dict[str, Any], list[dict[str, Any]]]:
    reader = PdfReader(str(file_path))
    page_entries: list[dict[str, Any]] = []
    first_lines: list[str] = []
    last_lines: list[str] = []
    for page_index, page in enumerate(reader.pages, start=1):
        page_text = page.extract_text() or ""
        page_text = page_text.strip()
        page_entries.append({"page_number": page_index, "raw_text": page_text, "normalized_text": normalize_text(page_text)})
        lines = [line.strip() for line in page_text.splitlines() if line.strip()]
        if lines:
            first_lines.extend(lines[:2])
            last_lines.extend(lines[-2:])
    raw_text = "\n\n".join(page["raw_text"] for page in page_entries if page["raw_text"]).strip()
    structure = extract_text_structure(raw_text, extension="pdf")
    structure.update(
        {
            "page_count": len(page_entries),
            "repeated_headers": repeated_lines(first_lines),
            "repeated_footers": repeated_lines(last_lines),
        }
    )
    return raw_text, structure, page_entries


def extract_docx(file_path: Path) -> tuple[str, dict[str, Any]]:
    with ZipFile(file_path) as archive:
        paragraphs: list[str] = []
        tables_preview: list[list[list[str]]] = []
        document_xml = archive.read("word/document.xml")
        root = ET.fromstring(document_xml)
        body = root.find("w:body", WORD_NS)
        if body is not None:
            for child in body:
                tag = child.tag.rsplit("}", 1)[-1]
                if tag == "p":
                    text = extract_word_paragraph(child)
                    if text:
                        paragraphs.append(text)
                elif tag == "tbl":
                    rows: list[list[str]] = []
                    for row in child.findall("w:tr", WORD_NS):
                        cells = []
                        for cell in row.findall("w:tc", WORD_NS):
                            cell_text = " ".join(
                                part for part in (extract_word_paragraph(p) for p in cell.findall("w:p", WORD_NS)) if part
                            )
                            if cell_text:
                                cells.append(cell_text)
                        if cells:
                            rows.append(cells)
                            paragraphs.append("\t".join(cells))
                    if rows:
                        tables_preview.append(rows)

        header_footer_lines: list[str] = []
        for name in archive.namelist():
            if name.startswith("word/header") or name.startswith("word/footer"):
                xml_root = ET.fromstring(archive.read(name))
                for paragraph in xml_root.findall(".//w:p", WORD_NS):
                    text = extract_word_paragraph(paragraph)
                    if text:
                        header_footer_lines.append(text)

    raw_text = "\n".join(paragraphs).strip()
    structure = extract_text_structure(raw_text, extension="docx")
    structure.update(
        {
            "table_count": len(tables_preview),
            "tables_preview": tables_preview[:3],
            "header_footer_lines": header_footer_lines[:20],
        }
    )
    return raw_text, structure


def extract_word_paragraph(paragraph: ET.Element) -> str:
    texts = [node.text or "" for node in paragraph.findall(".//w:t", WORD_NS)]
    return "".join(texts).strip()


def extract_text_structure(raw_text: str, extension: str) -> dict[str, Any]:
    lines = [line.strip() for line in raw_text.splitlines()]
    headings = collect_headings(lines)
    return {
        "extension": extension,
        "line_count": len(lines),
        "headings": headings,
        "field_labels": find_field_labels(raw_text),
        "table_count": 0,
    }


def collect_headings(lines: Iterable[str]) -> list[str]:
    headings: list[str] = []
    for line in lines:
        if not line:
            continue
        if line.startswith("#"):
            headings.append(line.lstrip("# ").strip())
            continue
        if len(line) <= HEADING_MAX_LENGTH and is_heading_like(line):
            headings.append(line)
    seen: set[str] = set()
    deduped = []
    for heading in headings:
        normalized = heading.casefold()
        if normalized in seen:
            continue
        seen.add(normalized)
        deduped.append(heading)
    return deduped[:25]


def is_heading_like(line: str) -> bool:
    if line.endswith(":"):
        return True
    if re.fullmatch(r"[A-Z0-9 \-–—()/.]{6,}", line):
        return True
    title_ratio = sum(1 for token in line.split() if token[:1].isupper()) / max(len(line.split()), 1)
    return title_ratio >= 0.7 and len(line.split()) <= 12


def find_field_labels(text: str) -> list[str]:
    labels: list[str] = []
    for match in re.finditer(r"(?m)^([A-Za-z][A-Za-z0-9 /()._-]{1,60}):\s", text):
        labels.append(match.group(1).strip())
    seen: set[str] = set()
    output = []
    for label in labels:
        folded = label.casefold()
        if folded in seen:
            continue
        seen.add(folded)
        output.append(label)
    return output[:30]


def repeated_lines(lines: list[str]) -> list[str]:
    counts = count_by_key(line for line in lines if line)
    repeated = [line for line, count in counts.items() if count >= 2]
    return repeated[:12]


def normalize_text(text: str) -> str:
    text = unicodedata.normalize("NFKC", text)
    text = text.replace("\u00ad", "")
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r" ?\n ?", "\n", text)
    return text.strip()


def detect_language(text: str) -> str:
    lowered = re.findall(r"[a-zà-ÿ]+", text.casefold())
    if not lowered:
        return "unknown"
    scores: dict[str, int] = {}
    token_set = set(lowered[:4000])
    for language, stopwords in LANGUAGE_STOPWORDS.items():
        scores[language] = len(token_set.intersection(stopwords))
    language, score = max(scores.items(), key=lambda item: item[1])
    return language if score > 0 else "unknown"


def estimate_ocr_quality(raw_text: str, normalized_text: str) -> float:
    if not normalized_text:
        return 0.0
    replacement_ratio = raw_text.count("�") / max(len(raw_text), 1)
    noisy_symbol_ratio = len(re.findall(r"[_]{4,}|[^\w\s]{5,}", raw_text)) / max(len(raw_text.splitlines()), 1)
    short_token_ratio = len([token for token in re.findall(r"\b\w+\b", normalized_text) if len(token) <= 1]) / max(
        len(re.findall(r"\b\w+\b", normalized_text)), 1
    )
    penalty = min(0.7 * replacement_ratio + 0.15 * noisy_symbol_ratio + 0.15 * short_token_ratio, 0.95)
    return round(max(0.05, 1.0 - penalty), 4)


def chunk_pages(pages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    chunks: list[dict[str, Any]] = []
    chunk_index = 0
    for page in pages:
        raw_text = page["raw_text"].strip()
        normalized = page["normalized_text"].strip()
        if not normalized:
            continue
        if len(normalized) <= MAX_CHUNK_CHARS:
            chunks.append(
                {
                    "chunk_index": chunk_index,
                    "page_number": page["page_number"],
                    "raw_text": raw_text,
                    "normalized_text": normalized,
                    "metadata": {"strategy": "page", "char_count": len(normalized)},
                }
            )
            chunk_index += 1
            continue

        segments = sliding_chunks(normalized, MAX_CHUNK_CHARS, CHUNK_OVERLAP_CHARS)
        for segment in segments:
            chunks.append(
                {
                    "chunk_index": chunk_index,
                    "page_number": page["page_number"],
                    "raw_text": segment,
                    "normalized_text": segment,
                    "metadata": {"strategy": "page_sliding_window", "char_count": len(segment)},
                }
            )
            chunk_index += 1
    return chunks


def chunk_text(normalized_text: str, raw_text: str, headings: list[str]) -> list[dict[str, Any]]:
    sections = [section.strip() for section in re.split(r"\n\s*\n", normalized_text) if section.strip()]
    chunks: list[dict[str, Any]] = []
    current_parts: list[str] = []
    current_length = 0
    chunk_index = 0

    def flush() -> None:
        nonlocal current_parts, current_length, chunk_index
        if not current_parts:
            return
        normalized_chunk = "\n\n".join(current_parts).strip()
        chunks.append(
            {
                "chunk_index": chunk_index,
                "page_number": None,
                "raw_text": normalized_chunk,
                "normalized_text": normalized_chunk,
                "metadata": {
                    "strategy": "section_window",
                    "char_count": len(normalized_chunk),
                    "heading_hints": [heading for heading in headings if heading in normalized_chunk][:3],
                },
            }
        )
        chunk_index += 1
        overlap_source = normalized_chunk[-CHUNK_OVERLAP_CHARS:].strip()
        current_parts = [overlap_source] if overlap_source else []
        current_length = sum(len(part) for part in current_parts)

    for section in sections:
        if len(section) > MAX_CHUNK_CHARS:
            flush()
            for segment in sliding_chunks(section, MAX_CHUNK_CHARS, CHUNK_OVERLAP_CHARS):
                chunks.append(
                    {
                        "chunk_index": chunk_index,
                        "page_number": None,
                        "raw_text": segment,
                        "normalized_text": segment,
                        "metadata": {"strategy": "sliding_window", "char_count": len(segment)},
                    }
                )
                chunk_index += 1
            current_parts = []
            current_length = 0
            continue

        projected = current_length + len(section) + (2 if current_parts else 0)
        if projected > MAX_CHUNK_CHARS:
            flush()
        current_parts.append(section)
        current_length += len(section) + (2 if current_parts else 0)

    flush()
    return chunks or [
        {
            "chunk_index": 0,
            "page_number": None,
            "raw_text": raw_text,
            "normalized_text": normalized_text,
            "metadata": {"strategy": "single_chunk", "char_count": len(normalized_text)},
        }
    ]


def sliding_chunks(text: str, chunk_size: int, overlap: int) -> list[str]:
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)
    return chunks


def upload_storage_objects(
    *,
    supabase_url: str,
    service_role_key: str,
    record: dict[str, Any],
    skip_existing: bool,
) -> None:
    upload_storage_object(
        supabase_url=supabase_url,
        service_role_key=service_role_key,
        bucket_name="raw-documents",
        object_path=record["raw_storage_object"],
        body=record["file_bytes"],
        content_type=record["document_row"]["mime_type"],
        skip_existing=skip_existing,
    )
    derived_payload = json.dumps(record["derived_artifact"], ensure_ascii=False, indent=2).encode("utf-8")
    upload_storage_object(
        supabase_url=supabase_url,
        service_role_key=service_role_key,
        bucket_name="derived-artifacts",
        object_path=record["derived_storage_object"],
        body=derived_payload,
        content_type="application/json; charset=utf-8",
        skip_existing=skip_existing,
    )


def upload_storage_object(
    *,
    supabase_url: str,
    service_role_key: str,
    bucket_name: str,
    object_path: str,
    body: bytes,
    content_type: str,
    skip_existing: bool,
) -> None:
    headers = {
        "Authorization": f"Bearer {service_role_key}",
        "apikey": service_role_key,
        "Content-Type": content_type,
    }
    endpoint = f"{supabase_url}/storage/v1/object/{bucket_name}/{quote(object_path, safe='/')}"
    if skip_existing:
        head_response = requests.get(endpoint, headers=headers, timeout=30)
        if head_response.ok:
            return

    response = requests.post(endpoint, headers=headers, data=body, timeout=60)
    if response.status_code in {200, 201}:
        return
    if response.status_code in {400, 409}:
        put_response = requests.put(endpoint, headers=headers, data=body, timeout=60)
        if put_response.status_code in {200, 201}:
            return
        raise RuntimeError(f"Storage PUT failed for {bucket_name}/{object_path}: {put_response.status_code} {put_response.text}")
    raise RuntimeError(f"Storage POST failed for {bucket_name}/{object_path}: {response.status_code} {response.text}")


def build_sql_script(*, run_id: str, documents: list[dict[str, Any]], chunks: list[dict[str, Any]]) -> str:
    document_ids = [doc["id"] for doc in documents]
    sql_parts = [
        "begin;",
        build_pipeline_run_sql(run_id, documents, chunks),
    ]

    if document_ids:
        sql_parts.append(
            "delete from internal.document_chunks where document_id in ("
            + ", ".join(sql_quote(value) for value in document_ids)
            + ");"
        )

    for document in documents:
        sql_parts.append(build_document_upsert_sql(document))

    for chunk in chunks:
        sql_parts.append(build_chunk_insert_sql(chunk))

    sql_parts.append("commit;")
    return "\n".join(sql_parts)


def build_pipeline_run_sql(run_id: str, documents: list[dict[str, Any]], chunks: list[dict[str, Any]]) -> str:
    stats = {
        "documents": len(documents),
        "chunks": len(chunks),
        "extensions": count_by_key(doc["extension"] for doc in documents),
    }
    return (
        "insert into internal.pipeline_runs (id, run_type, status, completed_at, config_json, stats_json) values ("
        f"{sql_quote(run_id)}, "
        f"{sql_quote('document_ingestion')}, "
        f"{sql_quote('completed')}, "
        "now(), "
        f"{sql_json({'stage': 'milestone_2_ingestion', 'storage_upload': True})}, "
        f"{sql_json(stats)}"
        ") on conflict (id) do update set status = excluded.status, completed_at = excluded.completed_at, "
        "config_json = excluded.config_json, stats_json = excluded.stats_json;"
    )


def build_document_upsert_sql(document: dict[str, Any]) -> str:
    return (
        "insert into public.documents ("
        "id, file_id, file_name, storage_path, extension, mime_type, byte_size, sha256, "
        "text_extraction_status, ocr_quality_score, language, metadata"
        ") values ("
        f"{sql_quote(document['id'])}, "
        f"{sql_quote(document['file_id'])}, "
        f"{sql_quote(document['file_name'])}, "
        f"{sql_quote(document['storage_path'])}, "
        f"{sql_quote(document['extension'])}, "
        f"{sql_quote(document['mime_type'])}, "
        f"{document['byte_size']}, "
        f"{sql_quote(document['sha256'])}, "
        f"{sql_quote(document['text_extraction_status'])}, "
        f"{document['ocr_quality_score']}, "
        f"{sql_quote(document['language'])}, "
        f"{sql_json(document['metadata'])}"
        ") on conflict (storage_path) do update set "
        "file_name = excluded.file_name, "
        "extension = excluded.extension, "
        "mime_type = excluded.mime_type, "
        "byte_size = excluded.byte_size, "
        "sha256 = excluded.sha256, "
        "text_extraction_status = excluded.text_extraction_status, "
        "ocr_quality_score = excluded.ocr_quality_score, "
        "language = excluded.language, "
        "metadata = excluded.metadata, "
        "updated_at = now();"
    )


def build_chunk_insert_sql(chunk: dict[str, Any]) -> str:
    page_number_sql = "null" if chunk["page_number"] is None else str(chunk["page_number"])
    return (
        "insert into internal.document_chunks (id, document_id, chunk_index, page_number, raw_text, normalized_text, metadata) values ("
        f"{sql_quote(chunk['id'])}, "
        f"{sql_quote(chunk['document_id'])}, "
        f"{chunk['chunk_index']}, "
        f"{page_number_sql}, "
        f"{sql_quote(chunk['raw_text'])}, "
        f"{sql_quote(chunk['normalized_text'])}, "
        f"{sql_json(chunk['metadata'])}"
        ") on conflict (document_id, chunk_index) do update set "
        "page_number = excluded.page_number, "
        "raw_text = excluded.raw_text, "
        "normalized_text = excluded.normalized_text, "
        "metadata = excluded.metadata, "
        "created_at = internal.document_chunks.created_at;"
    )


def sql_quote(value: str | None) -> str:
    if value is None:
        return "null"
    return "'" + value.replace("'", "''") + "'"


def sql_json(value: Any) -> str:
    return sql_quote(json.dumps(value, ensure_ascii=False)) + "::jsonb"


def count_by_key(values: Iterable[str]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for value in values:
        counts[value] = counts.get(value, 0) + 1
    return dict(sorted(counts.items()))


def execute_sql_file(sql_path: Path) -> None:
    command = [
        "powershell",
        "-Command",
        f"npx supabase@latest db query --linked --file '{sql_path}' --output json",
    ]
    result = subprocess.run(command, cwd=PROJECT_ROOT, check=False, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"Supabase SQL execution failed:\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}")
    if result.stdout.strip():
        print(result.stdout.strip())


if __name__ == "__main__":
    raise SystemExit(main())

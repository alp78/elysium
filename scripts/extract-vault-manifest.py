#!/usr/bin/env python3
"""
Vault Manifest Extractor for Elysium
Scans all .md files in content/, extracts metadata, writes vault-manifest.json.

Usage:
    python scripts/extract-vault-manifest.py

Run before Quartz build:
    npx quartz build   # prebuild hook runs this automatically
"""

import json
import os
import re
import sys
from collections import Counter
from pathlib import Path

CONTENT_DIR = Path(__file__).parent.parent / "content"
OUTPUT_FILE = Path(__file__).parent.parent / "quartz" / "static" / "vault-manifest.json"
BASE_URL = "/elysium"


def parse_frontmatter(text: str) -> dict:
    """Extract YAML frontmatter as a dict using regex (no pyyaml dependency)."""
    match = re.match(r"^---\s*\n(.*?)\n---\s*\n", text, re.DOTALL)
    if not match:
        return {}
    fm = {}
    raw = match.group(1)
    for line in raw.split("\n"):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        # Simple key: value parsing
        kv = re.match(r"^(\w[\w-]*)\s*:\s*(.*)", line)
        if kv:
            key, val = kv.group(1), kv.group(2).strip()
            # Handle arrays: [a, b, c] or bare values
            if val.startswith("[") and val.endswith("]"):
                items = [v.strip().strip("\"'") for v in val[1:-1].split(",") if v.strip()]
                fm[key] = items
            elif val.startswith('"') and val.endswith('"'):
                fm[key] = val[1:-1]
            elif val.startswith("'") and val.endswith("'"):
                fm[key] = val[1:-1]
            else:
                fm[key] = val
    # Handle multi-line arrays (YAML list style)
    for m in re.finditer(r"^(\w[\w-]*):\s*\n((?:\s+-\s+.*\n?)+)", raw, re.MULTILINE):
        key = m.group(1)
        items = re.findall(r"^\s+-\s+(.*)", m.group(2), re.MULTILINE)
        fm[key] = [i.strip().strip("\"'") for i in items]
    return fm


def get_body(text: str) -> str:
    """Return text after frontmatter."""
    match = re.match(r"^---\s*\n.*?\n---\s*\n", text, re.DOTALL)
    if match:
        return text[match.end():]
    return text


def count_words(body: str) -> int:
    """Count words excluding code blocks and HTML."""
    # Remove fenced code blocks
    no_code = re.sub(r"```.*?```", "", body, flags=re.DOTALL)
    # Remove HTML tags
    no_html = re.sub(r"<[^>]+>", "", no_code)
    # Remove wiki-links markup but keep text
    no_links = re.sub(r"\[\[([^|\]]*\|)?([^\]]*)\]\]", r"\2", no_html)
    # Remove markdown formatting
    clean = re.sub(r"[#*_`~>|]", " ", no_links)
    words = clean.split()
    return len(words)


def extract_note(filepath: Path) -> dict | None:
    """Extract metadata from a single .md file."""
    try:
        text = filepath.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return None

    rel = filepath.relative_to(CONTENT_DIR)
    parts = rel.parts
    if len(parts) < 1:
        return None

    filename = rel.stem
    path_str = str(rel.with_suffix("")).replace("\\", "/")

    # Section info
    section = parts[0] if len(parts) > 0 else ""
    section_match = re.match(r"^(\d+)-(.+)", section)
    section_number = int(section_match.group(1)) if section_match else -1
    section_name = section_match.group(2).replace("-", " ") if section_match else section

    # Subsection
    subsection = parts[1] if len(parts) > 2 else ""

    # Frontmatter
    fm = parse_frontmatter(text)
    body = get_body(text)

    # Title: first H1 heading, fallback to filename
    title_match = re.search(r"^#\s+(.+)", body, re.MULTILINE)
    title = title_match.group(1).strip() if title_match else filename.replace("-", " ").title()

    # Tags
    tags = fm.get("tags", [])
    if isinstance(tags, str):
        tags = [t.strip() for t in tags.split(",")]

    # Type
    note_type = fm.get("type", "unknown")

    # Technology
    technology = fm.get("technology", "")
    if isinstance(technology, list):
        technology = technology[0] if technology else ""

    # Status
    status = fm.get("status", "stable")

    # Updated date
    updated = fm.get("updated", "")

    # Word count
    wc = count_words(body)

    # Has code blocks
    has_code = bool(re.search(r"```\w", body))

    # Has Related section
    has_related = bool(re.search(r"^##\s+(Related|See Also|Cross-References)", body, re.MULTILINE | re.IGNORECASE))

    # Outgoing wiki-links
    outgoing = len(re.findall(r"\[\[[^\]]+\]\]", body))

    # URL
    url = f"{BASE_URL}/{path_str}"

    return {
        "path": path_str,
        "filename": filename,
        "title": title,
        "section": section,
        "section_name": section_name,
        "section_number": section_number,
        "subsection": subsection,
        "tags": tags,
        "type": note_type,
        "technology": technology,
        "status": status,
        "updated": updated,
        "word_count": wc,
        "has_code": has_code,
        "has_related": has_related,
        "outgoing_links": outgoing,
        "url": url,
    }


def main():
    if not CONTENT_DIR.exists():
        print(f"ERROR: content directory not found at {CONTENT_DIR}")
        sys.exit(1)

    notes = []
    for md_file in sorted(CONTENT_DIR.rglob("*.md")):
        # Skip root index (just a redirect)
        if md_file.name == "index.md" and md_file.parent == CONTENT_DIR:
            continue
        note = extract_note(md_file)
        if note and note["section_number"] >= 0:
            notes.append(note)

    # Aggregate statistics
    total_notes = len(notes)
    total_words = sum(n["word_count"] for n in notes)

    notes_by_section = Counter(n["section"] for n in notes)
    notes_by_type = Counter(n["type"] for n in notes)
    notes_by_status = Counter(n["status"] for n in notes)

    # Technology (flatten lists)
    tech_counter = Counter()
    for n in notes:
        tech = n.get("technology", "")
        if isinstance(tech, str) and tech:
            tech_counter[tech] += 1

    # Tag frequency
    tag_counter = Counter()
    for n in notes:
        for t in n.get("tags", []):
            if t:
                tag_counter[t] += 1

    # Non-index notes for related check
    non_index = [n for n in notes if not n["filename"].endswith("-index") and not n["filename"].endswith("index")]
    notes_with_code = sum(1 for n in notes if n["has_code"])
    notes_with_related = sum(1 for n in non_index if n["has_related"])

    avg_word_count = round(total_words / total_notes) if total_notes else 0
    avg_links = round(sum(n["outgoing_links"] for n in notes) / total_notes, 1) if total_notes else 0

    # Sections list
    sections_seen = {}
    for n in notes:
        s = n["section"]
        if s not in sections_seen:
            sections_seen[s] = {
                "number": n["section_number"],
                "name": n["section_name"],
                "slug": s,
                "note_count": 0,
                "url": f"{BASE_URL}/{s}",
            }
        sections_seen[s]["note_count"] += 1
    sections_list = sorted(sections_seen.values(), key=lambda x: x["number"])

    # Top 10 lists
    recently_updated = sorted(
        [n for n in notes if n["updated"]],
        key=lambda x: x["updated"],
        reverse=True,
    )[:10]

    largest_notes = sorted(notes, key=lambda x: x["word_count"], reverse=True)[:10]
    most_connected = sorted(notes, key=lambda x: x["outgoing_links"], reverse=True)[:10]

    manifest = {
        "generated": str(Path(sys.argv[0]).name),
        "total_notes": total_notes,
        "total_words": total_words,
        "notes_by_section": dict(notes_by_section.most_common()),
        "notes_by_type": dict(notes_by_type.most_common()),
        "notes_by_technology": dict(tech_counter.most_common()),
        "notes_by_status": dict(notes_by_status.most_common()),
        "tag_frequency": dict(tag_counter.most_common()),
        "notes_with_code_pct": round(notes_with_code / total_notes * 100, 1) if total_notes else 0,
        "notes_with_related_pct": round(notes_with_related / len(non_index) * 100, 1) if non_index else 0,
        "avg_word_count": avg_word_count,
        "avg_outgoing_links": avg_links,
        "sections_list": sections_list,
        "recently_updated": [
            {"title": n["title"], "url": n["url"], "updated": n["updated"], "section": n["section_name"]}
            for n in recently_updated
        ],
        "largest_notes": [
            {"title": n["title"], "url": n["url"], "word_count": n["word_count"], "section": n["section_name"]}
            for n in largest_notes
        ],
        "most_connected": [
            {"title": n["title"], "url": n["url"], "outgoing_links": n["outgoing_links"], "section": n["section_name"]}
            for n in most_connected
        ],
        "notes": notes,
    }

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_FILE.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")

    unique_tags = len(tag_counter)
    print(f"Extracted {total_notes} notes, {total_words:,} words, {unique_tags} unique tags")
    print(f"Output: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()

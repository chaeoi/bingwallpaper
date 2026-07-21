import json
import os
import tempfile
from datetime import datetime, timedelta
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = REPO_ROOT / "data" / "data.json"
README_FILE = REPO_ROOT / "README.md"
REQUIRED_FIELDS = ("image_date", "image_urlbase", "copyright")


def _parse_image_date(value, index):
    if not isinstance(value, str):
        raise ValueError(f"Entry {index} has a non-string image_date")

    try:
        return datetime.strptime(value, "%Y%m%d").date()
    except ValueError as exc:
        raise ValueError(f"Entry {index} has an invalid image_date: {value!r}") from exc


def validate_archive(entries, *, require_sorted=False, require_contiguous=False):
    if not isinstance(entries, list) or not entries:
        raise ValueError("Wallpaper archive must be a non-empty list")

    parsed_dates = []
    seen_dates = set()

    for index, entry in enumerate(entries):
        if not isinstance(entry, dict):
            raise ValueError(f"Entry {index} must be an object")

        for field in REQUIRED_FIELDS:
            value = entry.get(field)
            if not isinstance(value, str) or not value.strip():
                raise ValueError(f"Entry {index} has an invalid {field}")

        if not entry["image_urlbase"].startswith("https://cn.bing.com/th?id=OHR."):
            raise ValueError(f"Entry {index} has an untrusted image_urlbase")

        parsed_date = _parse_image_date(entry["image_date"], index)
        if parsed_date in seen_dates:
            raise ValueError(f"Duplicate image_date: {entry['image_date']}")

        seen_dates.add(parsed_date)
        parsed_dates.append(parsed_date)

    if require_sorted and parsed_dates != sorted(parsed_dates, reverse=True):
        raise ValueError("Wallpaper archive is not sorted by image_date descending")

    if require_contiguous:
        missing_dates = []
        current_date = min(parsed_dates)
        last_date = max(parsed_dates)

        while current_date <= last_date:
            if current_date not in seen_dates:
                missing_dates.append(current_date.isoformat())
            current_date += timedelta(days=1)

        if missing_dates:
            raise ValueError(
                f"Wallpaper archive has missing dates: {', '.join(missing_dates)}"
            )


def load_archive(path=DATA_FILE, *, require_sorted=False, require_contiguous=False):
    path = Path(path)

    try:
        with path.open("r", encoding="utf-8") as file:
            entries = json.load(file)
    except FileNotFoundError as exc:
        raise FileNotFoundError(f"Wallpaper archive does not exist: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"Wallpaper archive contains invalid JSON: {path}") from exc

    validate_archive(
        entries,
        require_sorted=require_sorted,
        require_contiguous=require_contiguous,
    )
    return entries


def merge_entries(existing_entries, recent_entries):
    entries_by_date = {entry["image_date"]: dict(entry) for entry in existing_entries}
    entries_by_date.update(
        {entry["image_date"]: dict(entry) for entry in recent_entries}
    )
    return sorted(
        entries_by_date.values(),
        key=lambda entry: entry["image_date"],
        reverse=True,
    )


def atomic_write_text(path, content):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    existing_mode = path.stat().st_mode if path.exists() else None
    file_descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.",
        dir=path.parent,
        text=True,
    )

    try:
        with os.fdopen(file_descriptor, "w", encoding="utf-8", newline="\n") as file:
            file.write(content)
            file.flush()
            os.fsync(file.fileno())

        if existing_mode is not None:
            os.chmod(temporary_name, existing_mode)
        os.replace(temporary_name, path)
    except Exception:
        try:
            os.unlink(temporary_name)
        except FileNotFoundError:
            pass
        raise


def write_archive(entries, path=DATA_FILE):
    validate_archive(entries, require_sorted=True, require_contiguous=True)
    content = json.dumps(entries, ensure_ascii=False, indent=2) + "\n"
    atomic_write_text(path, content)

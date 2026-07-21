from html import escape
from pathlib import Path

from .archive import DATA_FILE, README_FILE, atomic_write_text, load_archive


def generate_readme(data_path=DATA_FILE, readme_path=README_FILE):
    readme_path = Path(readme_path)
    entries = load_archive(
        data_path,
        require_sorted=True,
        require_contiguous=True,
    )
    latest_entry = entries[0]
    image_url = escape(latest_entry["image_urlbase"] + "_UHD.jpg", quote=True)
    copyright_text = escape(latest_entry["copyright"])
    content = f"""<div align="center">
<img src="{image_url}" alt="Bing Wallpaper" width="100%">
<em>{copyright_text}</em>
</div>
"""

    try:
        existing_content = readme_path.read_text(encoding="utf-8")
    except FileNotFoundError:
        existing_content = None

    if content != existing_content:
        atomic_write_text(readme_path, content)
        print("Updated README.md")
    else:
        print("README.md is already up to date")

    return content


if __name__ == "__main__":
    generate_readme()

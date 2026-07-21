from urllib.parse import urljoin


import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from .archive import (
    DATA_FILE,
    load_archive,
    merge_entries,
    validate_archive,
    write_archive,
)


API_URL = "https://global.bing.com/HPImageArchive.aspx?format=js&mkt=zh-CN&idx=0&n=8"
REQUEST_TIMEOUT = (5, 30)


def create_session():
    retry_policy = Retry(
        total=3,
        connect=3,
        read=3,
        status=3,
        backoff_factor=1,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset({"GET"}),
        respect_retry_after_header=True,
    )
    adapter = HTTPAdapter(max_retries=retry_policy)
    session = requests.Session()
    session.headers.update({"User-Agent": "bingwallpaper-archive-updater/1.0"})
    session.mount("https://", adapter)
    return session


def _fetch_recent_entries(session):
    response = session.get(API_URL, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()

    try:
        payload = response.json()
    except ValueError as exc:
        raise ValueError("Bing API returned invalid JSON") from exc

    images = payload.get("images") if isinstance(payload, dict) else None
    if not isinstance(images, list) or not images:
        raise ValueError("Bing API response does not contain any images")

    entries = []
    for index, image in enumerate(images):
        if not isinstance(image, dict):
            raise ValueError(f"Bing API image {index} must be an object")

        try:
            entry = {
                "image_date": image["enddate"],
                "image_urlbase": urljoin("https://cn.bing.com", image["urlbase"]),
                "copyright": image["copyright"],
            }
        except KeyError as exc:
            raise ValueError(
                f"Bing API image {index} is missing {exc.args[0]}"
            ) from exc

        entries.append(entry)

    validate_archive(entries)
    return entries


def fetch_recent_entries(session=None):
    if session is not None:
        return _fetch_recent_entries(session)

    with create_session() as managed_session:
        return _fetch_recent_entries(managed_session)


def generate_data_json(filepath=DATA_FILE, session=None):
    existing_entries = load_archive(filepath, require_sorted=True)
    recent_entries = fetch_recent_entries(session)
    merged_entries = merge_entries(existing_entries, recent_entries)
    validate_archive(merged_entries, require_sorted=True, require_contiguous=True)

    if merged_entries != existing_entries:
        write_archive(merged_entries, filepath)
        print(f"Updated wallpaper archive with {len(merged_entries)} entries")
    else:
        print("Wallpaper archive is already up to date")

    return merged_entries


if __name__ == "__main__":
    generate_data_json()

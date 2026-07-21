import requests
import json
from urllib.parse import urljoin

def generate_data_json():
    api_url = "https://global.bing.com/HPImageArchive.aspx?format=js&mkt=zh-CN&idx=0&n=8"
    response = requests.get(api_url)
    response.raise_for_status()
    images = response.json()['images']
    filepath = "data/data.json"

    try:
        with open(filepath, "r", encoding='utf-8') as f:
            existing_data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return

    existing_dates = {item.get('image_date') for item in existing_data}
    new_entries = [
        {
            "image_date": image['enddate'],
            "image_urlbase": urljoin("https://cn.bing.com", image['urlbase']),
            "copyright": image['copyright']
        }
        for image in images
        if image['enddate'] not in existing_dates
    ]

    if new_entries:
        existing_data.extend(new_entries)
        existing_data.sort(key=lambda item: item.get('image_date', ''), reverse=True)
        with open(filepath, "w", encoding='utf-8') as f:
            json.dump(existing_data, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    generate_data_json()

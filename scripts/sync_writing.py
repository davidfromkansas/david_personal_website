"""Import public Substack RSS metadata; keep the last good index on failure."""
import argparse
from datetime import timezone
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
import json
import math
from pathlib import Path
import re
import urllib.request
from urllib.parse import urlparse
import xml.etree.ElementTree as ET

FEED = "https://davidfromkansas.substack.com/feed"
OUTPUT = Path(__file__).resolve().parents[1] / "data/writing.json"

class Text(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.ignored = 0
    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.ignored += 1
    def handle_endtag(self, tag):
        if tag in ("script", "style") and self.ignored:
            self.ignored -= 1
    def handle_data(self, data):
        if not self.ignored:
            self.parts.append(data)

def plain(value):
    parser = Text()
    parser.feed(value or "")
    return " ".join(" ".join(parser.parts).split())

def parse_feed(xml):
    root = ET.fromstring(xml)
    if root.tag != "rss" or root.find("channel") is None:
        raise ValueError("Expected an RSS channel")
    articles = []
    for item in root.findall("./channel/item"):
        url = (item.findtext("link") or "").strip()
        parsed = urlparse(url)
        title = (item.findtext("title") or "").strip()
        if not title or parsed.scheme != "https" or parsed.hostname != "davidfromkansas.substack.com" or parsed.username or parsed.password:
            raise ValueError("Invalid article title or URL")
        date = parsedate_to_datetime(item.findtext("pubDate") or "")
        if not date.tzinfo:
            date = date.replace(tzinfo=timezone.utc)
        content = plain(item.findtext("{http://purl.org/rss/1.0/modules/content/}encoded"))
        words = len(re.findall(r"\b\w+\b", content))
        articles.append({"url": url, "title": title, "publishedAt": date.astimezone(timezone.utc).isoformat(), "description": plain(item.findtext("description")), "author": item.findtext("{http://purl.org/dc/elements/1.1/}creator") or "David Lie-Tjauw", "readingMinutes": max(1, math.ceil(words / 220)) if words else None})
    if not articles:
        raise ValueError("Feed contained no articles; preserving existing index")
    return articles

def merge_articles(previous, incoming):
    merged = {a["url"]: a for a in previous}
    merged.update({a["url"]: a for a in incoming})
    return sorted(merged.values(), key=lambda a: (a["publishedAt"], a["url"]), reverse=True)

def sync(xml, output=OUTPUT):
    incoming = parse_feed(xml)
    previous = json.loads(output.read_text())["articles"] if output.exists() else []
    payload = json.dumps({"articles": merge_articles(previous, incoming)}, ensure_ascii=False, indent=2) + "\n"
    if output.exists() and output.read_text() == payload:
        return False
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(".tmp")
    temporary.write_text(payload, encoding="utf-8")
    temporary.replace(output)
    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--feed-file", type=Path, help="Use a downloaded RSS file")
    args = parser.parse_args()
    if args.feed_file:
        xml = args.feed_file.read_bytes()
    else:
        request = urllib.request.Request(FEED, headers={"User-Agent": "DavidPortfolioRSS/1.0"})
        with urllib.request.urlopen(request, timeout=30) as response:
            xml = response.read(5_000_001)
        if len(xml) > 5_000_000:
            raise ValueError("Unexpectedly large feed")
    print("Updated writing index" if sync(xml) else "Writing index unchanged")

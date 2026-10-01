import json
from pathlib import Path
import tempfile
import unittest
from sync_writing import parse_feed, sync, merge_articles, plain

def feed(title="Example", url="https://davidfromkansas.substack.com/p/example", extra=""):
    return f'<rss><channel><item><title>{title}</title><link>{url}</link><pubDate>Tue, 16 Jun 2026 01:38:02 GMT</pubDate>{extra}</item></channel></rss>'

class ImportTests(unittest.TestCase):
    def test_mirror_matches_direct_feed(self):
        data = {"status": "ok", "feed": {"url": "https://davidfromkansas.substack.com/feed"}, "items": [{"title": "Example", "link": "https://davidfromkansas.substack.com/p/example", "pubDate": "2026-06-16 01:38:02"}]}
        self.assertEqual(parse_feed(json.dumps(data)), parse_feed(feed()))
    def test_mirror_rejects_wrong_source_and_errors(self):
        for data in ({"status": "error"}, {"status": "ok", "feed": {"url": "https://other.example/feed"}}, {"status": "ok", "feed": {"url": "https://davidfromkansas.substack.com/feed"}, "items": []}):
            with self.assertRaises(ValueError):
                parse_feed(json.dumps(data))
    def test_optional_metadata(self):
        article = parse_feed(feed())[0]
        self.assertEqual(article["author"], "David Lie-Tjauw")
        self.assertIsNone(article["readingMinutes"])
    def test_safe_plain_text(self):
        self.assertEqual(plain("<p>A &amp; B</p><script>bad()</script>"), "A & B")
    def test_dedup_update_retention(self):
        old = parse_feed(feed())[0]
        archived = dict(old, url="https://davidfromkansas.substack.com/p/archived")
        updated = dict(old, title="Updated")
        result = merge_articles([old, archived], [updated, updated])
        self.assertEqual(len(result), 2)
        self.assertIn(updated, result)
        self.assertIn(archived, result)
    def test_invalid_feeds_preserve_file(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "writing.json"
            sync(feed(), output)
            original = output.read_bytes()
            for invalid in ("broken", "<rss><channel/></rss>", feed(url="javascript:alert(1)"), feed(extra="<pubDate>bad</pubDate>").replace("Tue, 16 Jun 2026 01:38:02 GMT", "bad")):
                with self.assertRaises(Exception):
                    sync(invalid, output)
                self.assertEqual(output.read_bytes(), original)
    def test_repeated_sync_has_no_diff(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "writing.json"
            self.assertTrue(sync(feed(), output))
            self.assertFalse(sync(feed(), output))
            self.assertEqual(len(json.loads(output.read_text())["articles"]), 1)

if __name__ == "__main__":
    unittest.main()

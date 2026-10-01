# Writing archive

The Writing tab reads `data/writing.json`, generated from the public Substack RSS feed. No Substack credentials or browser proxy are needed. GitHub runners currently receive HTTP 403 from Substack, so the workflow falls back to the public RSS2JSON feed reader (https://rss2json.com/docs) if direct RSS download fails. This service needs no key for the default 10 latest posts; cached responses may add publishing delay. Older imported posts remain in the local index. If both sources fail, the existing index remains unchanged.

## Refresh

Run `python3 scripts/sync_writing.py`, or select **Actions > Refresh writing > Run workflow** on GitHub. The workflow runs at minute 17 every hour on main. GitHub schedules can be delayed, and public-repository schedules may be disabled after 60 days without repository activity; re-enable the workflow in Actions if needed.

GitHub Pages continues serving main at the repository root. The workflow needs contents:write and pages:write, commits changed metadata, and explicitly requests a Pages rebuild because bot commits do not trigger branch-based builds. Repository rules must permit the workflow to commit the index to main. Check failed runs in Actions if updates stop.

The importer preserves older entries no longer present in RSS. To remove an unpublished article, remove its entry from data/writing.json after removing it from Substack. Missing categories are not invented. Reading times estimate available feed text at 220 words per minute; excerpts may underestimate full articles.

## Validation

`python3 -m unittest discover -s scripts -p 'test_*.py'`

`node --check writing.js`

Preview through an HTTP server (`python3 -m http.server 8765`) and open `http://localhost:8765/#writing`. Verify search, navigation, original article links, narrow-screen layout, and the no-results state.

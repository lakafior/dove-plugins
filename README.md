# dove-plugins

Plugins for [Dove](https://github.com/lakafior/Dove) (iOS and macOS): book, audiobook and game metadata, and
public-domain libraries (Internet Archive, Wolne Lektury), run on the device in Dove's JavaScript sandbox. The contract is Dove's `docs/plugins.md` (API v1).

| Plugin | Id | Does | Reaches |
|---|---|---|---|
| Polskie książki | `pl.polskie-ksiazki` | metadata for Books and Audiobooks: lubimyczytac.pl, Audioteka (audiobooks), Storytel (the market's own editions) | lubimyczytac.pl, audioteka.com, www.storytel.com |
| Audible | `audible.metadata` | audiobook metadata from Audible's catalog API (store in settings) | api.audible.* |
| Wolnelektury | `wolnelektury.books` | for a book picked from Dove's metadata search: Wolne Lektury's free Polish books (epub; PDF, mobi, fb2, txt as fallback) and audiobooks (mp3, a recorded work's parts under one row, in reading order), no account. The site's OPDS catalog searches books, its official API gives the files and the recordings | wolnelektury.pl |
| Steam | `steam.metadata` | game titles, box covers (600×900), years, genres and descriptions for Games from the Steam store's JSON (storesearch, appdetails for the first six), no account; every game is PC; soundtracks and DLC are marked so they sink below the game | store.steampowered.com |
| GOG | `gog.metadata` | game titles, box covers, years and genres for Games from GOG's catalog JSON, no account; PC; packs (GOTY editions) count as the game | catalog.gog.com |
| LaunchBox Games DB | `launchbox.metadata` | game titles, box covers, platforms and years for Games from gamesdb.launchbox-app.com's search page (no public API), no account: strongest for retro consoles; ROM hacks are marked so the original comes first | gamesdb.launchbox-app.com |
| RAWG | `rawg.metadata` | game titles, years, platforms, genres and artwork (landscape screenshots, not box covers) for Games with your free RAWG key | api.rawg.io |
| SteamGridDB | `steamgriddb.metadata` | box covers (600×900 grids) for Games with your free SteamGridDB key; Dove uses them when IGDB has no cover | www.steamgriddb.com |
| TheGamesDB | `thegamesdb.metadata` | game titles, box covers, platforms, years and descriptions for Games with your TheGamesDB key (monthly allowance) | api.thegamesdb.net |
| ScreenScraper | `screenscraper.metadata` | retro game titles, box covers, consoles, years and descriptions for Games: needs ScreenScraper's developer credentials (asked for on its forum) and, for more searches a day, your account; covers whose addresses carry a login are left out | api.screenscraper.fr |
| Internet Archive | `archive.org` | public archive.org items in every category, no account: Books (EPUB first, else PDF…), Audiobooks (LibriVox: the m4b parts, else the MP3 chapters), Music (FLAC originals, else MP3, in track order), Movies & TV (the largest MKV/MP4 original), Games and Software (every original file but screenshots); most downloaded first; its item pages (`/details/…`), pasted or shared, are recognised. Items archive.org only lends or keeps dark are left out; items of more than 150 files (ROM sets, discographies) are refused with a note to pick a file on the site. Links are plain, so a cloud service can fetch them | archive.org |

## Use in Dove

Settings › Search and metadata › Plugins › Add repository:

```
https://lakafior.github.io/dove-plugins/index.json
```

Then install a plugin (Dove shows the hosts it may reach) and fill its settings.

## Build

```sh
npm ci
npm run build      # dist/plugins/*.js and dist/index.json with each script's SHA-256
```

Pushing to `main` publishes `dist/` to GitHub Pages (`.github/workflows/pages.yml`; Settings › Pages › Source:
GitHub Actions). Dove installs only scripts whose SHA-256 matches the index, so a changed plugin needs a new
version in its manifest.

## Writing a plugin

- `plugins/<name>/index.js` sets `globalThis.plugin = { manifest, metadata?, tracks?, search?, resolve? }` (see Dove's
  `docs/plugins.md`); shared code lives in `plugins/_shared/`.
- Network only through `await dove.fetch(url, { headers })` to the manifest's `hosts`.
- JavaScriptCore has no DOM, `URL`, `TextDecoder`, timers or `atob`: `plugins/_shared/polyfills.js` is injected
  into every bundle (`atob`, which cheerio needs); parse HTML with `cheerio/slim`.
- Bundles must stay under 2 MB; calls have 30 seconds.

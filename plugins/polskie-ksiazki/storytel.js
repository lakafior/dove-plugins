// storytel.com: books and audiobooks in its markets (search answers everything; no detail pages).
import { browserHeaders, validIsbn } from "../_shared/text.js"

/** One row per edition the asked format has. `locale`: Storytel market (`pl`). */
export async function search(query, format, locale) {
  const url = `https://www.storytel.com/api/search.action?q=${encodeURIComponent(query)}&request_locale=${encodeURIComponent(locale)}`
  const headers = {
    ...browserHeaders,
    Accept: "application/json",
    "Accept-Language": locale === "pl" ? "pl-PL,pl;q=0.9" : `${locale};q=0.9,en;q=0.5`,
    Referer: "https://www.storytel.com/",
    "X-Requested-With": "XMLHttpRequest",
  }
  const response = await dove.fetch(url, { headers })
  if (response.status !== 200) throw new Error(`Storytel answered ${response.status}`)
  let data
  try {
    data = response.json()
  } catch {}
  // Anything but `{ books: [...] }` (an HTML block page, for one) is a failure, not "no results".
  if (!data || !Array.isArray(data.books)) throw new Error("Storytel answered something other than search results")
  const books = data.books
  const rows = []
  for (const item of books) {
    const book = item.book
    const edition = format === "audiobook" ? item.abook : item.ebook
    if (!book || !edition) continue
    // This plugin is for the market's own editions: other languages are mostly podcast episodes about a book.
    const language = book.language && book.language.isoValue
    if (language && language !== locale) continue
    const covers = format === "audiobook" ? [book.largeCover, book.largeCoverE] : [book.largeCoverE, book.largeCover]
    const cover = covers.find((path) => path && !path.includes("nocover"))
    const series = book.series && book.series[0] && book.series[0].name
    rows.push({
      id: `${book.id}-${format}`,
      title: book.name,
      authors: (book.authors || []).map((author) => author.name).filter(Boolean),
      cover: cover ? `https://www.storytel.com${cover.replace("320x320", "640x640")}` : undefined,
      description: edition.description || undefined,
      // "20170715"
      year: Number(String(book.latestReleaseDate || "").slice(0, 4)) || undefined,
      narrators: edition.narratorAsString ? edition.narratorAsString.split(/,\s*/) : undefined,
      series: series || undefined,
      // Audiobooks carry Storytel's own numbers in the ISBN field; only real ISBNs count.
      isbn: validIsbn(edition.isbn),
      link: item.shareUrl || undefined,
      language: book.language && book.language.isoValue,
    })
  }
  return rows
}

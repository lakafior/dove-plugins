// lubimyczytac.pl: Polish books and audiobooks (search page + detail page for the best matches).
import { load } from "cheerio/slim"
import { browserHeaders, jsonLdNodes, plainText, validIsbn, year } from "../_shared/text.js"

const base = "https://lubimyczytac.pl"

/** Search rows: id, title, authors, cover, page. `format`: "ebook" or "audiobook". */
export async function search(query, format) {
  const path = format === "audiobook" ? "audiobooki" : "ksiazki"
  const response = await dove.fetch(`${base}/szukaj/${path}?phrase=${encodeURIComponent(query)}`, { headers: browserHeaders })
  if (response.status !== 200) throw new Error(`lubimyczytac answered ${response.status}`)
  const $ = load(response.body)
  const rows = []
  $(".book-card--l").each((_, element) => {
    const $card = $(element)
    // Promoted offers are ads, not results.
    if ($card.closest(".promoted-offers__list, .promoted-offers").length) return
    const $title = $card.find(".book-card__title").first()
    const href = $title.attr("href")
    const title = text($title.text())
    if (!href || !title) return
    const id = $card.attr("data-book-id") || (href.match(/\/(?:ksiazka|audiobook|ebook)\/(\d+)/) || [])[1] || href.split("/").filter(Boolean)[1]
    const $image = $card.find("img").first()
    rows.push({
      id,
      title,
      authors: $card.find(".book-card__author a").map((_, a) => text($(a).text())).get().filter(Boolean),
      cover: realCover($image.attr("data-src") || $image.attr("src")),
      link: href.startsWith("http") ? href : base + href,
    })
  })
  return rows
}

/** Adds description, year, ISBN, series, narrators and a bigger cover from the book's page. */
export async function details(row) {
  const response = await dove.fetch(row.link, { headers: browserHeaders })
  if (response.status !== 200) return row
  const $ = load(response.body)
  const book = jsonLdNodes($).find((node) => /Book/i.test([].concat(node["@type"] || []).join(" "))) || {}
  // The details list: <dt>Label:</dt><dd>value</dd>
  const dd = (label) => {
    const $dt = $("dt").filter((_, e) => text($(e).text()).startsWith(label)).first()
    return $dt.length ? $dt.next("dd") : $()
  }

  // An audiobook's og:image is the site's logo: the preview picture is the cover. The stand-in for a missing
  // cover is no cover.
  const coverFound =
    $("a#js-lightboxCover").attr("href") ||
    $(".book-cover__link").attr("href") ||
    (typeof book.image === "string" ? book.image : "") ||
    $('meta[property="og:image"]').attr("content") ||
    ""
  const cover = realCover(coverFound)

  const description = plainText($("#book-description").html() || $('meta[property="og:description"]').attr("content")).replace(
    /\.(\p{Lu})/gu,
    ". $1",
  )

  // A "/cykl/" is the author's cycle; a "/seria/" is only the publisher's imprint and is not a series.
  const cycle =
    text($('span.d-none.d-sm-block.mt-1:contains("Cykl:")').find("a").first().text()) ||
    text(dd("Cykl").find("a").first().text() || dd("Cykl").text())
  let series = cycle.replace(/\s*\(tom [^)]*\)\s*$/i, "").trim()
  if (!series) {
    const part = [].concat(book.isPartOfSeries || []).find((s) => s && typeof s.url === "string" && s.url.includes("/cykl/"))
    if (part && typeof part.name === "string") series = text(part.name)
  }

  const isbn =
    validIsbn($('meta[property="books:isbn"]').attr("content")) ||
    validIsbn(dd("ISBN").text()) ||
    validIsbn(typeof book.isbn === "string" ? book.isbn : "")
  const narrator = text(dd("Lektor").text()) || text(dd("Czyta").text())

  return {
    ...row,
    cover: cover || row.cover,
    description: description && description !== "Ta książka nie posiada jeszcze opisu." ? description : undefined,
    year: year(publishedDate($, dd, book)),
    isbn,
    series: series || undefined,
    narrators: narrator ? narrator.split(/\s*,\s*/).filter(Boolean) : undefined,
  }
}

/** The first Polish edition, then the first edition anywhere, then this edition, then the page's record. */
function publishedDate($, dd, book) {
  const titled = (title) => text($("dt").filter((_, e) => ($(e).attr("title") || "").trim() === title).first().next("dd").text())
  return (
    titled("Data pierwszego wydania polskiego") ||
    text(dd("Data 1. wyd. pol.").text()) ||
    text($('dt[title*="Data pierwszego wydania"]').first().next("dd").text()) ||
    text(dd("Data 1. wydania").text()) ||
    text(dd("Data wydania").text()) ||
    (typeof book.datePublished === "string" ? book.datePublished : "")
  )
}

/** No cover for the site's stand-ins (its logo, "default-book"); https for the rest. */
function realCover(url) {
  if (!url || /default-book|lc-logo/.test(url)) return undefined
  return url.replace(/^http:\/\//, "https://")
}

function text(value) {
  return String(value || "").replace(/\s+/g, " ").trim()
}

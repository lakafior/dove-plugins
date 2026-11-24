// audioteka.com: Polish audiobooks (search page; detail page for the best matches).
import { load } from "cheerio/slim"
import { browserHeaders, hasType, jsonLdNodes, plainText, validIsbn, year } from "../_shared/text.js"

const base = "https://audioteka.com"

/** Removes CDN resize parameters: the plain URL is the large cover. */
function cleanCover(url) {
  return url ? url.split("?")[0] : undefined
}

function text(value) {
  return String(value || "").replace(/\s+/g, " ").trim()
}

function unique(list) {
  return [...new Set(list.filter(Boolean))]
}

export async function search(query) {
  const response = await dove.fetch(`${base}/pl/szukaj/?phrase=${encodeURIComponent(query)}`, { headers: browserHeaders })
  if (response.status !== 200) throw new Error(`Audioteka answered ${response.status}`)
  const $ = load(response.body)
  const rows = []
  const seen = new Set()
  // CSS-module class names carry a build hash (teaser_title__hDeCG): match their stable prefix.
  $('[class*="teaser_teaser__"]').each((_, element) => {
    const $item = $(element)
    const title = text($item.find('[class*="teaser_title__"]').first().text())
    const href = $item.find('[class*="teaser_link__"]').first().attr("href") || $item.find('a[href*="/audiobook/"]').first().attr("href")
    // Products only: the results also list cycles (/pl/cykl/), which have no detail page to read.
    if (!title || !href || !/\/audiobook\//.test(href)) return
    const link = href.startsWith("http") ? href : base + href
    if (seen.has(link)) return
    seen.add(link)
    const $image = $item.find('[class*="teaser_coverImage__"], img').first()
    let cover = $image.attr("src") || $image.attr("data-src") || $image.attr("data-srcset") || $image.attr("srcset")
    if (cover && cover.includes(",")) cover = cover.split(",")[0].trim().split(" ")[0]
    // Lazily loaded teasers keep the image in <noscript>, which is plain text to the parser.
    if (!cover || !/^https?:/.test(cover)) {
      const lazy = ($item.find("noscript").first().text() || "").match(/src="([^"]+)"/)
      if (lazy) cover = lazy[1].replace(/&amp;/g, "&")
    }
    rows.push({
      // The address ends in the product's slug: /pl/audiobook/krew-elfow-tom-1/
      id: link.split("/").filter(Boolean).pop(),
      title,
      authors: text($item.find('[class*="teaser_author__"]').first().text()).split(/\s*,\s*/).filter(Boolean),
      cover: cover && /^https?:/.test(cover) ? cleanCover(cover) : undefined,
      link,
    })
  })
  return rows
}

export async function details(row) {
  const response = await dove.fetch(row.link, { headers: browserHeaders })
  if (response.status !== 200) return row
  const $ = load(response.body)
  // The page describes the product twice: as JSON-LD (schema.org Audiobook) and as a details list
  // (<dt>Głosy</dt><dd>…</dd>). The list first, JSON-LD fills what it lacks. The first JSON-LD node is
  // Audioteka itself (an Organization), so only a product node counts.
  const product = jsonLdNodes($).filter((node) => hasType(node, ["Audiobook", "Product", "Book"])).pop() || {}
  const names = (value) => unique([].concat(value || []).map((n) => text(typeof n === "string" ? n : n && n.name)))
  const dd = (labels) => $("dt").filter((_, e) => labels.includes(text($(e).text()))).first().next("dd")
  const ddList = (labels) => {
    const $cell = dd(labels)
    const links = unique($cell.find("a").map((_, a) => text($(a).text())).get())
    return links.length ? links : text($cell.text()) ? [text($cell.text())] : []
  }

  let narrators = ddList(["Głosy", "Czyta"])
  if (!narrators.length) narrators = names(product.readBy)

  let description = $('[class*="description_description__"], #audiobook-description, .product-description, .book-description')
    .first()
    .html()
  if (!description && typeof product.description === "string") description = product.description
  description = plainText(description || $('meta[property="og:description"]').attr("content"))

  const image = [].concat(product.image || []).map((i) => (typeof i === "string" ? i : i && i.url)).find(Boolean)
  return {
    ...row,
    cover: cleanCover(image) || cleanCover($('meta[property="og:image"]').attr("content")) || row.cover,
    description: description || undefined,
    narrators: narrators.length ? narrators : undefined,
    year: year(text(dd(["Data premiery", "Data wydania"]).text()) || product.datePublished),
    isbn: validIsbn(text(dd(["ISBN"]).text())) || validIsbn(product.isbn),
  }
}

// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: oil-can;

// Oil & Gas Price Widget for Scriptable (iOS)
// Shows WTI, Brent and natural gas prices on the lock screen or home screen.
// Data: Yahoo Finance public chart API (free, no API key). Futures quotes
// may be delayed ~10-15 minutes.

// ---- Settings -------------------------------------------------------------

// label: what the widget shows. symbol: the Yahoo Finance ticker.
// Swap a symbol to change what is tracked, e.g. { label: "LNG", symbol: "LNG" }
// for Cheniere Energy stock instead of Henry Hub natural gas futures.
const QUOTES = [
  { label: "WTI", symbol: "CL=F" },   // WTI crude oil futures, $/barrel
  { label: "BRENT", symbol: "BZ=F" }, // Brent crude oil futures, $/barrel
  { label: "LNG", symbol: "NG=F" },   // Henry Hub natural gas futures, $/MMBtu
];

// How often iOS should try to refresh the widget (iOS treats this as a hint).
const REFRESH_MINUTES = 15;

// ---- Data -----------------------------------------------------------------

const fm = FileManager.local();
const cachePath = fm.joinPath(fm.documentsDirectory(), "oil-widget-cache.json");

async function fetchQuote(symbol) {
  const url =
    "https://query1.finance.yahoo.com/v8/finance/chart/" +
    encodeURIComponent(symbol) +
    "?range=1d&interval=1d";
  const req = new Request(url);
  req.headers = { "User-Agent": "Mozilla/5.0" };
  req.timeoutInterval = 10;
  const json = await req.loadJSON();
  const meta = json.chart.result[0].meta;
  const price = meta.regularMarketPrice;
  if (!Number.isFinite(price)) throw new Error("Invalid price for " + symbol);
  const prev = meta.chartPreviousClose ?? meta.previousClose;
  const change = prev ? ((price - prev) / prev) * 100 : 0;
  if (!Number.isFinite(change)) throw new Error("Invalid change for " + symbol);
  return { price, change };
}

function validCache(data) {
  return data != null &&
    Number.isFinite(data.updated) &&
    Number.isFinite(new Date(data.updated).getTime()) &&
    Array.isArray(data.quotes) && data.quotes.length === QUOTES.length &&
    data.quotes.every((q, i) => q != null &&
      q.label === QUOTES[i].label &&
      Number.isFinite(q.price) && Number.isFinite(q.change));
}

async function loadQuotes() {
  try {
    const results = await Promise.all(QUOTES.map((q) => fetchQuote(q.symbol)));
    const data = {
      updated: Date.now(),
      quotes: QUOTES.map((q, i) => ({ label: q.label, ...results[i] })),
    };
    // A storage failure should not discard successfully fetched prices.
    try {
      fm.writeString(cachePath, JSON.stringify(data));
    } catch (e) {}
    return { ...data, stale: false };
  } catch (e) {
    // Offline or the API hiccuped: fall back to the last good prices.
    try {
      if (fm.fileExists(cachePath)) {
        const cached = JSON.parse(fm.readString(cachePath));
        if (validCache(cached)) return { ...cached, stale: true };
      }
    } catch (cacheError) {
      // An unreadable or damaged cache is equivalent to having no cache.
    }
    return null;
  }
}

// ---- Formatting -----------------------------------------------------------

function fmtPrice(p) {
  return p.toFixed(2);
}

function fmtChange(c) {
  return (c >= 0 ? "+" : "") + c.toFixed(1) + "%";
}

function arrow(c) {
  return c >= 0 ? "▲" : "▼";
}

function fmtTime(ms) {
  const df = new DateFormatter();
  df.useShortTimeStyle();
  return df.string(new Date(ms));
}

// ---- Widget layouts -------------------------------------------------------

// Lock screen, rectangular slot: three rows like the Stocks widget.
function buildRectangular(w, data) {
  // 17pt matches the Stocks lock screen widget; shrink a little when the
  // offline line needs room.
  const size = data.stale ? 14 : 17;
  for (const q of data.quotes) {
    const row = w.addStack();
    row.centerAlignContent();
    const label = row.addText(q.label);
    label.font = Font.semiboldSystemFont(size);
    row.addSpacer();
    const value = row.addText(fmtPrice(q.price) + " " + arrow(q.change));
    value.font = Font.mediumSystemFont(size);
  }
  if (data.stale) {
    const s = w.addText("offline · " + fmtTime(data.updated));
    s.font = Font.systemFont(9);
  }
}

// Lock screen, line above the clock.
function buildInline(w, data) {
  const parts = data.quotes.map((q) => q.label + " " + fmtPrice(q.price));
  // Put the status first so truncation cannot hide that prices are cached.
  w.addText((data.stale ? "offline · " : "") + parts.join("  "));
}

// Lock screen, small circle: shows just the first quote.
function buildCircular(w, data) {
  const q = data.quotes[0];
  w.addAccessoryWidgetBackground = true;
  const l = w.addText(q.label);
  l.font = Font.semiboldSystemFont(10);
  l.centerAlignText();
  const p = w.addText(Math.round(q.price).toString());
  p.font = Font.boldSystemFont(16);
  p.centerAlignText();
  p.minimumScaleFactor = 0.5;
  if (data.stale) {
    const status = w.addText("offline");
    status.font = Font.systemFont(9);
    status.centerAlignText();
  }
}

// Home screen (small / medium / large).
function buildHome(w, data) {
  w.backgroundColor = new Color("#1c1c1e");
  w.setPadding(12, 14, 12, 14);

  const title = w.addText("Energy");
  title.font = Font.boldSystemFont(14);
  title.textColor = Color.white();
  w.addSpacer(6);

  for (const q of data.quotes) {
    const row = w.addStack();
    row.centerAlignContent();
    const label = row.addText(q.label);
    label.font = Font.semiboldSystemFont(14);
    label.textColor = Color.white();
    row.addSpacer();
    const col = row.addStack();
    col.layoutVertically();
    const price = col.addText(fmtPrice(q.price));
    price.font = Font.semiboldMonospacedSystemFont(14);
    price.textColor = Color.white();
    price.rightAlignText();
    const chg = col.addText(fmtChange(q.change));
    chg.font = Font.regularMonospacedSystemFont(10);
    chg.textColor = q.change >= 0 ? new Color("#30d158") : new Color("#ff453a");
    w.addSpacer(4);
  }

  w.addSpacer();
  const footer = w.addText((data.stale ? "offline · " : "") + fmtTime(data.updated));
  footer.font = Font.systemFont(9);
  footer.textColor = Color.gray();
}

// ---- Main -----------------------------------------------------------------

const data = await loadQuotes();
const widget = new ListWidget();
widget.refreshAfterDate = new Date(Date.now() + REFRESH_MINUTES * 60 * 1000);
const family = config.widgetFamily ?? "accessoryRectangular";

if (!data) {
  widget.addText("No data");
} else if (family === "accessoryRectangular") {
  buildRectangular(widget, data);
} else if (family === "accessoryInline") {
  buildInline(widget, data);
} else if (family === "accessoryCircular") {
  buildCircular(widget, data);
} else {
  buildHome(widget, data);
}

if (config.runsInWidget || config.runsInAccessoryWidget) {
  Script.setWidget(widget);
} else {
  // Running inside the app: show a preview.
  if (family.startsWith("accessory")) {
    await widget.presentAccessoryRectangular();
  } else {
    await widget.presentSmall();
  }
}
Script.complete();

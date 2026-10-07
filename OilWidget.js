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
  const prev = meta.chartPreviousClose ?? meta.previousClose;
  const change = prev ? ((price - prev) / prev) * 100 : 0;
  return { price, change };
}

async function loadQuotes() {
  try {
    const results = await Promise.all(QUOTES.map((q) => fetchQuote(q.symbol)));
    const data = {
      updated: Date.now(),
      quotes: QUOTES.map((q, i) => ({ label: q.label, ...results[i] })),
    };
    fm.writeString(cachePath, JSON.stringify(data));
    return { ...data, stale: false };
  } catch (e) {
    // Offline or the API hiccuped: fall back to the last good prices.
    if (fm.fileExists(cachePath)) {
      return { ...JSON.parse(fm.readString(cachePath)), stale: true };
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
  for (const q of data.quotes) {
    const row = w.addStack();
    row.centerAlignContent();
    const label = row.addText(q.label);
    label.font = Font.semiboldSystemFont(13);
    row.addSpacer();
    const value = row.addText(fmtPrice(q.price) + " " + arrow(q.change));
    value.font = Font.monospacedDigitSystemFont(13, "regular");
  }
  if (data.stale) {
    const s = w.addText("offline · " + fmtTime(data.updated));
    s.font = Font.systemFont(9);
  }
}

// Lock screen, line above the clock.
function buildInline(w, data) {
  const parts = data.quotes.map((q) => q.label + " " + fmtPrice(q.price));
  w.addText(parts.join("  "));
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
    price.font = Font.monospacedDigitSystemFont(14, "semibold");
    price.textColor = Color.white();
    price.rightAlignText();
    const chg = col.addText(fmtChange(q.change));
    chg.font = Font.monospacedDigitSystemFont(10, "regular");
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

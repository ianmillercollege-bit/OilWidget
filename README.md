# Oil Widget

An iPhone lock screen widget that shows **WTI**, **Brent** and **natural gas** prices, the way the Stocks widget shows your stocks. It's free: it runs in the free [Scriptable](https://apps.apple.com/app/scriptable/id1405459188) app and gets prices from Yahoo Finance's public data, so you don't need an account or API key.

```
WTI      61.42 ▲
BRENT    65.10 ▼
LNG       3.21 ▲
```

## Setup (about 2 minutes)

1. Install **Scriptable** from the App Store. It's free.
2. Open Scriptable, tap **+**, and paste in everything from [`OilWidget.js`](OilWidget.js).
3. Tap the title at the top and rename the script **Oil Widget**.
4. Tap ▶︎ to test it. A preview with the prices should appear.
5. Lock your phone, then long-press the lock screen → **Customize** → **Lock Screen** → tap the widget area.
6. Add **Scriptable**, picking the wide rectangular size (it fits three rows).
7. Tap the new widget, set **Script** to **Oil Widget**, then tap outside and **Done**.

The script also supports:
- **Inline** (the line above the clock): `WTI 61.42  BRENT 65.10  LNG 3.21`
- **Circular**: shows only the first quote
- **Home screen** small or medium widgets: prices plus green or red % change

## What the numbers are

| Label | Yahoo ticker | What it is | Unit |
|-------|--------------|------------|------|
| WTI   | `CL=F` | Front-month WTI crude futures (NYMEX) | $/barrel |
| BRENT | `BZ=F` | Front-month Brent crude futures | $/barrel |
| LNG   | `NG=F` | Front-month Henry Hub natural gas futures | $/MMBtu |

The "LNG" row shows US natural gas (Henry Hub), the standard US gas benchmark. Asian LNG prices (JKM) aren't available for free. If you'd rather track Cheniere Energy, the largest US LNG exporter, change that line in the script to:

```js
{ label: "LNG", symbol: "LNG" },
```

Any Yahoo Finance ticker works the same way. For example, `HO=F` is heating oil and `RB=F` is gasoline.

## Notes

- Futures quotes may be about 10–15 minutes behind.
- iOS decides when widgets refresh, usually every 15–30 minutes or so. The script asks for every 15.
- If there's no internet, the widget shows the last prices it got, plus "offline" and the time.

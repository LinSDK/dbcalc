# dB Calculator

A static, mobile-first page that estimates how loud a headphone gets on a measured DAC at every volume step.
It has no build step and no dependencies: plain HTML, CSS and JavaScript.

```
calculator/
├── index.html, styles.css, app.js
├── data/dacs.js          generated from ../tray-app/plugins (don't edit)
├── data/headphones.js    the headphone list (edit freely)
├── assets/, favicon.ico  logo and icons
└── scripts/sync-dacs.ps1 regenerates data/dacs.js
```

## Run locally

Opening `index.html` directly works (the data is plain script files, not fetched JSON). Or serve the folder:

```bash
python -m http.server 8765 --directory calculator
```

## Deploy

Upload the `calculator` folder as-is to any static host. Nothing needs building.

- **Netlify:** drag the folder onto app.netlify.com/drop.
- **Cloudflare Pages / Vercel:** new project → this folder as the root, no build command, output directory `.`.
- **GitHub Pages:** publish the folder (e.g. a `gh-pages` branch containing its contents).

The `scripts/` folder and this README can be left out of the upload.

## Update the data

**DACs** come from the tray app's plugins, so a new DAC measured for the tray app shows up here after:

```bash
pwsh calculator/scripts/sync-dacs.ps1
```

**Headphones:** add an entry to `data/headphones.js`:

```js
{ id: "maker-model", name: "Maker Model", type: "IEM",        // or "Over-ear"
  sensitivity: 110, unit: "dB/mW", impedance: 32,             // unit: "dB/mW" or "dB/V"
  note: "Optional caveat, shown behind a ⚠ button",
  sources: ["https://…"] }
```

Specs for the current list were looked up on 2026-10-24. The sources are in the file. Two need care:
- **SIVGA Lyrebird:** the sensitivity unit isn't stated, so dB/mW is assumed (the louder case).
- **HiFiMAN HE400se:** retailers say 25 Ω, HiFiMAN says 32 Ω (used).

## The numbers

| Shown | Meaning |
|---|---|
| **dB** (big range) | Typical music: 20 to 8 dB below the loudest possible |
| **Peak** | A full-scale (0 dBFS) sine: the loudest the DAC can go at that step |
| **Per day** | NIOSH: 8 h at 85 dB, halving per 3 dB above, using the loud end of the range |
| **Weighting** | A / C / Z. A fixed offset from the IEC 61672 curve on pink noise (20 Hz–20 kHz): A −2.9 dB, C −1.1 dB. Applies to the music range and everything derived from it; Peak (a 1 kHz sine) is the same in every weighting |
| **Safe / Danger** | Danger once the loud end of the music range reaches 100 dB, safe below that |
| **Safe to** | The highest step that's still safe |

```
sensitivity (dB/V) = dB/mW + 10·log10(1000 / Ω)
peak (dB SPL)      = sensitivity (dB/V) + 20·log10(volts at that step)
```

Volts per step are the median across the measured test tones, just as in the tray app. Source volume (Windows,
phone) is assumed at 100%. Everything is an estimate: fit, seal and spec tolerances move real levels by a few dB.

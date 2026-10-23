// Headphone database for the calculator. Edit freely: add an object per model.
//   sensitivity + unit: as the manufacturer states it, "dB/V" (dB SPL at 1 Vrms) or "dB/mW" (dB SPL at 1 mW)
//   impedance: ohms (needed to convert dB/mW)
//   type: "IEM" or "Over-ear" (only used for grouping in the picker)
//   note: shown under the result; use it for anything uncertain
//   sources: where the numbers came from
// Specs looked up 2026-10-24.
window.DBM_HEADPHONES = [
  {
    id: "moondrop-lan", name: "Moondrop Lan", type: "IEM",
    sensitivity: 120, unit: "dB/V", impedance: 32,
    sources: ["https://audio46.com/products/moondrop-lan-earphones", "https://www.audiophonics.fr/en/in-ear-earphones/moondrop-lan-in-ear-monitors-iem-dynamic-10mm-120db-32-ohm-15hz-37khz-p-17418.html"]
  },
  {
    id: "moondrop-chu-2", name: "Moondrop Chu 2", type: "IEM",
    sensitivity: 119, unit: "dB/V", impedance: 18,
    sources: ["https://hangout.audio/products/moondrop-chu-2", "https://www.ifixit.com/Device/Moondrop_Chu_II"]
  },
  {
    id: "moondrop-chu-3", name: "Moondrop Chu 3", type: "IEM",
    sensitivity: 118, unit: "dB/V", impedance: 16,
    sources: ["https://hifigo.com/products/moondrop-chu-3", "https://www.audiophonics.fr/en/in-ear-earphones/moondrop-chu-iii-black-p-22427.html"]
  },
  {
    id: "moondrop-aria-snow", name: "Moondrop Aria Snow Edition", type: "IEM",
    sensitivity: 119, unit: "dB/V", impedance: 32,
    sources: ["https://audio46.com/products/moondrop-aria-snow-edition-iems", "https://www.headphonesty.com/2022/06/review-moondrop-aria-snow-edition/"]
  },
  {
    id: "gk-kunten", name: "GK Kunten", type: "IEM",
    sensitivity: 109, unit: "dB/mW", impedance: 43,
    sources: ["https://conceptkart.com/products/gk-kunten-pro-2nd-generation-kun-dynamic-driver-in-ear-monitor", "https://www.gadgetbytenepal.com/best-iem-under-5000-in-nepal/"]
  },
  {
    id: "sivga-lyrebird", name: "SIVGA Lyrebird", type: "IEM",
    sensitivity: 108, unit: "dB/mW", impedance: 14,
    note: "Unit not stated by SIVGA. Assumed dB/mW (the louder case). If it's dB/V, subtract 18 dB.",
    sources: ["https://www.stereonet.com/news/sivga-lyrebird-sings-with-quad-driver-hybrid-design-and-premium-wood-finish", "https://moonstarreviews.net/sivga-lyrebird-review/"]
  },
  {
    id: "hifiman-sundara", name: "HiFiMAN Sundara (open-back)", type: "Over-ear",
    sensitivity: 94, unit: "dB/mW", impedance: 37,
    sources: ["https://headphones.com/products/hifiman-sundara", "https://www.scan.co.uk/products/hifiman-sundara-over-ear-open-back-planar-headphones"]
  },
  {
    id: "hifiman-sundara-closed", name: "HiFiMAN Sundara Closed-Back", type: "Over-ear",
    sensitivity: 98, unit: "dB/mW", impedance: 20,
    sources: ["https://hifiman.com/products/detail/324", "https://www.headphonecheck.com/test/hifiman-sundara-closed-back/"]
  },
  {
    id: "hifiman-he400se", name: "HiFiMAN HE400se", type: "Over-ear",
    sensitivity: 91, unit: "dB/mW", impedance: 32,
    note: "Retailers list 25 Ω; HiFiMAN says 32 Ω (used). About 1 dB difference.",
    sources: ["https://hifiman.com/products/detail/310", "https://www.scan.co.uk/products/hifiman-he400se-over-ear-open-back-planar-magnetic-headphones"]
  }
];

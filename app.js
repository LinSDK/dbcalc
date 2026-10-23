// dB Calculator: estimates headphone SPL at every volume step of a measured DAC.
// Data comes from data/dacs.js (generated from the tray app's plugins) and data/headphones.js.
(function () {
  "use strict";

  // Music sits this far below a full-scale sine (dB): loud modern masters near the top, quiet/dynamic near the bottom.
  const MUSIC_LOUD = -8;
  const MUSIC_QUIET = -20;
  const WARN = 85;     // NIOSH 8-hour level (only for the per-day time)
  const DANGER = 100;  // at or above this (as displayed) is danger; below is safe
  const CUSTOM = "__custom";

  const DACS = window.DBM_DACS || [];
  const HEADPHONES = window.DBM_HEADPHONES || [];
  const $ = (id) => document.getElementById(id);

  // ------------------------------------------------------------------ storage (optional convenience)
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem("dbcalc." + key); return v === null ? fallback : JSON.parse(v); }
      catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem("dbcalc." + key, JSON.stringify(value)); } catch { /* private mode etc. */ }
    },
  };

  // ------------------------------------------------------------------ data

  /** Groups a DAC's rows into interface → mode → step → median volts, keeping first-seen order. */
  function buildTable(dac) {
    const ifaces = new Map();
    for (const [iface, mode, step, volts] of dac.rows) {
      if (!ifaces.has(iface)) ifaces.set(iface, new Map());
      const modes = ifaces.get(iface);
      if (!modes.has(mode)) modes.set(mode, new Map());
      const steps = modes.get(mode);
      if (!steps.has(step)) steps.set(step, []);
      steps.get(step).push(volts);
    }
    for (const modes of ifaces.values())
      for (const [mode, steps] of modes)
        modes.set(mode, new Map([...steps.entries()].sort((a, b) => a[0] - b[0]).map(([s, v]) => [s, median(v)])));
    return ifaces;
  }

  function median(values) {
    const s = [...values].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  /** Sensitivity in dB SPL at 1 Vrms. */
  function dbPerVolt(hp) {
    return hp.unit === "dB/V" ? hp.sensitivity : hp.sensitivity + 10 * Math.log10(1000 / hp.impedance);
  }

  // ------------------------------------------------------------------ weighting
  // The page never sees the music, so weighting is applied as a fixed offset: the level difference the IEC 61672
  // curve makes on pink noise (20 Hz–20 kHz, equal power per octave), the usual stand-in for programme material.
  // A ≈ −2.9 dB, C ≈ −1.1 dB. The tray app weights the real signal instead.
  const IEC = { f1: 20.598997, f2: 107.65265, f3: 737.86223, f4: 12194.217 };
  const CURVES = {
    A: (f) => { const q = f * f; return (IEC.f4 ** 2 * q * q) / ((q + IEC.f1 ** 2) * Math.sqrt((q + IEC.f2 ** 2) * (q + IEC.f3 ** 2)) * (q + IEC.f4 ** 2)); },
    C: (f) => { const q = f * f; return (IEC.f4 ** 2 * q) / ((q + IEC.f1 ** 2) * (q + IEC.f4 ** 2)); },
  };

  function pinkNoiseOffset(curve) {
    const n = 2000, lo = Math.log(20), hi = Math.log(20000), ref = curve(1000);
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const g = curve(Math.exp(lo + ((i + 0.5) * (hi - lo)) / n)) / ref;
      sum += g * g;
    }
    return 10 * Math.log10(sum / n);
  }

  const WEIGHTING = { A: pinkNoiseOffset(CURVES.A), C: pinkNoiseOffset(CURVES.C), Z: 0 };

  /**
   * SPL figures for one step, or null when the voltage is below the measurement floor. Peak is the 0 dBFS 1 kHz
   * sine (0 dB in every weighting); the music range carries the weighting offset.
   */
  function levels(sV, volts) {
    if (!(volts > 0)) return null;
    const peak = sV + 20 * Math.log10(volts);
    const w = WEIGHTING[state.weighting] ?? 0;
    return { peak, loud: peak + MUSIC_LOUD + w, quiet: peak + MUSIC_QUIET + w };
  }

  function zone(db) {
    return Math.round(db) >= DANGER ? { cls: "danger", text: "Danger" } : { cls: "ok", text: "Safe" };
  }

  function zoneClass(db) { return zone(db).cls; }

  /** NIOSH: 8 h at 85 dB, halved per 3 dB above. */
  function dailyLimit(db) {
    if (db <= WARN) return "∞";
    const minutes = 480 / Math.pow(2, (db - WARN) / 3);
    if (minutes >= 60) {
      const h = Math.floor(minutes / 60), m = Math.round(minutes % 60);
      return m ? `${h}h ${m}m` : `${h}h`;
    }
    if (minutes >= 1) return `${Math.round(minutes)}m`;
    return `${Math.max(1, Math.round(minutes * 60))}s`;
  }

  const fmt = (x) => Math.round(x).toString();
  const fmtVolts = (v) => v <= 0 ? "< 0.1 mV" : v < 1 ? `${+(v * 1000).toFixed(v < 0.01 ? 1 : 0)} mV` : `${v.toFixed(2)} V`;

  // ------------------------------------------------------------------ state

  const state = {
    dacId: store.get("dac", DACS[0] && DACS[0].id),
    iface: store.get("iface", null),
    mode: store.get("mode", null),
    hpId: store.get("hp", HEADPHONES[0] ? HEADPHONES[0].id : CUSTOM),
    custom: store.get("custom", { sensitivity: 110, unit: "dB/mW", impedance: 32 }),
    step: store.get("step", null),
    weighting: store.get("weighting", "A"),
  };
  if (!(state.weighting in WEIGHTING)) state.weighting = "A";
  let table = null;

  function currentDac() { return DACS.find((d) => d.id === state.dacId) || DACS[0]; }

  function currentHeadphone() {
    if (state.hpId === CUSTOM) return { name: "Custom", ...state.custom, custom: true };
    return HEADPHONES.find((h) => h.id === state.hpId) || HEADPHONES[0];
  }

  function currentSteps() {
    const modes = table && table.get(state.iface);
    return (modes && modes.get(state.mode)) || new Map();
  }

  // ------------------------------------------------------------------ rendering

  function fillDacs() {
    const sel = $("dac");
    sel.replaceChildren(...DACS.map((d) => new Option(d.name, d.id)));
    sel.value = currentDac().id;
  }

  function fillHeadphones() {
    const sel = $("headphone");
    const groups = new Map();
    for (const h of HEADPHONES) {
      const type = h.type || "Headphones";
      if (!groups.has(type)) groups.set(type, []);
      groups.get(type).push(h);
    }
    const nodes = [];
    for (const [type, list] of groups) {
      const g = document.createElement("optgroup");
      g.label = type === "IEM" ? "In-ear" : type;
      g.append(...list.map((h) => new Option(h.name, h.id)));
      nodes.push(g);
    }
    nodes.push(new Option("Custom…", CUSTOM));
    sel.replaceChildren(...nodes);
    if (!HEADPHONES.some((h) => h.id === state.hpId)) state.hpId = HEADPHONES[0] ? HEADPHONES[0].id : CUSTOM;
    sel.value = state.hpId;
  }

  function segments(container, name, values, selected, onPick) {
    container.replaceChildren(...values.map((value) => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = name;
      input.value = value;
      input.checked = value === selected;
      input.addEventListener("change", () => onPick(value));
      const span = document.createElement("span");
      // "3.5mm (Moondrop Lan Cable)" → "3.5mm", "Low-gain" → "Low": the fieldset legend already says what it is.
      span.textContent = value.split(" (")[0].replace(/[-\s]?gain$/i, "") || value;
      label.title = value;
      label.append(input, span);
      return label;
    }));
  }

  function loadDac() {
    const dac = currentDac();
    table = buildTable(dac);
    const ifaces = [...table.keys()];
    if (!ifaces.includes(state.iface)) state.iface = ifaces[0];
    segments($("iface"), "iface", ifaces, state.iface, (v) => { state.iface = v; save(); loadModes(); });
    loadModes();
  }

  function loadModes() {
    const modes = [...table.get(state.iface).keys()];
    if (!modes.includes(state.mode)) state.mode = modes[0];
    segments($("mode"), "mode", modes, state.mode, (v) => { state.mode = v; save(); loadSteps(); });
    loadSteps();
  }

  function loadSteps() {
    const steps = [...currentSteps().keys()];
    const slider = $("volume");
    slider.min = steps[0];
    slider.max = steps[steps.length - 1];
    if (state.step === null || state.step < steps[0] || state.step > steps[steps.length - 1])
      state.step = steps[Math.floor(steps.length / 2)];
    slider.value = state.step;
    render();
  }

  function render() {
    const hp = currentHeadphone();
    const sV = dbPerVolt(hp);
    const steps = currentSteps();
    const volts = steps.get(state.step);
    const l = levels(sV, volts);

    // Headphone spec chips; a caveat becomes a ⚠ chip whose tooltip carries the detail.
    $("custom").hidden = !hp.custom;
    const chips = [`${hp.sensitivity} ${hp.unit}`, `${hp.impedance} Ω`].map((t) =>
      Object.assign(document.createElement("span"), { textContent: t }));
    $("hp-note").hidden = true;
    $("hp-note").textContent = hp.note || "";
    if (hp.note) {
      const btn = Object.assign(document.createElement("button"), { type: "button", textContent: "⚠", className: "warn" });
      btn.setAttribute("aria-label", "Spec caveat");
      btn.setAttribute("aria-expanded", "false");
      btn.addEventListener("click", () => {
        const open = $("hp-note").hidden;
        $("hp-note").hidden = !open;
        btn.setAttribute("aria-expanded", String(open));
      });
      chips.push(btn);
    }
    $("hp-chips").replaceChildren(...chips);

    // Headline
    $("vol-value").textContent = state.step;
    $("unit").textContent = state.weighting === "Z" ? "dB" : `dB(${state.weighting})`;
    if (l) {
      const zz = zone(l.loud);
      $("range").textContent = `${fmt(l.quiet)}–${fmt(l.loud)}`;
      $("peak").textContent = `${fmt(l.peak)} dB`;
      $("limit").textContent = dailyLimit(l.loud);
      $("meter").className = "meter " + zz.cls;
      $("zone").textContent = zz.text;
    } else {
      $("range").textContent = "0";
      $("peak").textContent = "–";
      $("limit").textContent = "∞";
      $("meter").className = "meter none";
      $("zone").textContent = "Silent";
    }

    // Highest step whose loud end stays at or under 85 dB
    let safe = null;
    for (const [s, v] of steps) {
      const x = levels(sV, v);
      if (!x || zone(x.loud).cls === "ok") safe = s;
    }
    $("safe-step").textContent = safe === null ? "–" : `≤ ${safe}`;

    renderChart(steps, sV);
    renderTable(steps, sV);
  }

  function renderChart(steps, sV) {
    const W = 320, H = 190, L = 30, R = 8, T = 8, B = 24;
    const entries = [...steps.entries()];
    const xs = entries.map(([s]) => s);
    const minS = xs[0], maxS = xs[xs.length - 1];
    const pts = entries.map(([s, v]) => [s, levels(sV, v)]).filter(([, x]) => x);
    const lo = 40, hi = Math.max(110, Math.ceil(Math.max(...pts.map(([, x]) => x.peak), 0) / 10) * 10);
    const X = (s) => L + ((s - minS) / Math.max(1, maxS - minS)) * (W - L - R);
    const Y = (db) => T + (1 - (Math.min(Math.max(db, lo), hi) - lo) / (hi - lo)) * (H - T - B);

    const band = pts.length
      ? pts.map(([s, x]) => `${X(s).toFixed(1)},${Y(x.loud).toFixed(1)}`).join(" ") + " " +
        pts.slice().reverse().map(([s, x]) => `${X(s).toFixed(1)},${Y(x.quiet).toFixed(1)}`).join(" ")
      : "";
    const peak = pts.map(([s, x]) => `${X(s).toFixed(1)},${Y(x.peak).toFixed(1)}`).join(" ");

    let grid = "";
    for (let db = lo; db <= hi; db += 20)
      grid += `<line x1="${L}" x2="${W - R}" y1="${Y(db)}" y2="${Y(db)}" stroke="var(--line)" />` +
              `<text x="${L - 6}" y="${Y(db) + 4}" text-anchor="end">${db}</text>`;
    const tickEvery = maxS - minS > 30 ? 10 : 5;
    for (let s = Math.ceil(minS / tickEvery) * tickEvery; s <= maxS; s += tickEvery)
      grid += `<text x="${X(s)}" y="${H - 6}" text-anchor="middle">${s}</text>`;

    const cur = levels(sV, steps.get(state.step));
    $("chart").innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        ${grid}
        <polygon points="${band}" fill="var(--band)" />
        <polyline points="${peak}" fill="none" stroke="var(--text)" stroke-width="1.5" stroke-dasharray="4 3" />
        <line x1="${L}" x2="${W - R}" y1="${Y(DANGER)}" y2="${Y(DANGER)}" stroke="var(--danger)" stroke-width="1.5" />
        <text class="tag" x="${L + 4}" y="${Y(DANGER) - 4}" style="fill:var(--danger)">${DANGER}</text>
        <line x1="${X(state.step)}" x2="${X(state.step)}" y1="${T}" y2="${H - B}" stroke="var(--text)" stroke-width="1" opacity="0.5" />
        ${cur ? `<circle cx="${X(state.step)}" cy="${Y(cur.loud)}" r="4.5" fill="var(--text)" />` : ""}
      </svg>`;
    const svg = $("chart").querySelector("svg");
    const pick = (e) => {
      const r = svg.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * W;
      setStep(Math.round(minS + ((x - L) / (W - L - R)) * (maxS - minS)));
    };
    svg.addEventListener("pointerdown", (e) => { pick(e); svg.setPointerCapture(e.pointerId); });
    svg.addEventListener("pointermove", (e) => { if (e.buttons) pick(e); });
    $("chart").setAttribute("aria-label",
      `Chart of estimated music level against volume step ${minS} to ${maxS}, with 85 and 99 dB lines.`);
  }

  function renderTable(steps, sV) {
    const rows = [...steps.entries()].reverse().map(([s, v]) => {
      const x = levels(sV, v);
      const tr = document.createElement("tr");
      if (s === state.step) tr.className = "current";
      const cells = [
        [String(s), ""],
        [fmtVolts(v), ""],
        [x ? `${fmt(x.quiet)}–${fmt(x.loud)}` : "–", x ? zoneClass(x.loud) : ""],
        [x ? fmt(x.peak) : "–", x ? zoneClass(x.peak) : ""],
      ];
      for (const [text, cls] of cells) {
        const td = document.createElement("td");
        td.textContent = text;
        if (cls) td.className = cls;
        tr.append(td);
      }
      tr.addEventListener("click", () => setStep(s));
      return tr;
    });
    $("table").replaceChildren(...rows);
  }

  // ------------------------------------------------------------------ events

  function save() {
    store.set("dac", state.dacId);
    store.set("iface", state.iface);
    store.set("mode", state.mode);
    store.set("hp", state.hpId);
    store.set("custom", state.custom);
    store.set("step", state.step);
    store.set("weighting", state.weighting);
  }

  function setStep(step) {
    const steps = [...currentSteps().keys()];
    state.step = Math.min(steps[steps.length - 1], Math.max(steps[0], step));
    $("volume").value = state.step;
    save();
    render();
  }

  function readCustom() {
    const sens = parseFloat($("custom-sens").value);
    const imp = parseFloat($("custom-imp").value);
    if (sens > 0 && imp > 0) {
      state.custom = { sensitivity: sens, unit: $("custom-unit").value, impedance: imp };
      save();
      render();
    }
  }

  function init() {
    if (!DACS.length) {
      document.querySelector("main").innerHTML =
        '<section class="card"><h2>No DAC data</h2><p>Run <code>scripts/sync-dacs.ps1</code> to generate data/dacs.js.</p></section>';
      return;
    }
    fillDacs();
    fillHeadphones();
    segments($("weighting"), "weighting", Object.keys(WEIGHTING), state.weighting, (v) => { state.weighting = v; save(); render(); });
    $("custom-sens").value = state.custom.sensitivity;
    $("custom-unit").value = state.custom.unit;
    $("custom-imp").value = state.custom.impedance;

    $("dac").addEventListener("change", (e) => { state.dacId = e.target.value; state.step = null; save(); loadDac(); });
    $("headphone").addEventListener("change", (e) => { state.hpId = e.target.value; save(); render(); });
    for (const id of ["custom-sens", "custom-unit", "custom-imp"]) $(id).addEventListener("input", readCustom);
    $("volume").addEventListener("input", (e) => setStep(parseInt(e.target.value, 10)));
    $("vol-down").addEventListener("click", () => setStep(state.step - 1));
    $("vol-up").addEventListener("click", () => setStep(state.step + 1));
    $("info-btn").addEventListener("click", () => $("info").showModal());
    $("info").addEventListener("click", (e) => { if (e.target === $("info")) $("info").close(); });   // tap outside closes

    loadDac();
  }

  // Exposed for tests.
  window.DbCalc = { buildTable, median, dbPerVolt, levels, dailyLimit, zone, WEIGHTING };

  init();
})();

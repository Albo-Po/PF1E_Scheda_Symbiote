// scheda_pathfinder.js — refactor “snello e coerente”
document.addEventListener("DOMContentLoaded", () => {
  /* =========================
     Helpers (UNA SOLA VOLTA)
  ========================= */
  const THEME_KEY = "pf1e_theme";
  const STORAGE_KEY = "pf1e_sheet_state_v3";
  const SKILLS_EXTRA_KEY = "pf1e_skills_extra_rows_v3";
  const ATK_STORAGE_KEY = "pf1e_attacks_extra_rows_v1";
  const COMP_ATK_STORAGE_KEY = "pf1e_comp_attacks_extra_rows_v1";
  const SPELLS_EXTRA_KEY = "pf1e_spells_extra_rows_v1";
  const MAX_CHARACTER_LEVEL = 20;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  const fmtSigned = (n) => {
    const v = Math.trunc(num(n));
    return (v >= 0 ? "+" : "") + String(v);
  };

  const parseSignedInt = (v) => {
    const s = String(v ?? "").trim().replace("+", "");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };

  const d20 = () => Math.floor(Math.random() * 20) + 1;
  const pendingTsRolls = [];

  function toast(msg) {
    let el = document.getElementById("toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast";
      Object.assign(el.style, {
        position: "fixed",
        left: "50%",
        bottom: "18px",
        transform: "translateX(-50%)",
        zIndex: "9999",
        maxWidth: "92vw",
        padding: "10px 12px",
        border: "2px solid var(--line)",
        borderRadius: "12px",
        background: "var(--surface)",
        color: "var(--text)",
        boxShadow: "var(--shadow)",
        fontSize: "13px",
        lineHeight: "1.2",
        opacity: "0",
        transition: "opacity .15s ease, transform .15s ease",
      });
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = "1";
    el.style.transform = "translateX(-50%) translateY(0)";
    clearTimeout(el._t);
    el._t = setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translateX(-50%) translateY(6px)";
    }, 2200);
  }

  function extractRollTotal(payload) {
    if (payload == null) return null;
    if (typeof payload === "number" && Number.isFinite(payload)) return payload;

    if (Array.isArray(payload)) {
      for (const item of payload) {
        const value = extractRollTotal(item);
        if (value != null) return value;
      }
      return null;
    }

    if (typeof payload === "object") {
      const keys = ["total", "result", "value", "sum", "grandTotal"];
      for (const key of keys) {
        const value = payload[key];
        if (typeof value === "number" && Number.isFinite(value)) return value;
      }
      for (const value of Object.values(payload)) {
        const nested = extractRollTotal(value);
        if (nested != null) return nested;
      }
    }

    return null;
  }

  function formatD20Formula(total) {
    const mod = parseSignedInt(total);
    return mod === 0 ? "1d20" : `1d20${fmtSigned(mod)}`;
  }

  function tryTaleSpireDiceRoll(formula, cleanLabel, mod, trackResult = true) {
    const diceApi = window?.TS?.dice;
    if (!diceApi) return false;
    const queueEntry =
      trackResult === false ? null : { label: cleanLabel, mod, kind: trackResult === "formula" ? "formula" : "d20" };

    if (typeof diceApi.putDiceInTray === "function") {
      const legacyTrayRequest = [{ name: cleanLabel, roll: String(formula).toUpperCase() }];
      try {
        if (queueEntry) pendingTsRolls.push(queueEntry);
        diceApi.putDiceInTray(legacyTrayRequest);
        toast(`${cleanLabel}: inviato nel tray TaleSpire (${formula})`);
        return true;
      } catch (err) {
        if (queueEntry) pendingTsRolls.pop();
        console.error("Errore con TS.dice.putDiceInTray (legacy):", err);
      }
    }

    const hasDescriptorsApi =
      typeof diceApi.makeRollDescriptors === "function" &&
      typeof diceApi.putDiceInTray === "function";

    if (hasDescriptorsApi) {
      try {
        if (
          typeof diceApi.isValidRollString === "function" &&
          !diceApi.isValidRollString(formula)
        ) {
          console.warn("Formula TS non valida:", formula);
          return false;
        }

        const descriptors = diceApi.makeRollDescriptors(formula);
        if (!Array.isArray(descriptors) || descriptors.length === 0) return false;

        if (queueEntry) pendingTsRolls.push(queueEntry);
        diceApi.putDiceInTray(descriptors, false);
        toast(`${cleanLabel}: inviato nel tray TaleSpire (${formula})`);
        return true;
      } catch (err) {
        if (queueEntry) pendingTsRolls.pop();
        console.error("Errore con TS.dice.makeRollDescriptors/putDiceInTray:", err);
      }
    }

    const callSpecs = [
      { method: "roll", mode: "roll" },
      { method: "rollDice", mode: "roll" },
    ];

    for (const spec of callSpecs) {
      const fn = diceApi?.[spec.method];
      if (typeof fn !== "function") continue;

      try {
        if (queueEntry) pendingTsRolls.push(queueEntry);
        fn.call(diceApi, formula);
        const action =
          spec.mode === "roll" ? "tirato in TaleSpire" : "inviato nel tray TaleSpire";
        toast(`${cleanLabel}: ${action} (${formula})`);
        return true;
      } catch (err) {
        if (queueEntry) pendingTsRolls.pop();
        console.error(`Errore con TS.dice.${spec.method}:`, err);
      }
    }

    return false;
  }

  function rollViaTaleSpire(total, label) {
    const cleanLabel = String(label || "Tiro").trim() || "Tiro";
    const mod = parseSignedInt(total);
    const formula = formatD20Formula(mod);
    const tsRollSent =
      typeof window !== "undefined" && tryTaleSpireDiceRoll(formula, cleanLabel, mod);
    if (tsRollSent) return;

    const roll = d20();
    const result = roll + mod;
    toast(`${cleanLabel}: d20(${roll}) + Tot(${mod >= 0 ? "+" : ""}${mod}) = ${result}`);
  }

  function rollFormulaViaTaleSpire(formula, label) {
    const cleanLabel = String(label || "Danni").trim() || "Danni";
    const cleanFormula = String(formula || "").trim();
    if (!cleanFormula) return;

    const tsRollSent =
      typeof window !== "undefined" && tryTaleSpireDiceRoll(cleanFormula, cleanLabel, 0, "formula");
    if (tsRollSent) return;

    toast(`${cleanLabel}: formula ${cleanFormula}`);
  }

  window.handleRollResult = async (payload) => {
    if (payload?.kind === "rollRemoved") {
      const removed = pendingTsRolls.shift();
      toast(`${removed?.label || "Un tiro"}: rimosso dal tray`);
      return;
    }

    const ctx = pendingTsRolls.shift();
    const label = ctx?.label || "Tiro";
    const mod = ctx?.mod ?? 0;
    let total = extractRollTotal(payload);

    if (
      total == null &&
      payload?.kind === "rollResults" &&
      typeof window?.TS?.dice?.evaluateDiceResultsGroup === "function"
    ) {
      const group = payload?.payload?.resultsGroups?.[0] ?? payload?.resultsGroups?.[0];
      if (group != null) {
        try {
          const evaluated = await window.TS.dice.evaluateDiceResultsGroup(group);
          total = extractRollTotal(evaluated);
        } catch (err) {
          console.error("Errore TS.dice.evaluateDiceResultsGroup:", err);
        }
      }
    }

    if (total == null) {
      toast(`${label}: risultato TaleSpire ricevuto`);
      return;
    }

    if (ctx?.kind === "formula") {
      toast(`${label}: risultato ${total}`);
      return;
    }

    const baseRoll = total - mod;
    toast(
      `${label}: d20(${baseRoll}) + Tot(${mod >= 0 ? "+" : ""}${mod}) = ${total}`
    );
  };

  window.logSymbioteEvent = (event) => {
    console.debug("[PF1E Symbiote] Visibility event:", event);
  };

  window.onStateChangeEvent = (event) => {
    console.debug("[PF1E Symbiote] State change event:", event);
  };

  /* =========================
     Tabs
  ========================= */
  const tabs = $$(".tab");
  const pages = $$(".page");
  const tabIncantesimi = document.getElementById("tab-incantesimi");
  const tabCompagno = document.getElementById("tab-compagno");
  const tabCdp = document.getElementById("tab-cdp");
  const enableCdpSection = document.getElementById("enable-cdp-section");
  const enableSpellsTab = document.getElementById("enable-spells-tab");
  const enableCompanionTab = document.getElementById("enable-companion-tab");
  const cdpFields = $$(".cdp-field");

  function activate(targetId, pushHash = true) {
    pages.forEach((p) => p.classList.toggle("active", p.id === targetId));
    tabs.forEach((t) =>
      t.setAttribute("aria-selected", String(t.dataset.target === targetId))
    );
    if (pushHash) history.replaceState(null, "", "#" + targetId);
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", (e) => {
      if (tab.classList.contains("is-disabled")) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      activate(tab.dataset.target, true);
    });
  });

  const hash = (location.hash || "").replace("#", "");
  if (hash && document.getElementById(hash)) activate(hash, false);

  function updateOptionalTabsVisibility() {
    const cdpEnabled = !!enableCdpSection?.checked;
    const spellsEnabled = !!enableSpellsTab?.checked;
    const companionEnabled = !!enableCompanionTab?.checked;

    cdpFields.forEach((el) => {
      el.hidden = !cdpEnabled;
      el.setAttribute("aria-hidden", String(!cdpEnabled));
      el.querySelectorAll("input, select, textarea").forEach((ctrl) => {
        ctrl.disabled = !cdpEnabled;
      });
    });

    if (tabCdp) {
      tabCdp.hidden = !cdpEnabled;
      tabCdp.setAttribute("aria-hidden", String(!cdpEnabled));
      if (!cdpEnabled && tabCdp.getAttribute("aria-selected") === "true") {
        activate("page-identita", true);
      }
    }

    if (tabIncantesimi) {
      tabIncantesimi.hidden = !spellsEnabled;
      tabIncantesimi.setAttribute("aria-hidden", String(!spellsEnabled));
      if (!spellsEnabled && tabIncantesimi.getAttribute("aria-selected") === "true") {
        activate("page-identita", true);
      }
    }

    if (tabCompagno) {
      tabCompagno.hidden = !companionEnabled;
      tabCompagno.setAttribute("aria-hidden", String(!companionEnabled));
      if (!companionEnabled && tabCompagno.getAttribute("aria-selected") === "true") {
        activate("page-identita", true);
      }
    }
  }

  /* =========================
     Theme (dark mode) — stabile
  ========================= */
  const themeToggle = document.getElementById("theme-toggle");
  const wrathThemeToggle = document.getElementById("theme-wrath-toggle");
  const wrathThemeLabel = document.getElementById("wrath-theme-label");
  const vividThemeToggle = document.getElementById("theme-vivid-toggle");
  const vividThemeLabel = document.getElementById("vivid-theme-label");
  const classicThemeToggle = document.getElementById("theme-classic-toggle");
  const classicThemeLabel = document.getElementById("classic-theme-label");
  const themeState = document.getElementById("theme-state");
  const refreshPageBtn = document.getElementById("refresh-page");
  const themeSwitch = themeToggle?.closest(".switch") || null;
  let previousThemeBeforeVariant = null;

  function applyTheme(mode) {
    const isDark = mode === "dark";
    if (isDark) document.documentElement.setAttribute("data-theme", "dark");
    else document.documentElement.removeAttribute("data-theme");

    localStorage.setItem(THEME_KEY, mode);

    if (themeToggle) themeToggle.checked = isDark;
    if (themeState) themeState.textContent = isDark ? "Dark 🌙" : "Light ☀";
  }

  function preferredTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "dark" || saved === "light") return saved;
    const prefersDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    return prefersDark ? "dark" : "light";
  }

  applyTheme(preferredTheme());

  function applyThemeVariant() {
    const variant = wrathThemeToggle?.checked
      ? "wrath"
      : vividThemeToggle?.checked
        ? "vivid"
        : classicThemeToggle?.checked
          ? "classic"
          : "";
    const enabled = !!variant;
    if (enabled) {
      previousThemeBeforeVariant = themeToggle?.checked ? "dark" : "light";
      document.documentElement.setAttribute("data-theme-variant", variant);
      applyTheme(variant === "classic" ? "light" : "dark");
    } else {
      document.documentElement.removeAttribute("data-theme-variant");
      if (previousThemeBeforeVariant) applyTheme(previousThemeBeforeVariant);
    }

    if (themeSwitch) themeSwitch.hidden = enabled;
    if (themeState) themeState.hidden = enabled;
    if (wrathThemeLabel) wrathThemeLabel.hidden = variant !== "wrath";
    if (vividThemeLabel) vividThemeLabel.hidden = variant !== "vivid";
    if (classicThemeLabel) classicThemeLabel.hidden = variant !== "classic";
  }

  applyThemeVariant();

  if (themeToggle) {
    themeToggle.addEventListener("change", () => {
      applyTheme(themeToggle.checked ? "dark" : "light");
    });
  }

  if (wrathThemeToggle) {
    wrathThemeToggle.addEventListener("input", () => {
      if (wrathThemeToggle.checked && vividThemeToggle) vividThemeToggle.checked = false;
      if (wrathThemeToggle.checked && classicThemeToggle) classicThemeToggle.checked = false;
      applyThemeVariant();
    });
    wrathThemeToggle.addEventListener("change", () => {
      if (wrathThemeToggle.checked && vividThemeToggle) vividThemeToggle.checked = false;
      if (wrathThemeToggle.checked && classicThemeToggle) classicThemeToggle.checked = false;
      applyThemeVariant();
    });
  }

  if (vividThemeToggle) {
    vividThemeToggle.addEventListener("input", () => {
      if (vividThemeToggle.checked && wrathThemeToggle) wrathThemeToggle.checked = false;
      if (vividThemeToggle.checked && classicThemeToggle) classicThemeToggle.checked = false;
      applyThemeVariant();
    });
    vividThemeToggle.addEventListener("change", () => {
      if (vividThemeToggle.checked && wrathThemeToggle) wrathThemeToggle.checked = false;
      if (vividThemeToggle.checked && classicThemeToggle) classicThemeToggle.checked = false;
      applyThemeVariant();
    });
  }

  if (classicThemeToggle) {
    classicThemeToggle.addEventListener("input", () => {
      if (classicThemeToggle.checked && wrathThemeToggle) wrathThemeToggle.checked = false;
      if (classicThemeToggle.checked && vividThemeToggle) vividThemeToggle.checked = false;
      applyThemeVariant();
    });
    classicThemeToggle.addEventListener("change", () => {
      if (classicThemeToggle.checked && wrathThemeToggle) wrathThemeToggle.checked = false;
      if (classicThemeToggle.checked && vividThemeToggle) vividThemeToggle.checked = false;
      applyThemeVariant();
    });
  }

  if (refreshPageBtn) {
    refreshPageBtn.addEventListener("click", () => {
      location.reload();
    });
  }

  /* =========================
     Autosave localStorage (esclude theme-toggle)
  ========================= */
  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch {
      return {};
    }
  }
  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  const state = loadState();

  function domPathKey(el) {
    const page = el.closest(".page");
    const pageId = page ? page.id : "root";

    let parts = [];
    let cur = el;
    while (cur && cur !== page && cur.nodeType === 1) {
      const tag = cur.tagName.toLowerCase();
      let i = 1;
      let sib = cur;
      while ((sib = sib.previousElementSibling)) {
        if (sib.tagName === cur.tagName) i++;
      }
      parts.push(`${tag}:nth-of-type(${i})`);
      cur = cur.parentElement;
    }
    parts.reverse();
    return `${pageId}::${parts.join(">")}`;
  }

  function keyFor(el) {
    return el.dataset.key || domPathKey(el);
  }

  function applySavedValues(root = document) {
    $$(".page input, .page textarea, .page select", root).forEach((el) => {
      if (el.type === "button" || el.type === "submit") return;
      if (el.id === "theme-toggle") return;
      const k = keyFor(el);
      if (Object.prototype.hasOwnProperty.call(state, k)) {
        if (el.type === "checkbox") el.checked = !!state[k];
        else el.value = state[k];
      }
    });
  }

  function wireAutosave(root = document) {
    $$(".page input, .page textarea, .page select", root).forEach((el) => {
      if (el.type === "button" || el.type === "submit") return;
      if (el.id === "theme-toggle") return;

      const handler = () => {
        const k = keyFor(el);
        state[k] = el.type === "checkbox" ? !!el.checked : el.value;
        saveState(state);
      };

      el.addEventListener("input", handler);
      el.addEventListener("change", handler);
    });
  }

  applySavedValues(document);
  wireAutosave(document);

  [enableCdpSection, enableSpellsTab, enableCompanionTab].forEach((el) => {
    if (!el) return;
    el.addEventListener("input", updateOptionalTabsVisibility);
    el.addEventListener("change", updateOptionalTabsVisibility);
  });
  updateOptionalTabsVisibility();

  const sizeSelectors = $$(".size-select-sync");
  const SIZE_MODIFIERS = {
    small: { acAtk: 1, stealth: 4, cmbCmd: -1 },
    medium: { acAtk: 0, stealth: 0, cmbCmd: 0 },
    large: { acAtk: -1, stealth: -4, cmbCmd: 1 },
  };

  function normalizeSizeKey(v) {
    const k = String(v || "").trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(SIZE_MODIFIERS, k) ? k : "medium";
  }

  function getCurrentSizeKey() {
    const first = sizeSelectors.find((el) => !!el);
    return normalizeSizeKey(first?.value || "medium");
  }

  function getCurrentSizeMods() {
    return SIZE_MODIFIERS[getCurrentSizeKey()] || SIZE_MODIFIERS.medium;
  }

  function getSizeAbilityScoreBonus(code) {
    const size = getCurrentSizeKey();
    const adjustmentsBySize = {
      small: { FOR: -2, DES: 2 },
      medium: { FOR: 0, DES: 0 },
      large: { FOR: 2, DES: -2 },
    };
    return adjustmentsBySize[size]?.[code] ?? 0;
  }

  function getSizeAbilityModBonus(code) {
    return Math.trunc(getSizeAbilityScoreBonus(code) / 2);
  }

  function setAllSizeSelectors(sizeKey) {
    const k = normalizeSizeKey(sizeKey);
    sizeSelectors.forEach((sel) => {
      if (!sel) return;
      sel.value = k;
      state[keyFor(sel)] = k;
    });
    saveState(state);
  }

  sizeSelectors.forEach((sel) => {
    if (!sel) return;
    const onSizeChange = () => {
      setAllSizeSelectors(sel.value);
      applyMythicAbilityBonusToScores();
      recalcDerived();
    };
    sel.addEventListener("input", onSizeChange);
    sel.addEventListener("change", onSizeChange);
  });
  setAllSizeSelectors(getCurrentSizeKey());

  /* =========================
     Ability score <-> mod (bidirezionale)
  ========================= */
  const pfModFromScore = (score) => Math.floor((num(score) - 10) / 2);
  const scoreFromPfMod = (mod) => 10 + 2 * num(mod);

  let isAbilitySyncing = false;

  function updateAbilityBlock(statEl) {
    if (!statEl) return;
    const scoreEl = $(".ability-score", statEl);
    const modEl = $(".ability-mod", statEl);
    if (!scoreEl || !modEl) return;
    modEl.value = String(pfModFromScore(scoreEl.value));
  }

  function updateAllAbilityMods() {
    $$(".stat[data-ability]").forEach(updateAbilityBlock);
  }

  function updateCompAbilityField(fieldEl) {
    if (!fieldEl) return;
    const scoreEl = $(".comp-ability-score", fieldEl);
    const modEl = $(".comp-ability-mod", fieldEl);
    if (!scoreEl || !modEl) return;
    modEl.value = String(pfModFromScore(scoreEl.value));
  }

  function getCompAbilityModByCode(code) {
    const field = $(`.comp-ability-field[data-ability="${code}"]`);
    const modEl = field ? $(".comp-ability-mod", field) : null;
    return modEl ? num(modEl.value) : 0;
  }

  function syncCompAttackModsFromAbilities() {
    const strEl = document.getElementById("comp-atk-str-mod");
    const dexEl = document.getElementById("comp-atk-dex-mod");
    if (strEl) strEl.value = String(getCompAbilityModByCode("FOR"));
    if (dexEl) dexEl.value = String(getCompAbilityModByCode("DES"));
  }

  function updateAllCompAbilityMods() {
    $$(".comp-ability-field[data-ability]").forEach(updateCompAbilityField);
    syncCompAttackModsFromAbilities();
  }

  function recalcCompanionEffectiveLevel() {
    const companionLevelEl = document.getElementById("comp-level");
    const effectiveLevelEl = document.getElementById("comp-effective-level");
    if (!effectiveLevelEl) return;

    const pcLevel = Math.max(0, Math.trunc(num(document.getElementById("pc-level-total")?.value)));
    const companionLevel = Math.max(0, Math.trunc(num(companionLevelEl?.value)));
    const hasBoonCompanion = !!document.getElementById("comp-boon-companion")?.checked;

    let effectiveLevel = companionLevel + (hasBoonCompanion ? 4 : 0);
    if (pcLevel > 0) effectiveLevel = Math.min(effectiveLevel, pcLevel);

    effectiveLevelEl.value = String(Math.max(0, effectiveLevel));
  }

  updateAllAbilityMods();
  updateAllCompAbilityMods();
  recalcCompanionEffectiveLevel();

  function getMythicAbilityBonusFor(code) {
    const tierA = document.getElementById("mythic-tier-identita");
    const tierB = document.getElementById("mythic-tier-mitico");
    const tier = Math.max(num(tierA?.value), num(tierB?.value), 0);
    if (tier <= 0) return 0;

    let bonus = 0;
    $$(".mythic-ability-pick").forEach((sel) => {
      const pickTier = num(sel.dataset.tier);
      if (!pickTier || pickTier > tier) return;
      if (String(sel.value || "").trim() === code) bonus += 2;
    });
    return bonus;
  }

  function applyMythicAbilityBonusToScores() {
    let changed = false;

    $$(".stat[data-ability]").forEach((statEl) => {
      const code = String(statEl.dataset.ability || "");
      const scoreEl = $(".ability-score", statEl);
      if (!scoreEl) return;

      const mythicBonus = getMythicAbilityBonusFor(code);
      const sizeScoreBonus = getSizeAbilityScoreBonus(code);
      const min = num(scoreEl.min || 1);
      const max = num(scoreEl.max || 50);

      if (scoreEl.dataset.baseScore === undefined) {
        const currentVisible = num(scoreEl.value);
        scoreEl.dataset.baseScore = String(currentVisible - mythicBonus - sizeScoreBonus);
      }

      const base = num(scoreEl.dataset.baseScore);
      const total = clamp(base + mythicBonus + sizeScoreBonus, min, max);
      const nextValue = String(total);

      if (scoreEl.value !== nextValue) {
        scoreEl.value = nextValue;
        state[keyFor(scoreEl)] = nextValue;
        changed = true;
      }
    });

    if (changed) saveState(state);
    updateAllAbilityMods();
  }

  function syncAbilityBaseFromInput(statEl) {
    if (!statEl) return;
    const scoreEl = $(".ability-score", statEl);
    if (!scoreEl) return;

    const code = String(statEl.dataset.ability || "");
    const mythicBonus = getMythicAbilityBonusFor(code);
    const sizeScoreBonus = getSizeAbilityScoreBonus(code);
    scoreEl.dataset.baseScore = String(num(scoreEl.value) - mythicBonus - sizeScoreBonus);
  }

  function syncAllAbilityBaseFromVisibleScores() {
    $$(".stat[data-ability]").forEach((statEl) => {
      const scoreEl = $(".ability-score", statEl);
      if (!scoreEl) return;
      const code = String(statEl.dataset.ability || "");
      const mythicBonus = getMythicAbilityBonusFor(code);
      const sizeScoreBonus = getSizeAbilityScoreBonus(code);
      scoreEl.dataset.baseScore = String(num(scoreEl.value) - mythicBonus - sizeScoreBonus);
    });
  }

  document.addEventListener("input", (e) => {
    const t = e.target;
    if (!t?.classList) return;

    // score -> mod
    if (t.classList.contains("ability-score")) {
      if (isAbilitySyncing) return;
      isAbilitySyncing = true;
      const stat = t.closest(".stat");
      syncAbilityBaseFromInput(stat);
      applyMythicAbilityBonusToScores();
      updateAbilityBlock(stat);
      isAbilitySyncing = false;
      recalcDerived(); // iniziativa/CA/attacchi/skills
      return;
    }

    if (t.classList.contains("comp-ability-score")) {
      if (isAbilitySyncing) return;
      isAbilitySyncing = true;
      const field = t.closest(".comp-ability-field");
      updateCompAbilityField(field);
      syncCompAttackModsFromAbilities();
      isAbilitySyncing = false;
      recalcAllCompAttacks();
      return;
    }

    // mod -> score
    if (t.classList.contains("ability-mod")) {
      if (isAbilitySyncing) return;
      isAbilitySyncing = true;

      const stat = t.closest(".stat");
      const scoreEl = stat ? $(".ability-score", stat) : null;
      if (scoreEl) {
        const code = String(stat?.dataset?.ability || "");
        const mythicBonus = getMythicAbilityBonusFor(code);
        const sizeScoreBonus = getSizeAbilityScoreBonus(code);
        const desired = scoreFromPfMod(num(t.value));
        const min = num(scoreEl.min || 1);
        const max = num(scoreEl.max || 50);
        const total = clamp(desired, min, max);
        scoreEl.dataset.baseScore = String(total - mythicBonus - sizeScoreBonus);
        scoreEl.value = String(total);
        updateAbilityBlock(stat);
      }

      isAbilitySyncing = false;
      recalcDerived();
      return;
    }

    if (t.classList.contains("comp-ability-mod")) {
      if (isAbilitySyncing) return;
      isAbilitySyncing = true;
      const field = t.closest(".comp-ability-field");
      const scoreEl = field ? $(".comp-ability-score", field) : null;
      if (scoreEl) {
        const desired = scoreFromPfMod(num(t.value));
        const min = num(scoreEl.min || 1);
        const max = num(scoreEl.max || 50);
        scoreEl.value = String(clamp(desired, min, max));
        updateCompAbilityField(field);
      }
      syncCompAttackModsFromAbilities();
      isAbilitySyncing = false;
      recalcAllCompAttacks();
      return;
    }
  });

  function getAbilityModByCode(code) {
    const stat = $(`.stat[data-ability="${code}"]`);
    if (!stat) return 0;
    const modEl = $(".ability-mod", stat);
    return modEl ? num(modEl.value) : 0;
  }

  const SPELLCASTING_ABILITY_BY_CLASS = {
    Chierico: "SAG",
    Druido: "SAG",
    Inquisitore: "SAG",
    Ranger: "SAG",
    Antipaladino: "CAR",
    Bardo: "CAR",
    Convocatore: "CAR",
    Oracolo: "CAR",
    Paladino: "CAR",
    Stregone: "CAR",
    Alchimista: "INT",
    Fattucchiere: "INT",
    Mago: "INT",
    Magus: "INT",
  };

  function updateSpellcastingClassFields() {
    const classEl = document.getElementById("spellcaster-class");
    const abilityEl = document.getElementById("spellcasting-ability");
    const modEl = document.getElementById("spellcasting-ability-mod");
    if (!classEl || !abilityEl || !modEl) return;

    const cls = String(classEl.value || "").trim();
    const abilityCode = SPELLCASTING_ABILITY_BY_CLASS[cls] || "";
    abilityEl.value = abilityCode || "—";
    modEl.value = abilityCode ? fmtSigned(getAbilityModByCode(abilityCode)) : "+0";
  }

  function getSpellApi() {
    return window.PF1EData?.tables?.spells || null;
  }

  function getMaxCastableSpellLevel() {
    const className = String(document.getElementById("spellcaster-class")?.value || "").trim();
    if (!className) return 9;
    const li = num(document.getElementById("spellcaster-level")?.value);
    const spellApi = getSpellApi();
    if (!spellApi || typeof spellApi.getMaxLevelByClass !== "function") return 9;
    return spellApi.getMaxLevelByClass(li, className);
  }

  function updateSpellLevelsVisibility() {
    const className = String(document.getElementById("spellcaster-class")?.value || "").trim();
    const hasClass = className.length > 0;
    const maxLevel = getMaxCastableSpellLevel();

    $$(".spell-level-block").forEach((block, idx) => {
      const lvl = idx;
      block.dataset.level = String(lvl);
      const visible = !hasClass || lvl <= maxLevel;
      block.hidden = !visible;
      block.setAttribute("aria-hidden", String(!visible));
    });

    $$("#spell-slots-body .spell-slot-row").forEach((row) => {
      const lvl = num(row.dataset.level);
      const visible = !hasClass || lvl <= maxLevel;
      row.hidden = !visible;
      row.setAttribute("aria-hidden", String(!visible));
    });
  }

  function loadSpellExtraMap() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SPELLS_EXTRA_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveSpellExtraMap(map) {
    localStorage.setItem(SPELLS_EXTRA_KEY, JSON.stringify(map || {}));
  }

  function getSpellExtraCount(level) {
    const map = loadSpellExtraMap();
    return Math.max(0, parseInt(map[String(level)] || 0, 10) || 0);
  }

  function setSpellExtraCount(level, count) {
    const map = loadSpellExtraMap();
    map[String(level)] = Math.max(0, parseInt(count, 10) || 0);
    saveSpellExtraMap(map);
  }

  function getSpellRangeFeet(rangeType, casterLevel) {
    const li = Math.max(0, Math.trunc(num(casterLevel)));
    if (rangeType === "medium") return 100 + 10 * li;
    if (rangeType === "long") return 400 + 40 * li;
    return 25 + 5 * Math.floor(li / 2);
  }

  function formatFeetToMeters(feet) {
    const meters = Math.round(num(feet) * 0.3048);
    return `${meters} m`;
  }

  function makeSpellRow(level, index, isExtra = false) {
    const row = document.createElement("div");
    row.className = `spell-entry${isExtra ? " spell-entry-extra" : ""}`;
    row.dataset.level = String(level);
    row.dataset.index = String(index);
    row.innerHTML = `
      <div class="spell-entry-head">
        <div class="spell-entry-title">
          <input
            class="spell-name${isExtra ? " spell-name-extra" : ""}"
            data-key="spell:${level}:${index}:name"
            type="text"
            placeholder="Incantesimo livello ${level}"
          />
        </div>
        <div class="spell-entry-controls">
          <button type="button" class="spell-entry-toggle" aria-expanded="true" title="Mostra/nascondi dettagli incantesimo">
            Dettagli
          </button>
          <label class="spell-offensive-toggle">
            <input class="spell-offensive" data-key="spell:${level}:${index}:offensive" type="checkbox" />
            Offensivo
          </label>
        </div>
      </div>

      <div class="spell-entry-body">
        <div class="spell-offensive-panel" hidden>
          <div class="spell-offensive-row">
            <div class="spell-offensive-group">
              <span class="attack-subtitle">TpC Incantesimo</span>
              <div class="spell-offensive-inline spell-atk-line">
                <select class="select spell-atk-type" data-key="spell:${level}:${index}:atk_type" title="Tipo attacco">
                  <option value="ranged" selected>Distanza (DES)</option>
                  <option value="melee">Mischia (FOR)</option>
                </select>
                <input class="small spell-atk-misc" data-key="spell:${level}:${index}:atk_misc" type="number" step="1" value="0" title="Varie TpC" />
                <input class="small spell-atk-total" type="text" value="+0" readonly title="Totale TpC" />
              </div>
            </div>
            <div class="spell-offensive-group">
              <span class="attack-subtitle">Danni</span>
              <div class="spell-offensive-inline spell-dmg-line">
                <div class="atk-dmg-builder">
                  <input class="small spell-dice-count" data-key="spell:${level}:${index}:dice_count" type="number" min="1" step="1" value="1" title="Numero dadi" />
                  <select class="select spell-die" data-key="spell:${level}:${index}:die_size" title="Tipo dado">
                    <option value="4">d4</option>
                    <option value="6" selected>d6</option>
                    <option value="8">d8</option>
                    <option value="10">d10</option>
                    <option value="12">d12</option>
                  </select>
                </div>
                <button type="button" class="roll-btn spell-roll-btn spell-atk-roll-btn" title="Tira 1d20 + TpC">Tiro</button>
                <button type="button" class="roll-btn spell-roll-btn spell-dmg-roll-btn" title="Tira danni">Danni</button>
              </div>
            </div>
          </div>
        </div>

        <div class="spell-range-row">
          <label>Raggio</label>
          <div class="spell-range-inline">
            <select class="select spell-range-type" data-key="spell:${level}:${index}:range_type" title="Raggio">
              <option value="close" selected>Vicino</option>
              <option value="medium">Medio</option>
              <option value="long">Lontano</option>
            </select>
            <input class="small spell-range-summary" type="text" value="8 m" readonly title="Raggio calcolato da LI" />
          </div>
        </div>
      </div>
    `;
    return row;
  }

  function setSpellEntryCollapsed(row, collapsed) {
    if (!row) return;
    row.classList.toggle("is-collapsed", !!collapsed);
    const toggleBtn = row.querySelector(".spell-entry-toggle");
    if (toggleBtn) toggleBtn.setAttribute("aria-expanded", String(!collapsed));
  }

  function moveSpellLevelActionsInline() {
    $$(".spell-level-block").forEach((block) => {
      const head = block.querySelector(".spell-level-head");
      const actions = block.querySelector(".spell-level-actions");
      if (!head || !actions || head.contains(actions)) return;
      head.appendChild(actions);
    });
  }

  function recalcSpellRow(row, attackVars = buildAttackBaseVariables()) {
    if (!row) return;
    const offensiveEl = row.querySelector(".spell-offensive");
    const offensivePanel = row.querySelector(".spell-offensive-panel");
    const offensive = !!offensiveEl?.checked;
    if (offensivePanel) {
      offensivePanel.hidden = !offensive;
      offensivePanel.setAttribute("aria-hidden", String(!offensive));
    }

    if (offensive) {
      const atkType = row.querySelector(".spell-atk-type")?.value || "ranged";
      const rowMisc = num(row.querySelector(".spell-atk-misc")?.value);
      const base = atkType === "melee" ? attackVars.melee.total : attackVars.ranged.total;
      const total = base + rowMisc;
      const atkOut = row.querySelector(".spell-atk-total");
      if (atkOut) atkOut.value = fmtSigned(total);

      const diceCount = row.querySelector(".spell-dice-count")?.value;
      const dieSize = row.querySelector(".spell-die")?.value;
      const dmgFormula = formatDamageFormula(diceCount, dieSize, 0);
      row.dataset.dmgFormula = dmgFormula;
    }

    const rangeType = row.querySelector(".spell-range-type")?.value || "close";
    const li = num(document.getElementById("spellcaster-level")?.value);
    const feet = getSpellRangeFeet(rangeType, li);
    const meters = formatFeetToMeters(feet);
    const summary = `${meters}`;
    const rangeOut = row.querySelector(".spell-range-summary");
    if (rangeOut) rangeOut.value = summary;
  }

  function recalcAllSpellRows() {
    const attackVars = buildAttackBaseVariables();
    $$(".spell-entry").forEach((row) => recalcSpellRow(row, attackVars));
  }

  function rebuildSpellRows() {
    for (let lvl = 0; lvl <= 9; lvl++) {
      const container = document.getElementById(`spell-list-level-${lvl}`);
      if (!container) continue;
      container.innerHTML = "";
      const extra = getSpellExtraCount(lvl);
      const rows = 1 + extra;
      for (let idx = 0; idx < rows; idx++) {
        const row = makeSpellRow(lvl, idx, idx > 0);
        container.appendChild(row);
        applySavedValues(row);
        wireAutosave(row);
        setSpellEntryCollapsed(row, false);
        recalcSpellRow(row);
      }
    }
  }

  function recalcSpellSlotRow(row) {
    if (!row) return;
    const totalEl = row.querySelector(".spell-slot-total");
    const usedEl = row.querySelector(".spell-slot-used");
    const bonusEl = row.querySelector(".spell-slot-bonus");
    const remainingEl = row.querySelector(".spell-slot-remaining");
    const cdEl = row.querySelector(".spell-slot-cd");
    if (!totalEl || !usedEl || !bonusEl || !remainingEl) return;

    const total = num(totalEl.value);
    const used = num(usedEl.value);
    const bonus = num(bonusEl.value);
    remainingEl.value = String(total + bonus - used);

    const li = num(document.getElementById("spellcaster-level")?.value);
    const mod = parseSignedInt(document.getElementById("spellcasting-ability-mod")?.value);
    const spellLevel = num(row.dataset.level);
    if (cdEl) cdEl.value = String(10 + li + mod + spellLevel);
  }

  function recalcAllSpellSlots() {
    $$("#spell-slots-body .spell-slot-row").forEach(recalcSpellSlotRow);
  }

  /* =========================
     CdP cap (max 10)
  ========================= */
  const cdpLevel = document.getElementById("cdp-level");
  if (cdpLevel) {
    cdpLevel.addEventListener("input", () => {
      cdpLevel.value = String(clamp(num(cdpLevel.value), 0, 10));
    });
  }

  /* =========================
     Mitico sync + tab enable/disable
  ========================= */
  const pathI = document.getElementById("mythic-path-identita");
  const tierI = document.getElementById("mythic-tier-identita");
  const pathM = document.getElementById("mythic-path-mitico");
  const tierM = document.getElementById("mythic-tier-mitico");
  const mythicAbilityPicks = $$(".mythic-ability-pick");
  const mythicTierTableBody = document.getElementById("mythic-tier-table-body");
  const mythicSurgeDie = document.getElementById("mythic-surge-die");
  const mythicSurgeReminder = document.getElementById("mythic-surge-reminder");
  const mythicPowerUses = document.getElementById("mythic-power-uses");
  const mythicInitBonus = document.getElementById("mythic-init-bonus");

  const tabMitico = document.getElementById("tab-mitico");
  const mythicBadge = document.getElementById("mythic-badge");

  let isSyncing = false;

  function syncValue(fromEl, toEl) {
    if (!fromEl || !toEl) return;
    toEl.value = fromEl.value;
    toEl.dispatchEvent(new Event("input", { bubbles: true }));
    toEl.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function wireSync(a, b) {
    if (!a || !b) return;
    const handler = () => {
      if (isSyncing) return;
      isSyncing = true;
      syncValue(a, b);
      isSyncing = false;
    };
    a.addEventListener("input", handler);
    a.addEventListener("change", handler);
  }

  wireSync(pathI, pathM);
  wireSync(pathM, pathI);
  wireSync(tierI, tierM);
  wireSync(tierM, tierI);

  function forceMythicTierEquality() {
    if (!tierI || !tierM) return;
    const canonical = String(clamp(Math.max(num(tierI.value), num(tierM.value), 0), 0, 10));
    tierI.value = canonical;
    tierM.value = canonical;
  }

  function getMythicTier() {
    const va = tierI ? num(tierI.value) : 0;
    const vb = tierM ? num(tierM.value) : 0;
    return Math.max(va, vb, 0);
  }

  function getMythicPath() {
    const pathA = String(pathI?.value || "").trim();
    const pathB = String(pathM?.value || "").trim();
    return pathB || pathA || "";
  }

  function getSurgeDieByTier(tier) {
    if (tier >= 9) return "d12";
    if (tier >= 6) return "d10";
    if (tier >= 3) return "d8";
    if (tier >= 1) return "d6";
    return "—";
  }

  function getSurgeReminderByTier(tier) {
    if (tier <= 0) return "Diventa mitico (Categoria 1) per ottenere il dado impulso.";
    if (tier < 3) return "Impulso d6. Prossimo aumento a d8 alla Categoria 3.";
    if (tier < 6) return "Impulso d8. Prossimo aumento a d10 alla Categoria 6.";
    if (tier < 9) return "Impulso d10. Prossimo aumento a d12 alla Categoria 9.";
    return "Impulso d12 (massimo).";
  }

  function updateMythicSurgeUI() {
    const tier = getMythicTier();
    if (mythicSurgeDie) mythicSurgeDie.value = getSurgeDieByTier(tier);
    if (mythicSurgeReminder) mythicSurgeReminder.value = getSurgeReminderByTier(tier);
    if (mythicPowerUses) mythicPowerUses.value = String(Math.max(0, tier * 2));
    if (mythicInitBonus) mythicInitBonus.value = fmtSigned(tier >= 2 ? tier : 0);
  }

  function updateMythicAbilityPickAvailability() {
    const tier = getMythicTier();
    mythicAbilityPicks.forEach((sel) => {
      const pickTier = num(sel.dataset.tier);
      const locked = pickTier > tier;
      sel.classList.toggle("mythic-pick-locked", locked);
      sel.title = locked
        ? `Si applica dal rango ${pickTier}`
        : `Attivo al rango ${pickTier}`;
    });
  }

  function updateMythicAbilityPickVisualState() {
    mythicAbilityPicks.forEach((sel) => {
      const hasValue = String(sel.value || "").trim() !== "";
      sel.classList.toggle("mythic-pick-selected", hasValue);
    });
  }

  function updateMythicTierRowHighlights() {
    if (!mythicTierTableBody) return;
    const tier = getMythicTier();
    mythicTierTableBody.querySelectorAll("tr[data-tier]").forEach((row) => {
      const rowTier = num(row.dataset.tier);
      const active = rowTier > 0 && rowTier <= tier;
      row.classList.toggle("mythic-tier-active", active);
      row.classList.toggle("mythic-tier-current", rowTier === tier && tier > 0);
      row.classList.toggle(
        "mythic-tier-pick-active",
        active && row.classList.contains("mythic-tier-pick-row")
      );
    });
  }

  function updateMythicUI() {
    const tier = getMythicTier();
    const isMythic = tier > 0;
    if (mythicBadge) mythicBadge.style.display = isMythic ? "none" : "block";
    if (tabMitico) {
      tabMitico.hidden = !isMythic;
      tabMitico.setAttribute("aria-hidden", String(!isMythic));
      tabMitico.classList.remove("is-disabled");
      tabMitico.setAttribute("aria-disabled", "false");
      if (!isMythic && tabMitico.getAttribute("aria-selected") === "true") {
        activate("page-identita", true);
      }
    }
  }

  [tierI, tierM].forEach((el) => {
    if (!el) return;
    el.addEventListener("input", () => {
      forceMythicTierEquality();
      updateMythicUI();
      updateMythicAbilityPickAvailability();
      updateMythicAbilityPickVisualState();
      updateMythicTierRowHighlights();
      applyMythicAbilityBonusToScores();
      updateMythicSurgeUI();
      recalcDerived();
    });
    el.addEventListener("change", () => {
      forceMythicTierEquality();
      updateMythicUI();
      updateMythicAbilityPickAvailability();
      updateMythicAbilityPickVisualState();
      updateMythicTierRowHighlights();
      applyMythicAbilityBonusToScores();
      updateMythicSurgeUI();
      recalcDerived();
    });
  });

  [pathI, pathM].forEach((el) => {
    if (!el) return;
    el.addEventListener("input", recalcHitPoints);
    el.addEventListener("change", recalcHitPoints);
  });

  if (mythicAbilityPicks.length) {
    const onMythicAbilityChange = () => {
      updateMythicAbilityPickAvailability();
      updateMythicAbilityPickVisualState();
      applyMythicAbilityBonusToScores();
      updateMythicSurgeUI();
      recalcDerived();
    };
    mythicAbilityPicks.forEach((sel) => {
      sel.addEventListener("input", onMythicAbilityChange);
      sel.addEventListener("change", onMythicAbilityChange);
    });
  }

  forceMythicTierEquality();
  updateMythicUI();
  updateMythicAbilityPickAvailability();
  updateMythicAbilityPickVisualState();
  updateMythicTierRowHighlights();
  applyMythicAbilityBonusToScores();
  updateMythicSurgeUI();

  /* =========================
     Combattimento — Iniziativa
     DES + misc + tier (solo se tier >= 2)
  ========================= */
  function recalcInitiative() {
    const out = document.getElementById("init-total");
    const miscEl = document.getElementById("init-misc");
    if (!out) return;

    const dex = getAbilityModByCode("DES");
    const misc = miscEl ? num(miscEl.value) : 0;
    const tier = getMythicTier();
    const mythicBonus = tier >= 2 ? tier : 0;

    out.value = fmtSigned(dex + misc + mythicBonus);
  }

  /* =========================
     Combattimento — CA
  ========================= */
  function syncDexToAC() {
    const acDexEl = document.getElementById("ac-dex");
    if (!acDexEl) return;
    acDexEl.value = String(getAbilityModByCode("DES"));
    acDexEl.readOnly = true;
  }

  function recalcAC() {
    const armorEl = document.getElementById("ac-armor");
    const shieldEl = document.getElementById("ac-shield");
    const armorEnhancementEl = document.getElementById("ac-armor-enhancement");
    const shieldEnhancementEl = document.getElementById("ac-shield-enhancement");
    const dexEl = document.getElementById("ac-dex");
    const dexMaxEl = document.getElementById("ac-dex-max");
    const miscEl = document.getElementById("ac-misc");
    const shieldOffEl = document.getElementById("shield-off");

    const totalEl = document.getElementById("ac-total");
    const touchEl = document.getElementById("ac-touch");
    const ffEl = document.getElementById("ac-ff");

    if (!armorEl || !shieldEl || !armorEnhancementEl || !shieldEnhancementEl || !dexEl || !miscEl) return;
    if (!totalEl || !touchEl || !ffEl) return;

    const armor = num(armorEl.value);
    const armorEnhancement = clamp(Math.trunc(num(armorEnhancementEl.value)), 0, 5);
    const shieldBase = num(shieldEl.value);
    const shieldEnhancement = clamp(Math.trunc(num(shieldEnhancementEl.value)), 0, 5);
    const dex = num(dexEl.value);
    const dexMaxRaw = String(dexMaxEl?.value ?? "").trim();
    const hasDexMax = dexMaxRaw !== "" && Number.isFinite(Number(dexMaxRaw));
    const dexApplied = hasDexMax ? Math.min(dex, num(dexMaxRaw)) : dex;
    const size = getCurrentSizeMods().acAtk;
    const misc = num(miscEl.value);

    const shieldActive = !(shieldOffEl && shieldOffEl.checked);
    const shield = shieldActive ? shieldBase + shieldEnhancement : 0;
    const armorTotal = armor + armorEnhancement;

    totalEl.value = String(10 + armorTotal + shield + dexApplied + size + misc);
    touchEl.value = String(10 + dexApplied + size + misc);
    ffEl.value = String(10 + armorTotal + shield + size + misc);

    if (shieldOffEl) {
      shieldEl.disabled = !!shieldOffEl.checked;
      shieldEnhancementEl.disabled = !!shieldOffEl.checked;
    }
  }

  /* =========================
     Attacchi — tabella dinamica (FOR/DES)
  ========================= */
  const attacksTbody = document.getElementById("attacks-tbody");
  const addAtkBtn = document.getElementById("add-attack-row");
  const remAtkBtn = document.getElementById("remove-attack-row");

  function buildAttackBaseVariables() {
    const bab = num(document.getElementById("atk-bab")?.value);
    const size = getCurrentSizeMods().acAtk;
    const misc = num(document.getElementById("atk-misc")?.value);
    const str = getAbilityModByCode("FOR");
    const dex = getAbilityModByCode("DES");

    const melee = {
      bab,
      ability: str,
      size,
      misc,
      total: bab + str + size + misc,
    };

    const ranged = {
      bab,
      ability: dex,
      size,
      misc,
      total: bab + dex + size + misc,
    };

    return { bab, size, misc, str, dex, melee, ranged };
  }

  function syncAttackBaseTotals(attackVars = buildAttackBaseVariables()) {
    const meleeOut = document.getElementById("atk-melee-total");
    const rangedOut = document.getElementById("atk-ranged-total");
    if (meleeOut) meleeOut.value = fmtSigned(attackVars.melee.total);
    if (rangedOut) rangedOut.value = fmtSigned(attackVars.ranged.total);
  }

  function getAvailableAttackCount() {
    const bab = Math.max(0, Math.trunc(num(document.getElementById("atk-bab")?.value)));
    return Math.max(1, Math.floor(Math.max(0, bab - 1) / 5) + 1);
  }

  function buildAttackSequenceOptions() {
    const count = getAvailableAttackCount();
    const bab = Math.max(0, Math.trunc(num(document.getElementById("atk-bab")?.value)));
    const options = [];
    for (let i = 0; i < count; i++) {
      options.push({
        value: String(i),
        label: `${i + 1}°`,
        babValue: Math.max(0, bab - i * 5),
        penalty: i * 5,
      });
    }
    return options;
  }

  function refreshAttackSequenceSelectors() {
    const options = buildAttackSequenceOptions();
    $$(".atk-sequence", attacksTbody || document).forEach((sel) => {
      const current = String(sel.value || "0");
      sel.innerHTML = "";
      options.forEach((opt) => {
        const option = document.createElement("option");
        option.value = opt.value;
        option.textContent = `${opt.label} (${fmtSigned(opt.babValue)})`;
        if (opt.value === current) option.selected = true;
        sel.appendChild(option);
      });
      if (![...sel.options].some((opt) => opt.value === current)) sel.value = "0";
      sel.disabled = options.length <= 1;
    });
  }

  function recalcCmbCmd() {
    const cmbEl = document.getElementById("cmb");
    const cmdEl = document.getElementById("cmd");
    const babEl = document.getElementById("atk-bab");
    if (!cmbEl || !cmdEl || !babEl) return;

    const bab = num(babEl.value);
    const str = getAbilityModByCode("FOR");
    const dex = getAbilityModByCode("DES");
    const size = getCurrentSizeMods().cmbCmd;

    const cmb = bab + str + size;
    const cmd = 10 + bab + str + dex + size;

    cmbEl.value = fmtSigned(cmb);
    cmdEl.value = String(cmd);
  }

  function formatDamageFormula(diceCount, dieSize, dmgBonus) {
    const count = Math.max(1, Math.trunc(num(diceCount)));
    const die = Math.max(2, Math.trunc(num(dieSize)));
    const bonus = Math.trunc(num(dmgBonus));
    const base = `${count}d${die}`;
    if (bonus === 0) return base;
    return `${base}${bonus > 0 ? "+" : ""}${bonus}`;
  }

  function computePowerAttackStep(babValue) {
    const bab = Math.max(0, Math.trunc(num(babValue)));
    if (bab < 1) return 0;
    return 1 + Math.floor((bab - 1) / 4);
  }

  function formatCritFormula(rangeStart, mult) {
    const start = Math.max(2, Math.min(20, Math.trunc(num(rangeStart))));
    const critRange = start === 20 ? "20" : `${start}-20`;
    const critMult = Math.max(2, Math.min(4, Math.trunc(num(mult))));
    return `${critRange}/x${critMult}`;
  }

  function getAttackDamageRow(hitRow) {
    if (!hitRow) return null;
    const next = hitRow.nextElementSibling;
    return next?.classList?.contains("attack-row-dmg") ? next : null;
  }

  function syncAttackRowDerivedFields(tr) {
    if (!tr) return;
    const dmgRow = getAttackDamageRow(tr);
    if (!dmgRow) return { attackPenalty: 0 };
    const diceCount = dmgRow.querySelector(".atk-dice-count")?.value;
    const dieSize = dmgRow.querySelector(".atk-die")?.value;
    const type = tr.querySelector(".atk-type")?.value || "melee";
    const isMelee = type === "melee";
    const meleeOnly = Array.from(dmgRow.querySelectorAll(".atk-melee-only"));
    meleeOnly.forEach((el) => {
      el.hidden = !isMelee;
      el.setAttribute("aria-hidden", String(!isMelee));
    });

    const twoHandsEl = dmgRow.querySelector(".atk-twohands");
    const powerAttackEl = dmgRow.querySelector(".atk-power-attack");
    const furiousFocusEl = dmgRow.querySelector(".atk-furious-focus");

    const twoHands = isMelee && !!twoHandsEl?.checked;
    const powerAttack = isMelee && !!powerAttackEl?.checked;
    const furiousFocus = isMelee && !!furiousFocusEl?.checked;
    const magicBonus = clamp(Math.trunc(num(tr.querySelector(".atk-magic-bonus")?.value)), 0, 5);

    const strMod = getAbilityModByCode("FOR");
    const strToDamage = isMelee ? (twoHands ? Math.trunc(strMod * 1.5) : strMod) : 0;
    const bab = num(document.getElementById("atk-bab")?.value);
    const paStep = computePowerAttackStep(bab);
    const paDamage = powerAttack ? paStep * (twoHands ? 3 : 2) : 0;
    const attackPenaltyRaw = powerAttack ? paStep : 0;
    const attackPenalty = furiousFocus ? 0 : attackPenaltyRaw;

    const dmgBonus = strToDamage + paDamage + magicBonus;
    const critRange = dmgRow.querySelector(".atk-crit-range")?.value;
    const critMult = dmgRow.querySelector(".atk-crit-mult")?.value;

    const dmgFormula = formatDamageFormula(diceCount, dieSize, dmgBonus);
    tr.dataset.dmgFormula = dmgFormula;

    const dmgTotalOut = dmgRow.querySelector(".atk-dmg-total");
    if (dmgTotalOut) dmgTotalOut.value = dmgFormula;

    const critOut = dmgRow.querySelector(".atk-crit");
    if (critOut) critOut.value = formatCritFormula(critRange, critMult);
    return { attackPenalty };
  }

  function getCompAttackDamageRow(hitRow) {
    if (!hitRow) return null;
    const next = hitRow.nextElementSibling;
    return next?.classList?.contains("comp-attack-row-dmg") ? next : null;
  }

  function syncCompAttackRowDerivedFields(tr) {
    if (!tr) return;
    const dmgRow = getCompAttackDamageRow(tr);
    if (!dmgRow) return;
    const diceCount = dmgRow.querySelector(".comp-atk-dice-count")?.value;
    const dieSize = dmgRow.querySelector(".comp-atk-die")?.value;
    const type = tr.querySelector(".comp-atk-type")?.value || "melee";
    const strMod = num(document.getElementById("comp-atk-str-mod")?.value);
    const dmgBonus = type === "melee" ? strMod : 0;
    const critRange = dmgRow.querySelector(".comp-atk-crit-range")?.value;
    const critMult = dmgRow.querySelector(".comp-atk-crit-mult")?.value;

    const dmgFormula = formatDamageFormula(diceCount, dieSize, dmgBonus);
    tr.dataset.dmgFormula = dmgFormula;

    const dmgTotalOut = dmgRow.querySelector(".comp-atk-dmg-total");
    if (dmgTotalOut) dmgTotalOut.value = dmgFormula;

    const critOut = dmgRow.querySelector(".comp-atk-crit");
    if (critOut) critOut.value = formatCritFormula(critRange, critMult);
  }

  function recalcAttackRow(tr, attackVars = buildAttackBaseVariables()) {
    if (!tr) return;
    const derived = syncAttackRowDerivedFields(tr);
    const type = tr.querySelector(".atk-type")?.value || "melee";
    const sequenceIndex = Math.max(0, Math.trunc(num(tr.querySelector(".atk-sequence")?.value)));
    const magicBonus = clamp(Math.trunc(num(tr.querySelector(".atk-magic-bonus")?.value)), 0, 5);
    const rowMisc = num(tr.querySelector(".atk-row-misc")?.value);
    const base = type === "ranged" ? attackVars.ranged.total : attackVars.melee.total;
    const iterativePenalty = sequenceIndex * 5;
    const total = base + magicBonus + rowMisc - num(derived?.attackPenalty) - iterativePenalty;
    const out = tr.querySelector(".atk-total");
    if (out) out.value = fmtSigned(total);
  }

  function recalcAllAttacks() {
    const attackVars = buildAttackBaseVariables();
    syncAttackBaseTotals(attackVars);
    if (!attacksTbody) return;
    attacksTbody.querySelectorAll(".attack-row").forEach((row) => recalcAttackRow(row, attackVars));
  }

  function buildFullAttackBonuses(totalToHit, babValue) {
    const total = Math.trunc(num(totalToHit));
    const bab = Math.max(0, Math.trunc(num(babValue)));
    const attacksCount = Math.max(1, Math.floor((Math.max(1, bab) - 1) / 5) + 1);
    const bonuses = [];
    for (let i = 0; i < attacksCount; i++) bonuses.push(total - 5 * i);
    return bonuses;
  }

  function rollFullAttackSequence(totalToHit, babValue, label) {
    const bonuses = buildFullAttackBonuses(totalToHit, babValue);
    bonuses.forEach((bonus, idx) => {
      rollViaTaleSpire(bonus, `${label} Full #${idx + 1}`);
    });
  }

  function getAtkExtraCount() {
    return parseInt(localStorage.getItem(ATK_STORAGE_KEY) || "0", 10) || 0;
  }
  function setAtkExtraCount(n) {
    localStorage.setItem(ATK_STORAGE_KEY, String(Math.max(0, n)));
  }

  function makeAttackRow() {
    const hitRow = document.createElement("tr");
    hitRow.className = "attack-row attack-row-extra";
    hitRow.innerHTML = `
      <td>
        <select class="select atk-type">
          <option value="melee" selected>Mischia (FOR)</option>
          <option value="ranged">Distanza (DES)</option>
        </select>
      </td>
      <td>
        <select class="select atk-sequence">
          <option value="0" selected>1°</option>
        </select>
      </td>
      <td>
        <select class="select atk-magic-bonus">
          <option value="0" selected>+0</option>
          <option value="1">+1</option>
          <option value="2">+2</option>
          <option value="3">+3</option>
          <option value="4">+4</option>
          <option value="5">+5</option>
        </select>
      </td>
      <td><input class="small atk-row-misc" type="number" step="1" value="0" /></td>
      <td><input class="small atk-total" type="text" value="+0" readonly /></td>
    `;

    const dmgRow = document.createElement("tr");
    dmgRow.className = "attack-row-dmg attack-row-dmg-extra";
    dmgRow.innerHTML = `
      <td colspan="5">
        <div class="attack-dmg-line">
          <div class="attack-main">
            <div class="attack-groups">
              <div class="attack-group">
                <span class="attack-subtitle">Danni</span>
                <div class="attack-dmg-inline">
                  <div class="atk-dmg-builder">
                    <input class="small atk-dice-count" type="number" min="1" step="1" value="1" title="Numero dadi" />
                    <select class="select atk-die" title="Tipo dado">
                      <option value="4">d4</option>
                      <option value="6">d6</option>
                      <option value="8" selected>d8</option>
                      <option value="10">d10</option>
                      <option value="12">d12</option>
                    </select>
                  </div>
                  <input class="small atk-dmg-total" type="text" value="1d8+0" readonly title="Riepilogo danni calcolati" />
                </div>
              </div>
              <div class="attack-group">
                <span class="attack-subtitle">Critico</span>
                <div class="atk-crit-builder">
                  <select class="select atk-crit-range" title="Minaccia critico">
                    <option value="20" selected>20</option>
                    <option value="19">19-20</option>
                    <option value="18">18-20</option>
                    <option value="17">17-20</option>
                  </select>
                  <select class="select atk-crit-mult" title="Moltiplicatore critico">
                    <option value="2" selected>x2</option>
                    <option value="3">x3</option>
                    <option value="4">x4</option>
                  </select>
                </div>
              </div>
            </div>
            <div class="attack-flags">
              <label class="attack-flag atk-melee-only">
                <input class="atk-twohands" type="checkbox" />
                2 mani
              </label>
              <label class="attack-flag atk-melee-only">
                <input class="atk-power-attack" type="checkbox" />
                Attacco Poderoso
              </label>
              <label class="attack-flag atk-melee-only">
                <input class="atk-furious-focus" type="checkbox" />
                Furia Focalizzata
              </label>
            </div>
          </div>
          <div class="attack-roll-line">
            <button type="button" class="roll-btn atk-roll-btn" title="Tira 1d20 + Tot">Tiro</button>
            <button type="button" class="roll-btn atk-dmg-roll-btn" title="Tira danni">Danni</button>
          </div>
        </div>
      </td>
    `;

    return { hitRow, dmgRow };
  }

  function rebuildAttackExtraRows() {
    if (!attacksTbody) return;
    const n = getAtkExtraCount();
    for (let i = 0; i < n; i++) {
      const { hitRow, dmgRow } = makeAttackRow();
      attacksTbody.appendChild(hitRow);
      attacksTbody.appendChild(dmgRow);
      applySavedValues(hitRow);
      applySavedValues(dmgRow);
      wireAutosave(hitRow);
      wireAutosave(dmgRow);
    }
    refreshAttackSequenceSelectors();
    recalcAllAttacks();
  }

  rebuildAttackExtraRows();
  refreshAttackSequenceSelectors();

  if (addAtkBtn && attacksTbody) {
    addAtkBtn.addEventListener("click", () => {
      const { hitRow, dmgRow } = makeAttackRow();
      attacksTbody.appendChild(hitRow);
      attacksTbody.appendChild(dmgRow);
      setAtkExtraCount(getAtkExtraCount() + 1);
      applySavedValues(hitRow);
      applySavedValues(dmgRow);
      wireAutosave(hitRow);
      wireAutosave(dmgRow);
      refreshAttackSequenceSelectors();
      recalcAttackRow(hitRow);
    });
  }

  if (remAtkBtn && attacksTbody) {
    remAtkBtn.addEventListener("click", () => {
      const extras = attacksTbody.querySelectorAll(".attack-row-extra");
      if (!extras.length) return;
      const lastHit = extras[extras.length - 1];
      const lastDmg = getAttackDamageRow(lastHit);
      [lastHit, lastDmg].forEach((row) => {
        if (!row) return;
        row.querySelectorAll("input, textarea, select").forEach((el) => delete state[keyFor(el)]);
      });
      saveState(state);
      if (lastDmg) lastDmg.remove();
      lastHit.remove();
      setAtkExtraCount(getAtkExtraCount() - 1);
      recalcAllAttacks();
    });
  }

  /* =========================
     Attacchi Compagno — tabella dinamica (FOR/DES)
  ========================= */
  const compAttacksTbody = document.getElementById("comp-attacks-tbody");
  const addCompAtkBtn = document.getElementById("add-comp-attack-row");
  const remCompAtkBtn = document.getElementById("remove-comp-attack-row");

  function getCompAtkGlobals() {
    return {
      bab: num(document.getElementById("comp-atk-bab")?.value),
      size: getCurrentSizeMods().acAtk,
      misc: num(document.getElementById("comp-atk-misc")?.value),
      str: num(document.getElementById("comp-atk-str-mod")?.value),
      dex: num(document.getElementById("comp-atk-dex-mod")?.value),
    };
  }

  function getCompAvailableAttackCount() {
    const bab = Math.max(0, Math.trunc(num(document.getElementById("comp-atk-bab")?.value)));
    return Math.max(1, Math.floor(Math.max(0, bab - 1) / 5) + 1);
  }

  function buildCompAttackSequenceOptions() {
    const count = getCompAvailableAttackCount();
    const bab = Math.max(0, Math.trunc(num(document.getElementById("comp-atk-bab")?.value)));
    const options = [];
    for (let i = 0; i < count; i++) {
      options.push({
        value: String(i),
        label: `${i + 1}°`,
        babValue: Math.max(0, bab - i * 5),
      });
    }
    return options;
  }

  function refreshCompAttackSequenceSelectors() {
    const options = buildCompAttackSequenceOptions();
    $$(".comp-atk-sequence", compAttacksTbody || document).forEach((sel) => {
      const current = String(sel.value || "0");
      sel.innerHTML = "";
      options.forEach((opt) => {
        const option = document.createElement("option");
        option.value = opt.value;
        option.textContent = `${opt.label} (${fmtSigned(opt.babValue)})`;
        if (opt.value === current) option.selected = true;
        sel.appendChild(option);
      });
      if (![...sel.options].some((opt) => opt.value === current)) sel.value = "0";
      sel.disabled = options.length <= 1;
    });
  }

  function recalcCompAttackRow(tr) {
    if (!tr) return;
    syncCompAttackRowDerivedFields(tr);
    const type = tr.querySelector(".comp-atk-type")?.value || "melee";
    const sequenceIndex = Math.max(0, Math.trunc(num(tr.querySelector(".comp-atk-sequence")?.value)));
    const rowMisc = num(tr.querySelector(".comp-atk-row-misc")?.value);

    const { bab, size, misc, str, dex } = getCompAtkGlobals();
    const abil = type === "ranged" ? dex : str;

    const total = bab + abil + size + misc + rowMisc - sequenceIndex * 5;
    const out = tr.querySelector(".comp-atk-total");
    if (out) out.value = fmtSigned(total);
  }

  function recalcAllCompAttacks() {
    if (!compAttacksTbody) return;
    compAttacksTbody.querySelectorAll(".comp-attack-row").forEach(recalcCompAttackRow);
  }

  function getCompAtkExtraCount() {
    return parseInt(localStorage.getItem(COMP_ATK_STORAGE_KEY) || "0", 10) || 0;
  }
  function setCompAtkExtraCount(n) {
    localStorage.setItem(COMP_ATK_STORAGE_KEY, String(Math.max(0, n)));
  }

  function makeCompAttackRow() {
    const hitRow = document.createElement("tr");
    hitRow.className = "comp-attack-row comp-attack-row-extra";
    hitRow.innerHTML = `
      <td>
        <select class="select comp-atk-type">
          <option value="melee" selected>Mischia (FOR)</option>
          <option value="ranged">Distanza (DES)</option>
        </select>
      </td>
      <td>
        <select class="select comp-atk-sequence">
          <option value="0" selected>1°</option>
        </select>
      </td>
      <td><input class="small comp-atk-row-misc" type="number" step="1" value="0" /></td>
      <td><input class="small comp-atk-total" type="text" value="+0" readonly /></td>
    `;

    const dmgRow = document.createElement("tr");
    dmgRow.className = "comp-attack-row-dmg comp-attack-row-dmg-extra";
    dmgRow.innerHTML = `
      <td colspan="4">
        <div class="attack-dmg-line">
          <div class="attack-main">
            <div class="attack-groups">
              <div class="attack-group">
                <span class="attack-subtitle">Danni</span>
                <div class="attack-dmg-inline">
                  <div class="atk-dmg-builder">
                    <input class="small comp-atk-dice-count" type="number" min="1" step="1" value="1" title="Numero dadi" />
                    <select class="select comp-atk-die" title="Tipo dado">
                      <option value="4">d4</option>
                      <option value="6" selected>d6</option>
                      <option value="8">d8</option>
                      <option value="10">d10</option>
                      <option value="12">d12</option>
                    </select>
                  </div>
                  <input class="small atk-dmg-total comp-atk-dmg-total" type="text" value="1d6+0" readonly title="Riepilogo danni calcolati" />
                </div>
              </div>
              <div class="attack-group">
                <span class="attack-subtitle">Critico</span>
                <div class="atk-crit-builder">
                  <select class="select comp-atk-crit-range" title="Minaccia critico">
                    <option value="20" selected>20</option>
                    <option value="19">19-20</option>
                    <option value="18">18-20</option>
                    <option value="17">17-20</option>
                  </select>
                  <select class="select comp-atk-crit-mult" title="Moltiplicatore critico">
                    <option value="2" selected>x2</option>
                    <option value="3">x3</option>
                    <option value="4">x4</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          <div class="attack-roll-line">
            <button type="button" class="roll-btn comp-atk-roll-btn" title="Tira 1d20 + Tot">Tiro</button>
            <button type="button" class="roll-btn comp-atk-dmg-roll-btn" title="Tira danni">Danni</button>
          </div>
        </div>
      </td>
    `;
    return { hitRow, dmgRow };
  }

  function rebuildCompAttackExtraRows() {
    if (!compAttacksTbody) return;
    const n = getCompAtkExtraCount();
    for (let i = 0; i < n; i++) {
      const { hitRow, dmgRow } = makeCompAttackRow();
      compAttacksTbody.appendChild(hitRow);
      compAttacksTbody.appendChild(dmgRow);
      applySavedValues(hitRow);
      applySavedValues(dmgRow);
      wireAutosave(hitRow);
      wireAutosave(dmgRow);
    }
    refreshCompAttackSequenceSelectors();
    recalcAllCompAttacks();
  }

  rebuildCompAttackExtraRows();
  refreshCompAttackSequenceSelectors();

  if (addCompAtkBtn && compAttacksTbody) {
    addCompAtkBtn.addEventListener("click", () => {
      const { hitRow, dmgRow } = makeCompAttackRow();
      compAttacksTbody.appendChild(hitRow);
      compAttacksTbody.appendChild(dmgRow);
      setCompAtkExtraCount(getCompAtkExtraCount() + 1);
      applySavedValues(hitRow);
      applySavedValues(dmgRow);
      wireAutosave(hitRow);
      wireAutosave(dmgRow);
      refreshCompAttackSequenceSelectors();
      recalcCompAttackRow(hitRow);
    });
  }

  if (remCompAtkBtn && compAttacksTbody) {
    remCompAtkBtn.addEventListener("click", () => {
      const extras = compAttacksTbody.querySelectorAll(".comp-attack-row-extra");
      if (!extras.length) return;
      const lastHit = extras[extras.length - 1];
      const lastDmg = getCompAttackDamageRow(lastHit);
      [lastHit, lastDmg].forEach((row) => {
        if (!row) return;
        row.querySelectorAll("input, textarea, select").forEach((el) => delete state[keyFor(el)]);
      });
      saveState(state);
      if (lastDmg) lastDmg.remove();
      lastHit.remove();
      setCompAtkExtraCount(getCompAtkExtraCount() - 1);
      refreshCompAttackSequenceSelectors();
      recalcAllCompAttacks();
    });
  }

  /* =========================
     Skills — calcolo + filtri + righe extra + auto-CS + roll
  ========================= */
  const skillsTbody = document.getElementById("skills-tbody");
  const addSkillBtn = document.getElementById("add-skill-row");
  const addKnowledgeBtn = document.getElementById("add-knowledge-row");
  const remSkillBtn = document.getElementById("remove-skill-row");

  function normSkillName(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[’']/g, "'");
  }

  const SKILL_ALIASES = {
    osservare: "percezione",
    ascoltare: "percezione",
    "senso motivazioni": "intuizione",
    "utilizzare oggetti magici": "utilizzare congegni magici",
    furtivita: "furtività",
  };

  function canonicalSkill(name) {
    const n = normSkillName(name);
    return SKILL_ALIASES[n] || n;
  }

  const CLASS_SKILLS = {
    Barbaro: ["acrobazia","addestrare animali","artigianato","cavalcare","intimidire","nuotare","percezione","scalare","sopravvivenza"],
    Bardo: ["acrobazia","addestrare animali","artigianato","artista della fuga","camuffare","diplomazia","furtività","intimidire","intrattenere","linguistica","percezione","professione","raggirare","rapidità di mano","sapienza magica","intuizione","utilizzare congegni magici","valutare","conoscenze (tutte)"],
    Chierico: ["artigianato","diplomazia","guarire","linguistica","professione","sapienza magica","intuizione","conoscenze (arcane)","conoscenze (nobiltà)","conoscenze (piani)","conoscenze (religioni)"],
    Druido: ["addestrare animali","artigianato","cavalcare","guarire","percezione","professione","sapienza magica","sopravvivenza","conoscenze (natura)"],
    Guerriero: ["addestrare animali","artigianato","cavalcare","intimidire","nuotare","professione","scalare","sopravvivenza"],
    Ladro: ["acrobazia","artista della fuga","camuffare","diplomazia","disattivare congegni","furtività","intimidire","intrattenere","linguistica","nuotare","percezione","raggirare","rapidità di mano","scalare","intuizione","utilizzare congegni magici","valutare","conoscenze (dungeon)","conoscenze (locali)"],
    Mago: ["artigianato","linguistica","professione","sapienza magica","conoscenze (tutte)"],
    Monaco: ["acrobazia","artigianato","artista della fuga","intimidire","nuotare","percezione","professione","scalare","intuizione"],
    Paladino: ["addestrare animali","artigianato","cavalcare","diplomazia","guarire","professione","sapienza magica","intuizione","conoscenze (nobiltà)","conoscenze (religioni)"],
    Ranger: ["addestrare animali","artigianato","cavalcare","furtività","guarire","intimidire","nuotare","percezione","professione","scalare","sopravvivenza","conoscenze (dungeon)","conoscenze (geografia)","conoscenze (natura)"],
    Stregone: ["artigianato","conoscenze (arcane)","professione","sapienza magica","utilizzare congegni magici"],
  };

  const PRESTIGE_CLASS_OPTIONS = [
    "Arcane Archer",
    "Arcane Trickster",
    "Dragon Disciple",
    "Duelist",
    "Eldritch Knight",
    "Evangelist",
    "Exalted",
    "Hellknight",
    "Hellknight Signifer",
    "Holy Vindicator",
    "Loremaster",
    "Mystic Theurge",
    "Pathfinder Chronicler",
    "Red Mantis Assassin",
    "Sentinel",
    "Shadowdancer",
  ];

  const PRESTIGE_CLASS_DATA = {
    "Arcane Archer": { bab: "full", hitDie: 10, skillPoints: 4, saves: { fort: "good", ref: "good", will: "poor" }, classSkills: "Artigianato, Cavalcare, Intimidire, Percezione, Sopravvivenza", featuresByLevel: {} },
    "Arcane Trickster": { bab: "half", hitDie: 6, skillPoints: 4, saves: { fort: "poor", ref: "good", will: "good" }, classSkills: "Artista della Fuga, Conoscenze (arcane), Disattivare Congegni, Furtività, Percezione, Rapidità di Mano, Raggirare, Sapienza Magica", featuresByLevel: {} },
    "Dragon Disciple": { bab: "three_quarters", hitDie: 12, skillPoints: 2, saves: { fort: "good", ref: "poor", will: "good" }, classSkills: "Artigianato, Conoscenze (arcane), Percezione, Sapienza Magica, Volare", featuresByLevel: {} },
    Duelist: { bab: "full", hitDie: 10, skillPoints: 4, saves: { fort: "poor", ref: "good", will: "poor" }, classSkills: "Acrobazia, Artista della Fuga, Diplomazia, Intuizione, Percezione, Raggirare, Rapidità di Mano", featuresByLevel: {} },
    "Eldritch Knight": { bab: "full", hitDie: 10, skillPoints: 2, saves: { fort: "good", ref: "poor", will: "poor" }, classSkills: "Conoscenze (arcane), Cavalcare, Intimidire, Sapienza Magica, Scalare", featuresByLevel: {} },
    Evangelist: { bab: "three_quarters", hitDie: 8, skillPoints: 6, saves: { fort: "poor", ref: "poor", will: "good" }, classSkills: "Artigianato, Diplomazia, Guarire, Intuizione, Conoscenze (religioni), Professione, Sapienza Magica", featuresByLevel: {} },
    Exalted: { bab: "three_quarters", hitDie: 8, skillPoints: 4, saves: { fort: "good", ref: "poor", will: "good" }, classSkills: "Diplomazia, Guarire, Intimidire, Conoscenze (nobiltà), Conoscenze (religioni), Percezione, Professione, Intuizione", featuresByLevel: {} },
    Hellknight: { bab: "full", hitDie: 10, skillPoints: 2, saves: { fort: "good", ref: "poor", will: "good" }, classSkills: "Artigianato, Cavalcare, Diplomazia, Intimidire, Conoscenze (piani), Professione, Intuizione", featuresByLevel: {} },
    "Hellknight Signifer": { bab: "three_quarters", hitDie: 8, skillPoints: 2, saves: { fort: "poor", ref: "poor", will: "good" }, classSkills: "Conoscenze (arcane), Conoscenze (piani), Linguistica, Professione, Sapienza Magica, Utilizzare Congegni Magici", featuresByLevel: {} },
    "Holy Vindicator": { bab: "full", hitDie: 10, skillPoints: 2, saves: { fort: "good", ref: "poor", will: "good" }, classSkills: "Diplomazia, Guarire, Intimidire, Conoscenze (religioni), Professione, Sapienza Magica", featuresByLevel: {} },
    Loremaster: { bab: "half", hitDie: 6, skillPoints: 2, saves: { fort: "poor", ref: "poor", will: "good" }, classSkills: "Conoscenze (tutte), Linguistica, Sapienza Magica, Valutare", featuresByLevel: {} },
    "Mystic Theurge": { bab: "half", hitDie: 6, skillPoints: 2, saves: { fort: "poor", ref: "poor", will: "good" }, classSkills: "Conoscenze (arcane), Conoscenze (religioni), Professione, Sapienza Magica", featuresByLevel: {} },
    "Pathfinder Chronicler": { bab: "three_quarters", hitDie: 8, skillPoints: 6, saves: { fort: "poor", ref: "good", will: "good" }, classSkills: "Diplomazia, Furtività, Intrattenere, Linguistica, Percezione, Professione, Sapienza Magica, Utilizzare Congegni Magici", featuresByLevel: {} },
    "Red Mantis Assassin": { bab: "three_quarters", hitDie: 8, skillPoints: 4, saves: { fort: "poor", ref: "good", will: "poor" }, classSkills: "Acrobazia, Camuffare, Furtività, Intimidire, Percezione, Raggirare, Scalare", featuresByLevel: {} },
    Sentinel: { bab: "full", hitDie: 10, skillPoints: 2, saves: { fort: "good", ref: "poor", will: "good" }, classSkills: "Cavalcare, Diplomazia, Guarire, Intimidire, Percezione, Professione, Intuizione, Sopravvivenza", featuresByLevel: {} },
    Shadowdancer: { bab: "three_quarters", hitDie: 8, skillPoints: 4, saves: { fort: "poor", ref: "good", will: "poor" }, classSkills: "Acrobazia, Artista della Fuga, Furtività, Percezione, Rapidità di Mano, Sapienza Magica", featuresByLevel: {} },
  };

  function getPrestigeClassData(name) {
    return PRESTIGE_CLASS_DATA[String(name || "").trim()] || null;
  }

  function formatBabProgressionLabel(key) {
    if (key === "full") return "Pieno";
    if (key === "three_quarters" || key === "two_thirds") return "Medio";
    if (key === "half") return "Scarso";
    return "—";
  }

  function getSaveBonusByProgression(level, progression) {
    const lvl = Math.max(0, Math.trunc(num(level)));
    if (lvl <= 0) return 0;
    return progression === "good" ? 2 + Math.floor(lvl / 2) : Math.floor(lvl / 3);
  }

  function formatSaveProgressionLabel(saves) {
    if (!saves) return "—";
    const short = (key) => (key === "good" ? "B" : "S");
    return `${short(saves.fort)} / ${short(saves.ref)} / ${short(saves.will)}`;
  }

  function initPrestigeClassSelects() {
    $$(".prestige-class-select").forEach((sel) => {
      const saved = Object.prototype.hasOwnProperty.call(state, keyFor(sel)) ? state[keyFor(sel)] : sel.value;
      const current = String(saved || "").trim();
      sel.innerHTML = '<option value="" selected>— Seleziona CdP —</option>';
      PRESTIGE_CLASS_OPTIONS.forEach((name) => {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        if (name === current) option.selected = true;
        sel.appendChild(option);
      });
    });
  }

  function updatePrestigeDerivedFields() {
    const prestigeName =
      String(document.getElementById("cdp-name")?.value || document.getElementById("cdp-name-tab")?.value || "").trim();
    const prestigeLevel = Math.max(
      0,
      Math.trunc(
        num(document.getElementById("cdp-level")?.value || document.getElementById("cdp-level-tab")?.value)
      )
    );
    const data = getPrestigeClassData(prestigeName);
    const babEl = document.getElementById("cdp-bab-progression");
    const hitDieEl = document.getElementById("cdp-hit-die");
    const saveEl = document.getElementById("cdp-save-progression");
    const skillsEl = document.getElementById("cdp-class-skills");
    const summaryBody = document.getElementById("cdp-summary-body");
    if (babEl) babEl.value = data ? formatBabProgressionLabel(data.bab) : "—";
    if (hitDieEl) hitDieEl.value = data ? `d${data.hitDie}` : "—";
    if (saveEl) saveEl.value = data ? formatSaveProgressionLabel(data.saves) : "—";
    if (skillsEl) skillsEl.value = data?.classSkills || "";
    if (summaryBody) {
      summaryBody.innerHTML = "";
      if (data && prestigeLevel > 0) {
        for (let level = 1; level <= prestigeLevel; level++) {
          const tr = document.createElement("tr");
          const featureText = String(data.featuresByLevel?.[level] || "Da compilare");
          tr.innerHTML = `
            <td>${level}</td>
            <td>${featureText}</td>
          `;
          summaryBody.appendChild(tr);
        }
      }
    }
  }

  const BASE_SKILLS = [
    { name: "Acrobazia", abil: "DES", acp: true },
    { name: "Addestrare Animali", abil: "CAR", acp: false },
    { name: "Artigianato (Alchimia)", abil: "INT", acp: false },
    { name: "Artista della Fuga", abil: "DES", acp: true },
    { name: "Camuffare", abil: "CAR", acp: false },
    { name: "Cavalcare", abil: "DES", acp: true },
    { name: "Conoscenze (Arcane)", abil: "INT", acp: false },
    { name: "Conoscenze (Dungeon)", abil: "INT", acp: false },
    { name: "Conoscenze (Geografia)", abil: "INT", acp: false },
    { name: "Conoscenze (Ingegneria)", abil: "INT", acp: false },
    { name: "Conoscenze (Locali)", abil: "INT", acp: false },
    { name: "Conoscenze (Natura)", abil: "INT", acp: false },
    { name: "Conoscenze (Nobiltà)", abil: "INT", acp: false },
    { name: "Conoscenze (Piani)", abil: "INT", acp: false },
    { name: "Conoscenze (Religioni)", abil: "INT", acp: false },
    { name: "Diplomazia", abil: "CAR", acp: false },
    { name: "Disattivare Congegni", abil: "DES", acp: false },
    { name: "Furtività", abil: "DES", acp: true },
    { name: "Guarire", abil: "SAG", acp: false },
    { name: "Intimidire", abil: "CAR", acp: false },
    { name: "Intuizione", abil: "SAG", acp: false },
    { name: "Intrattenere (Canto)", abil: "CAR", acp: false },
    { name: "Linguistica", abil: "INT", acp: false },
    { name: "Nuotare", abil: "FOR", acp: true },
    { name: "Percezione", abil: "SAG", acp: false },
    { name: "Professione (Soldato)", abil: "SAG", acp: false },
    { name: "Raggirare", abil: "CAR", acp: false },
    { name: "Rapidità di Mano", abil: "DES", acp: false },
    { name: "Sapienza Magica", abil: "INT", acp: false },
    { name: "Scalare", abil: "FOR", acp: true },
    { name: "Sopravvivenza", abil: "SAG", acp: false },
    { name: "Utilizzare Congegni Magici", abil: "CAR", acp: false },
    { name: "Valutare", abil: "INT", acp: false },
    { name: "Volare", abil: "DES", acp: true },
  ];

  function getClassEntries() {
    return $$('.class-entry-row[data-class-slot="1"], .class-entry-row[data-class-slot="2"], .class-entry-row[data-class-slot="3"]')
      .map((row) => {
        const className = String(row.querySelector(".class-row-select")?.value || "").trim();
        const level = Math.max(0, Math.trunc(num(row.querySelector(".class-row-level")?.value)));
        return { className, level };
      })
      .filter((entry) => entry.className && entry.level > 0);
  }

  function getPrestigeEntry() {
    const className = String(document.getElementById("cdp-name")?.value || "").trim();
    const level = Math.max(0, Math.trunc(num(document.getElementById("cdp-level")?.value)));
    if (!enableCdpSection?.checked || !className || level <= 0) return null;
    const data = getPrestigeClassData(className);
    return {
      className,
      level,
      babProgression: data?.bab || "half",
      hitDie: data?.hitDie || 8,
      isPrestige: true,
    };
  }

  let isPrestigeSyncing = false;

  function syncPrestigeFields(source = "card") {
    if (isPrestigeSyncing) return;
    isPrestigeSyncing = true;

    const cardNameEl = document.getElementById("cdp-name");
    const cardLevelEl = document.getElementById("cdp-level");
    const tabNameEl = document.getElementById("cdp-name-tab");
    const tabLevelEl = document.getElementById("cdp-level-tab");

    if (source === "tab") {
      if (cardNameEl && tabNameEl) cardNameEl.value = tabNameEl.value;
      if (cardLevelEl && tabLevelEl) cardLevelEl.value = tabLevelEl.value;
    } else {
      if (tabNameEl && cardNameEl) tabNameEl.value = cardNameEl.value;
      if (tabLevelEl && cardLevelEl) tabLevelEl.value = cardLevelEl.value;
    }

    updatePrestigeDerivedFields();
    isPrestigeSyncing = false;
  }

  function parseClassSkillsText(rawSkills = "") {
    return String(rawSkills || "")
      .split(",")
      .map((skill) => canonicalSkill(skill.trim()))
      .filter(Boolean);
  }

  function getSelectedSkillSources() {
    const baseClasses = getClassEntries().map((entry) => entry.className);
    const prestigeEntry = getPrestigeEntry();
    const prestigeClasses = prestigeEntry ? [prestigeEntry.className] : [];
    return Array.from(new Set([...baseClasses, ...prestigeClasses].filter(Boolean)));
  }

  function getSelectedClasses() {
    return Array.from(new Set(getClassEntries().map((entry) => entry.className)));
  }

  function getCardClassLevelInputs() {
    return $$(".class-entry-row .class-row-level");
  }

  function resolveCardLevelInput(inputEl) {
    if (!inputEl) return null;
    if (inputEl.id === "cdp-level-tab") return document.getElementById("cdp-level");
    return inputEl;
  }

  function enforceCharacterLevelCap(preferredInput = null) {
    const levelInputs = getCardClassLevelInputs();
    if (!levelInputs.length) return;

    const values = new Map(levelInputs.map((input) => [input, Math.max(0, Math.trunc(num(input.value)))]));
    let total = Array.from(values.values()).reduce((sum, value) => sum + value, 0);
    if (total <= MAX_CHARACTER_LEVEL) return;

    const preferredCardInput = resolveCardLevelInput(preferredInput);
    const orderedInputs = [];
    if (preferredCardInput && values.has(preferredCardInput)) orderedInputs.push(preferredCardInput);
    levelInputs
      .slice()
      .reverse()
      .forEach((input) => {
        if (!orderedInputs.includes(input)) orderedInputs.push(input);
      });

    let excess = total - MAX_CHARACTER_LEVEL;
    orderedInputs.forEach((input) => {
      if (excess <= 0) return;
      const current = values.get(input) || 0;
      if (current <= 0) return;
      const reduction = Math.min(current, excess);
      const nextValue = current - reduction;
      input.value = String(nextValue);
      values.set(input, nextValue);
      excess -= reduction;
    });
  }

  function refreshClassLevelCaps() {
    const levelInputs = getCardClassLevelInputs();
    if (!levelInputs.length) return;

    levelInputs.forEach((input) => {
      const current = Math.max(0, Math.trunc(num(input.value)));
      const othersTotal = levelInputs.reduce((sum, other) => {
        if (other === input) return sum;
        return sum + Math.max(0, Math.trunc(num(other.value)));
      }, 0);
      const hardMax = input.id === "cdp-level" ? 10 : MAX_CHARACTER_LEVEL;
      const dynamicMax = Math.min(hardMax, Math.max(0, MAX_CHARACTER_LEVEL - othersTotal + current));
      input.max = String(dynamicMax);
      if (current > dynamicMax) input.value = String(dynamicMax);
    });

    const cdpTabLevelEl = document.getElementById("cdp-level-tab");
    const cdpCardLevelEl = document.getElementById("cdp-level");
    if (cdpTabLevelEl && cdpCardLevelEl) {
      cdpTabLevelEl.max = cdpCardLevelEl.max || "10";
      cdpTabLevelEl.value = cdpCardLevelEl.value;
    }
  }

  function refreshClassRowVisibility() {
    const rows = $$('.class-entry-row[data-class-slot="1"], .class-entry-row[data-class-slot="2"], .class-entry-row[data-class-slot="3"]');
    const addBtn = document.getElementById("add-class-row");
    const removeBtn = document.getElementById("remove-class-row");
    const hiddenRows = rows.filter((row) => row.hidden);
    const visibleRows = rows.filter((row) => !row.hidden);
    if (addBtn) addBtn.hidden = hiddenRows.length === 0;
    if (removeBtn) removeBtn.hidden = visibleRows.length <= 1;
  }

  function initClassCard() {
    const rows = $$('.class-entry-row[data-class-slot="1"], .class-entry-row[data-class-slot="2"], .class-entry-row[data-class-slot="3"]');
    const addBtn = document.getElementById("add-class-row");
    const removeBtn = document.getElementById("remove-class-row");
    if (!rows.length) return;

    let highestUsedIndex = 0;
    rows.forEach((row, index) => {
      const className = String(row.querySelector(".class-row-select")?.value || "").trim();
      const level = Math.max(0, Math.trunc(num(row.querySelector(".class-row-level")?.value)));
      if (className || level > 0) highestUsedIndex = index;
    });

    rows.forEach((row, index) => {
      row.hidden = index > Math.max(0, highestUsedIndex);
    });

    if (addBtn) {
      addBtn.addEventListener("click", () => {
        const nextHidden = rows.find((row) => row.hidden);
        if (!nextHidden) return;
        nextHidden.hidden = false;
        refreshClassRowVisibility();
        nextHidden.querySelector(".class-row-select")?.focus();
      });
    }

    if (removeBtn) {
      removeBtn.addEventListener("click", () => {
        const visibleRows = rows.filter((row) => !row.hidden);
        if (visibleRows.length <= 1) return;
        const lastVisible = visibleRows[visibleRows.length - 1];
        lastVisible.querySelectorAll("input, select").forEach((el) => {
          if (el.tagName === "SELECT") {
            const idx = Array.from(el.options).findIndex((o) => o.defaultSelected);
            el.selectedIndex = idx >= 0 ? idx : 0;
          } else {
            el.value = el.defaultValue ?? "";
          }
          delete state[keyFor(el)];
        });
        saveState(state);
        lastVisible.hidden = true;
        refreshClassRowVisibility();
        syncClassSummaryFields();
        applyAutoClassSkills();
        applyAutoBabFromClass();
        recalcHitPoints();
      });
    }

    refreshClassRowVisibility();
    refreshClassLevelCaps();
  }

  function syncClassSummaryFields() {
    const classSummaryEl = document.getElementById("pc-class-free-text");
    const totalLevelEl = document.getElementById("pc-level-total");
    const hpLevelsEl = document.getElementById("hp-levels");
    const skillsSummaryEl = document.getElementById("skills-class-summary");
    const entries = getClassEntries();
    const prestigeEntry = getPrestigeEntry();
    const summaryEntries = prestigeEntry ? [...entries, prestigeEntry] : entries;
    const summary = summaryEntries.map((entry) => `${entry.className} ${entry.level}`).join(" / ");
    const totalLevel = summaryEntries.reduce((sum, entry) => sum + entry.level, 0);

    if (classSummaryEl) classSummaryEl.value = summary;
    if (totalLevelEl) totalLevelEl.value = String(totalLevel);
    if (hpLevelsEl) hpLevelsEl.value = String(totalLevel);

    if (skillsSummaryEl) {
      skillsSummaryEl.value = summary || "";
      skillsSummaryEl.title = summary || "Nessuna classe selezionata";
    }

    recalcCompanionEffectiveLevel();
    refreshClassLevelCaps();
    updateTalentLevelMarkers(summaryEntries);
  }

  function updateTalentLevelMarkers(summaryEntries = null) {
    const rows = $$("#talents-table tbody tr");
    if (!rows.length) return;

    const entries = Array.isArray(summaryEntries)
      ? summaryEntries
      : (() => {
          const classEntries = getClassEntries();
          const prestigeEntry = getPrestigeEntry();
          return prestigeEntry ? [...classEntries, prestigeEntry] : classEntries;
        })();

    const progression = [];
    entries.forEach((entry) => {
      const levelCount = Math.max(0, Math.trunc(num(entry.level)));
      for (let classLevel = 1; classLevel <= levelCount; classLevel++) {
        progression.push({
          className: entry.className,
          classLevel,
          isNewClass: classLevel === 1,
        });
      }
    });

    rows.forEach((row, index) => {
      const totalLevel = index + 1;
      const levelCell = row.cells?.[0];
      if (!levelCell) return;

      const info = progression[index] || null;
      row.classList.toggle("talent-class-break", !!info && info.isNewClass && totalLevel > 1);

      if (!info) {
        levelCell.innerHTML = `<div class="talent-level-total">${totalLevel}</div>`;
        row.dataset.className = "";
        row.dataset.classLevel = "";
        return;
      }

      levelCell.innerHTML = `
        <div class="talent-level-total">${totalLevel}</div>
        <div class="talent-level-class">${info.className} ${info.classLevel}</div>
      `;
      row.dataset.className = info.className;
      row.dataset.classLevel = String(info.classLevel);
    });
  }

  function getBabApi() {
    return window.PF1EData?.tables?.bab || null;
  }

  function getHitPointApi() {
    return window.PF1EData?.tables?.hitPoints || null;
  }

  function getSkillPointApi() {
    return window.PF1EData?.tables?.skills || null;
  }

  function getResolvedHitDie() {
    const hpHitDieEl = document.getElementById("hp-hit-die");
    if (!hpHitDieEl) return 0;

    const raw = String(hpHitDieEl.value || "auto").trim();
    if (raw !== "auto") return Math.max(0, Math.trunc(num(raw)));

    const cls = getClassEntries()[0]?.className || "";
    const hpApi = getHitPointApi();
    if (!hpApi || typeof hpApi.getHitDieByClass !== "function") return 8;
    return Math.max(0, Math.trunc(num(hpApi.getHitDieByClass(cls) || 8)));
  }

  function getMythicHitPointsPerTier() {
    const path = getMythicPath();
    const bonusByPath = {
      Arcimago: 3,
      Campione: 5,
      Gerofante: 4,
      Maresciallo: 4,
      Mistificatore: 4,
      Protettore: 5,
    };
    return bonusByPath[path] || 0;
  }

  function recalcHitPoints() {
    const hpTotalEl = document.getElementById("hp-total");
    const hpCurrentEl = document.getElementById("hp-current");
    const hpTempEl = document.getElementById("hp-temp");
    const hpLevelsEl = document.getElementById("hp-levels");
    const hpHitDieEl = document.getElementById("hp-hit-die");
    const hpFavoredBonusEl = document.getElementById("hp-favored-bonus");
    const hpMiscBonusEl = document.getElementById("hp-misc-bonus");
    const hpBaseTotalEl = document.getElementById("hp-base-total");
    const hpConTotalEl = document.getElementById("hp-con-total");
    const hpMythicTotalEl = document.getElementById("hp-mythic-total");
    const hpToughnessEl = document.getElementById("hp-toughness");
    const hpToughnessTotalEl = document.getElementById("hp-toughness-total");
    const levelEl = document.getElementById("pc-level-total");

    if (
      !hpTotalEl ||
      !hpCurrentEl ||
      !hpTempEl ||
      !hpLevelsEl ||
      !hpHitDieEl ||
      !hpFavoredBonusEl ||
      !hpMiscBonusEl ||
      !hpBaseTotalEl ||
      !hpConTotalEl ||
      !hpMythicTotalEl ||
      !hpToughnessEl ||
      !hpToughnessTotalEl ||
      !levelEl
    ) {
      return;
    }

    const entries = getClassEntries();
    const prestigeEntry = getPrestigeEntry();
    const hpEntries = prestigeEntry ? [...entries, prestigeEntry] : entries;
    const levelFromIdentity = Math.max(0, Math.trunc(num(levelEl.value)));
    const levels = levelFromIdentity;
    const hitDie = getResolvedHitDie();
    const hpApi = getHitPointApi();
    const avgPerLevel =
      hpApi && typeof hpApi.getAveragePerLevel === "function"
        ? Math.max(0, Math.trunc(num(hpApi.getAveragePerLevel(hitDie))))
        : Math.max(0, Math.floor(hitDie / 2) + 1);
    const conMod = Math.trunc(getAbilityModByCode("COS"));
    const mythicTier = Math.max(0, Math.trunc(getMythicTier()));
    const mythicTotal = mythicTier * getMythicHitPointsPerTier();
    const toughnessTotal = hpToughnessEl.checked ? Math.max(3, levels) : 0;
    const favoredBonus = Math.max(0, Math.trunc(num(hpFavoredBonusEl.value)));
    const miscBonus = Math.trunc(num(hpMiscBonusEl.value));
    const tempHp = Math.max(0, Math.trunc(num(hpTempEl.value)));

    let baseTotal = 0;
    if (String(hpHitDieEl.value || "auto").trim() === "auto" && hpEntries.length && hpApi) {
      hpEntries.forEach((entry, idx) => {
        const classHitDie = entry.isPrestige
          ? Math.max(0, Math.trunc(num(entry.hitDie || 8)))
          : Math.max(0, Math.trunc(num(hpApi.getHitDieByClass?.(entry.className) || 8)));
        const classAvg = Math.max(0, Math.trunc(num(hpApi.getAveragePerLevel?.(classHitDie) || (Math.floor(classHitDie / 2) + 1))));
        if (idx === 0) {
          baseTotal += classHitDie + classAvg * Math.max(0, entry.level - 1);
        } else {
          baseTotal += classAvg * entry.level;
        }
      });
    } else {
      const firstLevelHp = levels <= 0 ? 0 : hitDie;
      const otherLevelsHp = levels > 1 ? avgPerLevel * (levels - 1) : 0;
      baseTotal = firstLevelHp + otherLevelsHp;
    }
    const conTotal = conMod * levels;
    const totalBase = Math.max(0, baseTotal + conTotal + mythicTotal + toughnessTotal + favoredBonus + miscBonus);
    const total = totalBase + tempHp;

    hpLevelsEl.value = String(levels);
    levelEl.value = String(levels);
    hpFavoredBonusEl.value = String(favoredBonus);
    hpMiscBonusEl.value = String(miscBonus);
    hpTempEl.value = String(tempHp);
    hpBaseTotalEl.value = String(baseTotal);
    hpConTotalEl.value = fmtSigned(conTotal);
    hpMythicTotalEl.value = fmtSigned(mythicTotal);
    hpToughnessTotalEl.value = fmtSigned(toughnessTotal);
    hpTotalEl.value = String(total);

    const prevAutoTotal = Math.max(0, Math.trunc(num(hpCurrentEl.dataset.autoTotal)));
    const currentRaw = String(hpCurrentEl.value || "").trim();
    const currentValue = Math.max(0, Math.trunc(num(hpCurrentEl.value)));
    const shouldAutofillCurrent = currentRaw === "" || currentValue === prevAutoTotal;
    hpCurrentEl.value = String(shouldAutofillCurrent ? total : clamp(currentValue, 0, total));
    hpCurrentEl.dataset.autoTotal = String(total);
  }

  function applyAutoBabFromClass() {
    const entries = getClassEntries();
    const prestigeEntry = getPrestigeEntry();
    const atkBabEl = document.getElementById("atk-bab");
    if (!atkBabEl) return;

    const babApi = getBabApi();
    if (!babApi || typeof babApi.getByClass !== "function") return;

    const autoBabBase = entries.reduce(
      (sum, entry) => sum + babApi.getByClass(entry.level, entry.className),
      0
    );
    const autoBabPrestige = prestigeEntry
      ? babApi.getByProgression(prestigeEntry.level, prestigeEntry.babProgression)
      : 0;
    atkBabEl.value = String(autoBabBase + autoBabPrestige);
    refreshAttackSequenceSelectors();
    recalcAllAttacks();
    recalcCmbCmd();
  }

  function buildClassSkillSet(classes) {
    const set = new Set();
    classes.forEach((cls) => {
      (CLASS_SKILLS[cls] || []).forEach((sk) => set.add(canonicalSkill(sk)));
      parseClassSkillsText(getPrestigeClassData(cls)?.classSkills).forEach((sk) => set.add(sk));
    });
    return set;
  }

  function skillFamilyName(skillName) {
    const canon = canonicalSkill(skillName);
    const m = canon.match(/^([^()]+)\s*\(.+\)$/);
    return m ? m[1].trim() : canon;
  }

  function applyAutoClassSkills() {
    const skillSources = getSelectedSkillSources();
    if (!skillSources.length) {
      $$("#skills-tbody tr.skill-row .skill-cs").forEach((el) => {
        el.checked = false;
      });
      recalcAllSkills();
      applySkillFilters();
      return;
    }
    const csSet = buildClassSkillSet(skillSources);

    $$("#skills-tbody tr.skill-row").forEach((tr) => {
      const nameEl = tr.querySelector(".skill-name");
      const csEl = tr.querySelector(".skill-cs");
      if (!nameEl || !csEl) return;
      const canon = canonicalSkill(nameEl.value);
      const family = skillFamilyName(nameEl.value);
      const isKnowledge = canon.startsWith("conoscenze (");
      csEl.checked =
        csSet.has(canon) ||
        csSet.has(family) ||
        (isKnowledge && csSet.has("conoscenze (tutte)"));
      csEl.dispatchEvent(new Event("change", { bubbles: true }));
    });
    recalcAllSkills();
    applySkillFilters();
  }

  function recalcSkillRow(tr) {
    if (!tr) return;

    const csEl = tr.querySelector(".skill-cs");
    const abilEl = tr.querySelector(".skill-abil");
    const acpEl = tr.querySelector(".skill-acp");
    const ranksEl = tr.querySelector(".skill-ranks");
    const miscEl = tr.querySelector(".skill-misc");
    const totalEl = tr.querySelector(".skill-total");
    if (!abilEl || !ranksEl || !miscEl || !totalEl) return;

    const abilMod = getAbilityModByCode(abilEl.value);
    const ranks = num(ranksEl.value);
    const misc = num(miscEl.value);

    const isCS = !!(csEl && csEl.checked);
    const csBonus = isCS && ranks > 0 ? 3 : 0;

    const acpGlobalEl = document.getElementById("skills-acp");
    const acpGlobal = acpGlobalEl ? num(acpGlobalEl.value) : 0;
    const acpPenalty = acpEl && acpEl.checked ? acpGlobal : 0;

    const skillName = tr.querySelector(".skill-name")?.value || "";
    const isStealth = canonicalSkill(skillName) === "furtività";
    const sizeStealth = isStealth ? getCurrentSizeMods().stealth : 0;

    totalEl.value = fmtSigned(ranks + abilMod + misc + csBonus - acpPenalty + sizeStealth);
  }

  function updateSkillPointsTotal() {
    const outEl = document.getElementById("skills-points-total");
    if (!outEl) return;
    const skillApi = getSkillPointApi();
    const entries = getClassEntries();
    const prestigeEntry = getPrestigeEntry();
    const summaryEntries = prestigeEntry ? [...entries, prestigeEntry] : entries;
    const intMod = Math.trunc(getAbilityModByCode("INT"));

    let totalPoints = 0;
    summaryEntries.forEach((entry) => {
      const level = Math.max(0, Math.trunc(num(entry.level)));
      if (level <= 0) return;

      const classBasePoints = entry.isPrestige
        ? Math.max(1, Math.trunc(num(entry.skillPoints || 2)))
        : Math.max(1, Math.trunc(num(skillApi?.getPointsByClass?.(entry.className) || 2)));
      const perLevelPoints = Math.max(1, classBasePoints + intMod);
      totalPoints += perLevelPoints * level;
    });

    outEl.value = String(Math.max(0, totalPoints));
  }

  function updateSkillRanksSpent() {
    const outEl = document.getElementById("skills-ranks-spent");
    if (!outEl) return;
    const spentRanks = $$("#skills-tbody tr.skill-row .skill-ranks").reduce(
      (sum, el) => sum + Math.max(0, Math.trunc(num(el.value))),
      0
    );
    outEl.value = String(spentRanks);
  }

  function recalcAllSkills() {
    $$("#skills-tbody tr.skill-row").forEach(recalcSkillRow);
    updateSkillPointsTotal();
    updateSkillRanksSpent();
  }

  function applySkillFilters() {
    const q = (document.getElementById("skills-search")?.value || "").toLowerCase().trim();
    const onlyCS = !!document.getElementById("filter-class")?.checked;
    const onlyTrained = !!document.getElementById("filter-trained")?.checked;

    $$("#skills-tbody tr.skill-row").forEach((tr) => {
      const name = (tr.querySelector(".skill-name")?.value || "").toLowerCase();
      const isCS = !!tr.querySelector(".skill-cs")?.checked;
      const ranks = num(tr.querySelector(".skill-ranks")?.value);

      const matchQ = !q || name.includes(q);
      const matchCS = !onlyCS || isCS;
      const matchTrained = !onlyTrained || ranks > 0;

      tr.style.display = matchQ && matchCS && matchTrained ? "" : "none";
    });
  }

  function makeSkillRow(opts = {}) {
    const {
      isExtra = true,
      name = "",
      ability = "DES",
      acp = false,
      placeholder = "Nuova abilità",
    } = opts;

    const tr = document.createElement("tr");
    tr.className = isExtra ? "skill-row skill-row-extra" : "skill-row";
    tr.innerHTML = `
      <td class="td-center"><input class="skill-cs" type="checkbox" /></td>
      <td><input class="skill-name" type="text" value="${name}" placeholder="${placeholder}" /></td>
      <td>
        <input class="small skill-abil-fixed" type="text" value="${ability}" readonly />
        <input class="skill-abil" type="hidden" value="${ability}" />
      </td>
      <td class="td-center"><input class="skill-acp" type="checkbox" ${acp ? "checked" : ""} /></td>
      <td><input class="small skill-ranks" type="number" step="1" min="0" value="0" /></td>
      <td><input class="small skill-misc" type="number" step="1" value="0" /></td>
      <td><input class="small skill-total" type="text" value="+0" readonly /></td>
      <td class="td-center"><button type="button" class="roll-btn" title="Tira 1d20 + Tot">Tiro</button></td>
    `;
    return tr;
  }

  function buildBaseSkillRows() {
    if (!skillsTbody) return;
    skillsTbody.innerHTML = "";
    BASE_SKILLS.forEach((sk) => {
      const tr = makeSkillRow({
        isExtra: false,
        name: sk.name,
        ability: sk.abil,
        acp: !!sk.acp,
      });
      skillsTbody.appendChild(tr);
      applySavedValues(tr);
      wireAutosave(tr);
    });
  }

  function getExtraRowsCount() {
    return parseInt(localStorage.getItem(SKILLS_EXTRA_KEY) || "0", 10) || 0;
  }
  function setExtraRowsCount(n) {
    localStorage.setItem(SKILLS_EXTRA_KEY, String(Math.max(0, n)));
  }

  function rebuildExtraSkillRows() {
    if (!skillsTbody) return;
    buildBaseSkillRows();
    skillsTbody.querySelectorAll(".skill-row-extra").forEach((r) => r.remove());
    const n = getExtraRowsCount();
    for (let i = 0; i < n; i++) {
      const tr = makeSkillRow({ isExtra: true });
      skillsTbody.appendChild(tr);
      applySavedValues(tr);
      wireAutosave(tr);
    }
  }

  rebuildExtraSkillRows();

  if (addSkillBtn && skillsTbody) {
    addSkillBtn.addEventListener("click", () => {
      const tr = makeSkillRow({ isExtra: true });
      skillsTbody.appendChild(tr);
      setExtraRowsCount(getExtraRowsCount() + 1);
      applySavedValues(tr);
      wireAutosave(tr);
      applyAutoClassSkills();
      recalcSkillRow(tr);
      applySkillFilters();
      tr.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }

  if (addKnowledgeBtn && skillsTbody) {
    addKnowledgeBtn.addEventListener("click", () => {
      const tr = makeSkillRow({
        isExtra: true,
        name: "Conoscenze (Nuova)",
        ability: "INT",
        acp: false,
      });
      skillsTbody.appendChild(tr);
      setExtraRowsCount(getExtraRowsCount() + 1);
      applySavedValues(tr);
      wireAutosave(tr);
      applyAutoClassSkills();
      recalcSkillRow(tr);
      applySkillFilters();
      tr.scrollIntoView({ block: "nearest", behavior: "smooth" });
      const nameEl = tr.querySelector(".skill-name");
      if (nameEl) nameEl.focus();
    });
  }

  if (remSkillBtn && skillsTbody) {
    remSkillBtn.addEventListener("click", () => {
      const extras = skillsTbody.querySelectorAll(".skill-row-extra");
      if (!extras.length) return;
      const last = extras[extras.length - 1];
      last.querySelectorAll("input, textarea, select").forEach((el) => delete state[keyFor(el)]);
      saveState(state);
      last.remove();
      setExtraRowsCount(getExtraRowsCount() - 1);
      recalcAllSkills();
      applySkillFilters();
    });
  }

  // listeners skills
  document.addEventListener("input", (e) => {
    const t = e.target;
    if (!t) return;

    const tr = t.closest?.("tr.skill-row");
    if (tr && t.matches(".skill-cs, .skill-abil, .skill-acp, .skill-ranks, .skill-misc")) {
      recalcSkillRow(tr);
    }

    if (t.id === "skills-acp") recalcAllSkills();

    if (t.classList?.contains("skill-name")) {
      applyAutoClassSkills();
      applySkillFilters();
      recalcSkillRow(tr);
    }
  });

  document.addEventListener("change", (e) => {
    const t = e.target;
    if (!t) return;
    if (t.id === "spellcaster-class") {
      updateSpellcastingClassFields();
      updateSpellLevelsVisibility();
      recalcAllSpellSlots();
    }
    if (t.id === "filter-class" || t.id === "filter-trained") applySkillFilters();
  });

  ["skills-search", "filter-class", "filter-trained"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", applySkillFilters);
    el.addEventListener("change", applySkillFilters);
  });

  function getLinkedHitRowFromButton(btnEl, hitRowClass, dmgRowClass) {
    if (!btnEl) return null;
    let tr = btnEl.closest(`tr.${hitRowClass}`);
    if (tr) return tr;
    const dmgRow = btnEl.closest(`tr.${dmgRowClass}`);
    tr = dmgRow?.previousElementSibling?.classList?.contains(hitRowClass)
      ? dmgRow.previousElementSibling
      : null;
    return tr || null;
  }

  function getAttackSequenceLabel(tr, selector = ".atk-sequence") {
    const sequenceEl = tr?.querySelector(selector);
    const selectedOption = sequenceEl?.selectedOptions?.[0];
    return String(selectedOption?.textContent || sequenceEl?.value || "1°").trim();
  }

  function getAttackRollLabel(tr, cfg) {
    const explicitName = cfg.nameSelector ? tr?.querySelector(cfg.nameSelector)?.value?.trim() : "";
    if (explicitName) return explicitName;
    if (cfg.hitRowClass === "attack-row") {
      const type = tr?.querySelector(".atk-type")?.value === "ranged" ? "Attacco distanza" : "Attacco mischia";
      return `${type} ${getAttackSequenceLabel(tr)}`;
    }
    if (cfg.hitRowClass === "comp-attack-row") {
      const type =
        tr?.querySelector(".comp-atk-type")?.value === "ranged" ? "Attacco compagno distanza" : "Attacco compagno mischia";
      return `${type} ${getAttackSequenceLabel(tr, ".comp-atk-sequence")}`;
    }
    return cfg.fallbackLabel;
  }

  function handleToHitRoll(btnEl, cfg) {
    const tr = getLinkedHitRowFromButton(btnEl, cfg.hitRowClass, cfg.dmgRowClass);
    if (!tr) return false;
    cfg.recalcRow(tr);
    const tot = parseSignedInt(tr.querySelector(cfg.totalSelector)?.value);
    const name = getAttackRollLabel(tr, cfg);
    rollViaTaleSpire(tot, name);
    return true;
  }

  function handleFullAttackRoll(btnEl, cfg) {
    const tr = getLinkedHitRowFromButton(btnEl, cfg.hitRowClass, cfg.dmgRowClass);
    if (!tr) return false;
    cfg.recalcRow(tr);
    const tot = parseSignedInt(tr.querySelector(cfg.totalSelector)?.value);
    const bab = num(document.getElementById(cfg.babId)?.value);
    const name = getAttackRollLabel(tr, cfg);
    rollFullAttackSequence(tot, bab, name);
    return true;
  }

  function handleDamageRoll(btnEl, cfg) {
    const tr = getLinkedHitRowFromButton(btnEl, cfg.hitRowClass, cfg.dmgRowClass);
    if (!tr) return false;
    cfg.recalcRow(tr);
    const formula = tr.dataset.dmgFormula || cfg.fallbackFormula || "1d6";
    const name = getAttackRollLabel(tr, cfg);
    rollFormulaViaTaleSpire(formula, `${name} - Danni`);
    return true;
  }

  // roll skill (delegation)
  document.addEventListener("click", (e) => {
    const spellToggleBtn = e.target.closest?.(".spell-entry-toggle");
    if (spellToggleBtn) {
      const row = spellToggleBtn.closest(".spell-entry");
      if (!row) return;
      const collapsed = row.classList.contains("is-collapsed");
      setSpellEntryCollapsed(row, !collapsed);
      return;
    }

    const addSpellBtn = e.target.closest?.("[id^='add-spell-']");
    if (addSpellBtn) {
      e.preventDefault();
      e.stopPropagation();
      const level = num(addSpellBtn.dataset.level);
      if (level < 0 || level > 9) return;
      const container = document.getElementById(`spell-list-level-${level}`);
      if (!container) return;
      const index = container.querySelectorAll(".spell-entry").length;
      const row = makeSpellRow(level, index, true);
      container.appendChild(row);
      setSpellExtraCount(level, getSpellExtraCount(level) + 1);
      applySavedValues(row);
      wireAutosave(row);
      setSpellEntryCollapsed(row, false);
      recalcSpellRow(row);
      const focusEl = row.querySelector(".spell-name");
      if (focusEl) focusEl.focus();
      row.scrollIntoView({ block: "nearest", behavior: "smooth" });
      return;
    }

    const remSpellBtn = e.target.closest?.("[id^='remove-spell-']");
    if (remSpellBtn) {
      e.preventDefault();
      e.stopPropagation();
      const level = num(remSpellBtn.dataset.level);
      if (level < 0 || level > 9) return;
      const container = document.getElementById(`spell-list-level-${level}`);
      if (!container) return;

      const extras = container.querySelectorAll(".spell-entry-extra");
      if (!extras.length) return;

      const last = extras[extras.length - 1];
      last.querySelectorAll("input, textarea, select").forEach((el) => delete state[keyFor(el)]);
      saveState(state);
      last.remove();
      setSpellExtraCount(level, getSpellExtraCount(level) - 1);
      return;
    }

    const spellAtkBtn = e.target.closest?.(".spell-atk-roll-btn");
    if (spellAtkBtn) {
      const row = spellAtkBtn.closest(".spell-entry");
      if (!row) return;
      recalcSpellRow(row);
      const total = parseSignedInt(row.querySelector(".spell-atk-total")?.value);
      const name = row.querySelector(".spell-name")?.value?.trim() || "Incantesimo";
      rollViaTaleSpire(total, `${name} - TpC`);
      return;
    }

    const spellDmgBtn = e.target.closest?.(".spell-dmg-roll-btn");
    if (spellDmgBtn) {
      const row = spellDmgBtn.closest(".spell-entry");
      if (!row) return;
      recalcSpellRow(row);
      const formula = row.dataset.dmgFormula || "1d6";
      const name = row.querySelector(".spell-name")?.value?.trim() || "Incantesimo";
      rollFormulaViaTaleSpire(formula, `${name} - Danni`);
      return;
    }

    const initBtn = e.target.closest?.(".init-roll-btn");
    if (initBtn) {
      recalcInitiative();
      const tot = parseSignedInt(document.getElementById("init-total")?.value);
      rollViaTaleSpire(tot, "Iniziativa");
      return;
    }

    const cmbBtn = e.target.closest?.(".cmb-roll-btn");
    if (cmbBtn) {
      recalcCmbCmd();
      const tot = parseSignedInt(document.getElementById("cmb")?.value);
      rollViaTaleSpire(tot, "BMC");
      return;
    }

    const saveBtn = e.target.closest?.(".save-roll-btn");
    if (saveBtn) {
      const targetId = String(saveBtn.dataset.target || "").trim();
      const label = String(saveBtn.dataset.label || "Tiro Salvezza").trim() || "Tiro Salvezza";
      const inputEl = targetId ? document.getElementById(targetId) : null;
      const tot = parseSignedInt(inputEl?.value);
      rollViaTaleSpire(tot, label);
      return;
    }

    const atkBtn = e.target.closest?.(".atk-roll-btn");
    if (
      atkBtn &&
      handleToHitRoll(atkBtn, {
        hitRowClass: "attack-row",
        dmgRowClass: "attack-row-dmg",
        recalcRow: recalcAttackRow,
        totalSelector: ".atk-total",
        nameSelector: ".atk-name",
        fallbackLabel: "Attacco",
      })
    ) {
      return;
    }

    const atkDmgBtn = e.target.closest?.(".atk-dmg-roll-btn");
    if (
      atkDmgBtn &&
      handleDamageRoll(atkDmgBtn, {
        hitRowClass: "attack-row",
        dmgRowClass: "attack-row-dmg",
        recalcRow: recalcAttackRow,
        nameSelector: ".atk-name",
        fallbackLabel: "Danni attacco",
        fallbackFormula: "1d6",
      })
    ) {
      return;
    }

    const compAtkBtn = e.target.closest?.(".comp-atk-roll-btn");
    if (
      compAtkBtn &&
      handleToHitRoll(compAtkBtn, {
        hitRowClass: "comp-attack-row",
        dmgRowClass: "comp-attack-row-dmg",
        recalcRow: recalcCompAttackRow,
        totalSelector: ".comp-atk-total",
        fallbackLabel: "Attacco compagno",
      })
    ) {
      return;
    }

    const compAtkDmgBtn = e.target.closest?.(".comp-atk-dmg-roll-btn");
    if (
      compAtkDmgBtn &&
      handleDamageRoll(compAtkDmgBtn, {
        hitRowClass: "comp-attack-row",
        dmgRowClass: "comp-attack-row-dmg",
        recalcRow: recalcCompAttackRow,
        fallbackLabel: "Danni attacco compagno",
        fallbackFormula: "1d6",
      })
    ) {
      return;
    }

    const btn = e.target.closest?.(".roll-btn");
    if (!btn) return;

    const tr = btn.closest("tr.skill-row");
    if (!tr) return;

    recalcSkillRow(tr);
    const tot = parseSignedInt(tr.querySelector(".skill-total")?.value);
    const name = tr.querySelector(".skill-name")?.value?.trim() || "Abilità";
    rollViaTaleSpire(tot, name);
  });

  /* =========================
     Derived recalcs (tutto in un punto)
  ========================= */
  function recalcDerived() {
    // iniziativa
    recalcInitiative();

    // CA: DES -> ac-dex -> recalc
    syncDexToAC();
    recalcAC();

    // attacchi
    recalcAllAttacks();
    recalcAllCompAttacks();

    // BMC / DMC
    recalcCmbCmd();

    // skills (perché abilMod cambia)
    recalcAllSkills();

    // PF
    recalcHitPoints();

    // incantesimi (caratteristica chiave + mod)
    updateSpellcastingClassFields();
    updateSpellLevelsVisibility();
    recalcAllSpellSlots();
    recalcAllSpellRows();
  }

  function initCollapsibleCards() {
    $$(".page .card").forEach((card) => {
      if (card.classList.contains("card-collapsible")) return;
      const head = card.querySelector(":scope > h2");
      if (!head) return;

      card.classList.add("card-collapsible");
      head.classList.add("card-collapse-head");
      head.setAttribute("role", "button");
      head.setAttribute("tabindex", "0");
      head.setAttribute("aria-expanded", "true");

      const toggle = () => {
        const collapsed = card.classList.toggle("is-collapsed");
        head.setAttribute("aria-expanded", String(!collapsed));
      };

      head.addEventListener("click", () => toggle());
      head.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      });
    });
  }

  let refreshLegendaryWeaponUI = () => {};
  let refreshEquipLegendaryBridgeUI = () => {};

  function initLegendaryWeaponCard() {
    const card = document.querySelector(".sword-graphic-card");
    if (!card) return;
    const enabledEl = document.getElementById("legendary-enabled");
    const contentEl = document.getElementById("legendary-content");
    const itemTypeEl = document.getElementById("legendary-item-type");
    const materialEl = document.getElementById("legendary-material");
    const figureNodes = Array.from(card.querySelectorAll(".legendary-figure"));
    const tierEl = document.getElementById("legendary-tier");
    const powerTotalEl = document.getElementById("legendary-power-total");
    const powerSpentEl = document.getElementById("legendary-power-spent");
    const powerRemainingEl = document.getElementById("legendary-power-remaining");
    const surgeDieEl = document.getElementById("legendary-surge-die");
    const magicBonusEl = document.getElementById("legendary-magic-bonus");
    const abilityBonusEl = document.getElementById("legendary-ability-bonus");
    const totalBonusEl = document.getElementById("legendary-total-bonus");
    const summaryEl = document.getElementById("legendary-mod-summary");
    const catalogBody = document.getElementById("legendary-power-catalog-body");
    const tierOut = document.getElementById("legendary-tier-out");
    const powerTotalOut = document.getElementById("legendary-power-total-out");
    const powerSpentOut = document.getElementById("legendary-power-spent-out");
    const powerRemainingOut = document.getElementById("legendary-power-remaining-out");
    const surgeOut = document.getElementById("legendary-surge-out");
    const enhancementWarning = document.getElementById("legendary-enhancement-warning");
    if (
      !enabledEl ||
      !contentEl ||
      !itemTypeEl ||
      !materialEl ||
      !tierEl ||
      !powerTotalEl ||
      !powerSpentEl ||
      !powerRemainingEl ||
      !surgeDieEl ||
      !magicBonusEl ||
      !abilityBonusEl ||
      !totalBonusEl ||
      !summaryEl ||
      !catalogBody ||
      !tierOut ||
      !powerTotalOut ||
      !powerSpentOut ||
      !powerRemainingOut ||
      !surgeOut ||
      !enhancementWarning
    ) {
      return;
    }

    const powerCatalog = window.PF1EData?.tables?.legendaryItems?.powerCatalog || [];
    if (!Array.isArray(powerCatalog) || !powerCatalog.length) return;

    const MATERIAL_LABELS = {
      steel: "Acciaio",
      cold_iron: "Ferro Freddo",
      silver: "Argento Alchemico",
      adamantine: "Adamantio",
      mithral: "Mithral",
    };

    catalogBody.innerHTML = "";

    powerCatalog.forEach((power) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${power.name}</td>
        <td>${power.category}</td>
        <td>${power.powerCost}</td>
        <td>${power.mechanics || "—"}</td>
        <td>${power.restrictions || "—"}</td>
      `;
      catalogBody.appendChild(tr);
    });

    const update = (bonusSourceEl = null) => {
      const material = String(materialEl.value || "steel");
      const itemType = String(itemTypeEl.value || "weapon");
      const enabled = !!enabledEl.checked;
      const tier = Math.max(0, Math.trunc(getMythicTier()));
      const powerTotal = 3 + tier;
      const powerSpent = clamp(num(powerSpentEl.value), 0, powerTotal);
      const powerRemaining = powerTotal - powerSpent;
      const surge = getSurgeDieByTier(tier);
      let magicBonus = clamp(Math.trunc(num(magicBonusEl.value)), 0, 5);
      let abilityBonus = clamp(Math.trunc(num(abilityBonusEl.value)), 0, 5);
      const rawTotal = magicBonus + abilityBonus;
      if (rawTotal > 10) {
        if (bonusSourceEl === magicBonusEl) {
          magicBonus = 10 - abilityBonus;
        } else {
          abilityBonus = 10 - magicBonus;
        }
      }
      const totalBonus = magicBonus + abilityBonus;
      const wasClamped =
        rawTotal > 10 ||
        Math.trunc(num(magicBonusEl.value)) !== magicBonus ||
        Math.trunc(num(abilityBonusEl.value)) !== abilityBonus;

      card.dataset.enhancement = String(clamp(Math.ceil(tier / 2), 0, 5));
      card.dataset.material = material;
      card.dataset.itemType = itemType;
      card.dataset.legendaryEnabled = enabled ? "1" : "0";
      contentEl.hidden = !enabled;
      contentEl.setAttribute("aria-hidden", String(!enabled));
      if (figureNodes.length) {
        figureNodes.forEach((node) => {
          node.style.display = node.dataset.legendaryFigure === itemType ? "" : "none";
        });
      }

      const matLabel = MATERIAL_LABELS[material] || "Acciaio";
      summaryEl.textContent = `Tier ${tier} • Punti Potere ${powerRemaining}/${powerTotal} • ${matLabel} • Bonus +${totalBonus}/+10`;

      tierEl.value = String(tier);
      powerTotalEl.value = String(powerTotal);
      powerSpentEl.value = String(powerSpent);
      powerRemainingEl.value = String(powerRemaining);
      surgeDieEl.value = surge;
      magicBonusEl.value = String(magicBonus);
      abilityBonusEl.value = String(abilityBonus);
      totalBonusEl.value = `+${totalBonus} / +10`;

      tierOut.value = String(tier);
      powerTotalOut.value = String(powerTotal);
      powerSpentOut.value = String(powerSpent);
      powerRemainingOut.value = String(powerRemaining);
      surgeOut.value = surge;

      enhancementWarning.style.display = wasClamped ? "block" : "none";
    };

    [enabledEl, itemTypeEl, materialEl, powerSpentEl].forEach((el) => {
      el.addEventListener("input", update);
      el.addEventListener("change", update);
    });
    [magicBonusEl, abilityBonusEl].forEach((el) => {
      el.addEventListener("input", () => update(el));
      el.addEventListener("change", () => update(el));
    });

    refreshLegendaryWeaponUI = update;
    update();
  }

  function initEquipLegendaryBridge() {
    const legendaryCardEl = document.querySelector(".sword-graphic-card");
    const armorAcEl = document.getElementById("equip-armor-ac");
    const shieldAcEl = document.getElementById("equip-shield-ac");
    const armorAcpEl = document.getElementById("equip-armor-acp");
    const shieldAcpEl = document.getElementById("equip-shield-acp");
    const weaponMagicBonusEl = document.getElementById("equip-weapon-magic-bonus");
    const weaponAbilityBonusEl = document.getElementById("equip-weapon-ability-bonus");
    const acArmorEl = document.getElementById("ac-armor");
    const acShieldEl = document.getElementById("ac-shield");
    const skillsAcpEl = document.getElementById("skills-acp");
    const legendaryEnabledEl = document.getElementById("legendary-enabled");
    const legendaryTypeEl = document.getElementById("legendary-item-type");
    const legendaryMagicBonusEl = document.getElementById("legendary-magic-bonus");
    const legendaryAbilityBonusEl = document.getElementById("legendary-ability-bonus");
    const weaponLegendaryEl = document.getElementById("equip-weapon-legendary");
    const armorLegendaryEl = document.getElementById("equip-armor-legendary");
    const shieldLegendaryEl = document.getElementById("equip-shield-legendary");

    if (
      !armorAcEl ||
      !shieldAcEl ||
      !armorAcpEl ||
      !shieldAcpEl ||
      !weaponMagicBonusEl ||
      !weaponAbilityBonusEl ||
      !acArmorEl ||
      !acShieldEl ||
      !skillsAcpEl ||
      !legendaryCardEl ||
      !legendaryEnabledEl ||
      !legendaryTypeEl ||
      !legendaryMagicBonusEl ||
      !legendaryAbilityBonusEl ||
      !weaponLegendaryEl ||
      !armorLegendaryEl ||
      !shieldLegendaryEl
    ) {
      return;
    }

    let syncingDefenseFields = false;

    const legendaryLinks = [
      { type: "weapon", el: weaponLegendaryEl },
      { type: "armor", el: armorLegendaryEl },
      { type: "shield", el: shieldLegendaryEl },
    ];

    const syncDefenseFields = (source = "equip") => {
      if (syncingDefenseFields) return;
      syncingDefenseFields = true;

      const sourceArmorAc = source === "core" ? acArmorEl : armorAcEl;
      const sourceShieldAc = source === "core" ? acShieldEl : shieldAcEl;
      const armorAcp = Math.max(0, Math.trunc(num(armorAcpEl.value)));
      const shieldAcp = Math.max(0, Math.trunc(num(shieldAcpEl.value)));
      const nextArmorAc = Math.max(0, Math.trunc(num(sourceArmorAc.value)));
      const nextShieldAc = Math.max(0, Math.trunc(num(sourceShieldAc.value)));

      armorAcEl.value = String(nextArmorAc);
      shieldAcEl.value = String(nextShieldAc);
      acArmorEl.value = String(nextArmorAc);
      acShieldEl.value = String(nextShieldAc);

      armorAcpEl.value = String(armorAcp);
      shieldAcpEl.value = String(shieldAcp);
      skillsAcpEl.value = String(armorAcp + shieldAcp);
      skillsAcpEl.readOnly = true;

      recalcAC();
      recalcAllSkills();
      syncingDefenseFields = false;
    };

    const syncWeaponLegendaryStats = () => {
      const weaponMagic = clamp(Math.trunc(num(weaponMagicBonusEl.value)), 0, 5);
      const weaponAbility = clamp(Math.trunc(num(weaponAbilityBonusEl.value)), 0, 5);
      weaponMagicBonusEl.value = String(weaponMagic);
      weaponAbilityBonusEl.value = String(weaponAbility);

      if (!weaponLegendaryEl.checked) return;
      legendaryMagicBonusEl.value = String(weaponMagic);
      legendaryAbilityBonusEl.value = String(weaponAbility);
      refreshLegendaryWeaponUI();
    };

    const syncLegendaryToggle = (sourceEl = null) => {
      if (sourceEl?.checked) {
        legendaryLinks.forEach(({ el }) => {
          if (el !== sourceEl) el.checked = false;
        });
      }

      const selected = legendaryLinks.find(({ el }) => el.checked) || null;
      legendaryEnabledEl.checked = !!selected;
      legendaryCardEl.hidden = !selected;
      if (selected) legendaryTypeEl.value = selected.type;
      if (selected?.type === "weapon") syncWeaponLegendaryStats();
      refreshLegendaryWeaponUI();
    };

    [armorAcEl, shieldAcEl, armorAcpEl, shieldAcpEl].forEach((el) => {
      el.addEventListener("input", () => syncDefenseFields("equip"));
      el.addEventListener("change", () => syncDefenseFields("equip"));
    });
    [acArmorEl, acShieldEl].forEach((el) => {
      el.addEventListener("input", () => syncDefenseFields("core"));
      el.addEventListener("change", () => syncDefenseFields("core"));
    });
    [weaponMagicBonusEl, weaponAbilityBonusEl].forEach((el) => {
      el.addEventListener("input", syncWeaponLegendaryStats);
      el.addEventListener("change", syncWeaponLegendaryStats);
    });

    legendaryLinks.forEach(({ el }) => {
      el.addEventListener("input", () => syncLegendaryToggle(el));
      el.addEventListener("change", () => syncLegendaryToggle(el));
    });

    legendaryEnabledEl.addEventListener("change", () => {
      if (legendaryEnabledEl.checked) return;
      legendaryLinks.forEach(({ el }) => {
        el.checked = false;
      });
      syncLegendaryToggle();
    });
    [legendaryMagicBonusEl, legendaryAbilityBonusEl].forEach((el) => {
      el.addEventListener("input", syncWeaponLegendaryStats);
      el.addEventListener("change", syncWeaponLegendaryStats);
    });

    refreshEquipLegendaryBridgeUI = () => {
      syncDefenseFields("equip");
      syncWeaponLegendaryStats();
      syncLegendaryToggle();
    };

    refreshEquipLegendaryBridgeUI();
  }

  // listeners combat
  ["init-misc"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", recalcInitiative);
    el.addEventListener("change", recalcInitiative);
  });

  ["ac-armor", "ac-shield", "ac-armor-enhancement", "ac-shield-enhancement", "ac-dex-max", "ac-misc", "shield-off"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", recalcAC);
    el.addEventListener("change", recalcAC);
  });

  const atkBabEl = document.getElementById("atk-bab");
  if (atkBabEl) {
    atkBabEl.addEventListener("input", () => {
      refreshAttackSequenceSelectors();
      recalcAllAttacks();
      recalcCmbCmd();
      recalcAllSpellRows();
    });
    atkBabEl.addEventListener("change", () => {
      refreshAttackSequenceSelectors();
      recalcAllAttacks();
      recalcCmbCmd();
      recalcAllSpellRows();
    });
  }

  const atkMiscEl = document.getElementById("atk-misc");
  if (atkMiscEl) {
    atkMiscEl.addEventListener("input", () => {
      recalcAllAttacks();
      recalcAllSpellRows();
    });
    atkMiscEl.addEventListener("change", () => {
      recalcAllAttacks();
      recalcAllSpellRows();
    });
  }

  const spellcasterLevelEl = document.getElementById("spellcaster-level");
  if (spellcasterLevelEl) {
    spellcasterLevelEl.addEventListener("input", () => {
      updateSpellLevelsVisibility();
      recalcAllSpellSlots();
      recalcAllSpellRows();
    });
    spellcasterLevelEl.addEventListener("change", () => {
      updateSpellLevelsVisibility();
      recalcAllSpellSlots();
      recalcAllSpellRows();
    });
  }

  ["comp-atk-bab", "comp-atk-str-mod", "comp-atk-dex-mod", "comp-atk-misc"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", () => {
      refreshCompAttackSequenceSelectors();
      recalcAllCompAttacks();
    });
    el.addEventListener("change", () => {
      refreshCompAttackSequenceSelectors();
      recalcAllCompAttacks();
    });
  });

  function resolveLinkedRowFromEventTarget(target, hitRowClass, dmgRowClass) {
    if (!target?.closest) return null;
    let row = target.closest(`.${hitRowClass}`);
    if (row) return row;
    const dmgRow = target.closest(`.${dmgRowClass}`);
    row = dmgRow?.previousElementSibling?.classList?.contains(hitRowClass)
      ? dmgRow.previousElementSibling
      : null;
    return row || null;
  }

  const pcLevelEl = document.getElementById("pc-level-total");
  if (pcLevelEl) {
    pcLevelEl.addEventListener("input", applyAutoBabFromClass);
    pcLevelEl.addEventListener("change", applyAutoBabFromClass);
    pcLevelEl.addEventListener("input", recalcHitPoints);
    pcLevelEl.addEventListener("change", recalcHitPoints);
    pcLevelEl.addEventListener("input", recalcCompanionEffectiveLevel);
    pcLevelEl.addEventListener("change", recalcCompanionEffectiveLevel);
  }

  ["comp-level", "comp-boon-companion"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", recalcCompanionEffectiveLevel);
    el.addEventListener("change", recalcCompanionEffectiveLevel);
  });

  ["hp-hit-die", "hp-favored-bonus", "hp-misc-bonus", "hp-toughness"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", recalcHitPoints);
    el.addEventListener("change", recalcHitPoints);
  });

  $$(".class-entry-row .class-row-select, .class-entry-row .class-row-level").forEach((el) => {
    el.addEventListener("input", () => {
      if (el.classList.contains("class-row-level")) {
        enforceCharacterLevelCap(el);
        refreshClassLevelCaps();
      }
      syncClassSummaryFields();
      applyAutoClassSkills();
      applyAutoBabFromClass();
      recalcHitPoints();
    });
    el.addEventListener("change", () => {
      if (el.classList.contains("class-row-level")) {
        enforceCharacterLevelCap(el);
        refreshClassLevelCaps();
      }
      syncClassSummaryFields();
      applyAutoClassSkills();
      applyAutoBabFromClass();
      recalcHitPoints();
    });
  });

  ["cdp-name", "cdp-level", "enable-cdp-section"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", () => {
      if (id === "cdp-level") {
        enforceCharacterLevelCap(el);
        refreshClassLevelCaps();
      }
      if (id === "cdp-name" || id === "cdp-level") syncPrestigeFields("card");
      syncClassSummaryFields();
      applyAutoBabFromClass();
      recalcHitPoints();
    });
    el.addEventListener("change", () => {
      if (id === "cdp-level") {
        enforceCharacterLevelCap(el);
        refreshClassLevelCaps();
      }
      if (id === "cdp-name" || id === "cdp-level") syncPrestigeFields("card");
      syncClassSummaryFields();
      applyAutoBabFromClass();
      recalcHitPoints();
    });
  });

  ["cdp-name-tab", "cdp-level-tab"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", () => {
      if (id === "cdp-level-tab") {
        enforceCharacterLevelCap(el);
        refreshClassLevelCaps();
      }
      syncPrestigeFields("tab");
      syncClassSummaryFields();
      applyAutoBabFromClass();
      recalcHitPoints();
    });
    el.addEventListener("change", () => {
      if (id === "cdp-level-tab") {
        enforceCharacterLevelCap(el);
        refreshClassLevelCaps();
      }
      syncPrestigeFields("tab");
      syncClassSummaryFields();
      applyAutoBabFromClass();
      recalcHitPoints();
    });
  });

  function targetHasAnyClass(target, classNames) {
    if (!target?.classList) return false;
    return classNames.some((className) => target.classList.contains(className));
  }

  document.addEventListener("input", (e) => {
    const row = resolveLinkedRowFromEventTarget(e.target, "attack-row", "attack-row-dmg");
    if (!row) return;
    if (
      targetHasAnyClass(e.target, [
        "atk-row-misc",
        "atk-magic-bonus",
        "atk-type",
        "atk-sequence",
        "atk-dice-count",
        "atk-die",
        "atk-crit-range",
        "atk-crit-mult",
        "atk-twohands",
        "atk-power-attack",
        "atk-furious-focus",
      ])
    ) {
      recalcAttackRow(row);
    }
  });

  document.addEventListener("input", (e) => {
    const row = resolveLinkedRowFromEventTarget(e.target, "comp-attack-row", "comp-attack-row-dmg");
    if (!row) return;
    if (
      targetHasAnyClass(e.target, [
        "comp-atk-row-misc",
        "comp-atk-type",
        "comp-atk-sequence",
        "comp-atk-dice-count",
        "comp-atk-die",
        "comp-atk-crit-range",
        "comp-atk-crit-mult",
      ])
    ) {
      recalcCompAttackRow(row);
    }
  });

  document.addEventListener("input", (e) => {
    const row = e.target?.closest?.(".spell-slot-row");
    if (!row) return;
    if (
      e.target.classList.contains("spell-slot-total") ||
      e.target.classList.contains("spell-slot-used") ||
      e.target.classList.contains("spell-slot-bonus")
    ) {
      recalcSpellSlotRow(row);
    }
  });

  document.addEventListener("input", (e) => {
    const row = e.target?.closest?.(".spell-entry");
    if (!row) return;
    if (
      targetHasAnyClass(e.target, [
        "spell-offensive",
        "spell-atk-type",
        "spell-atk-misc",
        "spell-dice-count",
        "spell-die",
        "spell-range-type",
      ])
    ) {
      recalcSpellRow(row);
    }
  });

  document.addEventListener("change", (e) => {
    const row = resolveLinkedRowFromEventTarget(e.target, "attack-row", "attack-row-dmg");
    if (!row) return;
    if (
      targetHasAnyClass(e.target, [
        "atk-type",
        "atk-magic-bonus",
        "atk-die",
        "atk-crit-range",
        "atk-crit-mult",
        "atk-twohands",
        "atk-power-attack",
        "atk-furious-focus",
      ])
    ) {
      recalcAttackRow(row);
    }
  });

  document.addEventListener("change", (e) => {
    const row = resolveLinkedRowFromEventTarget(e.target, "comp-attack-row", "comp-attack-row-dmg");
    if (!row) return;
    if (
      targetHasAnyClass(e.target, [
        "comp-atk-type",
        "comp-atk-die",
        "comp-atk-crit-range",
        "comp-atk-crit-mult",
      ])
    ) {
      recalcCompAttackRow(row);
    }
  });

  document.addEventListener("change", (e) => {
    const row = e.target?.closest?.(".spell-entry");
    if (!row) return;
    if (
      targetHasAnyClass(e.target, [
        "spell-offensive",
        "spell-atk-type",
        "spell-die",
        "spell-range-type",
      ])
    ) {
      recalcSpellRow(row);
    }
  });

  /* =========================
     Reset (preserva tema)
  ========================= */
  const resetBtn = document.getElementById("reset-storage");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      const theme = localStorage.getItem(THEME_KEY);

      // 1) Rimuove stato salvato e contatori righe dinamiche.
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(SKILLS_EXTRA_KEY);
      localStorage.removeItem(ATK_STORAGE_KEY);
      localStorage.removeItem(COMP_ATK_STORAGE_KEY);
      localStorage.removeItem(SPELLS_EXTRA_KEY);
      if (theme) localStorage.setItem(THEME_KEY, theme);

      // 2) Svuota stato in memoria.
      Object.keys(state).forEach((k) => delete state[k]);
      saveState(state);

      // 3) Ripristina default HTML su tutti i controlli.
      $$(".page input, .page textarea, .page select").forEach((el) => {
        if (el.type === "button" || el.type === "submit") return;
        if (el.id === "theme-toggle") return;

        if (el.tagName === "SELECT") {
          const idx = Array.from(el.options).findIndex((o) => o.defaultSelected);
          el.selectedIndex = idx >= 0 ? idx : 0;
          return;
        }

        if (el.type === "checkbox" || el.type === "radio") {
          el.checked = !!el.defaultChecked;
          return;
        }

        el.value = el.defaultValue ?? "";
      });

      // 4) Forza i default richiesti della scheda.
      const cdpLevelEl = document.getElementById("cdp-level");
      if (cdpLevelEl) cdpLevelEl.value = "0";

      const tierA = document.getElementById("mythic-tier-identita");
      const tierB = document.getElementById("mythic-tier-mitico");
      if (tierA) tierA.value = "0";
      if (tierB) tierB.value = "0";

      if (enableSpellsTab) enableSpellsTab.checked = false;
      if (enableCompanionTab) enableCompanionTab.checked = false;
      if (enableCdpSection) enableCdpSection.checked = false;

      $$(".ability-score").forEach((el) => {
        el.value = "10";
        el.dataset.baseScore = "10";
      });

      // 5) Rimuove righe extra dinamiche e ricostruisce le sezioni.
      setAtkExtraCount(0);
      attacksTbody?.querySelectorAll(".attack-row-extra").forEach((r) => r.remove());
      attacksTbody?.querySelectorAll(".attack-row-dmg-extra").forEach((r) => r.remove());

      setCompAtkExtraCount(0);
      compAttacksTbody?.querySelectorAll(".comp-attack-row-extra").forEach((r) => r.remove());
      compAttacksTbody?.querySelectorAll(".comp-attack-row-dmg-extra").forEach((r) => r.remove());

      setExtraRowsCount(0);
      rebuildExtraSkillRows();

      for (let lvl = 0; lvl <= 9; lvl++) setSpellExtraCount(lvl, 0);
      rebuildSpellRows();

      // 6) Aggiorna visibilità tab/sezioni opzionali e ricalcola.
      setAllSizeSelectors("medium");
      forceMythicTierEquality();
      updateMythicUI();
      updateMythicAbilityPickAvailability();
      updateMythicAbilityPickVisualState();
      updateMythicTierRowHighlights();
      applyMythicAbilityBonusToScores();
      updateMythicSurgeUI();
      updateOptionalTabsVisibility();
      initPrestigeClassSelects();
      syncPrestigeFields("card");
      updatePrestigeDerivedFields();
      initClassCard();
      syncClassSummaryFields();
      applyAutoClassSkills();
      applySkillFilters();
      updateSpellcastingClassFields();
      updateSpellLevelsVisibility();
      recalcAllSpellSlots();
      recalcAllSpellRows();
      recalcDerived();
      refreshEquipLegendaryBridgeUI();
      refreshLegendaryWeaponUI();
      updateAllCompAbilityMods();
    });
  }

  /* =========================
     Init finale
  ========================= */
  // Dopo restore: ricalcoli + auto-CS + filtri
  initPrestigeClassSelects();
  syncPrestigeFields("card");
  updatePrestigeDerivedFields();
  initClassCard();
  syncClassSummaryFields();
  applyAutoClassSkills();
  applySkillFilters();
  applyAutoBabFromClass();
  moveSpellLevelActionsInline();
  initCollapsibleCards();
  initLegendaryWeaponCard();
  initEquipLegendaryBridge();
  updateAllCompAbilityMods();
  rebuildSpellRows();
  updateSpellLevelsVisibility();
  recalcAllSpellSlots();
  recalcAllSpellRows();
  updateSpellcastingClassFields();
  recalcDerived();
});




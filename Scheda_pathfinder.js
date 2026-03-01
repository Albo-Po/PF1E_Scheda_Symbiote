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

  /* =========================
     Tabs
  ========================= */
  const tabs = $$(".tab");
  const pages = $$(".page");
  const tabIncantesimi = document.getElementById("tab-incantesimi");
  const tabCompagno = document.getElementById("tab-compagno");
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
  const themeState = document.getElementById("theme-state");

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

  if (themeToggle) {
    themeToggle.addEventListener("change", () => {
      applyTheme(themeToggle.checked ? "dark" : "light");
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

  function getSizeAbilityModBonus(code) {
    const size = getCurrentSizeKey();
    if (size === "large" && code === "FOR") return 2;
    if (size === "small" && code === "DES") return 2;
    return 0;
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
      updateAllAbilityMods();
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
    const code = String(statEl.dataset.ability || "");
    const sizeBonus = getSizeAbilityModBonus(code);
    modEl.value = String(pfModFromScore(scoreEl.value) + sizeBonus);
  }

  function updateAllAbilityMods() {
    $$(".stat[data-ability]").forEach(updateAbilityBlock);
  }

  updateAllAbilityMods();

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
      const min = num(scoreEl.min || 1);
      const max = num(scoreEl.max || 50);

      if (scoreEl.dataset.baseScore === undefined) {
        const currentVisible = num(scoreEl.value);
        scoreEl.dataset.baseScore = String(currentVisible - mythicBonus);
      }

      const base = num(scoreEl.dataset.baseScore);
      const total = clamp(base + mythicBonus, min, max);
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
    const bonus = getMythicAbilityBonusFor(code);
    scoreEl.dataset.baseScore = String(num(scoreEl.value) - bonus);
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

    // mod -> score
    if (t.classList.contains("ability-mod")) {
      if (isAbilitySyncing) return;
      isAbilitySyncing = true;

      const stat = t.closest(".stat");
      const scoreEl = stat ? $(".ability-score", stat) : null;
      if (scoreEl) {
        const code = String(stat?.dataset?.ability || "");
        const mythicBonus = getMythicAbilityBonusFor(code);
        const sizeBonus = getSizeAbilityModBonus(code);
        const desired = scoreFromPfMod(num(t.value) - sizeBonus);
        const min = num(scoreEl.min || 1);
        const max = num(scoreEl.max || 50);
        const total = clamp(desired, min, max);
        scoreEl.dataset.baseScore = String(total - mythicBonus);
        scoreEl.value = String(total);
        updateAbilityBlock(stat);
      }

      isAbilitySyncing = false;
      recalcDerived();
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

  function makeSpellRow(level) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "spell-name spell-name-extra";
    input.placeholder = `Incantesimo livello ${level}`;
    return input;
  }

  function rebuildSpellRows() {
    for (let lvl = 0; lvl <= 9; lvl++) {
      const container = document.getElementById(`spell-list-level-${lvl}`);
      if (!container) continue;
      container.querySelectorAll(".spell-name-extra").forEach((el) => el.remove());
      const extra = getSpellExtraCount(lvl);
      for (let i = 0; i < extra; i++) {
        const row = makeSpellRow(lvl);
        container.appendChild(row);
        applySavedValues(row);
        wireAutosave(row);
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
    const dexEl = document.getElementById("ac-dex");
    const dexMaxEl = document.getElementById("ac-dex-max");
    const miscEl = document.getElementById("ac-misc");
    const shieldOffEl = document.getElementById("shield-off");

    const totalEl = document.getElementById("ac-total");
    const touchEl = document.getElementById("ac-touch");
    const ffEl = document.getElementById("ac-ff");

    if (!armorEl || !shieldEl || !dexEl || !miscEl) return;
    if (!totalEl || !touchEl || !ffEl) return;

    const armor = num(armorEl.value);
    const shieldBase = num(shieldEl.value);
    const dex = num(dexEl.value);
    const dexMaxRaw = String(dexMaxEl?.value ?? "").trim();
    const hasDexMax = dexMaxRaw !== "" && Number.isFinite(Number(dexMaxRaw));
    const dexApplied = hasDexMax ? Math.min(dex, num(dexMaxRaw)) : dex;
    const size = getCurrentSizeMods().acAtk;
    const misc = num(miscEl.value);

    const shieldActive = !(shieldOffEl && shieldOffEl.checked);
    const shield = shieldActive ? shieldBase : 0;

    totalEl.value = String(10 + armor + shield + dexApplied + size + misc);
    touchEl.value = String(10 + dexApplied + size + misc);
    ffEl.value = String(10 + armor + shield + size + misc);

    if (shieldOffEl) {
      shieldEl.disabled = !!shieldOffEl.checked;
    }
  }

  /* =========================
     Attacchi — tabella dinamica (FOR/DES)
  ========================= */
  const attacksTbody = document.getElementById("attacks-tbody");
  const addAtkBtn = document.getElementById("add-attack-row");
  const remAtkBtn = document.getElementById("remove-attack-row");

  function getAtkGlobals() {
    return {
      bab: num(document.getElementById("atk-bab")?.value),
      size: getCurrentSizeMods().acAtk,
      misc: num(document.getElementById("atk-misc")?.value),
    };
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

  function recalcAttackRow(tr) {
    if (!tr) return;
    const type = tr.querySelector(".atk-type")?.value || "melee";
    const rowMisc = num(tr.querySelector(".atk-row-misc")?.value);

    const { bab, size, misc } = getAtkGlobals();
    const abil = type === "ranged" ? getAbilityModByCode("DES") : getAbilityModByCode("FOR");

    const total = bab + abil + size + misc + rowMisc;
    const out = tr.querySelector(".atk-total");
    if (out) out.value = fmtSigned(total);
  }

  function recalcAllAttacks() {
    if (!attacksTbody) return;
    attacksTbody.querySelectorAll(".attack-row").forEach(recalcAttackRow);
  }

  function getAtkExtraCount() {
    return parseInt(localStorage.getItem(ATK_STORAGE_KEY) || "0", 10) || 0;
  }
  function setAtkExtraCount(n) {
    localStorage.setItem(ATK_STORAGE_KEY, String(Math.max(0, n)));
  }

  function makeAttackRow() {
    const tr = document.createElement("tr");
    tr.className = "attack-row attack-row-extra";
    tr.innerHTML = `
      <td>
        <select class="select atk-type">
          <option value="melee" selected>Mischia (FOR)</option>
          <option value="ranged">Distanza (DES)</option>
        </select>
      </td>
      <td><input class="atk-name" type="text" placeholder="Es. Arma/Attacco" /></td>
      <td><input class="atk-dmg" type="text" placeholder="Es. 1d6+2" /></td>
      <td><input class="small atk-row-misc" type="number" step="1" value="0" /></td>
      <td><input class="small atk-total" type="text" value="+0" readonly /></td>
      <td><input class="small atk-crit" type="text" placeholder="19-20/x2" /></td>
      <td style="text-align:center;"><button type="button" class="roll-btn atk-roll-btn" title="Tira 1d20 + Tot">Tiro</button></td>
    `;
    return tr;
  }

  function rebuildAttackExtraRows() {
    if (!attacksTbody) return;
    const n = getAtkExtraCount();
    for (let i = 0; i < n; i++) {
      const tr = makeAttackRow();
      attacksTbody.appendChild(tr);
      applySavedValues(tr);
      wireAutosave(tr);
    }
    recalcAllAttacks();
  }

  rebuildAttackExtraRows();

  if (addAtkBtn && attacksTbody) {
    addAtkBtn.addEventListener("click", () => {
      const tr = makeAttackRow();
      attacksTbody.appendChild(tr);
      setAtkExtraCount(getAtkExtraCount() + 1);
      applySavedValues(tr);
      wireAutosave(tr);
      recalcAttackRow(tr);
    });
  }

  if (remAtkBtn && attacksTbody) {
    remAtkBtn.addEventListener("click", () => {
      const extras = attacksTbody.querySelectorAll(".attack-row-extra");
      if (!extras.length) return;
      const last = extras[extras.length - 1];
      last.querySelectorAll("input, textarea, select").forEach((el) => delete state[keyFor(el)]);
      saveState(state);
      last.remove();
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

  function recalcCompAttackRow(tr) {
    if (!tr) return;
    const type = tr.querySelector(".comp-atk-type")?.value || "melee";
    const rowMisc = num(tr.querySelector(".comp-atk-row-misc")?.value);

    const { bab, size, misc, str, dex } = getCompAtkGlobals();
    const abil = type === "ranged" ? dex : str;

    const total = bab + abil + size + misc + rowMisc;
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
    const tr = document.createElement("tr");
    tr.className = "comp-attack-row comp-attack-row-extra";
    tr.innerHTML = `
      <td>
        <select class="select comp-atk-type">
          <option value="melee" selected>Mischia (FOR)</option>
          <option value="ranged">Distanza (DES)</option>
        </select>
      </td>
      <td><input class="comp-atk-name" type="text" placeholder="Es. Attacco compagno" /></td>
      <td><input class="comp-atk-dmg" type="text" placeholder="Es. 1d6+4" /></td>
      <td><input class="small comp-atk-row-misc" type="number" step="1" value="0" /></td>
      <td><input class="small comp-atk-total" type="text" value="+0" readonly /></td>
      <td><input class="small comp-atk-crit" type="text" placeholder="20/x2" /></td>
      <td style="text-align:center;"><button type="button" class="roll-btn comp-atk-roll-btn" title="Tira 1d20 + Tot">Tiro</button></td>
    `;
    return tr;
  }

  function rebuildCompAttackExtraRows() {
    if (!compAttacksTbody) return;
    const n = getCompAtkExtraCount();
    for (let i = 0; i < n; i++) {
      const tr = makeCompAttackRow();
      compAttacksTbody.appendChild(tr);
      applySavedValues(tr);
      wireAutosave(tr);
    }
    recalcAllCompAttacks();
  }

  rebuildCompAttackExtraRows();

  if (addCompAtkBtn && compAttacksTbody) {
    addCompAtkBtn.addEventListener("click", () => {
      const tr = makeCompAttackRow();
      compAttacksTbody.appendChild(tr);
      setCompAtkExtraCount(getCompAtkExtraCount() + 1);
      applySavedValues(tr);
      wireAutosave(tr);
      recalcCompAttackRow(tr);
    });
  }

  if (remCompAtkBtn && compAttacksTbody) {
    remCompAtkBtn.addEventListener("click", () => {
      const extras = compAttacksTbody.querySelectorAll(".comp-attack-row-extra");
      if (!extras.length) return;
      const last = extras[extras.length - 1];
      last.querySelectorAll("input, textarea, select").forEach((el) => delete state[keyFor(el)]);
      saveState(state);
      last.remove();
      setCompAtkExtraCount(getCompAtkExtraCount() - 1);
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
    intuizione: "senso motivazioni",
    "utilizzare oggetti magici": "utilizzare congegni magici",
    furtivita: "furtività",
  };

  function canonicalSkill(name) {
    const n = normSkillName(name);
    return SKILL_ALIASES[n] || n;
  }

  const CLASS_SKILLS = {
    Barbaro: ["acrobazia","addestrare animali","artigianato","cavalcare","intimidire","nuotare","percezione","scalare","sopravvivenza"],
    Bardo: ["acrobazia","addestrare animali","artigianato","artista della fuga","camuffare","diplomazia","furtività","intimidire","intrattenere","linguistica","percezione","professione","raggirare","rapidità di mano","sapienza magica","senso motivazioni","utilizzare congegni magici","valutare","conoscenze (tutte)"],
    Chierico: ["artigianato","diplomazia","guarire","linguistica","professione","sapienza magica","senso motivazioni","conoscenze (arcane)","conoscenze (nobiltà)","conoscenze (piani)","conoscenze (religioni)"],
    Druido: ["addestrare animali","artigianato","cavalcare","guarire","percezione","professione","sapienza magica","sopravvivenza","conoscenze (natura)"],
    Guerriero: ["addestrare animali","artigianato","cavalcare","intimidire","nuotare","professione","scalare","sopravvivenza"],
    Ladro: ["acrobazia","artista della fuga","camuffare","diplomazia","disattivare congegni","furtività","intimidire","intrattenere","linguistica","nuotare","percezione","raggirare","rapidità di mano","scalare","senso motivazioni","utilizzare congegni magici","valutare","conoscenze (dungeon)","conoscenze (locali)"],
    Mago: ["artigianato","linguistica","professione","sapienza magica","conoscenze (tutte)"],
    Monaco: ["acrobazia","artigianato","artista della fuga","intimidire","nuotare","percezione","professione","scalare","senso motivazioni"],
    Paladino: ["addestrare animali","artigianato","cavalcare","diplomazia","guarire","professione","sapienza magica","senso motivazioni","conoscenze (nobiltà)","conoscenze (religioni)"],
    Ranger: ["addestrare animali","artigianato","cavalcare","furtività","guarire","intimidire","nuotare","percezione","professione","scalare","sopravvivenza","conoscenze (dungeon)","conoscenze (geografia)","conoscenze (natura)"],
    Stregone: ["artigianato","conoscenze (arcane)","professione","sapienza magica","utilizzare congegni magici"],
  };

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
    { name: "Intrattenere (Canto)", abil: "CAR", acp: false },
    { name: "Linguistica", abil: "INT", acp: false },
    { name: "Nuotare", abil: "FOR", acp: true },
    { name: "Percezione", abil: "SAG", acp: false },
    { name: "Professione (Soldato)", abil: "SAG", acp: false },
    { name: "Raggirare", abil: "CAR", acp: false },
    { name: "Rapidità di Mano", abil: "DES", acp: false },
    { name: "Sapienza Magica", abil: "INT", acp: false },
    { name: "Scalare", abil: "FOR", acp: true },
    { name: "Senso Motivazioni", abil: "SAG", acp: false },
    { name: "Sopravvivenza", abil: "SAG", acp: false },
    { name: "Utilizzare Congegni Magici", abil: "CAR", acp: false },
    { name: "Valutare", abil: "INT", acp: false },
    { name: "Volare", abil: "DES", acp: true },
  ];

  function getSelectedClasses() {
    const sel = document.getElementById("pf-class-select");
    if (!sel) return [];
    const v = String(sel.value || "").trim();
    return v ? [v] : [];
  }

  function buildClassSkillSet(classes) {
    const set = new Set();
    classes.forEach((cls) => (CLASS_SKILLS[cls] || []).forEach((sk) => set.add(canonicalSkill(sk))));
    return set;
  }

  function skillFamilyName(skillName) {
    const canon = canonicalSkill(skillName);
    const m = canon.match(/^([^()]+)\s*\(.+\)$/);
    return m ? m[1].trim() : canon;
  }

  function applyAutoClassSkills() {
    const classes = getSelectedClasses();
    if (!classes.length) {
      $$("#skills-tbody tr.skill-row .skill-cs").forEach((el) => {
        el.checked = false;
      });
      recalcAllSkills();
      applySkillFilters();
      return;
    }
    const csSet = buildClassSkillSet(classes);

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

  function recalcAllSkills() {
    $$("#skills-tbody tr.skill-row").forEach(recalcSkillRow);
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
      <td style="text-align:center;"><input class="skill-cs" type="checkbox" /></td>
      <td><input class="skill-name" type="text" value="${name}" placeholder="${placeholder}" /></td>
      <td>
        <input class="small skill-abil-fixed" type="text" value="${ability}" readonly />
        <input class="skill-abil" type="hidden" value="${ability}" />
      </td>
      <td style="text-align:center;"><input class="skill-acp" type="checkbox" ${acp ? "checked" : ""} /></td>
      <td><input class="small skill-ranks" type="number" step="1" min="0" value="0" /></td>
      <td><input class="small skill-misc" type="number" step="1" value="0" /></td>
      <td><input class="small skill-total" type="text" value="+0" readonly /></td>
      <td style="text-align:center;"><button type="button" class="roll-btn" title="Tira 1d20 + Tot">Tiro</button></td>
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
    if (t.id === "pf-class-select") applyAutoClassSkills();
    if (t.id === "spellcaster-class") {
      updateSpellcastingClassFields();
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

  // roll skill (delegation)
  document.addEventListener("click", (e) => {
    const addSpellBtn = e.target.closest?.("[id^='add-spell-']");
    if (addSpellBtn) {
      e.preventDefault();
      e.stopPropagation();
      const level = num(addSpellBtn.dataset.level);
      if (level < 0 || level > 9) return;
      const container = document.getElementById(`spell-list-level-${level}`);
      if (!container) return;
      const row = makeSpellRow(level);
      container.appendChild(row);
      setSpellExtraCount(level, getSpellExtraCount(level) + 1);
      applySavedValues(row);
      wireAutosave(row);
      row.focus();
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

      const extras = container.querySelectorAll(".spell-name-extra");
      if (!extras.length) return;

      const last = extras[extras.length - 1];
      delete state[keyFor(last)];
      saveState(state);
      last.remove();
      setSpellExtraCount(level, getSpellExtraCount(level) - 1);
      return;
    }

    const atkBtn = e.target.closest?.(".atk-roll-btn");
    if (atkBtn) {
      const tr = atkBtn.closest("tr.attack-row");
      if (!tr) return;

      recalcAttackRow(tr);
      const tot = parseSignedInt(tr.querySelector(".atk-total")?.value);
      const roll = d20();
      const result = roll + tot;
      const name = tr.querySelector(".atk-name")?.value?.trim() || "Attacco";
      toast(`${name}: d20(${roll}) + Tot(${tot >= 0 ? "+" : ""}${tot}) = ${result}`);
      return;
    }

    const compAtkBtn = e.target.closest?.(".comp-atk-roll-btn");
    if (compAtkBtn) {
      const tr = compAtkBtn.closest("tr.comp-attack-row");
      if (!tr) return;

      recalcCompAttackRow(tr);
      const tot = parseSignedInt(tr.querySelector(".comp-atk-total")?.value);
      const roll = d20();
      const result = roll + tot;
      const name = tr.querySelector(".comp-atk-name")?.value?.trim() || "Attacco compagno";
      toast(`${name}: d20(${roll}) + Tot(${tot >= 0 ? "+" : ""}${tot}) = ${result}`);
      return;
    }

    const btn = e.target.closest?.(".roll-btn");
    if (!btn) return;

    const tr = btn.closest("tr.skill-row");
    if (!tr) return;

    recalcSkillRow(tr);
    const tot = parseSignedInt(tr.querySelector(".skill-total")?.value);
    const roll = d20();
    const result = roll + tot;

    const name = tr.querySelector(".skill-name")?.value?.trim() || "Abilità";
    toast(`${name}: d20(${roll}) + Tot(${tot >= 0 ? "+" : ""}${tot}) = ${result}`);
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

    // incantesimi (caratteristica chiave + mod)
    updateSpellcastingClassFields();
    recalcAllSpellSlots();
  }

  // listeners combat
  ["init-misc"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", recalcInitiative);
    el.addEventListener("change", recalcInitiative);
  });

  ["ac-armor", "ac-shield", "ac-dex-max", "ac-misc", "shield-off"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", recalcAC);
    el.addEventListener("change", recalcAC);
  });

  const atkBabEl = document.getElementById("atk-bab");
  if (atkBabEl) {
    atkBabEl.addEventListener("input", () => {
      recalcAllAttacks();
      recalcCmbCmd();
    });
    atkBabEl.addEventListener("change", () => {
      recalcAllAttacks();
      recalcCmbCmd();
    });
  }

  const atkMiscEl = document.getElementById("atk-misc");
  if (atkMiscEl) {
    atkMiscEl.addEventListener("input", recalcAllAttacks);
    atkMiscEl.addEventListener("change", recalcAllAttacks);
  }

  const spellcasterLevelEl = document.getElementById("spellcaster-level");
  if (spellcasterLevelEl) {
    spellcasterLevelEl.addEventListener("input", recalcAllSpellSlots);
    spellcasterLevelEl.addEventListener("change", recalcAllSpellSlots);
  }

  ["comp-atk-bab", "comp-atk-str-mod", "comp-atk-dex-mod", "comp-atk-misc"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", recalcAllCompAttacks);
    el.addEventListener("change", recalcAllCompAttacks);
  });

  document.addEventListener("input", (e) => {
    const row = e.target?.closest?.(".attack-row");
    if (!row) return;
    if (e.target.classList.contains("atk-row-misc") || e.target.classList.contains("atk-type")) {
      recalcAttackRow(row);
    }
  });

  document.addEventListener("input", (e) => {
    const row = e.target?.closest?.(".comp-attack-row");
    if (!row) return;
    if (
      e.target.classList.contains("comp-atk-row-misc") ||
      e.target.classList.contains("comp-atk-type")
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

  document.addEventListener("change", (e) => {
    const row = e.target?.closest?.(".attack-row");
    if (!row) return;
    if (e.target.classList.contains("atk-type")) recalcAttackRow(row);
  });

  document.addEventListener("change", (e) => {
    const row = e.target?.closest?.(".comp-attack-row");
    if (!row) return;
    if (e.target.classList.contains("comp-atk-type")) recalcCompAttackRow(row);
  });

  /* =========================
     Reset (preserva tema)
  ========================= */
  const resetBtn = document.getElementById("reset-storage");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      const theme = localStorage.getItem(THEME_KEY);
      localStorage.clear();
      if (theme) localStorage.setItem(THEME_KEY, theme);
      location.reload();
    });
  }

  /* =========================
     Init finale
  ========================= */
  // Dopo restore: ricalcoli + auto-CS + filtri
  applyAutoClassSkills();
  applySkillFilters();
  rebuildSpellRows();
  recalcAllSpellSlots();
  updateSpellcastingClassFields();
  recalcDerived();
});




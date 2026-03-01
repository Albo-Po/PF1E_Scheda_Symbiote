// scheda_pathfinder.js — refactor “snello e coerente”
document.addEventListener("DOMContentLoaded", () => {
  /* =========================
     Helpers (UNA SOLA VOLTA)
  ========================= */
  const THEME_KEY = "pf1e_theme";
  const STORAGE_KEY = "pf1e_sheet_state_v3";
  const SKILLS_EXTRA_KEY = "pf1e_skills_extra_rows_v3";
  const ATK_STORAGE_KEY = "pf1e_attacks_extra_rows_v1";

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
    if (themeState) themeState.textContent = isDark ? "Dark" : "Light";
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

  updateAllAbilityMods();

  document.addEventListener("input", (e) => {
    const t = e.target;
    if (!t?.classList) return;

    // score -> mod
    if (t.classList.contains("ability-score")) {
      if (isAbilitySyncing) return;
      isAbilitySyncing = true;
      updateAbilityBlock(t.closest(".stat"));
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
        const desired = scoreFromPfMod(t.value);
        const min = num(scoreEl.min || 1);
        const max = num(scoreEl.max || 50);
        scoreEl.value = String(clamp(desired, min, max));
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

  function getMythicTier() {
    const va = tierI ? num(tierI.value) : 0;
    const vb = tierM ? num(tierM.value) : 0;
    return va || vb || 0;
  }

  function updateMythicUI() {
    const tier = getMythicTier();
    const isMythic = tier > 0;
    if (mythicBadge) mythicBadge.style.display = isMythic ? "none" : "block";
    if (tabMitico) {
      tabMitico.classList.toggle("is-disabled", !isMythic);
      tabMitico.setAttribute("aria-disabled", String(!isMythic));
      if (!isMythic && tabMitico.getAttribute("aria-selected") === "true") {
        activate("page-identita", true);
      }
    }
  }

  [tierI, tierM].forEach((el) => {
    if (!el) return;
    el.addEventListener("input", () => {
      updateMythicUI();
      recalcInitiative();
    });
    el.addEventListener("change", () => {
      updateMythicUI();
      recalcInitiative();
    });
  });

  updateMythicUI();

  /* =========================
     Combattimento — Iniziativa
     DES + misc + tier (solo se tier > 2)
  ========================= */
  function recalcInitiative() {
    const out = document.getElementById("init-total");
    const miscEl = document.getElementById("init-misc");
    if (!out) return;

    const dex = getAbilityModByCode("DES");
    const misc = miscEl ? num(miscEl.value) : 0;
    const tier = getMythicTier();
    const mythicBonus = tier > 2 ? tier : 0;

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
    const sizeEl = document.getElementById("ac-size");
    const miscEl = document.getElementById("ac-misc");
    const shieldOffEl = document.getElementById("shield-off");

    const totalEl = document.getElementById("ac-total");
    const touchEl = document.getElementById("ac-touch");
    const ffEl = document.getElementById("ac-ff");

    if (!armorEl || !shieldEl || !dexEl || !sizeEl || !miscEl) return;
    if (!totalEl || !touchEl || !ffEl) return;

    const armor = num(armorEl.value);
    const shieldBase = num(shieldEl.value);
    const dex = num(dexEl.value);
    const size = num(sizeEl.value);
    const misc = num(miscEl.value);

    const shieldActive = !(shieldOffEl && shieldOffEl.checked);
    const shield = shieldActive ? shieldBase : 0;

    totalEl.value = String(10 + armor + shield + dex + size + misc);
    touchEl.value = String(10 + dex + size + misc);
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
      size: num(document.getElementById("atk-size")?.value),
      misc: num(document.getElementById("atk-misc")?.value),
    };
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
      <td><input class="atk-notes" type="text" placeholder="note..." /></td>
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
     Skills — calcolo + filtri + righe extra + auto-CS + roll
  ========================= */
  const skillsTbody = document.getElementById("skills-tbody");
  const addSkillBtn = document.getElementById("add-skill-row");
  const remSkillBtn = document.getElementById("remove-skill-row");

  function normSkillName(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[’']/g, "'");
  }

  const SKILL_ALIASES = { osservare: "percezione", ascoltare: "percezione" };

  function canonicalSkill(name) {
    const n = normSkillName(name);
    return SKILL_ALIASES[n] || n;
  }

  const CLASS_SKILLS = {
    Barbaro: ["acrobazia","addestrare animali","artigianato","cavalcare","intimidire","nuotare","percezione","scalare","sopravvivenza"],
    Bardo: ["acrobazia","addestrare animali","artigianato","artista della fuga","camuffare","diplomazia","furtività","intimidire","intrattenere","linguistica","percezione","professione","raggirare","rapidità di mano","senso motivazioni","utilizzare oggetti magici","valutare",
            "conoscenze (arcane)","conoscenze (dungeon)","conoscenze (geografia)","conoscenze (locali)","conoscenze (natura)","conoscenze (nobiltà)","conoscenze (piani)","conoscenze (religioni)"],
    Chierico: ["artigianato","diplomazia","guarire","linguistica","professione","senso motivazioni","conoscenze (arcane)","conoscenze (piani)","conoscenze (religioni)"],
    Druido: ["artigianato","cavalcare","conoscenze (geografia)","conoscenze (natura)","guarire","nuotare","percezione","professione","sopravvivenza"],
    Guerriero: ["artigianato","cavalcare","intimidire","nuotare","scalare","sopravvivenza"],
    Ladro: ["acrobazia","artista della fuga","camuffare","diplomazia","disattivare congegni","furtività","intimidire","intrattenere","linguistica","nuotare","percezione","raggirare","rapidità di mano","scalare","senso motivazioni","valutare",
            "conoscenze (dungeon)","conoscenze (locali)","utilizzare congegni magici"],
    Mago: ["artigianato","linguistica","professione","sapienza magica",
           "conoscenze (arcane)","conoscenze (dungeon)","conoscenze (geografia)","conoscenze (locali)","conoscenze (nobiltà)","conoscenze (piani)","conoscenze (religioni)"],
    Monaco: ["acrobazia","artista della fuga","cavalcare","diplomazia","furtività","intimidire","nuotare","percezione","professione","scalare","senso motivazioni"],
    Paladino: ["cavalcare","diplomazia","guarire","intuizione","professione","senso motivazioni"],
    Ranger: ["addestrare animali","artigianato","cavalcare","conoscenze (dungeon)","conoscenze (geografia)","conoscenze (natura)","guarire","intuizione","nuotare","percezione","professione","scalare","sopravvivenza"],
    Stregone: ["artigianato","camuffare","intrattenere","linguistica","professione","sapienza magica","utilizzare oggetti magici","conoscenze (arcane)"],
  };

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

  function applyAutoClassSkills() {
    const classes = getSelectedClasses();
    if (!classes.length) return;
    const csSet = buildClassSkillSet(classes);

    $$("#skills-tbody tr.skill-row").forEach((tr) => {
      const nameEl = tr.querySelector(".skill-name");
      const csEl = tr.querySelector(".skill-cs");
      if (!nameEl || !csEl) return;
      csEl.checked = csSet.has(canonicalSkill(nameEl.value));
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

    totalEl.value = fmtSigned(ranks + abilMod + misc + csBonus - acpPenalty);
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

  function makeSkillRow() {
    const tr = document.createElement("tr");
    tr.className = "skill-row skill-row-extra";
    tr.innerHTML = `
      <td style="text-align:center;"><input class="skill-cs" type="checkbox" /></td>
      <td><input class="skill-name" type="text" placeholder="Nuova abilità" /></td>
      <td>
        <select class="select skill-abil">
          <option value="DES" selected>DES</option>
          <option value="FOR">FOR</option>
          <option value="COS">COS</option>
          <option value="INT">INT</option>
          <option value="SAG">SAG</option>
          <option value="CAR">CAR</option>
        </select>
      </td>
      <td style="text-align:center;"><input class="skill-acp" type="checkbox" /></td>
      <td><input class="small skill-ranks" type="number" step="1" min="0" value="0" /></td>
      <td><input class="small skill-misc" type="number" step="1" value="0" /></td>
      <td><input class="small skill-total" type="text" value="+0" readonly /></td>
      <td><input class="skill-notes" type="text" /></td>
      <td style="text-align:center;"><button type="button" class="roll-btn" title="Tira 1d20 + Tot">🎲</button></td>
    `;
    return tr;
  }

  function getExtraRowsCount() {
    return parseInt(localStorage.getItem(SKILLS_EXTRA_KEY) || "0", 10) || 0;
  }
  function setExtraRowsCount(n) {
    localStorage.setItem(SKILLS_EXTRA_KEY, String(Math.max(0, n)));
  }

  function rebuildExtraSkillRows() {
    if (!skillsTbody) return;
    skillsTbody.querySelectorAll(".skill-row-extra").forEach((r) => r.remove());
    const n = getExtraRowsCount();
    for (let i = 0; i < n; i++) {
      const tr = makeSkillRow();
      skillsTbody.appendChild(tr);
      applySavedValues(tr);
      wireAutosave(tr);
    }
  }

  rebuildExtraSkillRows();

  if (addSkillBtn && skillsTbody) {
    addSkillBtn.addEventListener("click", () => {
      const tr = makeSkillRow();
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

    // skills (perché abilMod cambia)
    recalcAllSkills();
  }

  // listeners combat
  ["init-misc"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", recalcInitiative);
    el.addEventListener("change", recalcInitiative);
  });

  ["ac-armor", "ac-shield", "ac-size", "ac-misc", "shield-off"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", recalcAC);
    el.addEventListener("change", recalcAC);
  });

  ["atk-bab", "atk-size", "atk-misc"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", recalcAllAttacks);
    el.addEventListener("change", recalcAllAttacks);
  });

  document.addEventListener("input", (e) => {
    const row = e.target?.closest?.(".attack-row");
    if (!row) return;
    if (e.target.classList.contains("atk-row-misc") || e.target.classList.contains("atk-type")) {
      recalcAttackRow(row);
    }
  });

  document.addEventListener("change", (e) => {
    const row = e.target?.closest?.(".attack-row");
    if (!row) return;
    if (e.target.classList.contains("atk-type")) recalcAttackRow(row);
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
  recalcDerived();
});
// Scheda_pathfinder.js
document.addEventListener("DOMContentLoaded", function () {

  /* =====================================
     TABS (PAGINE)
  ====================================== */
  const tabs  = Array.from(document.querySelectorAll('.tab'));
  const pages = Array.from(document.querySelectorAll('.page'));

  function activate(targetId, pushHash = true) {
    pages.forEach(p => p.classList.toggle('active', p.id === targetId));
    tabs.forEach(t =>
      t.setAttribute('aria-selected', String(t.dataset.target === targetId))
    );
    if (pushHash) history.replaceState(null, '', '#' + targetId);
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      if (tab.classList.contains('is-disabled')) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      activate(tab.dataset.target, true);
    });
  });

  const hash = (location.hash || '').replace('#', '');
  if (hash && document.getElementById(hash)) activate(hash, false);



/* =====================================
   MODIFICATORI CARATTERISTICHE PF (BIDIREZIONALE)
   - Score -> Mod: mod = floor((score - 10)/2)
   - Mod -> Score: score = 10 + 2*mod (step naturale)
====================================== */
function pfModFromScore(score){
  const s = Number(score);
  if (!Number.isFinite(s)) return 0;
  return Math.floor((s - 10) / 2);
}

// score "canonico" per un dato mod (scelta semplice e stabile)
function scoreFromPfMod(mod){
  const m = Number(mod);
  if (!Number.isFinite(m)) return 10;
  return 10 + (2 * m);
}

function clamp(n, min, max){
  return Math.min(max, Math.max(min, n));
}

// evita loop quando aggiorniamo un campo dall'altro
let isAbilitySyncing = false;

function updateAbilityBlock(statEl){
  if (!statEl) return;
  const scoreEl = statEl.querySelector('.ability-score');
  const modEl   = statEl.querySelector('.ability-mod');
  if (!scoreEl || !modEl) return;

  const score = Number(scoreEl.value);
  const mod = pfModFromScore(score);

  // mod come numero (input type=number)
  modEl.value = String(mod);
}

function updateAllAbilityMods(){
  document.querySelectorAll('.stat[data-ability]').forEach(updateAbilityBlock);
}

// init
updateAllAbilityMods();

// Score -> Mod
document.addEventListener('input', (e) => {
  if (!e.target || !e.target.classList) return;
  if (!e.target.classList.contains('ability-score')) return;

  if (isAbilitySyncing) return;
  isAbilitySyncing = true;

  const stat = e.target.closest('.stat');
  updateAbilityBlock(stat);

  isAbilitySyncing = false;
});

// Mod -> Score
document.addEventListener('input', (e) => {
  if (!e.target || !e.target.classList) return;
  if (!e.target.classList.contains('ability-mod')) return;

  if (isAbilitySyncing) return;
  isAbilitySyncing = true;

  const stat = e.target.closest('.stat');
  if (stat){
    const scoreEl = stat.querySelector('.ability-score');
    const modEl = stat.querySelector('.ability-mod');
    if (scoreEl && modEl){
      const desiredScore = scoreFromPfMod(modEl.value);

      // rispetta min/max dell'input punteggio
      const min = Number(scoreEl.min || 1);
      const max = Number(scoreEl.max || 50);

      scoreEl.value = String(clamp(desiredScore, min, max));

      // assicura coerenza (se clamp ha cambiato il valore)
      updateAbilityBlock(stat);

      // notifica altri listener (autosave, skills recalculation ecc.)
      scoreEl.dispatchEvent(new Event('input', { bubbles: true }));
      scoreEl.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  isAbilitySyncing = false;
});
/* =====================================
   CAP Classe di Prestigio (max 10)
====================================== */
const cdpLevel = document.getElementById('cdp-level');

if (cdpLevel){
  cdpLevel.addEventListener('input', () => {
    let val = Number(cdpLevel.value);

    if (!Number.isFinite(val)) val = 0;

    if (val > 10) val = 10;
    if (val < 0) val = 0;

    cdpLevel.value = val;
  });
}

/* =========================
   COMBATTIMENTO — Iniziativa + Attacchi (calcolati)
========================= */

function num(v){
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function fmtSigned(n){
  const v = Math.trunc(num(n));
  return (v >= 0 ? "+" : "") + String(v);
}
function getAbilityModByCode(code){
  const stat = document.querySelector(`.stat[data-ability="${code}"]`);
  if (!stat) return 0;
  const modEl = stat.querySelector('.ability-mod');
  if (!modEl) return 0;
  const n = Number(modEl.value);
  return Number.isFinite(n) ? n : 0;
}
function getMythicTier(){
  // prova prima identità, poi mitico
  const a = document.getElementById('mythic-tier-identita');
  const b = document.getElementById('mythic-tier-mitico');
  const va = a ? num(a.value) : 0;
  const vb = b ? num(b.value) : 0;
  return va || vb || 0;
}

/* Iniziativa: DES + misc + tier (solo se >2) */
function recalcInitiative(){
  const out = document.getElementById('init-total');
  const miscEl = document.getElementById('init-misc');
  if (!out) return;

  const dex = getAbilityModByCode('DES');
  const misc = miscEl ? num(miscEl.value) : 0;
  const tier = getMythicTier();
  const mythicBonus = tier > 2 ? tier : 0;

  out.value = fmtSigned(dex + misc + mythicBonus);
}

/* Attacchi: BAB + (FOR/DES) + taglia + varie */
function recalcAttacks(){
  const babEl = document.getElementById('atk-bab');
  const sizeEl = document.getElementById('atk-size');
  const miscEl = document.getElementById('atk-misc');
  const meleeOut = document.getElementById('atk-melee-total');
  const rangedOut = document.getElementById('atk-ranged-total');
  if (!babEl || !sizeEl || !miscEl || !meleeOut || !rangedOut) return;

  const bab = num(babEl.value);
  const size = num(sizeEl.value);
  const misc = num(miscEl.value);

  const str = getAbilityModByCode('FOR');
  const dex = getAbilityModByCode('DES');

  meleeOut.value = fmtSigned(bab + str + size + misc);
  rangedOut.value = fmtSigned(bab + dex + size + misc);
}

// init
recalcInitiative();
recalcAttacks();

// ricalcola quando cambiano i campi
['init-misc','atk-bab','atk-size','atk-misc'].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('input', () => { recalcInitiative(); recalcAttacks(); });
  el.addEventListener('change', () => { recalcInitiative(); recalcAttacks(); });
});

// ricalcola quando cambiano FOR/DES (score o mod)
document.addEventListener('input', (e) => {
  const inStat = e.target && e.target.closest && e.target.closest('.stat[data-ability="FOR"], .stat[data-ability="DES"]');
  if (inStat && (e.target.classList.contains('ability-score') || e.target.classList.contains('ability-mod'))){
    recalcInitiative();
    recalcAttacks();
  }
});

// ricalcola quando cambia la categoria mitica (identità o mitico)
['mythic-tier-identita','mythic-tier-mitico'].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('input', recalcInitiative);
  el.addEventListener('change', recalcInitiative);
});


/* =========================
   ATTACCHI DINAMICI + CALCOLO (FOR/DES)
========================= */
const attacksTbody = document.getElementById('attacks-tbody');
const addAtkBtn = document.getElementById('add-attack-row');
const remAtkBtn = document.getElementById('remove-attack-row');

const ATK_STORAGE_KEY = 'pf1e_attacks_extra_rows_v1';

function num(v){
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function fmtSigned(n){
  const v = Math.trunc(num(n));
  return (v >= 0 ? "+" : "") + String(v);
}
function getAbilityModByCode(code){
  const stat = document.querySelector(`.stat[data-ability="${code}"]`);
  if (!stat) return 0;
  const modEl = stat.querySelector('.ability-mod');
  if (!modEl) return 0;
  const n = Number(modEl.value);
  return Number.isFinite(n) ? n : 0;
}

function getAtkGlobals(){
  const bab = num(document.getElementById('atk-bab')?.value);
  const size = num(document.getElementById('atk-size')?.value);
  const misc = num(document.getElementById('atk-misc')?.value);
  return { bab, size, misc };
}

function recalcAttackRow(tr){
  if (!tr) return;
  const type = tr.querySelector('.atk-type')?.value || 'melee';
  const rowMisc = num(tr.querySelector('.atk-row-misc')?.value);

  const { bab, size, misc } = getAtkGlobals();
  const abil = (type === 'ranged') ? getAbilityModByCode('DES') : getAbilityModByCode('FOR');

  const total = bab + abil + size + misc + rowMisc;
  const out = tr.querySelector('.atk-total');
  if (out) out.value = fmtSigned(total);
}

function recalcAllAttacks(){
  if (!attacksTbody) return;
  attacksTbody.querySelectorAll('.attack-row').forEach(recalcAttackRow);
}

function getAtkExtraCount(){
  return parseInt(localStorage.getItem(ATK_STORAGE_KEY) || '0', 10) || 0;
}
function setAtkExtraCount(n){
  localStorage.setItem(ATK_STORAGE_KEY, String(Math.max(0, n)));
}

function makeAttackRow(){
  const tr = document.createElement('tr');
  tr.className = 'attack-row attack-row-extra';
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

// ricostruisci righe extra all'avvio (solo struttura; i valori li recupera autosave già presente)
function rebuildAttackExtraRows(){
  if (!attacksTbody) return;
  const n = getAtkExtraCount();
  for (let i = 0; i < n; i++){
    const tr = makeAttackRow();
    attacksTbody.appendChild(tr);

    // se hai applySavedValues/wireAutosave nel tuo file (come per skills), riusiamole:
    if (typeof applySavedValues === 'function') applySavedValues(tr);
    if (typeof wireAutosave === 'function') wireAutosave(tr);
  }
  recalcAllAttacks();
}
rebuildAttackExtraRows();

// bottoni add/remove
if (addAtkBtn && attacksTbody){
  addAtkBtn.addEventListener('click', () => {
    const tr = makeAttackRow();
    attacksTbody.appendChild(tr);
    setAtkExtraCount(getAtkExtraCount() + 1);

    if (typeof applySavedValues === 'function') applySavedValues(tr);
    if (typeof wireAutosave === 'function') wireAutosave(tr);

    recalcAttackRow(tr);
  });
}

if (remAtkBtn && attacksTbody){
  remAtkBtn.addEventListener('click', () => {
    const extras = attacksTbody.querySelectorAll('.attack-row-extra');
    if (!extras.length) return;
    extras[extras.length - 1].remove();
    setAtkExtraCount(getAtkExtraCount() - 1);
    recalcAllAttacks();
  });
}

// listener: ricalcola quando tocchi campi globali
['atk-bab','atk-size','atk-misc'].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('input', recalcAllAttacks);
  el.addEventListener('change', recalcAllAttacks);
});

// listener: ricalcola quando cambi tipo o misc riga
document.addEventListener('input', (e) => {
  const row = e.target?.closest?.('.attack-row');
  if (!row) return;

  if (
    e.target.classList.contains('atk-row-misc') ||
    e.target.classList.contains('atk-type')
  ){
    recalcAttackRow(row);
  }
});
document.addEventListener('change', (e) => {
  const row = e.target?.closest?.('.attack-row');
  if (!row) return;
  if (e.target.classList.contains('atk-type')) recalcAttackRow(row);
});

// ricalcola se cambiano FOR o DES nella tab Identità
document.addEventListener('input', (e) => {
  const stat = e.target?.closest?.('.stat[data-ability="FOR"], .stat[data-ability="DES"]');
  if (!stat) return;

  if (e.target.classList.contains('ability-score') || e.target.classList.contains('ability-mod')){
    recalcAllAttacks();
  }
});

// init finale
recalcAllAttacks();

  /* =====================================
     SALVATAGGIO AUTOMATICO (localStorage)
     - salva input/textarea/select
     - ESCLUDE il toggle tema (#theme-toggle)
  ====================================== */
  const STORAGE_KEY = 'pf1e_sheet_state_v3';
  const SKILLS_EXTRA_KEY = 'pf1e_skills_extra_rows_v3';

  function loadState() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch { return {}; }
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  const state = loadState();

  function domPathKey(el) {
    const page = el.closest('.page');
    const pageId = page ? page.id : 'root';

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
    return `${pageId}::${parts.join('>')}`;
  }

  function keyFor(el) {
    return el.dataset.key || domPathKey(el);
  }

  function applySavedValues(root = document) {
    const fields = root.querySelectorAll('input, textarea, select');
    fields.forEach(el => {
      if (el.type === 'button' || el.type === 'submit') return;
      if (el.id === 'theme-toggle') return; // IMPORTANTISSIMO: tema ha storage dedicato
      const k = keyFor(el);

      if (Object.prototype.hasOwnProperty.call(state, k)) {
        // checkbox (tranne theme-toggle che è escluso)
        if (el.type === 'checkbox') {
          el.checked = !!state[k];
        } else {
          el.value = state[k];
        }
      }
    });
  }

  function wireAutosave(root = document) {
    const fields = root.querySelectorAll('input, textarea, select');
    fields.forEach(el => {
      if (el.type === 'button' || el.type === 'submit') return;
      if (el.id === 'theme-toggle') return;

      const handler = () => {
        const k = keyFor(el);

        if (el.type === 'checkbox') {
          state[k] = !!el.checked;
        } else {
          state[k] = el.value;
        }
        saveState(state);
      };

      el.addEventListener('input', handler);
      el.addEventListener('change', handler);
    });
  }

  applySavedValues(document);
  wireAutosave(document);


  /* =====================================
     SKILLS — righe dinamiche + tabella nuova
  ====================================== */
  const skillsTbody = document.getElementById('skills-tbody');
  const addBtn = document.getElementById('add-skill-row');
  const removeBtn = document.getElementById('remove-skill-row');

  function makeSkillRow() {
    const tr = document.createElement('tr');
    tr.className = 'skill-row skill-row-extra';
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
    return parseInt(localStorage.getItem(SKILLS_EXTRA_KEY) || '0', 10) || 0;
  }

  function setExtraRowsCount(n) {
    localStorage.setItem(SKILLS_EXTRA_KEY, String(Math.max(0, n)));
  }

  function rebuildExtraRows() {
    if (!skillsTbody) return;

    // rimuovi eventuali extra già presenti
    skillsTbody.querySelectorAll('.skill-row-extra').forEach(r => r.remove());

    const n = getExtraRowsCount();
    for (let i = 0; i < n; i++) {
      const tr = makeSkillRow();
      skillsTbody.appendChild(tr);
      applySavedValues(tr);
      wireAutosave(tr);
    }
  }

  rebuildExtraRows();

  if (addBtn) {
    addBtn.addEventListener('click', () => {
      if (!skillsTbody) return;
      const tr = makeSkillRow();
      skillsTbody.appendChild(tr);

      setExtraRowsCount(getExtraRowsCount() + 1);

      applySavedValues(tr);
      wireAutosave(tr);

      // aggiorna CS in base alle classi selezionate + ricalcola tot
      applyAutoClassSkills();
      recalcSkillRow(tr);
      applySkillFilters();

      tr.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }

  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      if (!skillsTbody) return;
      const extras = skillsTbody.querySelectorAll('.skill-row-extra');
      if (!extras.length) return;

      const last = extras[extras.length - 1];

      // pulisci i valori salvati per i campi della riga rimossa
      last.querySelectorAll('input, textarea, select').forEach(el => {
        delete state[keyFor(el)];
      });
      saveState(state);

      last.remove();
      setExtraRowsCount(getExtraRowsCount() - 1);

      recalcAllSkills();
      applySkillFilters();
    });
  }


  /* =====================================
     SKILLS — calcolo Totale + filtri
     Tot = ranks + modCar + misc + (CS +3 se ranks>0) - ACP(se flag ACP)
  ====================================== */
function getAbilityModByCode(code) {
  const stat = document.querySelector(`.stat[data-ability="${code}"]`);
  if (!stat) return 0;
  const modEl = stat.querySelector('.ability-mod');
  if (!modEl) return 0;
  const n = Number(modEl.value);
  return Number.isFinite(n) ? n : 0;
}

  function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function recalcSkillRow(tr) {
    if (!tr) return;

    const csEl    = tr.querySelector('.skill-cs');
    const abilEl  = tr.querySelector('.skill-abil');
    const acpEl   = tr.querySelector('.skill-acp');
    const ranksEl = tr.querySelector('.skill-ranks');
    const miscEl  = tr.querySelector('.skill-misc');
    const totalEl = tr.querySelector('.skill-total');

    if (!abilEl || !ranksEl || !miscEl || !totalEl) return;

    const abilMod = getAbilityModByCode(abilEl.value);
    const ranks   = num(ranksEl.value);
    const misc    = num(miscEl.value);

    const isCS = !!(csEl && csEl.checked);
    const csBonus = (isCS && ranks > 0) ? 3 : 0;

    const acpGlobalEl = document.getElementById('skills-acp');
    const acpGlobal = acpGlobalEl ? num(acpGlobalEl.value) : 0;
    const acpPenalty = (acpEl && acpEl.checked) ? acpGlobal : 0;

    const total = ranks + abilMod + misc + csBonus - acpPenalty;
    totalEl.value = fmtSigned(total);
  }

  function recalcAllSkills() {
    document.querySelectorAll('#skills-tbody tr.skill-row').forEach(recalcSkillRow);
  }

  // ricalcola su cambi skill
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (!t) return;

    const tr = t.closest && t.closest('tr.skill-row');
    if (tr && (t.matches('.skill-cs, .skill-abil, .skill-acp, .skill-ranks, .skill-misc'))) {
      recalcSkillRow(tr);
    }

    if (t.id === 'skills-acp') recalcAllSkills();

    // se cambia nome skill, riallinea class skill + filtri
    if (t.classList && t.classList.contains('skill-name')) {
      applyAutoClassSkills();
      applySkillFilters();
      recalcSkillRow(tr);
    }
  });

  document.addEventListener('change', (e) => {
    const t = e.target;
    if (!t) return;
    const tr = t.closest && t.closest('tr.skill-row');
    if (tr && (t.matches('.skill-cs, .skill-abil, .skill-acp'))) {
      recalcSkillRow(tr);
    }
    if (t.id === 'skills-acp') recalcAllSkills();
    if (t.id === 'pf-class-select') applyAutoClassSkills();
    if (t.id === 'filter-class' || t.id === 'filter-trained') applySkillFilters();
  });

  // Filtri
  function applySkillFilters() {
    const q = (document.getElementById('skills-search')?.value || '').toLowerCase().trim();
    const onlyCS = !!document.getElementById('filter-class')?.checked;
    const onlyTrained = !!document.getElementById('filter-trained')?.checked;

    document.querySelectorAll('#skills-tbody tr.skill-row').forEach(tr => {
      const name = (tr.querySelector('.skill-name')?.value || '').toLowerCase();
      const isCS = !!tr.querySelector('.skill-cs')?.checked;
      const ranks = num(tr.querySelector('.skill-ranks')?.value);

      const matchQ = !q || name.includes(q);
      const matchCS = !onlyCS || isCS;
      const matchTrained = !onlyTrained || ranks > 0;

      tr.style.display = (matchQ && matchCS && matchTrained) ? '' : 'none';
    });
  }

  ['skills-search', 'filter-class', 'filter-trained'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', applySkillFilters);
    el.addEventListener('change', applySkillFilters);
  });


  /* =====================================
     AUTO-CS: classi selezionate -> spunta skill-cs
  ====================================== */
  function normSkillName(s) {
    return String(s || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[’']/g, "'"); // apostrofi
  }

  // Dizionario PF1 (core) — nomi ITA usati nella tabella
  // Puoi aggiungere abilità mancanti o varianti.
  const CLASS_SKILLS = {
    "Barbaro": ["acrobazia","addestrare animali","artigianato","cavalcare","intimidire","nuotare","percezione","scalare","sopravvivenza"],
    "Bardo": ["acrobazia","addestrare animali","artigianato","artista della fuga","camuffare","diplomazia","furtività","intimidire","intrattenere","linguistica","percezione","professione","raggirare","rapidità di mano","senso motivazioni","utilizzare oggetti magici","valutare",
              "conoscenze (arcane)","conoscenze (dungeon)","conoscenze (geografia)","conoscenze (locali)","conoscenze (natura)","conoscenze (nobiltà)","conoscenze (piani)","conoscenze (religioni)"],
    "Chierico": ["artigianato","diplomazia","guarire","linguistica","professione","senso motivazioni","conoscenze (arcane)","conoscenze (piani)","conoscenze (religioni)"],
    "Druido": ["artigianato","cavalcare","conoscenze (geografia)","conoscenze (natura)","guarire","nuotare","percezione","professione","sopravvivenza"],
    "Guerriero": ["artigianato","cavalcare","intimidire","nuotare","scalare","sopravvivenza"],
    "Ladro": ["acrobazia","artista della fuga","camuffare","diplomazia","disattivare congegni","furtività","intimidire","intrattenere","linguistica","nuotare","percezione","raggirare","rapidità di mano","scalare","senso motivazioni","valutare",
              "conoscenze (dungeon)","conoscenze (locali)","utilizzare congegni magici"],
    "Mago": ["artigianato","linguistica","professione","sapienza magica",
             "conoscenze (arcane)","conoscenze (dungeon)","conoscenze (geografia)","conoscenze (locali)","conoscenze (nobiltà)","conoscenze (piani)","conoscenze (religioni)"],
    "Monaco": ["acrobazia","artista della fuga","cavalcare","diplomazia","furtività","intimidire","nuotare","percezione","professione","scalare","senso motivazioni"],
    "Paladino": ["cavalcare","diplomazia","guarire","intuizione","professione","senso motivazioni"],
    "Ranger": ["addestrare animali","artigianato","cavalcare","conoscenze (dungeon)","conoscenze (geografia)","conoscenze (natura)","guarire","intuizione","nuotare","percezione","professione","scalare","sopravvivenza"],
    "Stregone": ["artigianato","camuffare","intrattenere","linguistica","professione","sapienza magica","utilizzare oggetti magici","conoscenze (arcane)"],
  };

  // alias se usi nomi diversi
  const SKILL_ALIASES = {
    "osservare": "percezione",
    "ascoltare": "percezione",
  };

  function canonicalSkill(name) {
    const n = normSkillName(name);
    return SKILL_ALIASES[n] || n;
  }

  function getSelectedClasses() {
  const sel = document.getElementById('pf-class-select');
  if (!sel) return [];
  const v = String(sel.value || '').trim();
  return v ? [v] : [];
}

  function buildClassSkillSet(classes) {
    const set = new Set();
    classes.forEach(cls => {
      (CLASS_SKILLS[cls] || []).forEach(sk => set.add(canonicalSkill(sk)));
    });
    return set;
  }

  function applyAutoClassSkills() {
    const classes = getSelectedClasses();
    if (!classes.length) return;

    const csSet = buildClassSkillSet(classes);

    document.querySelectorAll('#skills-tbody tr.skill-row').forEach(tr => {
      const nameEl = tr.querySelector('.skill-name');
      const csEl = tr.querySelector('.skill-cs');
      if (!nameEl || !csEl) return;

      const skill = canonicalSkill(nameEl.value);
      csEl.checked = csSet.has(skill);

      // notifica autosave + ricalcolo
      csEl.dispatchEvent(new Event('change', { bubbles: true }));
    });

    recalcAllSkills();
    applySkillFilters();
  }


  /* =====================================
     Sync Identità <-> Mitico (percorso + categoria)
  ====================================== */
  const pathI = document.getElementById('mythic-path-identita');
  const tierI = document.getElementById('mythic-tier-identita');
  const pathM = document.getElementById('mythic-path-mitico');
  const tierM = document.getElementById('mythic-tier-mitico');

  let isSyncing = false;

  function syncValue(fromEl, toEl) {
    if (!fromEl || !toEl) return;
    toEl.value = fromEl.value;
    toEl.dispatchEvent(new Event('input', { bubbles: true }));
    toEl.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function wireSync(a, b) {
    if (!a || !b) return;

    const handler = () => {
      if (isSyncing) return;
      isSyncing = true;
      syncValue(a, b);
      isSyncing = false;
    };

    a.addEventListener('input', handler);
    a.addEventListener('change', handler);
  }

  wireSync(pathI, pathM);
  wireSync(pathM, pathI);
  wireSync(tierI, tierM);
  wireSync(tierM, tierI);

  // init sync (dopo restore)
  if (pathI && pathM) {
    if (pathI.value) syncValue(pathI, pathM);
    else if (pathM.value) syncValue(pathM, pathI);
  }
  if (tierI && tierM) {
    if (tierI.value) syncValue(tierI, tierM);
    else if (tierM.value) syncValue(tierM, tierI);
  }


  /* =====================================
     Abilita/Disabilita tab Mitico se Categoria = 0
  ====================================== */
  const tabMitico = document.getElementById('tab-mitico');
  const mythicBadge = document.getElementById('mythic-badge');

  function normalizeTier(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function updateMythicUI() {
    const tier = normalizeTier((tierI && tierI.value) || (tierM && tierM.value));
    const isMythic = tier > 0;

    if (mythicBadge) mythicBadge.style.display = isMythic ? 'none' : 'block';

    if (tabMitico) {
      tabMitico.classList.toggle('is-disabled', !isMythic);
      tabMitico.setAttribute('aria-disabled', String(!isMythic));
    }
  }

  [tierI, tierM].forEach(el => {
    if (!el) return;
    el.addEventListener('input', updateMythicUI);
    el.addEventListener('change', updateMythicUI);
  });

  updateMythicUI();

  /* =====================================
   COMBATTIMENTO — CA calcolata automaticamente
   CA Totale = 10 + Armatura + Scudo(attivo) + DES + Taglia + Varie
   Contatto = 10 + DES + Taglia + Varie
   Impreparato = 10 + Armatura + Scudo(attivo) + Taglia + Varie
====================================== */
function num(v){
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmt10(n){
  // Qui lascio "10" come numero semplice, ma se vuoi "+12" ecc lo cambiamo
  return String(n);
}

function recalcAC(){
  const armorEl  = document.getElementById('ac-armor');
  const shieldEl = document.getElementById('ac-shield');
  const dexEl    = document.getElementById('ac-dex');
  const sizeEl   = document.getElementById('ac-size');
  const miscEl   = document.getElementById('ac-misc');
  const shieldOffEl = document.getElementById('shield-off');

  const totalEl = document.getElementById('ac-total');
  const touchEl = document.getElementById('ac-touch');
  const ffEl    = document.getElementById('ac-ff');

  if (!armorEl || !shieldEl || !dexEl || !sizeEl || !miscEl || !totalEl || !touchEl || !ffEl) return;

  const armor  = num(armorEl.value);
  const shieldBase = num(shieldEl.value);
  const dex    = num(dexEl.value);
  const size   = num(sizeEl.value);
  const misc   = num(miscEl.value);

  const shieldActive = !(shieldOffEl && shieldOffEl.checked);
  const shield = shieldActive ? shieldBase : 0;

  const acTotal = 10 + armor + shield + dex + size + misc;
  const acTouch = 10 + dex + size + misc;           // no armor/shield
  const acFF    = 10 + armor + shield + size + misc; // no dex

  totalEl.value = fmt10(acTotal);
  touchEl.value = fmt10(acTouch);
  ffEl.value    = fmt10(acFF);
}

// Ricalcola quando cambiano i componenti o il toggle scudo
['ac-armor','ac-shield','ac-dex','ac-size','ac-misc','shield-off'].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('input', recalcAC);
  el.addEventListener('change', recalcAC);
});

// Init
recalcAC();

// UX: quando spunti "Scudo non attivo", puoi opzionalmente “grigiare” il campo scudo
const shieldOffEl = document.getElementById('shield-off');
const shieldEl = document.getElementById('ac-shield');
if (shieldOffEl && shieldEl){
  const syncShieldUI = () => {
    const off = shieldOffEl.checked;
    shieldEl.disabled = off;       // se preferisci solo stile e non disable, dimmelo
  };
  shieldOffEl.addEventListener('change', syncShieldUI);
  syncShieldUI();
}/* =====================================
   CA — collega automaticamente DES (mod) -> campo CA DES
====================================== */
function getDexMod(){
  const stat = document.querySelector('.stat[data-ability="DES"]');
  if (!stat) return 0;
  const modEl = stat.querySelector('.ability-mod');
  if (!modEl) return 0;
  const n = Number(modEl.value);
  return Number.isFinite(n) ? n : 0;
}

function syncDexToAC(){
  const acDexEl = document.getElementById('ac-dex');
  if (!acDexEl) return;
  acDexEl.value = String(getDexMod());
  // ricalcola CA dopo l’aggiornamento
  if (typeof recalcAC === 'function') recalcAC();
}

// Aggiorna all’avvio
syncDexToAC();

// Aggiorna quando cambiano punteggio o mod DES
document.addEventListener('input', (e) => {
  if (!e.target || !e.target.closest) return;
  const stat = e.target.closest('.stat[data-ability="DES"]');
  if (!stat) return;

  if (e.target.classList.contains('ability-score') || e.target.classList.contains('ability-mod')) {
    syncDexToAC();
  }
});

// (opzionale) evita modifiche manuali su ac-dex: lo rendiamo readonly
const acDexEl = document.getElementById('ac-dex');
if (acDexEl) acDexEl.readOnly = true;

  /* =====================================
     Dark Mode toggle (switch + persistente)
  ====================================== */
  const THEME_KEY = 'pf1e_theme';
  const themeToggle = document.getElementById('theme-toggle');
  const themeState = document.getElementById('theme-state');

  function applyTheme(mode) {
    const isDark = mode === 'dark';
    if (isDark) document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');

    localStorage.setItem(THEME_KEY, mode);

    if (themeToggle) themeToggle.checked = isDark;
    if (themeState) themeState.textContent = isDark ? 'Dark' : 'Light';
  }

  function preferredTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;

    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  }

  // init theme
  applyTheme(preferredTheme());

  // toggle
  if (themeToggle) {
    themeToggle.addEventListener('change', () => {
      applyTheme(themeToggle.checked ? 'dark' : 'light');
    });
  }


  /* =====================================
     RESET DATI (localStorage)
  ====================================== */
  const resetBtn = document.getElementById('reset-storage');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      // salva tema, cancella il resto
      const theme = localStorage.getItem(THEME_KEY);
      localStorage.clear();
      if (theme) localStorage.setItem(THEME_KEY, theme);

      // refresh
      location.reload();
    });
  }
  /* =====================================
   SKILLS — Roll d20 (1d20 + Tot)
====================================== */
function parseSignedInt(v){
  const s = String(v ?? '').trim();
  // accetta "+7", "7", "-1"
  const n = Number(s.replace('+',''));
  return Number.isFinite(n) ? n : 0;
}

function d20(){
  return Math.floor(Math.random() * 20) + 1;
}

function getSkillRowName(tr){
  const name = tr.querySelector('.skill-name')?.value?.trim();
  return name || 'Abilità';
}

function toast(msg){
  let el = document.getElementById('toast');
  if (!el){
    el = document.createElement('div');
    el.id = 'toast';
    el.style.position = 'fixed';
    el.style.left = '50%';
    el.style.bottom = '18px';
    el.style.transform = 'translateX(-50%)';
    el.style.zIndex = '9999';
    el.style.maxWidth = '92vw';
    el.style.padding = '10px 12px';
    el.style.border = '2px solid var(--line)';
    el.style.borderRadius = '12px';
    el.style.background = 'var(--surface)';
    el.style.color = 'var(--text)';
    el.style.boxShadow = 'var(--shadow)';
    el.style.fontSize = '13px';
    el.style.lineHeight = '1.2';
    el.style.opacity = '0';
    el.style.transition = 'opacity .15s ease, transform .15s ease';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  el.style.transform = 'translateX(-50%) translateY(0)';

  clearTimeout(el._t);
  el._t = setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(-50%) translateY(6px)';
  }, 2200);
}

// Click delegation: un solo listener per tutti i 🎲, anche righe dinamiche
document.addEventListener('click', (e) => {
  const btn = e.target.closest?.('.roll-btn');
  if (!btn) return;

  const tr = btn.closest('tr.skill-row');
  if (!tr) return;

  // assicurati che Tot sia aggiornato
  if (typeof recalcSkillRow === 'function') recalcSkillRow(tr);

  const totEl = tr.querySelector('.skill-total');
  const tot = parseSignedInt(totEl?.value);

  const roll = d20();
  const result = roll + tot;

  const name = getSkillRowName(tr);
  toast(`${name}: d20(${roll}) + Tot(${tot >= 0 ? '+' : ''}${tot}) = ${result}`);
});


  /* =====================================
     INIT SKILLS: CS da classi + calcoli + filtri
  ====================================== */
  applyAutoClassSkills();
  recalcAllSkills();
  applySkillFilters();

});
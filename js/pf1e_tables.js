// pf1e_tables.js
// Tabelle condivise (caricate prima dello script principale).
(function () {
  const BAB_FULL = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
  ];
  const BAB_TWO_THIRDS = [
    0, 0, 1, 2, 3, 3, 4, 5, 6, 6, 7,
    8, 9, 9, 10, 11, 12, 12, 13, 14, 15,
  ];
  const BAB_HALF = [
    0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5,
    5, 6, 6, 7, 7, 8, 8, 9, 9, 10,
  ];

  const BAB_BY_PROGRESSION = {
    full: BAB_FULL,
    two_thirds: BAB_TWO_THIRDS,
    half: BAB_HALF,
  };

  const CLASS_BAB_PROGRESSION = {
    Barbaro: "full",
    Guerriero: "full",
    Paladino: "full",
    Ranger: "full",
    Monaco: "three_quarters",
    Bardo: "three_quarters",
    Ladro: "three_quarters",
    Druido: "three_quarters",
    Chierico: "three_quarters",
    Inquisitore: "three_quarters",
    Mago: "half",
    Stregone: "half",
  };

  function clampLevel(level) {
    const n = Number(level);
    if (!Number.isFinite(n)) return 0;
    const l = Math.trunc(n);
    if (l < 0) return 0;
    if (l > 20) return 20;
    return l;
  }

  function getBabByProgression(level, progression) {
    const key = String(progression || "full").trim();
    const normalized = key === "three_quarters" ? "two_thirds" : key;
    const table = BAB_BY_PROGRESSION[normalized] || BAB_BY_PROGRESSION.full;
    return table[clampLevel(level)] ?? 0;
  }

  function getBabByClass(level, className) {
    const cls = String(className || "").trim();
    const progression = CLASS_BAB_PROGRESSION[cls] || "full";
    return getBabByProgression(level, progression);
  }

  function getProgressionByClass(className) {
    const cls = String(className || "").trim();
    return CLASS_BAB_PROGRESSION[cls] || null;
  }

  const SPELL_PROGRESSION_THRESHOLDS = {
    full_9_with_cantrips: [1, 1, 3, 5, 7, 9, 11, 13, 15, 17],
    six_with_cantrips: [1, 2, 4, 7, 10, 13, 16],
    six_no_cantrips: [null, 1, 4, 7, 10, 13, 16],
    four_no_cantrips: [null, 4, 7, 10, 13],
  };

  const CLASS_SPELL_PROGRESSION = {
    Alchimista: "six_no_cantrips",
    Antipaladino: "four_no_cantrips",
    Bardo: "six_with_cantrips",
    Chierico: "full_9_with_cantrips",
    Convocatore: "six_no_cantrips",
    Druido: "full_9_with_cantrips",
    Fattucchiere: "full_9_with_cantrips",
    Inquisitore: "six_no_cantrips",
    Magus: "six_no_cantrips",
    Mago: "full_9_with_cantrips",
    Oracolo: "full_9_with_cantrips",
    Paladino: "four_no_cantrips",
    Ranger: "four_no_cantrips",
    Stregone: "full_9_with_cantrips",
  };

  function getMaxSpellLevelByProgression(level, progression) {
    const key = String(progression || "").trim();
    const thresholds = SPELL_PROGRESSION_THRESHOLDS[key];
    if (!thresholds) return 9;

    const casterLevel = clampLevel(level);
    let max = -1;
    for (let spellLevel = 0; spellLevel < thresholds.length; spellLevel++) {
      const requiredLevel = thresholds[spellLevel];
      if (requiredLevel == null) continue;
      if (casterLevel >= requiredLevel) max = spellLevel;
    }
    return max;
  }

  function getMaxSpellLevelByClass(level, className) {
    const cls = String(className || "").trim();
    const progression = CLASS_SPELL_PROGRESSION[cls] || null;
    if (!progression) return 9;
    return getMaxSpellLevelByProgression(level, progression);
  }

  window.PF1EData = window.PF1EData || {};
  window.PF1EData.tables = window.PF1EData.tables || {};
  window.PF1EData.tables.bab = {
    full: BAB_FULL,
    two_thirds: BAB_TWO_THIRDS,
    half: BAB_HALF,
    byProgression: BAB_BY_PROGRESSION,
    byClassProgression: CLASS_BAB_PROGRESSION,
    getByProgression: getBabByProgression,
    getByClass: getBabByClass,
    getProgressionByClass: getProgressionByClass,
  };

  window.PF1EData.tables.spells = {
    thresholdsByProgression: SPELL_PROGRESSION_THRESHOLDS,
    byClassProgression: CLASS_SPELL_PROGRESSION,
    getMaxLevelByProgression: getMaxSpellLevelByProgression,
    getMaxLevelByClass: getMaxSpellLevelByClass,
  };

  const WEAPON_EFFECTS = [
    { id: "bane", name: "Anatema", costType: "bonus", bonusEq: 1, flatGp: 0, mechanics: "+2 colpire/+2d6 danni vs tipo scelto", restrictions: "scegli tipo creatura" },
    { id: "defending", name: "Difensiva", costType: "bonus", bonusEq: 1, flatGp: 0, mechanics: "trasferisce bonus potenziamento alla CA", restrictions: "azione gratuita" },
    { id: "flaming", name: "Infuocata", costType: "bonus", bonusEq: 1, flatGp: 0, mechanics: "+1d6 fuoco", restrictions: "solo su attacco a segno" },
    { id: "frost", name: "Gelida", costType: "bonus", bonusEq: 1, flatGp: 0, mechanics: "+1d6 freddo", restrictions: "solo su attacco a segno" },
    { id: "shock", name: "Folgorante", costType: "bonus", bonusEq: 1, flatGp: 0, mechanics: "+1d6 elettricita", restrictions: "solo su attacco a segno" },
    { id: "corrosive", name: "Corrosiva", costType: "bonus", bonusEq: 1, flatGp: 0, mechanics: "+1d6 acido", restrictions: "solo su attacco a segno" },
    { id: "ghost_touch", name: "Tocco Spettrale", costType: "bonus", bonusEq: 1, flatGp: 0, mechanics: "colpisce incorporei normalmente", restrictions: "" },
    { id: "keen", name: "Affilata", costType: "bonus", bonusEq: 1, flatGp: 0, mechanics: "raddoppia intervallo minaccia", restrictions: "armi taglienti/perforanti" },
    { id: "merciful", name: "Pietosa", costType: "bonus", bonusEq: 1, flatGp: 0, mechanics: "+1d6 non letale, danni convertibili", restrictions: "" },
    { id: "returning", name: "Ritornante", costType: "bonus", bonusEq: 1, flatGp: 0, mechanics: "torna al lanciatore", restrictions: "arma da lancio" },
    { id: "seeking", name: "Accurata (Seeking)", costType: "bonus", bonusEq: 1, flatGp: 0, mechanics: "ignora occultamento miss chance", restrictions: "arma a distanza" },
    { id: "spell_storing", name: "Immagazzina Incantesimo", costType: "bonus", bonusEq: 1, flatGp: 0, mechanics: "contiene incantesimo fino al colpo", restrictions: "incantesimo bersaglio creatura" },
    { id: "thundering", name: "Tonante", costType: "bonus", bonusEq: 1, flatGp: 0, mechanics: "+1d8 sonoro su critico", restrictions: "" },
    { id: "vicious", name: "Velenosa (Vicious)", costType: "bonus", bonusEq: 1, flatGp: 0, mechanics: "+2d6 danni, 1d6 al portatore", restrictions: "" },
    { id: "distance", name: "Distanza", costType: "bonus", bonusEq: 1, flatGp: 0, mechanics: "raddoppia incremento gittata", restrictions: "arma a distanza" },
    { id: "dancing", name: "Danzante", costType: "bonus", bonusEq: 4, flatGp: 0, mechanics: "combatte da sola 4 round", restrictions: "arma da mischia" },
    { id: "disruption", name: "Distruttiva Non Morti", costType: "bonus", bonusEq: 2, flatGp: 0, mechanics: "TS Volonta o distruzione non morto", restrictions: "arma contundente" },
    { id: "flaming_burst", name: "Esplosione di Fiamme", costType: "bonus", bonusEq: 2, flatGp: 0, mechanics: "+1d10 fuoco su critico (+d10 extra x crit)", restrictions: "" },
    { id: "icy_burst", name: "Esplosione Gelida", costType: "bonus", bonusEq: 2, flatGp: 0, mechanics: "+1d10 freddo su critico (+d10 extra x crit)", restrictions: "" },
    { id: "shocking_burst", name: "Esplosione Elettrica", costType: "bonus", bonusEq: 2, flatGp: 0, mechanics: "+1d10 elettricita su critico (+d10 extra x crit)", restrictions: "" },
    { id: "wounding", name: "Ferimento", costType: "bonus", bonusEq: 2, flatGp: 0, mechanics: "1 danno sanguinamento/round cumulabile", restrictions: "" },
    { id: "axiomatic", name: "Assiomatica", costType: "bonus", bonusEq: 2, flatGp: 0, mechanics: "+2d6 vs caotici", restrictions: "" },
    { id: "anarchic", name: "Anarchica", costType: "bonus", bonusEq: 2, flatGp: 0, mechanics: "+2d6 vs legali", restrictions: "" },
    { id: "holy", name: "Sacra", costType: "bonus", bonusEq: 2, flatGp: 0, mechanics: "+2d6 vs malvagi", restrictions: "" },
    { id: "unholy", name: "Empia", costType: "bonus", bonusEq: 2, flatGp: 0, mechanics: "+2d6 vs buoni", restrictions: "" },
    { id: "speed", name: "Velocita", costType: "bonus", bonusEq: 3, flatGp: 0, mechanics: "un attacco extra in full attack", restrictions: "" },
    { id: "brilliant_energy", name: "Energia Splendente", costType: "bonus", bonusEq: 4, flatGp: 0, mechanics: "ignora armature/scudi non viventi", restrictions: "non colpisce non viventi/oggetti" },
    { id: "vorpal", name: "Vorpal", costType: "bonus", bonusEq: 5, flatGp: 0, mechanics: "decapitazione su 20 confermato", restrictions: "arma tagliente" },
    { id: "ki_focus", name: "Focus Ki", costType: "bonus", bonusEq: 1, flatGp: 0, mechanics: "usa talenti ki su arma", restrictions: "monaco" },
    { id: "mighty_cleaving", name: "Mietitura Potente", costType: "bonus", bonusEq: 1, flatGp: 0, mechanics: "attacchi cleave aggiuntivi", restrictions: "richiede Attacco Poderoso/Cleave" },
  ];

  window.PF1EData.tables.weaponEffects = {
    all: WEAPON_EFFECTS,
  };

  const LEGENDARY_ITEM_POWERS = [
    { id: "surge_strike", name: "Colpo Impetuoso", category: "Minore", powerCost: 1, mechanics: "Aggiunge Legendary Surge a un tiro per colpire", restrictions: "prima del risultato" },
    { id: "guardian_shell", name: "Guscio Guardiano", category: "Minore", powerCost: 1, mechanics: "Bonus difensivo temporaneo +2 CA", restrictions: "1 round" },
    { id: "mythic_focus", name: "Focus Mitico", category: "Minore", powerCost: 1, mechanics: "Bonus +2 a TS o prova abilita", restrictions: "una prova" },
    { id: "arcane_burst", name: "Scarica Arcana", category: "Maggiore", powerCost: 2, mechanics: "Aggiunge 2d6 danni energetici", restrictions: "tipo energia scelto" },
    { id: "phase_step", name: "Passo Fase", category: "Maggiore", powerCost: 2, mechanics: "Teletrasporto breve", restrictions: "linea di vista" },
    { id: "unyielding_guard", name: "Guardia Infrangibile", category: "Maggiore", powerCost: 2, mechanics: "Riduzione danno temporanea", restrictions: "1 minuto" },
    { id: "legend_wrath", name: "Ira Leggendaria", category: "Supremo", powerCost: 3, mechanics: "Critico automatico da confermare", restrictions: "una volta per attivazione" },
    { id: "fate_rewrite", name: "Riscrivere il Destino", category: "Supremo", powerCost: 3, mechanics: "Ritira un d20 appena lanciato", restrictions: "devi accettare il nuovo risultato" },
    { id: "mythic_apex", name: "Apice Mitico", category: "Supremo", powerCost: 3, mechanics: "Effetto signature potenziato", restrictions: "decisione GM/giocatore" },
  ];

  window.PF1EData.tables.legendaryItems = {
    powerCatalog: LEGENDARY_ITEM_POWERS,
  };
})();

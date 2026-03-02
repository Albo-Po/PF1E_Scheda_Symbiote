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
})();

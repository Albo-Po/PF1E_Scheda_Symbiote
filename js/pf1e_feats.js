// pf1e_feats.js
// Registro leggero dei talenti di combattimento usati dalla scheda.
(function () {
  window.PF1EData = window.PF1EData || {};
  window.PF1EData.modules = window.PF1EData.modules || {};
  window.PF1EData.modules.feats = { version: 1 };

  window.PF1EData.feats = window.PF1EData.feats || {};
  window.PF1EData.feats.combat = {
    quickAttackIds: [
      "atk-quick-power-attack",
      "atk-quick-furious-focus",
      "atk-quick-weapon-focus",
      "atk-quick-weapon-specialization",
      "atk-quick-morale",
      "atk-quick-sacred",
      "atk-quick-luck",
      "atk-quick-competence",
      "atk-quick-defensive",
      "atk-quick-twf",
      "atk-quick-smite-atk",
      "atk-quick-smite-dmg",
      "atk-quick-mythic-atk",
      "atk-quick-mythic-dmg",
    ],
    mythicIds: [
      "mythic-feat-power-attack",
      "mythic-feat-furious-focus",
      "mythic-feat-mythic-toughness",
      "mythic-feat-spell-focus",
      "mythic-feat-spell-penetration",
      "mythic-feat-deadly-aim",
      "mythic-feat-rapid-shot",
      "mythic-feat-manyshot",
      "mythic-feat-improved-critical",
      "mythic-feat-weapon-focus",
    ],
  };
})();

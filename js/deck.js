(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ButtleDeck = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const HEAT_NAMES = [null, "невинно", "флирт", "смелее", "откровенно", "без тормозов"];

  function actorOk(card, actorGender) {
    return card.actor === "any" || card.actor === actorGender;
  }

  function partnerOk(card, players, actorId) {
    if (!card.partner) return true;
    return players.some(function (player) {
      return player.id !== actorId && player.gender === card.partner;
    });
  }

  function eligibleCards(cards, query) {
    return cards.filter(function (card) {
      return card.type === query.type &&
        card.heat === query.heat &&
        actorOk(card, query.actorGender) &&
        partnerOk(card, query.players, query.actorId);
    });
  }

  function companyHasBothGenders(players) {
    let men = false;
    let women = false;
    players.forEach(function (player) {
      if (player.gender === "m") men = true;
      if (player.gender === "f") women = true;
    });
    return men && women;
  }

  function preferOppositePartner(eligible, query) {
    if (!companyHasBothGenders(query.players)) return eligible;
    const preferred = eligible.filter(function (card) {
      return !card.partner || card.partner !== query.actorGender;
    });
    return preferred.length > 0 ? preferred : eligible;
  }

  function pick(list, random) {
    return list[Math.floor(random() * list.length)];
  }

  function cooldownCount(poolSize) {
    if (poolSize < 2) return 0;
    return Math.min(poolSize - 1, Math.max(1, Math.floor(poolSize / 2)));
  }

  function fill(text, partnerName) {
    return text.split("{partner}").join(partnerName);
  }

  function drawCard(cards, query) {
    const eligible = preferOppositePartner(eligibleCards(cards, query), query);
    if (eligible.length === 0) return { status: "empty", usedIds: query.usedIds.slice() };
    const eligibleIds = {};
    eligible.forEach(function (card) { eligibleIds[card.id] = true; });
    let usedIds = query.usedIds.slice();
    let fresh = eligible.filter(function (card) { return usedIds.indexOf(card.id) === -1; });
    if (fresh.length === 0) {
      const recent = usedIds.filter(function (id) { return eligibleIds[id]; });
      const blocked = {};
      recent.slice(recent.length - cooldownCount(recent.length)).forEach(function (id) {
        blocked[id] = true;
      });
      usedIds = usedIds.filter(function (id) { return !eligibleIds[id] || blocked[id]; });
      fresh = eligible.filter(function (card) { return !blocked[card.id]; });
    }
    const card = pick(fresh, query.random);
    const partners = query.players.filter(function (player) {
      return player.id !== query.actorId && player.gender === card.partner;
    });
    const partner = card.partner ? pick(partners, query.random) : null;
    usedIds.push(card.id);
    return {
      status: "card",
      id: card.id,
      text: fill(card.text[query.actorGender], partner ? partner.name : ""),
      partnerId: partner ? partner.id : null,
      usedIds: usedIds,
    };
  }

  function heatAfterDone(heat, roundsCompleted, playerCount) {
    const rounds = roundsCompleted + 1;
    const pace = Math.max(2, Math.min(8, playerCount | 0));
    return {
      heat: rounds % pace === 0 ? Math.min(5, heat + 1) : heat,
      roundsCompleted: rounds,
    };
  }

  function shiftHeat(heat, delta) {
    return Math.min(5, Math.max(1, heat + delta));
  }

  function createParty() {
    return { heat: 1, roundsCompleted: 0, usedIds: [], lastPlayerId: null };
  }

  return {
    HEAT_NAMES: HEAT_NAMES,
    eligibleCards: eligibleCards,
    drawCard: drawCard,
    heatAfterDone: heatAfterDone,
    shiftHeat: shiftHeat,
    createParty: createParty,
  };
});

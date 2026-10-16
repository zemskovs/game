(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ButtlePlayers = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const KEY = "buttle.players";

  function validateName(name, players) {
    const trimmed = String(name == null ? "" : name).trim();
    if (!trimmed) return { ok: false, reason: "empty" };
    if (trimmed.length > 20) return { ok: false, reason: "long" };
    if (players.length >= 8) return { ok: false, reason: "full" };
    const duplicate = players.some(function (player) {
      return player.name.toLowerCase() === trimmed.toLowerCase();
    });
    if (duplicate) return { ok: false, reason: "duplicate" };
    return { ok: true, name: trimmed };
  }

  function addPlayer(players, name, gender, id) {
    if (gender !== "m" && gender !== "f") return { players: players, error: "gender" };
    const check = validateName(name, players);
    if (!check.ok) return { players: players, error: check.reason };
    return {
      players: players.concat([{ id: id, name: check.name, gender: gender }]),
      error: null,
    };
  }

  function removePlayer(players, id) {
    return players.filter(function (player) { return player.id !== id; });
  }

  function loadPlayers(storage) {
    try {
      const raw = storage.getItem(KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(function (player) {
        return player &&
          typeof player.id === "string" &&
          typeof player.name === "string" &&
          (player.gender === "m" || player.gender === "f");
      });
    } catch (error) {
      return [];
    }
  }

  function savePlayers(storage, players) {
    storage.setItem(KEY, JSON.stringify(players));
  }

  return {
    validateName: validateName,
    addPlayer: addPlayer,
    removePlayer: removePlayer,
    loadPlayers: loadPlayers,
    savePlayers: savePlayers,
  };
});

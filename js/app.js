(function () {
  var deck = globalThis.ButtleDeck;
  var spinApi = globalThis.ButtleSpin;
  var playersApi = globalThis.ButtlePlayers;
  var cards = globalThis.BUTTLE_CARDS;
  var AGE_KEY = "buttle.ageOk";
  var PARTY_KEY = "buttle.party";
  var ERRORS = {
    empty: "Введите имя",
    long: "Имя не длиннее 20 символов",
    duplicate: "Такое имя уже есть",
    full: "За столом не больше 8 человек",
    gender: "Выберите пол",
  };

  var players = [];
  var party = null;
  var draftGender = "m";
  var sheet = null;
  var spinning = false;
  var rotation = 0;

  var ageScreen = document.querySelector("#screen-age");
  var playersScreen = document.querySelector("#screen-players");
  var tableScreen = document.querySelector("#screen-table");
  var nameInput = document.querySelector("#player-name");
  var errorNode = document.querySelector("#player-error");
  var listNode = document.querySelector("#player-list");
  var startButton = document.querySelector("#start-game");
  var installHint = document.querySelector("#install-hint");
  var seatsNode = document.querySelector("#seats");
  var bottle = document.querySelector("#bottle");
  var heatName = document.querySelector("#heat-name");
  var heatPips = document.querySelector("#heat-pips");
  var heatDown = document.querySelector("#heat-down");
  var heatUp = document.querySelector("#heat-up");
  var spinButton = document.querySelector("#spin");
  var sheetNode = document.querySelector("#sheet");
  var sheetName = document.querySelector("#sheet-name");
  var sheetChoice = document.querySelector("#sheet-choice");
  var sheetCard = document.querySelector("#sheet-card");
  var sheetText = document.querySelector("#sheet-text");
  var sheetEmpty = document.querySelector("#sheet-empty");

  function show(node, visible) {
    node.hidden = !visible;
  }

  function saveParty() {
    if (!party) sessionStorage.removeItem(PARTY_KEY);
    else sessionStorage.setItem(PARTY_KEY, JSON.stringify(party));
  }

  function loadParty() {
    try {
      var raw = sessionStorage.getItem(PARTY_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed) return null;
      if (!Number.isInteger(parsed.heat) || parsed.heat < 1 || parsed.heat > 5) return null;
      if (!Number.isInteger(parsed.roundsCompleted) || parsed.roundsCompleted < 0) return null;
      if (parsed.lastPlayerId !== null && typeof parsed.lastPlayerId !== "string") return null;
      if (!Array.isArray(parsed.usedIds)) return null;
      for (var i = 0; i < parsed.usedIds.length; i++) {
        if (typeof parsed.usedIds[i] !== "string") return null;
      }
      return parsed;
    } catch (error) {
      return null;
    }
  }

  function newPlayerId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return "p-" + Date.now() + "-" + Math.random();
  }

  function screenName() {
    if (localStorage.getItem(AGE_KEY) !== "1") return "age";
    if (party && players.length >= 2) return "table";
    return "players";
  }

  function renderPlayers() {
    listNode.innerHTML = "";
    players.forEach(function (player) {
      var item = document.createElement("li");
      var name = document.createElement("span");
      name.textContent = player.name + " · " + (player.gender === "m" ? "мужчина" : "женщина");
      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "text-button";
      remove.textContent = "убрать";
      remove.addEventListener("click", function () {
        players = playersApi.removePlayer(players, player.id);
        playersApi.savePlayers(localStorage, players);
        render();
      });
      item.appendChild(name);
      item.appendChild(remove);
      listNode.appendChild(item);
    });
    startButton.disabled = players.length < 2;
  }

  function renderSeats() {
    seatsNode.innerHTML = "";
    players.forEach(function (player, index) {
      var point = spinApi.seatPoint(index, players.length, 46);
      var seat = document.createElement("span");
      seat.className = "seat" + (sheet && sheet.playerId === player.id ? " is-chosen" : "");
      seat.style.left = (50 + point.x) + "%";
      seat.style.top = (50 + point.y) + "%";
      seat.textContent = player.name;
      seatsNode.appendChild(seat);
    });
  }

  function renderHeat() {
    var heat = party ? party.heat : 1;
    heatName.textContent = deck.HEAT_NAMES[heat];
    heatPips.innerHTML = "";
    for (var i = 1; i <= 5; i += 1) {
      var pip = document.createElement("i");
      if (i <= heat) pip.className = "is-on";
      heatPips.appendChild(pip);
    }
    var locked = Boolean(sheet) || spinning;
    heatDown.disabled = locked;
    heatUp.disabled = locked;
    spinButton.disabled = locked;
  }

  function renderSheet() {
    show(sheetNode, Boolean(sheet));
    if (!sheet) return;
    var player = players.find(function (item) { return item.id === sheet.playerId; });
    sheetName.textContent = player ? player.name : "";
    show(sheetChoice, sheet.kind === "choice");
    show(sheetCard, sheet.kind === "card");
    show(sheetEmpty, sheet.kind === "empty");
    if (sheet.kind === "card") sheetText.textContent = sheet.text;
  }

  function render() {
    var screen = screenName();
    show(ageScreen, screen === "age");
    show(playersScreen, screen === "players");
    show(tableScreen, screen === "table");
    if (screen === "players") {
      renderPlayers();
      var standalone = window.matchMedia("(display-mode: standalone)").matches;
      show(installHint, !standalone);
    }
    if (screen === "table") {
      renderSeats();
      renderHeat();
      renderSheet();
      bottle.style.transform = "translate(-50%, -50%) rotate(" + rotation + "deg)";
    }
  }

  function setGender(gender) {
    draftGender = gender;
    document.querySelector("#gender-m").classList.toggle("is-on", gender === "m");
    document.querySelector("#gender-f").classList.toggle("is-on", gender === "f");
    document.querySelector("#gender-m").setAttribute("aria-pressed", gender === "m" ? "true" : "false");
    document.querySelector("#gender-f").setAttribute("aria-pressed", gender === "f" ? "true" : "false");
  }

  function showError(reason) {
    if (!reason) {
      errorNode.hidden = true;
      errorNode.textContent = "";
      return;
    }
    errorNode.hidden = false;
    errorNode.textContent = ERRORS[reason];
  }

  document.querySelector("#age-ok").addEventListener("click", function () {
    localStorage.setItem(AGE_KEY, "1");
    render();
  });

  document.querySelector("#gender-m").addEventListener("click", function () { setGender("m"); });
  document.querySelector("#gender-f").addEventListener("click", function () { setGender("f"); });

  document.querySelector("#player-form").addEventListener("submit", function (event) {
    event.preventDefault();
    var result = playersApi.addPlayer(players, nameInput.value, draftGender, newPlayerId());
    if (result.error) {
      showError(result.error);
      return;
    }
    players = result.players;
    playersApi.savePlayers(localStorage, players);
    nameInput.value = "";
    showError(null);
    render();
  });

  startButton.addEventListener("click", function () {
    if (players.length < 2) return;
    party = deck.createParty();
    sheet = null;
    spinning = false;
    rotation = 0;
    saveParty();
    render();
  });

  document.querySelector("#leave").addEventListener("click", function () {
    party = null;
    sheet = null;
    spinning = false;
    saveParty();
    render();
  });

  function nudge(delta) {
    if (!party || sheet || spinning) return;
    party = Object.assign({}, party, { heat: deck.shiftHeat(party.heat, delta) });
    saveParty();
    render();
  }
  heatDown.addEventListener("click", function () { nudge(-1); });
  heatUp.addEventListener("click", function () { nudge(1); });

  spinButton.addEventListener("click", function () {
    if (!party || sheet || spinning) return;
    var lastIndex = players.findIndex(function (player) { return player.id === party.lastPlayerId; });
    var index = spinApi.nextPlayerIndex(players.length, lastIndex === -1 ? null : lastIndex, Math.random);
    var player = players[index];
    party = Object.assign({}, party, { lastPlayerId: player.id });
    saveParty();
    var nextRotation = spinApi.bottleRotation(rotation, spinApi.seatAngle(index, players.length));
    spinning = true;
    render();
    bottle.style.transition = "transform 2.8s cubic-bezier(0.12, 0.7, 0.08, 1)";
    bottle.style.transform = "translate(-50%, -50%) rotate(" + nextRotation + "deg)";
    rotation = nextRotation;
  });

  bottle.addEventListener("transitionend", function (event) {
    if (event.propertyName !== "transform" || !spinning) return;
    spinning = false;
    sheet = { kind: "choice", playerId: party.lastPlayerId };
    render();
  });

  function openDraw(type) {
    var player = players.find(function (item) { return item.id === sheet.playerId; });
    if (!player) {
      sheet = null;
      render();
      return;
    }
    var drawn = deck.drawCard(cards, {
      type: type,
      heat: party.heat,
      actorGender: player.gender,
      players: players,
      actorId: player.id,
      usedIds: party.usedIds,
      random: Math.random,
    });
    party = Object.assign({}, party, { usedIds: drawn.usedIds });
    saveParty();
    if (drawn.status === "empty") sheet = { kind: "empty", playerId: player.id };
    else sheet = { kind: "card", playerId: player.id, type: type, text: drawn.text };
    render();
  }

  document.querySelector("#pick-truth").addEventListener("click", function () { openDraw("truth"); });
  document.querySelector("#pick-dare").addEventListener("click", function () { openDraw("dare"); });
  document.querySelector("#card-another").addEventListener("click", function () {
    if (!sheet || sheet.kind !== "card") return;
    openDraw(sheet.type);
  });
  document.querySelector("#card-done").addEventListener("click", function () {
    var next = deck.heatAfterDone(party.heat, party.roundsCompleted);
    party = Object.assign({}, party, next);
    sheet = null;
    saveParty();
    render();
  });
  document.querySelector("#empty-close").addEventListener("click", function () {
    sheet = null;
    render();
  });

  players = playersApi.loadPlayers(localStorage);
  party = loadParty();
  if (party && players.length < 2) {
    party = null;
    saveParty();
  }
  if (party && !players.some(function (player) { return player.id === party.lastPlayerId; })) {
    party = Object.assign({}, party, { lastPlayerId: null });
    saveParty();
  }
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js");
  }
  render();
})();

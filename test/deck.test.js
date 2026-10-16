const assert = require("node:assert/strict");
const deck = require("../js/deck.js");

let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log("ok " + name);
  } catch (error) {
    failed += 1;
    console.error("FAIL " + name);
    console.error(error);
  }
}

function sequence(values) {
  let index = 0;
  return function random() {
    const value = values[index];
    index += 1;
    return value;
  };
}

const players = [
  { id: "a", name: "Аня", gender: "f" },
  { id: "b", name: "Боря", gender: "m" },
  { id: "c", name: "Вера", gender: "f" },
];

const cards = [
  { id: "keep", type: "truth", heat: 1, actor: "any", partner: null, text: { m: "Общее", f: "Общее" } },
  { id: "man-only", type: "truth", heat: 1, actor: "m", partner: null, text: { m: "Только он" } },
  { id: "hot", type: "truth", heat: 2, actor: "any", partner: null, text: { m: "Жарче", f: "Жарче" } },
  { id: "dare", type: "dare", heat: 1, actor: "any", partner: null, text: { m: "Действие", f: "Действие" } },
  { id: "needs-man", type: "truth", heat: 1, actor: "any", partner: "m", text: { m: "Рядом {partner}", f: "Рядом {partner}" } },
  { id: "needs-woman", type: "truth", heat: 1, actor: "any", partner: "f", text: { m: "Рядом {partner}", f: "Рядом {partner}" } },
  { id: "other", type: "dare", heat: 3, actor: "any", partner: null, text: { m: "Другое", f: "Другое" } },
];

test("фильтр по типу, ступени и полу ведущего", function () {
  const found = deck.eligibleCards(cards, {
    type: "truth",
    heat: 1,
    actorGender: "f",
    players,
    actorId: "a",
  });
  assert.deepEqual(found.map((card) => card.id).sort(), ["keep", "needs-man", "needs-woman"]);
});

test("пропуск карточки без нужного партнёра", function () {
  const found = deck.eligibleCards(cards, {
    type: "truth",
    heat: 1,
    actorGender: "m",
    players: [{ id: "b", name: "Боря", gender: "m" }, { id: "d", name: "Глеб", gender: "m" }],
    actorId: "b",
  });
  assert.deepEqual(found.map((card) => card.id).sort(), ["keep", "man-only", "needs-man"]);
});

test("подстановка имени партнёра", function () {
  const drawn = deck.drawCard(cards, {
    type: "truth",
    heat: 1,
    actorGender: "f",
    players,
    actorId: "a",
    usedIds: ["keep", "needs-woman"],
    random: sequence([0, 0]),
  });
  assert.equal(drawn.status, "card");
  assert.equal(drawn.id, "needs-man");
  assert.equal(drawn.text, "Рядом Боря");
  assert.equal(drawn.partnerId, "b");
  assert.deepEqual(drawn.usedIds, ["keep", "needs-woman", "needs-man"]);
});

test("повтор после исчерпания группы", function () {
  const drawn = deck.drawCard(
    [
      { id: "a1", type: "truth", heat: 1, actor: "any", partner: null, text: { m: "А", f: "А" } },
      { id: "a2", type: "truth", heat: 1, actor: "any", partner: null, text: { m: "Б", f: "Б" } },
      { id: "other", type: "dare", heat: 2, actor: "any", partner: null, text: { m: "В", f: "В" } },
    ],
    {
      type: "truth",
      heat: 1,
      actorGender: "m",
      players,
      actorId: "b",
      usedIds: ["a1", "a2", "other"],
      random: sequence([0]),
    }
  );
  assert.equal(drawn.id, "a1");
  assert.deepEqual(drawn.usedIds, ["other", "a1"]);
});

test("пустая группа", function () {
  const drawn = deck.drawCard(cards, {
    type: "truth",
    heat: 4,
    actorGender: "f",
    players,
    actorId: "a",
    usedIds: [],
    random: sequence([0]),
  });
  assert.equal(drawn.status, "empty");
  assert.deepEqual(drawn.usedIds, []);
});

test("накал растёт на каждый второй ход и останавливается на 5", function () {
  assert.deepEqual(deck.heatAfterDone(1, 0), { heat: 1, roundsCompleted: 1 });
  assert.deepEqual(deck.heatAfterDone(1, 1), { heat: 2, roundsCompleted: 2 });
  assert.deepEqual(deck.heatAfterDone(5, 1), { heat: 5, roundsCompleted: 2 });
  assert.equal(deck.shiftHeat(1, -1), 1);
  assert.equal(deck.shiftHeat(5, 1), 5);
  assert.equal(deck.shiftHeat(3, -1), 2);
});

test("новая партия и названия ступеней", function () {
  assert.deepEqual(deck.createParty(), {
    heat: 1,
    roundsCompleted: 0,
    usedIds: [],
    lastPlayerId: null,
  });
  assert.deepEqual(deck.HEAT_NAMES, [null, "невинно", "флирт", "смелее", "откровенно", "без тормозов"]);
});

const spin = require("../js/spin.js");

function near(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 0.000001, actual + " ~= " + expected);
}

test("места по кругу: первый сверху, дальше по часовой", function () {
  assert.equal(spin.seatAngle(0, 4), 0);
  assert.equal(spin.seatAngle(1, 4), 90);
  const top = spin.seatPoint(0, 4, 100);
  const right = spin.seatPoint(1, 4, 100);
  near(top.x, 0);
  near(top.y, -100);
  near(right.x, 100);
  near(right.y, 0);
});

test("три и больше игроков не повторяют предыдущего", function () {
  assert.equal(spin.nextPlayerIndex(3, 0, function () { return 0; }), 1);
  assert.equal(spin.nextPlayerIndex(4, null, function () { return 0.5; }), 2);
});

test("двое игроков могут выпасть повторно", function () {
  assert.equal(spin.nextPlayerIndex(2, 0, function () { return 0; }), 0);
  assert.equal(spin.nextPlayerIndex(2, 0, function () { return 0.6; }), 1);
});

test("бутылочка делает пять оборотов и доворот", function () {
  assert.equal(spin.bottleRotation(0, 0) % 360, 0);
  assert.equal(spin.bottleRotation(0, 0), 1800);
  assert.equal(spin.bottleRotation(10, 20), 1820);
  assert.equal(spin.bottleRotation(30, 10) % 360, 10);
});

const playersApi = require("../js/players.js");

function memoryStorage(initial) {
  const data = Object.assign({}, initial);
  return {
    getItem: function (key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem: function (key, value) {
      data[key] = String(value);
    },
  };
}

test("имя обрезается, пустое и длинное отклоняются, дубликат тоже", function () {
  const list = [{ id: "1", name: "Аня", gender: "f" }];
  assert.deepEqual(playersApi.validateName("  Боря ", list), { ok: true, name: "Боря" });
  assert.deepEqual(playersApi.validateName("   ", list), { ok: false, reason: "empty" });
  assert.deepEqual(playersApi.validateName("Аня", list), { ok: false, reason: "duplicate" });
  assert.deepEqual(playersApi.validateName("аня", list), { ok: false, reason: "duplicate" });
  assert.equal(playersApi.validateName("я".repeat(21), list).reason, "long");
});

test("не больше восьми и только два пола", function () {
  const full = [1, 2, 3, 4, 5, 6, 7, 8].map(function (n) {
    return { id: String(n), name: "Игрок " + n, gender: "m" };
  });
  assert.equal(playersApi.validateName("Новый", full).reason, "full");
  const added = playersApi.addPlayer([], "  Кира ", "f", "k");
  assert.equal(added.error, null);
  assert.deepEqual(added.players, [{ id: "k", name: "Кира", gender: "f" }]);
  assert.equal(playersApi.addPlayer([], "Кира", "x", "k").error, "gender");
});

test("список пишется в storage и читается обратно", function () {
  const storage = memoryStorage();
  const added = playersApi.addPlayer([], "Марк", "m", "m1");
  playersApi.savePlayers(storage, added.players);
  assert.deepEqual(playersApi.loadPlayers(storage), added.players);
  assert.deepEqual(playersApi.removePlayer(added.players, "m1"), []);
  assert.deepEqual(playersApi.loadPlayers(memoryStorage({ "buttle.players": "nope" })), []);
});

const cardsData = require("../cards.js");

function countBucket(group, actor, partner) {
  return group.filter(function (card) {
    return card.actor === actor && card.partner === partner;
  }).length;
}

test("колода всех ступеней собрана восьмёрками", function () {
  assert.equal(cardsData.length, 80);
  const ids = cardsData.map(function (card) { return card.id; });
  assert.equal(new Set(ids).size, ids.length);
  ["truth", "dare"].forEach(function (type) {
    [1, 2, 3, 4, 5].forEach(function (heat) {
      const group = cardsData.filter(function (card) {
        return card.type === type && card.heat === heat;
      });
      assert.equal(group.length, 8, type + " " + heat);
      assert.equal(countBucket(group, "any", null), 2);
      assert.equal(countBucket(group, "any", "m"), 2);
      assert.equal(countBucket(group, "any", "f"), 2);
      assert.equal(countBucket(group, "m", null), 1);
      assert.equal(countBucket(group, "f", null), 1);
      group.forEach(function (card) {
        if (card.actor === "any") {
          assert.equal(typeof card.text.m, "string");
          assert.equal(typeof card.text.f, "string");
        } else {
          assert.equal(typeof card.text[card.actor], "string");
        }
        const texts = [card.text.m, card.text.f].filter(Boolean);
        texts.forEach(function (text) {
          if (card.partner) assert.ok(text.indexOf("{partner}") !== -1, card.id);
          else assert.equal(text.indexOf("{partner}"), -1, card.id);
        });
      });
    });
  });
});

if (failed > 0) process.exit(1);

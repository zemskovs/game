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

if (failed > 0) process.exit(1);

# Bottle Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Собрать мобильное PWA «Бутылочка»: правда или действие для взрослых, с установкой на домашний экран Android и офлайн-кэшем.

**Architecture:** Чистые функции колоды, накала и угла бутылочки живут отдельно от страницы и проверяются `node test/deck.test.js`. Страница — статические HTML, CSS и скрипты без сборки. Данные карточек лежат в `cards.js`. Service worker кэширует оболочку, шрифты и иконки.

**Tech Stack:** HTML, CSS, JavaScript без фреймворка и без сборки. Node.js для тестов. GitHub Pages. Шрифты Cormorant Garamond и Manrope, файлы woff2.

## Global Constraints

- Мобильное PWA для телефона Android в портретной ориентации. Отдельной вёрстки для компьютера нет.
- Статические файлы в корне репозитория. Адреса относительные (`./`).
- `viewport`: `width=device-width, initial-scale=1, viewport-fit=cover`. Цвет темы `#14090c`.
- Манифест: `name` «Бутылочка. Правда или действие», `short_name` «Бутылочка», `start_url` и `scope` `./`, `display` `standalone`, `orientation` `portrait`, `background_color` и `theme_color` `#14090c`, иконки 192 и 512, в том числе maskable.
- Подтверждение 18+ один раз: `localStorage["buttle.ageOk"] = "1"`.
- Игроки: `localStorage["buttle.players"]`, элементы `{ id, name, gender }`, пол только `m` или `f`, имя 1–20 символов после trim, без одинаковых имён без учёта регистра, от 2 до 8 человек.
- Партия: `sessionStorage["buttle.party"]` = `{ heat, roundsCompleted, usedIds, lastPlayerId }` либо ключ отсутствует.
- Накал 1–5: «невинно», «флирт», «смелее», «откровенно», «без тормозов». Старт с 1. Каждые два «Готово» ступень +1, потолок 5. «Другое» счётчик не меняет. Ручные «тише» и «жарче» не сбрасывают счётчик и не работают, пока открыта плашка.
- При трёх и больше игроках бутылочка не падает на того же человека два раза подряд. При двух повтор разрешён.
- На каждую ступень и тип ровно восемь карточек: две `any` без партнёра, две `any` с партнёром `m`, две `any` с партнёром `f`, одна `m` без партнёра, одна `f` без партнёра.
- Для `actor: "any"` обязательны строки `text.m` и `text.f`. Партнёр подставляется вместо `{partner}`.
- Цвета: фон `#14090c`, стол `#2a1418`, золото `#d4b483`, плашка `#f3e6d4`, чернила `#1c1214`, текст на тёмном `#f6efe6`.
- Анимация бутылочки около 2,8 секунды: пять полных оборотов и доворот. Ноль градусов — 12 часов, по часовой стрелке. Повторное нажатие во время анимации игнорируется.
- Кэш service worker называется `buttle-v1`. Сначала кэш, потом сеть.
- Вне этой версии: учётки, сервер, редактор карточек, магазины, отдельная установка на iPhone, звук.

---

## File Structure

- `js/deck.js` — отбор карточки, подстановка имени, шаг накала, новая партия.
- `js/spin.js` — угол места, точка на круге, выбор следующего игрока, конечный угол бутылочки.
- `js/players.js` — проверка имени, добавление, удаление, запись списка.
- `cards.js` — только данные карточек.
- `test/deck.test.js` — проверки колоды, вращения, игроков и формы колоды.
- `index.html` — три экрана и плашка.
- `styles.css` — салон, стол, карточка, шрифты.
- `js/app.js` — экраны, нажатия, хранение возраста и партии.
- `manifest.webmanifest`, `sw.js`, `icons/`, `fonts/` — установка и офлайн.
- `scripts/make-icons.js` — генерация PNG, запускается один раз.

Интерфейсы, на которые опираются следующие задачи:

```javascript
// js/deck.js → ButtleDeck в браузере, module.exports в Node
eligibleCards(cards, { type, heat, actorGender, players, actorId }) => card[]
drawCard(cards, { type, heat, actorGender, players, actorId, usedIds, random })
  => { status: "empty", usedIds } | { status: "card", id, text, partnerId, usedIds }
heatAfterDone(heat, roundsCompleted) => { heat, roundsCompleted }
shiftHeat(heat, delta) => number
createParty() => { heat: 1, roundsCompleted: 0, usedIds: [], lastPlayerId: null }
HEAT_NAMES => [null, "невинно", "флирт", "смелее", "откровенно", "без тормозов"]

// js/spin.js → ButtleSpin
seatAngle(index, count) => number
seatPoint(index, count, radius) => { x, y }
nextPlayerIndex(count, lastIndex, random) => number
bottleRotation(currentRotation, targetAngle) => number

// js/players.js → ButtlePlayers
validateName(name, players) => { ok: true, name } | { ok: false, reason }
addPlayer(players, name, gender, id) => { players, error }
removePlayer(players, id) => players
loadPlayers(storage) => players
savePlayers(storage, players) => void

// cards.js → BUTTLE_CARDS, массив карточек
```

`random` — функция без аргументов, возвращает число от 0 включительно до 1 не включая. `reason` бывает `empty`, `long`, `duplicate`, `full`, `gender`.

---

### Task 1: Колода и накал

**Files:**
- Create: `js/deck.js`
- Create: `test/deck.test.js`
- Test: `test/deck.test.js`

**Interfaces:**
- Consumes: ничего
- Produces: `eligibleCards`, `drawCard`, `heatAfterDone`, `shiftHeat`, `createParty`, `HEAT_NAMES`

- [ ] **Step 1: Write the failing test**

Создай `test/deck.test.js`:

```javascript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node test/deck.test.js`

Expected: FAIL, `Cannot find module '../js/deck.js'`

- [ ] **Step 3: Write minimal implementation**

Создай `js/deck.js`:

```javascript
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

  function pick(list, random) {
    return list[Math.floor(random() * list.length)];
  }

  function fill(text, partnerName) {
    return text.split("{partner}").join(partnerName);
  }

  function drawCard(cards, query) {
    const eligible = eligibleCards(cards, query);
    if (eligible.length === 0) return { status: "empty", usedIds: query.usedIds.slice() };
    const eligibleIds = {};
    eligible.forEach(function (card) { eligibleIds[card.id] = true; });
    let usedIds = query.usedIds.slice();
    let fresh = eligible.filter(function (card) { return usedIds.indexOf(card.id) === -1; });
    if (fresh.length === 0) {
      usedIds = usedIds.filter(function (id) { return !eligibleIds[id]; });
      fresh = eligible;
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

  function heatAfterDone(heat, roundsCompleted) {
    const rounds = roundsCompleted + 1;
    return {
      heat: rounds % 2 === 0 ? Math.min(5, heat + 1) : heat,
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node test/deck.test.js`

Expected: семь строк `ok ...` и код выхода 0.

- [ ] **Step 5: Commit**

```bash
git add js/deck.js test/deck.test.js
git commit -m "$(cat <<'EOF'
Добавить выбор карточки и шаг накала, чтобы партия могла расти по правилам.

EOF
)"
```

---

### Task 2: Угол бутылочки и выбор игрока

**Files:**
- Create: `js/spin.js`
- Modify: `test/deck.test.js`
- Test: `test/deck.test.js`

**Interfaces:**
- Consumes: ничего из Task 1 внутри `spin.js`. Тест остаётся в `test/deck.test.js`.
- Produces: `seatAngle`, `seatPoint`, `nextPlayerIndex`, `bottleRotation`

- [ ] **Step 1: Write the failing test**

В конец `test/deck.test.js`, перед `if (failed > 0)`, добавь:

```javascript
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
```

Require в этом блоке один. Второй `require("../js/spin.js")` в файле не добавляй.

- [ ] **Step 2: Run test to verify it fails**

Run: `node test/deck.test.js`

Expected: FAIL, `Cannot find module '../js/spin.js'`

- [ ] **Step 3: Write minimal implementation**

Создай `js/spin.js`:

```javascript
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ButtleSpin = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function seatAngle(index, count) {
    return (360 / count) * index;
  }

  function seatPoint(index, count, radius) {
    const angle = seatAngle(index, count) * Math.PI / 180;
    return {
      x: radius * Math.sin(angle),
      y: -radius * Math.cos(angle),
    };
  }

  function nextPlayerIndex(count, lastIndex, random) {
    const blocked = count >= 3 && Number.isInteger(lastIndex) && lastIndex >= 0 && lastIndex < count;
    if (!blocked) return Math.floor(random() * count);
    const choice = Math.floor(random() * (count - 1));
    return choice >= lastIndex ? choice + 1 : choice;
  }

  function bottleRotation(currentRotation, targetAngle) {
    const currentMod = ((currentRotation % 360) + 360) % 360;
    let delta = targetAngle - currentMod;
    if (delta < 0) delta += 360;
    return currentRotation + 5 * 360 + delta;
  }

  return {
    seatAngle: seatAngle,
    seatPoint: seatPoint,
    nextPlayerIndex: nextPlayerIndex,
    bottleRotation: bottleRotation,
  };
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node test/deck.test.js`

Expected: прежние тесты и четыре новых `ok`, код выхода 0.

- [ ] **Step 5: Commit**

```bash
git add js/spin.js test/deck.test.js
git commit -m "$(cat <<'EOF'
Добавить расчёт вращения бутылочки и запрет повтора при трёх игроках.

EOF
)"
```

---

### Task 3: Список игроков

**Files:**
- Create: `js/players.js`
- Modify: `test/deck.test.js`
- Test: `test/deck.test.js`

**Interfaces:**
- Consumes: ничего
- Produces: `validateName`, `addPlayer`, `removePlayer`, `loadPlayers`, `savePlayers`

- [ ] **Step 1: Write the failing test**

В `test/deck.test.js` перед `if (failed > 0)` добавь:

```javascript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node test/deck.test.js`

Expected: FAIL, `Cannot find module '../js/players.js'`

- [ ] **Step 3: Write minimal implementation**

Создай `js/players.js`:

```javascript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node test/deck.test.js`

Expected: все предыдущие тесты и три новых `ok`, код выхода 0.

- [ ] **Step 5: Commit**

```bash
git add js/players.js test/deck.test.js
git commit -m "$(cat <<'EOF'
Добавить проверку имён и сохранение состава компании.

EOF
)"
```

---

### Task 4: Карточки ступеней 1–3

**Files:**
- Create: `cards.js`
- Modify: `test/deck.test.js`
- Test: `test/deck.test.js`

**Interfaces:**
- Consumes: ничего
- Produces: `BUTTLE_CARDS` / `module.exports` — массив карточек ступеней 1–3, по 8 на каждый тип

- [ ] **Step 1: Write the failing test**

В `test/deck.test.js` перед `if (failed > 0)` добавь:

```javascript
const cardsData = require("../cards.js");

function countBucket(group, actor, partner) {
  return group.filter(function (card) {
    return card.actor === actor && card.partner === partner;
  }).length;
}

test("колода ступеней 1–3 собрана восьмёрками", function () {
  assert.equal(cardsData.length, 48);
  const ids = cardsData.map(function (card) { return card.id; });
  assert.equal(new Set(ids).size, ids.length);
  ["truth", "dare"].forEach(function (type) {
    [1, 2, 3].forEach(function (heat) {
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node test/deck.test.js`

Expected: FAIL, `Cannot find module '../cards.js'`

- [ ] **Step 3: Write minimal implementation**

Создай `cards.js` ровно с этими 48 карточками. Тон: 1 — комплименты без прикосновений, 2 — флирт без раздевания, 3 — поцелуи и прикосновения поверх одежды.

```javascript
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BUTTLE_CARDS = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function both(male, female) { return { m: male, f: female }; }
  function card(id, type, heat, actor, partner, text) {
    return { id: id, type: type, heat: heat, actor: actor, partner: partner, text: text };
  }

  return [
    card("t1-a1", "truth", 1, "any", null, both("Какой самый тёплый комплимент ты слышал за этот год?", "Какой самый тёплый комплимент ты слышала за этот год?")),
    card("t1-a2", "truth", 1, "any", null, both("Что в сегодняшней компании тебе уже приятно?", "Что в сегодняшней компании тебе уже приятно?")),
    card("t1-pm1", "truth", 1, "any", "m", both("Какая черта {partner} делает его надёжным в компании?", "Какая черта {partner} делает его надёжным в компании?")),
    card("t1-pm2", "truth", 1, "any", "m", both("За что {partner} можно сказать спасибо сегодня?", "За что {partner} можно сказать спасибо сегодня?")),
    card("t1-pf1", "truth", 1, "any", "f", both("Какая черта {partner} делает её особенно тёплой?", "Какая черта {partner} делает её особенно тёплой?")),
    card("t1-pf2", "truth", 1, "any", "f", both("За что {partner} можно сказать спасибо сегодня?", "За что {partner} можно сказать спасибо сегодня?")),
    card("t1-m", "truth", 1, "m", null, { m: "Каким своим спокойным качеством ты гордишься?" }),
    card("t1-f", "truth", 1, "f", null, { f: "Каким своим спокойным качеством ты гордишься?" }),

    card("d1-a1", "dare", 1, "any", null, both("Скажи каждому за столом по одному искреннему комплименту.", "Скажи каждому за столом по одному искреннему комплименту.")),
    card("d1-a2", "dare", 1, "any", null, both("Произнеси короткий тост за людей за этим столом.", "Произнеси короткий тост за людей за этим столом.")),
    card("d1-pm1", "dare", 1, "any", "m", both("Посмотри {partner} в глаза и скажи, за что ты его уважаешь.", "Посмотри {partner} в глаза и скажи, за что ты его уважаешь.")),
    card("d1-pm2", "dare", 1, "any", "m", both("Скажи {partner} одну хорошую вещь о нём, которую ещё не говорил вслух.", "Скажи {partner} одну хорошую вещь о нём, которую ещё не говорила вслух.")),
    card("d1-pf1", "dare", 1, "any", "f", both("Посмотри {partner} в глаза и скажи, за что ты её уважаешь.", "Посмотри {partner} в глаза и скажи, за что ты её уважаешь.")),
    card("d1-pf2", "dare", 1, "any", "f", both("Скажи {partner} одну хорошую вещь о ней, которую ещё не говорил вслух.", "Скажи {partner} одну хорошую вещь о ней, которую ещё не говорила вслух.")),
    card("d1-m", "dare", 1, "m", null, { m: "Встань и одной фразой расскажи, чему ты рад в этой компании." }),
    card("d1-f", "dare", 1, "f", null, { f: "Встань и одной фразой расскажи, чему ты рада в этой компании." }),

    card("t2-a1", "truth", 2, "any", null, both("Кого за этим столом ты сегодня считаешь самым притягательным и почему?", "Кого за этим столом ты сегодня считаешь самой притягательной и почему?")),
    card("t2-a2", "truth", 2, "any", null, both("Какая деталь внешности за этим столом цепляет тебя сильнее всего?", "Какая деталь внешности за этим столом цепляет тебя сильнее всего?")),
    card("t2-pm1", "truth", 2, "any", "m", both("Что во взгляде {partner} кажется тебе флиртом?", "Что во взгляде {partner} кажется тебе флиртом?")),
    card("t2-pm2", "truth", 2, "any", "m", both("Какой комплимент внешности {partner} ты ещё не решился сказать вслух?", "Какой комплимент внешности {partner} ты ещё не решилась сказать вслух?")),
    card("t2-pf1", "truth", 2, "any", "f", both("Что во взгляде {partner} кажется тебе флиртом?", "Что во взгляде {partner} кажется тебе флиртом?")),
    card("t2-pf2", "truth", 2, "any", "f", both("Какой комплимент внешности {partner} ты ещё не решился сказать вслух?", "Какой комплимент внешности {partner} ты ещё не решилась сказать вслух?")),
    card("t2-m", "truth", 2, "m", null, { m: "Какая часть твоей внешности, по-твоему, замечается первой?" }),
    card("t2-f", "truth", 2, "f", null, { f: "Какая часть твоей внешности, по-твоему, замечается первой?" }),

    card("d2-a1", "dare", 2, "any", null, both("Три секунды смотри в глаза человеку слева, не отводя взгляд.", "Три секунды смотри в глаза человеку слева, не отводя взгляд.")),
    card("d2-a2", "dare", 2, "any", null, both("Вслух назови, в чём ты сегодня выглядишь особенно хорошо.", "Вслух назови, в чём ты сегодня выглядишь особенно хорошо.")),
    card("d2-pm1", "dare", 2, "any", "m", both("Скажи {partner}, какая деталь в нём сегодня особенно привлекательна.", "Скажи {partner}, какая деталь в нём сегодня особенно привлекательна.")),
    card("d2-pm2", "dare", 2, "any", "m", both("Опиши {partner}, как бы ты пригласил его на медленный танец, не вставая.", "Опиши {partner}, как бы ты пригласила его на медленный танец, не вставая.")),
    card("d2-pf1", "dare", 2, "any", "f", both("Скажи {partner}, какая деталь в ней сегодня особенно привлекательна.", "Скажи {partner}, какая деталь в ней сегодня особенно привлекательна.")),
    card("d2-pf2", "dare", 2, "any", "f", both("Опиши {partner}, как бы ты пригласил её на медленный танец, не вставая.", "Опиши {partner}, как бы ты пригласила её на медленный танец, не вставая.")),
    card("d2-m", "dare", 2, "m", null, { m: "Поправь волосы или ворот и скажи, для кого за столом ты сейчас стараешься выглядеть хорошо." }),
    card("d2-f", "dare", 2, "f", null, { f: "Поправь волосы и скажи, для кого за столом ты сейчас стараешься выглядеть хорошо." }),

    card("t3-a1", "truth", 3, "any", null, both("Куда тебе приятнее всего, когда тебя целуют?", "Куда тебе приятнее всего, когда тебя целуют?")),
    card("t3-a2", "truth", 3, "any", null, both("Какой поцелуй ты до сих пор вспоминаешь как самый удачный?", "Какой поцелуй ты до сих пор вспоминаешь как самый удачный?")),
    card("t3-pm1", "truth", 3, "any", "m", both("Куда ты хочешь поцеловать {partner}, пока одежда остаётся на месте?", "Куда ты хочешь поцеловать {partner}, пока одежда остаётся на месте?")),
    card("t3-pm2", "truth", 3, "any", "m", both("Как бы ты обнял {partner}, чтобы это уже не было просто дружеским?", "Как бы ты обняла {partner}, чтобы это уже не было просто дружеским?")),
    card("t3-pf1", "truth", 3, "any", "f", both("Куда ты хочешь поцеловать {partner}, пока одежда остаётся на месте?", "Куда ты хочешь поцеловать {partner}, пока одежда остаётся на месте?")),
    card("t3-pf2", "truth", 3, "any", "f", both("Как бы ты обнял {partner}, чтобы это уже не было просто дружеским?", "Как бы ты обняла {partner}, чтобы это уже не было просто дружеским?")),
    card("t3-m", "truth", 3, "m", null, { m: "Покажи на себе поверх одежды, где тебе приятнее всего чужая ладонь." }),
    card("t3-f", "truth", 3, "f", null, { f: "Покажи на себе поверх одежды, где тебе приятнее всего чужая ладонь." }),

    card("d3-a1", "dare", 3, "any", null, both("Медленно проведи ладонью по своей шее и скажи, приятно ли тебе.", "Медленно проведи ладонью по своей шее и скажи, приятно ли тебе.")),
    card("d3-a2", "dare", 3, "any", null, both("Поцелуй свою ладонь так, как ты умеешь целовать человека.", "Поцелуй свою ладонь так, как ты умеешь целовать человека.")),
    card("d3-pm1", "dare", 3, "any", "m", both("Поцелуй {partner} в щёку и задержись дольше, чем это принято.", "Поцелуй {partner} в щёку и задержись дольше, чем это принято.")),
    card("d3-pm2", "dare", 3, "any", "m", both("Положи ладонь {partner} на грудь поверх одежды и подержи пять секунд.", "Положи ладонь {partner} на грудь поверх одежды и подержи пять секунд.")),
    card("d3-pf1", "dare", 3, "any", "f", both("Поцелуй {partner} в щёку и задержись дольше, чем это принято.", "Поцелуй {partner} в щёку и задержись дольше, чем это принято.")),
    card("d3-pf2", "dare", 3, "any", "f", both("Положи ладонь {partner} на талию поверх одежды и подержи пять секунд.", "Положи ладонь {partner} на талию поверх одежды и подержи пять секунд.")),
    card("d3-m", "dare", 3, "m", null, { m: "Обними себя за плечи и покажи, каким объятием ты встречаешь человека." }),
    card("d3-f", "dare", 3, "f", null, { f: "Обними себя за плечи и покажи, каким объятием ты встречаешь человека." }),
  ];
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node test/deck.test.js`

Expected: код выхода 0, в том числе `ok колода ступеней 1–3 собрана восьмёрками`.

- [ ] **Step 5: Commit**

```bash
git add cards.js test/deck.test.js
git commit -m "$(cat <<'EOF'
Добавить невинные, флиртующие и смелые карточки первых трёх ступеней.

EOF
)"
```

---

### Task 5: Карточки ступеней 4–5

**Files:**
- Modify: `cards.js`
- Modify: `test/deck.test.js`
- Test: `test/deck.test.js`

**Interfaces:**
- Consumes: массив из Task 4, функции `card` и `both` в том же файле
- Produces: 80 карточек, ступени 1–5. На пятой ступени есть действие: уложить `{partner}`-мужчину на спину и сесть ему на лицо своей попкой

- [ ] **Step 1: Write the failing test**

В тесте `колода ступеней 1–3 собрана восьмёрками` замени ожидание длины и цикл ступеней:

```javascript
  assert.equal(cardsData.length, 80);
```

```javascript
    [1, 2, 3, 4, 5].forEach(function (heat) {
```

Переименуй тест в `колода всех ступеней собрана восьмёрками`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node test/deck.test.js`

Expected: FAIL, длина 48 не равна 80.

- [ ] **Step 3: Write minimal implementation**

В массив `cards.js` перед закрывающей `];` добавь 32 карточки. Тон 4 — прямой сексуальный разговор и действия под одеждой. Тон 5 — откровенные сексуальные действия. `d5-pm1` обязан содержать посадку на лицо.

```javascript
    card("t4-a1", "truth", 4, "any", null, both("Что из сексуального тебе хочется сегодня сильнее всего, если говорить прямо?", "Что из сексуального тебе хочется сегодня сильнее всего, если говорить прямо?")),
    card("t4-a2", "truth", 4, "any", null, both("Какая ласка под одеждой заводит тебя быстрее всего?", "Какая ласка под одеждой заводит тебя быстрее всего?")),
    card("t4-pm1", "truth", 4, "any", "m", both("Что бы ты сделал с {partner}, если бы завёл руку ему под одежду?", "Что бы ты сделала с {partner}, если бы завела руку ему под одежду?")),
    card("t4-pm2", "truth", 4, "any", "m", both("Какая часть тела {partner} тебе сейчас интереснее всего под тканью?", "Какая часть тела {partner} тебе сейчас интереснее всего под тканью?")),
    card("t4-pf1", "truth", 4, "any", "f", both("Что бы ты сделал с {partner}, если бы завёл руку ей под одежду?", "Что бы ты сделала с {partner}, если бы завела руку ей под одежду?")),
    card("t4-pf2", "truth", 4, "any", "f", both("Какая часть тела {partner} тебе сейчас интереснее всего под тканью?", "Какая часть тела {partner} тебе сейчас интереснее всего под тканью?")),
    card("t4-m", "truth", 4, "m", null, { m: "Расскажи, как ты возбуждаешься, когда чья-то рука оказывается у тебя под рубашкой." }),
    card("t4-f", "truth", 4, "f", null, { f: "Расскажи, как ты возбуждаешься, когда чья-то рука оказывается у тебя под одеждой." }),

    card("d4-a1", "dare", 4, "any", null, both("Запусти свою ладонь себе под одежду на грудь или живот и опиши ощущение вслух.", "Запусти свою ладонь себе под одежду на грудь или живот и опиши ощущение вслух.")),
    card("d4-a2", "dare", 4, "any", null, both("Шёпотом опиши сексуальное действие, которое ты хочешь получить сегодня.", "Шёпотом опиши сексуальное действие, которое ты хочешь получить сегодня.")),
    card("d4-pm1", "dare", 4, "any", "m", both("Заведи ладонь {partner} под одежду на грудь или живот и подержи, пока он не кивнёт.", "Заведи ладонь {partner} под одежду на грудь или живот и подержи, пока он не кивнёт.")),
    card("d4-pm2", "dare", 4, "any", "m", both("На ухо {partner} опиши, как ты ласкаешь его рукой под одеждой.", "На ухо {partner} опиши, как ты ласкаешь его рукой под одеждой.")),
    card("d4-pf1", "dare", 4, "any", "f", both("Заведи ладонь {partner} под одежду на грудь или живот и подержи, пока она не кивнёт.", "Заведи ладонь {partner} под одежду на грудь или живот и подержи, пока она не кивнёт.")),
    card("d4-pf2", "dare", 4, "any", "f", both("На ухо {partner} опиши, как ты ласкаешь её рукой под одеждой.", "На ухо {partner} опиши, как ты ласкаешь её рукой под одеждой.")),
    card("d4-m", "dare", 4, "m", null, { m: "Расстегни верх одежды, проведи своей ладонью по груди под тканью и скажи вслух, чего тебе хочется." }),
    card("d4-f", "dare", 4, "f", null, { f: "Проведи своей ладонью по животу под одеждой и скажи вслух, чего тебе хочется." }),

    card("t5-a1", "truth", 5, "any", null, both("Какое откровенное сексуальное желание ты готов исполнить за этим столом?", "Какое откровенное сексуальное желание ты готова исполнить за этим столом?")),
    card("t5-a2", "truth", 5, "any", null, both("Опиши вслух, как ты хочешь кончить сегодня.", "Опиши вслух, как ты хочешь кончить сегодня.")),
    card("t5-pm1", "truth", 5, "any", "m", both("Что сексуального ты хочешь сделать с {partner} прямо сейчас?", "Что сексуального ты хочешь сделать с {partner} прямо сейчас?")),
    card("t5-pm2", "truth", 5, "any", "m", both("Хочешь ли ты, чтобы {partner} кончил от твоего рта, и как именно?", "Хочешь ли ты, чтобы {partner} кончил от твоего рта, и как именно?")),
    card("t5-pf1", "truth", 5, "any", "f", both("Что сексуального ты хочешь сделать с {partner} прямо сейчас?", "Что сексуального ты хочешь сделать с {partner} прямо сейчас?")),
    card("t5-pf2", "truth", 5, "any", "f", both("Хочешь ли ты, чтобы {partner} кончила от твоего рта, и как именно?", "Хочешь ли ты, чтобы {partner} кончила от твоего рта, и как именно?")),
    card("t5-m", "truth", 5, "m", null, { m: "Расскажи, как ты хочешь взять человека ртом." }),
    card("t5-f", "truth", 5, "f", null, { f: "Расскажи, как ты хочешь сесть на лицо или взять человека ртом." }),

    card("d5-a1", "dare", 5, "any", null, both("Сними один верхний предмет одежды и скажи, какое сексуальное действие ты готов сделать следующим.", "Сними один верхний предмет одежды и скажи, какое сексуальное действие ты готова сделать следующим.")),
    card("d5-a2", "dare", 5, "any", null, both("Две минуты описывай вслух, как ты ласкаешь партнёра ртом, не пропуская детали.", "Две минуты описывай вслух, как ты ласкаешь партнёра ртом, не пропуская детали.")),
    card("d5-pm1", "dare", 5, "any", "m", both("Уложи {partner} на спину. Сядь ему на лицо своей попкой.", "Уложи {partner} на спину. Сядь ему на лицо своей попкой.")),
    card("d5-pm2", "dare", 5, "any", "m", both("Если {partner} согласен, приспусти ему одежду и ласкай его ртом, пока он не остановит.", "Если {partner} согласен, приспусти ему одежду и ласкай его ртом, пока он не остановит.")),
    card("d5-pf1", "dare", 5, "any", "f", both("Уложи {partner} на спину и целуй её между ног через бельё, пока она не остановит или не попросит ближе.", "Уложи {partner} на спину и целуй её между ног через бельё, пока она не остановит или не попросит ближе.")),
    card("d5-pf2", "dare", 5, "any", "f", both("Сядь на бёдра {partner} лицом к ней и трись так, чтобы это уже было близостью в одежде.", "Сядь на бёдра {partner} лицом к ней и трись так, чтобы это уже было близостью в одежде.")),
    card("d5-m", "dare", 5, "m", null, { m: "Встань на колени и по своей ладони покажи ртом, как ты берёшь член." }),
    card("d5-f", "dare", 5, "f", null, { f: "Встань на колени и по своей ладони покажи ртом, как ты ласкаешь." }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node test/deck.test.js`

Expected: код выхода 0, `ok колода всех ступеней собрана восьмёрками`.

- [ ] **Step 5: Commit**

```bash
git add cards.js test/deck.test.js
git commit -m "$(cat <<'EOF'
Добавить откровенные карточки четвёртой и пятой ступеней накала.

EOF
)"
```

---

### Task 6: Оболочка салона

**Files:**
- Create: `index.html`
- Create: `styles.css`
- Create: `fonts/cormorant-garamond-cyrillic.woff2`
- Create: `fonts/cormorant-garamond-latin.woff2`
- Create: `fonts/manrope-cyrillic.woff2`
- Create: `fonts/manrope-latin.woff2`

**Interfaces:**
- Consumes: ничего из логики, страница ещё без `app.js`
- Produces: разметка `#screen-age`, `#screen-players`, `#screen-table`, `#sheet`, `#bottle`, `#seats` и классы из CSS ниже

- [ ] **Step 1: Download fonts**

```bash
mkdir -p fonts
curl -fsSL -o fonts/cormorant-garamond-cyrillic.woff2 "https://cdn.jsdelivr.net/fontsource/fonts/cormorant-garamond@5.2.8/cyrillic-600-normal.woff2"
curl -fsSL -o fonts/cormorant-garamond-latin.woff2 "https://cdn.jsdelivr.net/fontsource/fonts/cormorant-garamond@5.2.8/latin-600-normal.woff2"
curl -fsSL -o fonts/manrope-cyrillic.woff2 "https://cdn.jsdelivr.net/fontsource/fonts/manrope@5.2.8/cyrillic-400-normal.woff2"
curl -fsSL -o fonts/manrope-latin.woff2 "https://cdn.jsdelivr.net/fontsource/fonts/manrope@5.2.8/latin-400-normal.woff2"
```

Expected: четыре файла ненулевого размера, `file fonts/*.woff2` показывает Web Open Font Format.

- [ ] **Step 2: Write the page**

Создай `index.html`:

```html
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#14090c">
  <title>Бутылочка</title>
  <link rel="manifest" href="./manifest.webmanifest">
  <link rel="icon" href="./icons/icon-192.png">
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
  <main class="app">
    <section id="screen-age" class="screen">
      <p class="eyebrow">18+</p>
      <h1>Бутылочка</h1>
      <p class="lead">Игра для взрослых. За столом только те, кому уже есть 18.</p>
      <button type="button" id="age-ok" class="button">Мне есть 18</button>
    </section>

    <section id="screen-players" class="screen" hidden>
      <p class="eyebrow">Компания</p>
      <h1>Кто за столом</h1>
      <form id="player-form" class="player-form">
        <label class="field">
          <span>Имя</span>
          <input id="player-name" name="name" maxlength="20" autocomplete="off" placeholder="Имя">
        </label>
        <div class="gender" role="group" aria-label="Пол">
          <button type="button" id="gender-m" class="chip is-on" aria-pressed="true">мужчина</button>
          <button type="button" id="gender-f" class="chip" aria-pressed="false">женщина</button>
        </div>
        <p id="player-error" class="error" hidden></p>
        <button type="submit" class="button">Добавить</button>
      </form>
      <ul id="player-list" class="player-list"></ul>
      <button type="button" id="start-game" class="button" disabled>Начать</button>
      <p id="install-hint" class="hint" hidden>Чтобы поставить на телефон: меню браузера → «Добавить на главный экран» или «Установить приложение».</p>
    </section>

    <section id="screen-table" class="screen" hidden>
      <header class="heat">
        <button type="button" id="heat-down" class="chip">тише</button>
        <div>
          <p id="heat-name" class="heat-name">невинно</p>
          <p id="heat-pips" class="pips" aria-hidden="true"></p>
        </div>
        <button type="button" id="heat-up" class="chip">жарче</button>
      </header>
      <div class="ring">
        <div id="seats" class="seats"></div>
        <div class="felt"></div>
        <div id="bottle" class="bottle" aria-hidden="true">
          <svg viewBox="0 0 80 220" width="46" height="150">
            <rect x="30" y="8" width="20" height="28" rx="4" fill="#d4b483"></rect>
            <rect x="34" y="34" width="12" height="36" rx="4" fill="#e8d6be"></rect>
            <ellipse cx="40" cy="132" rx="28" ry="62" fill="#e8d6be"></ellipse>
            <ellipse cx="40" cy="124" rx="16" ry="36" fill="#c4a574" opacity="0.35"></ellipse>
          </svg>
        </div>
      </div>
      <button type="button" id="spin" class="button">Крутить</button>
      <button type="button" id="leave" class="text-button">К игрокам</button>
      <div id="sheet" class="sheet" hidden>
        <p id="sheet-name" class="sheet-name"></p>
        <div id="sheet-choice" class="sheet-actions">
          <button type="button" id="pick-truth" class="button">Правда</button>
          <button type="button" id="pick-dare" class="button button-ghost">Действие</button>
        </div>
        <div id="sheet-card" hidden>
          <p id="sheet-text" class="sheet-text"></p>
          <div class="sheet-actions">
            <button type="button" id="card-another" class="button button-ghost">Другое</button>
            <button type="button" id="card-done" class="button">Готово</button>
          </div>
        </div>
        <div id="sheet-empty" hidden>
          <p class="sheet-text">На этой ступени для такой компании нет карточек</p>
          <button type="button" id="empty-close" class="button">К столу</button>
        </div>
      </div>
    </section>
  </main>
  <script src="./cards.js"></script>
  <script src="./js/players.js"></script>
  <script src="./js/deck.js"></script>
  <script src="./js/spin.js"></script>
</body>
</html>
```

- [ ] **Step 3: Write the styles**

Создай `styles.css`:

```css
@font-face {
  font-family: "Cormorant Garamond";
  src: url("./fonts/cormorant-garamond-cyrillic.woff2") format("woff2");
  font-weight: 600;
  font-style: normal;
  font-display: swap;
  unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116;
}
@font-face {
  font-family: "Cormorant Garamond";
  src: url("./fonts/cormorant-garamond-latin.woff2") format("woff2");
  font-weight: 600;
  font-style: normal;
  font-display: swap;
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: Manrope;
  src: url("./fonts/manrope-cyrillic.woff2") format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
  unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116;
}
@font-face {
  font-family: Manrope;
  src: url("./fonts/manrope-latin.woff2") format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}

* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; }
body {
  min-height: 100dvh;
  color: #f6efe6;
  background: #14090c;
  font-family: Manrope, sans-serif;
  overflow-x: hidden;
}
body::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(ellipse at center, transparent 35%, rgba(0, 0, 0, 0.55) 100%);
}
.app {
  width: min(100%, 480px);
  min-height: 100dvh;
  margin: 0 auto;
  padding: calc(20px + env(safe-area-inset-top)) 20px calc(24px + env(safe-area-inset-bottom));
  position: relative;
}
.screen { display: flex; flex-direction: column; gap: 16px; min-height: calc(100dvh - 48px); }
h1, .heat-name, .sheet-name, .sheet-text, .seat {
  font-family: "Cormorant Garamond", serif;
  font-weight: 600;
}
h1 { font-size: 64px; line-height: 0.9; margin: 0; }
.eyebrow { letter-spacing: 0.18em; text-transform: uppercase; color: #d4b483; margin: 0; }
.lead, .hint, .error { margin: 0; line-height: 1.45; }
.error { color: #e7b2a8; min-height: 1.2em; }
.hint { color: #d4b483; }
.button, .chip, .text-button {
  font: inherit;
  color: #f6efe6;
  background: transparent;
  border: 1px solid #d4b483;
  border-radius: 999px;
  min-height: 52px;
  padding: 12px 18px;
}
.button { width: 100%; background: #2a1418; }
.button-ghost { background: transparent; }
.button:disabled, .chip:disabled { opacity: 0.4; }
.text-button { border: 0; min-height: 44px; color: #d4b483; }
.chip { min-height: 44px; }
.chip.is-on { background: #d4b483; color: #1c1214; }
.player-form, .gender, .sheet-actions, .heat { display: flex; gap: 10px; }
.player-form, .sheet-actions { flex-direction: column; }
.gender, .heat { align-items: center; justify-content: space-between; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field input {
  font: inherit;
  color: #1c1214;
  background: #f3e6d4;
  border: 0;
  border-radius: 16px;
  min-height: 52px;
  padding: 0 16px;
}
.player-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
.player-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(212, 180, 131, 0.25);
}
.heat-name { margin: 0; text-align: center; font-size: 32px; line-height: 1; }
.pips { display: flex; gap: 6px; justify-content: center; margin: 8px 0 0; }
.pips i { width: 8px; height: 8px; border-radius: 50%; border: 1px solid #d4b483; display: block; }
.pips i.is-on { background: #d4b483; }
.ring { position: relative; width: min(92vw, 420px); aspect-ratio: 1; margin: 8px auto 0; }
.felt {
  position: absolute;
  inset: 22%;
  border-radius: 50%;
  background: #2a1418;
  box-shadow: inset 0 0 40px rgba(0, 0, 0, 0.35);
}
.bottle {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  filter: drop-shadow(0 10px 16px rgba(0, 0, 0, 0.35));
}
.seats { position: absolute; inset: 0; }
.seat {
  position: absolute;
  transform: translate(-50%, -50%);
  max-width: 88px;
  text-align: center;
  font-size: 22px;
  line-height: 1;
}
.seat.is-chosen { color: #d4b483; }
.sheet {
  position: fixed;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  width: min(100%, 480px);
  background: #f3e6d4;
  color: #1c1214;
  border-radius: 28px 28px 0 0;
  padding: 24px 20px calc(24px + env(safe-area-inset-bottom));
  box-shadow: 0 -20px 50px rgba(0, 0, 0, 0.35);
}
.sheet .button { color: #1c1214; background: transparent; }
.sheet-name { font-size: 42px; margin: 0 0 8px; }
.sheet-text { font-size: 34px; line-height: 1.25; margin: 0 0 18px; }
```

- [ ] **Step 4: Check the shell opens**

Run: `node test/deck.test.js`

Expected: код выхода 0. Затем открой `index.html` в браузере: тёмный винный фон, заголовок «Бутылочка» антиквой, золотая кнопка «Мне есть 18», страница не уезжает вбок.

- [ ] **Step 5: Commit**

```bash
git add index.html styles.css fonts
git commit -m "$(cat <<'EOF'
Собрать мобильную оболочку салона и подключить кириллические шрифты.

EOF
)"
```

---

### Task 7: Поведение экранов

**Files:**
- Create: `js/app.js`
- Modify: `index.html`
- Test: `node test/deck.test.js` и ручной проход в браузере

**Interfaces:**
- Consumes: `ButtleDeck`, `ButtleSpin`, `ButtlePlayers`, `BUTTLE_CARDS`, id элементов из Task 6
- Produces: рабочая партия в браузере. Ключи хранения ровно `buttle.ageOk`, `buttle.players`, `buttle.party`

- [ ] **Step 1: Подключи скрипт**

Перед `</body>` в `index.html` добавь:

```html
  <script src="./js/app.js"></script>
```

- [ ] **Step 2: Write the app**

Создай `js/app.js`:

```javascript
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
      if (!parsed || typeof parsed.heat !== "number" || !Array.isArray(parsed.usedIds)) return null;
      return parsed;
    } catch (error) {
      return null;
    }
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
    var result = playersApi.addPlayer(players, nameInput.value, draftGender, crypto.randomUUID());
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
  render();
})();
```

- [ ] **Step 3: Run unit tests**

Run: `node test/deck.test.js`

Expected: код выхода 0.

- [ ] **Step 4: Проверь партию в браузере**

Открой `index.html` через локальный сервер (`python3 -m http.server 4173` в корне репозитория), чтобы скрипты не блокировались как file://.

Пройди так:

1. «Мне есть 18» открывает набор игроков. Обновление страницы больше не показывает возраст.
2. Пустое имя показывает «Введите имя». Второе такое же имя показывает «Такое имя уже есть». «Начать» не нажимается, пока игрок один.
3. Добавь Аню (женщина), Борю (мужчина) и Веру (женщина). «Начать» открывает стол на ступени «невинно».
4. «Крутить» крутит бутылочку около трёх секунд. Повторное нажатие в это время ничего не меняет. После остановки видны «Правда» и «Действие», а «тише» и «жарче» не нажимаются.
5. «Действие», затем «Другое», затем «Готово». После двух «Готово» ступень становится «флирт». «Жарче» поднимает ещё на одну, «тише» опускает. Счётчик двух ходов при этом не обнуляется: следующие два «Готово» снова поднимают ступень.
6. «К игрокам» возвращает к списку, имена на месте. Снова «Начать» открывает «невинно».
7. Обновление страницы на открытой карточке возвращает к столу без карточки, ступень та же.

- [ ] **Step 5: Commit**

```bash
git add js/app.js index.html
git commit -m "$(cat <<'EOF'
Связать экраны с колодой, чтобы компания могла сыграть партию.

EOF
)"
```

---

### Task 8: Иконка, манифест и офлайн

**Files:**
- Create: `scripts/make-icons.js`
- Create: `icons/icon-192.png`
- Create: `icons/icon-512.png`
- Create: `icons/icon-maskable-192.png`
- Create: `icons/icon-maskable-512.png`
- Create: `manifest.webmanifest`
- Create: `sw.js`
- Modify: `js/app.js`

**Interfaces:**
- Consumes: файлы оболочки и скрипты из предыдущих задач
- Produces: устанавливаемое PWA с кэшем `buttle-v1`

- [ ] **Step 1: Write the icon generator**

Создай `scripts/make-icons.js`:

```javascript
const fs = require("node:fs");
const zlib = require("node:zlib");

function crc32(buffer) {
  let crc = ~0;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function paint(x, y, size, maskable) {
  const radius = size / 2;
  const nx = (x + 0.5 - radius) / radius;
  const ny = (y + 0.5 - radius) / radius;
  const background = [20, 9, 12, 255];
  if (maskable && Math.hypot(nx, ny) > 0.8) return background;
  const body = (nx * nx) / 0.09 + ((ny - 0.12) * (ny - 0.12)) / 0.28 < 1;
  const neck = Math.abs(nx) < 0.055 && ny < -0.08 && ny > -0.48;
  const foil = Math.abs(nx) < 0.07 && ny < -0.34 && ny > -0.52;
  if (foil) return [212, 180, 131, 255];
  if (body || neck) return [232, 214, 190, 255];
  return background;
}

function png(size, maskable) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const pixel = paint(x, y, size, maskable);
      const offset = row + 1 + x * 4;
      raw[offset] = pixel[0];
      raw[offset + 1] = pixel[1];
      raw[offset + 2] = pixel[2];
      raw[offset + 3] = pixel[3];
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

fs.mkdirSync("icons", { recursive: true });
fs.writeFileSync("icons/icon-192.png", png(192, false));
fs.writeFileSync("icons/icon-512.png", png(512, false));
fs.writeFileSync("icons/icon-maskable-192.png", png(192, true));
fs.writeFileSync("icons/icon-maskable-512.png", png(512, true));
```

- [ ] **Step 2: Generate icons and write the manifest**

Run: `node scripts/make-icons.js`

Expected: четыре PNG в `icons/`.

Создай `manifest.webmanifest`:

```json
{
  "name": "Бутылочка. Правда или действие",
  "short_name": "Бутылочка",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#14090c",
  "theme_color": "#14090c",
  "icons": [
    { "src": "./icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "./icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "./icons/icon-maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
    { "src": "./icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 3: Write the service worker and register it**

Создай `sw.js`:

```javascript
var CACHE = "buttle-v1";
var ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./cards.js",
  "./js/players.js",
  "./js/deck.js",
  "./js/spin.js",
  "./js/app.js",
  "./sw.js",
  "./fonts/cormorant-garamond-cyrillic.woff2",
  "./fonts/cormorant-garamond-latin.woff2",
  "./fonts/manrope-cyrillic.woff2",
  "./fonts/manrope-latin.woff2",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(caches.open(CACHE).then(function (cache) {
    return cache.addAll(ASSETS);
  }));
});

self.addEventListener("activate", function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (key) {
      return key !== CACHE;
    }).map(function (key) {
      return caches.delete(key);
    }));
  }).then(function () {
    return self.clients.claim();
  }));
});

self.addEventListener("fetch", function (event) {
  event.respondWith(caches.match(event.request).then(function (cached) {
    return cached || fetch(event.request);
  }));
});
```

Замени конец IIFE в `js/app.js`, начиная с проверки последнего игрока, на:

```javascript
  if (party && !players.some(function (player) { return player.id === party.lastPlayerId; })) {
    party = Object.assign({}, party, { lastPlayerId: null });
    saveParty();
  }
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js");
  }
  render();
})();
```

- [ ] **Step 4: Check manifest, icons, and the game tests**

Run:

```bash
node -e '
const fs = require("node:fs");
const manifest = JSON.parse(fs.readFileSync("manifest.webmanifest", "utf8"));
if (manifest.display !== "standalone") throw new Error("display");
if (manifest.orientation !== "portrait") throw new Error("orientation");
if (manifest.short_name !== "Бутылочка") throw new Error("name");
if (manifest.theme_color !== "#14090c") throw new Error("theme");
const sw = fs.readFileSync("sw.js", "utf8");
if (!sw.includes("buttle-v1")) throw new Error("cache");
["index.html", "styles.css", "cards.js", "js/app.js", "fonts/manrope-cyrillic.woff2", "icons/icon-512.png", "icons/icon-maskable-512.png"].forEach(function (file) {
  if (!sw.includes(file)) throw new Error(file);
  if (!fs.existsSync(file)) throw new Error("missing " + file);
});
console.log("ok pwa");
'
node test/deck.test.js
```

Expected: `ok pwa`, затем все `ok` тестов и код выхода 0.

На телефоне или в мобильной эмуляции Chrome по адресу локального сервера: в обычной вкладке видна подсказка про главный экран. После «Добавить на главный экран» иконка — бутылочка на винном фоне, открытие без адресной строки. Включи авиарежим и открой снова: экран возраста или игроков на месте.

- [ ] **Step 5: Commit**

```bash
git add scripts/make-icons.js icons manifest.webmanifest sw.js js/app.js
git commit -m "$(cat <<'EOF'
Сделать Бутылочку устанавливаемым офлайн-приложением для Android.

EOF
)"
```

---

## Spec coverage

- Мобильное PWA, портрет, viewport, safe area, манифест — Task 6 и Task 8.
- Правила партии, накал, пустая колода, «Другое», «Готово», запрет повтора — Task 1, Task 2, Task 7.
- Игроки, возраст, сохранение, сброс короткой компании и удалённого последнего игрока — Task 3 и Task 7.
- Восемь карточек на ступень и тип, грамматический род, пример с посадкой на лицо — Task 4 и Task 5.
- Салон, шрифты, бутылочка, пять делений накала — Task 6 и Task 7.
- Service worker `buttle-v1` — Task 8.
- Учётки, сервер, iPhone, звук и редактор карточек в план не входят.

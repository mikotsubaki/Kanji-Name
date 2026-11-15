/*
 * 100名以上の名前で、読み推定 → 漢字候補生成をテストします。
 *   実行: node tests/test-names.js          （一覧を表示）
 *         node tests/test-names.js --json   （結果を tests/results.json に保存）
 */
require("../data/kanji-db.js");
require("../data/names-db.js");
const K = require("../js/kana.js");
const { Engine } = require("../js/engine.js");
const fs = require("fs");
const path = require("path");

const engine = new Engine(globalThis.TSUBAKIDO_KANJI_DB);

const ENGLISH_100 = [
  "Michael","Emma","Olivia","Sophia","Alexander","Charlotte","William","Isabella","Lucas","Daniel",
  "Maria","Liam","Noah","Oliver","Elijah","James","Benjamin","Henry","Jacob","Mason",
  "Ethan","Logan","Jackson","Sebastian","Jack","Aiden","Owen","Samuel","Matthew","Joseph",
  "David","John","Luke","Gabriel","Anthony","Isaac","Dylan","Leo","Andrew","Joshua",
  "Christopher","Nathan","Thomas","Charles","Ryan","Adam","Robert","Richard","Edward","George",
  "Ava","Mia","Amelia","Harper","Evelyn","Abigail","Emily","Elizabeth","Ella","Grace",
  "Chloe","Lily","Hannah","Anna","Sarah","Lucy","Alice","Victoria","Madison","Natalie",
  "Zoe","Scarlett","Aria","Layla","Nora","Hazel","Ellie","Stella","Violet","Aurora",
  "Jessica","Jennifer","Ashley","Amanda","Rachel","Rebecca","Laura","Julia","Kate","Katherine",
  "Mary","Megan","Samantha","Rose","Ruby","Lauren","Taylor","Claire","Michelle","Nicole"
];
const OTHERS = [
  ["Pierre","fr"],["François","fr"],["Hans","de"],["Carlos","es"],["Lucas","fr"],["Michael","de"],["Charlotte","fr"],
  ["Giuseppe","it"],["João","pt"],["Wang Wei","zh"],["김민준","ko"],["Наталья","ru"],["Aarav","generic"],["Mathieu","fr"],
  ["Brooke","en"],["Zachary","en"],["Quentin","en"],["Fiona","en"]
];

const rows = [];
let okCount = 0, fiveCount = 0;
function run(name, profile) {
  const est = K.estimateReading(name, profile);
  const kata = est.parts[0] ? est.parts[0].kata : est.kata;
  const t0 = Date.now();
  const res = engine.generate(kata, { prefs: [] });
  const ms = Date.now() - t0;
  const c = res.candidates;
  if (c.length) okCount++;
  if (c.length >= 5) fiveCount++;
  rows.push({ name, profile, kata, source: est.parts[0] && est.parts[0].source, status: res.status, ms,
    candidates: c.map(x => ({ kanji: x.kanji, theme: x.theme, reading: x.kanjiReading, stars: x.stars, creative: x.creative })) });
}
ENGLISH_100.forEach(n => run(n, "en"));
OTHERS.forEach(([n, p]) => run(n, p));

if (process.argv.includes("--json")) {
  fs.writeFileSync(path.join(__dirname, "results.json"), JSON.stringify(rows, null, 1), "utf8");
}
rows.forEach(r => {
  console.log(`${r.name.padEnd(12)} [${r.profile}] ${r.kata.padEnd(10, "　")} ${r.ms}ms  ` +
    r.candidates.map(c => `${c.kanji}(${c.reading}${"★".repeat(c.stars)}${c.creative ? "*" : ""})`).join(" "));
});
const total = rows.length;
console.log(`\n合計 ${total} 名 / 候補あり ${okCount} 名 / 5候補 ${fiveCount} 名`);
const avgMs = rows.reduce((a, r) => a + r.ms, 0) / total;
console.log(`平均処理時間 ${avgMs.toFixed(0)}ms`);
if (okCount < total) { process.exitCode = 1; }

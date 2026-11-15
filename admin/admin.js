/* 椿堂 JAPANESE NAME MAKER — 管理画面（ローカル用） */
(function () {
  "use strict";
  var K = window.TKKana, E = window.TKEngine;
  var $ = function (id) { return document.getElementById(id); };
  var LANGS = ["ja", "en", "zh", "zt", "ko", "fr", "de", "es", "it", "pt"];
  var CATS = { be: "美しさ", lu: "幸運", lo: "愛情", st: "強さ", na: "自然", wi: "知性", ha: "調和", tr: "伝統", li: "光", el: "優雅" };
  var KEY = "tsubakido_admin_data";

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function toast(m) { var el = $("toast"); el.textContent = m; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { el.hidden = true; }, 2200); }
  function list(s) { return String(s || "").split(/[,、，\s]+/).map(function (x) { return x.trim(); }).filter(Boolean); }

  /* ---------- データ ---------- */
  var data;
  function fromDefaults() {
    var kdb = window.TSUBAKIDO_KANJI_DB, ndb = window.TSUBAKIDO_NAMES_DB;
    return {
      kanjiDB: {
        version: kdb.version,
        kanji: kdb.rows.map(function (r) {
          var o = E.parseKanjiRow(r);
          return { k: o.k, strokes: o.strokes, on: o.on, kun: o.kun.map(K.kataToHira), nanori: o.nanori.map(K.kataToHira), creative: o.creative, cats: o.cats, pol: o.pol, fit: o.fit, m: o.m };
        }),
        excluded: kdb.excluded,
        recommended: JSON.parse(JSON.stringify(kdb.recommended || {})),
        jpNames: JSON.parse(JSON.stringify(kdb.jpNames || {}))
      },
      namesDB: { version: ndb.version, rows: ndb.rows.map(function (r) { return typeof r === "string" ? K.parseNameRow(r) : r; }) }
    };
  }
  function load() {
    try { var raw = localStorage.getItem(KEY + "_draft"); if (raw) return JSON.parse(raw); } catch (e) {}
    return fromDefaults();
  }
  function saveDraft() { try { localStorage.setItem(KEY + "_draft", JSON.stringify(data)); } catch (e) {} }
  data = load();

  /* ---------- タブ ---------- */
  $("tabs").addEventListener("click", function (e) {
    var b = e.target.closest("[data-tab]"); if (!b) return;
    Array.prototype.forEach.call(document.querySelectorAll("[data-tab]"), function (x) { x.setAttribute("aria-selected", String(x === b)); });
    Array.prototype.forEach.call(document.querySelectorAll("[data-panel]"), function (p) { p.hidden = p.getAttribute("data-panel") !== b.getAttribute("data-tab"); });
  });

  /* ---------- 漢字 ---------- */
  var selected = null;
  $("catsBox").innerHTML = Object.keys(CATS).map(function (c) { return '<label><input type="checkbox" name="cat" value="' + c + '"> ' + CATS[c] + "</label>"; }).join("");
  function renderKanji() {
    var q = $("kSearch").value.trim();
    var rows = data.kanjiDB.kanji.filter(function (o) {
      if (!q) return true;
      var hay = [o.k, (o.on || []).join(","), (o.kun || []).join(","), (o.nanori || []).join(","), (o.m || {}).ja, (o.m || {}).en].join(" ");
      return hay.indexOf(q) >= 0 || hay.indexOf(K.hiraToKata(q)) >= 0 || hay.indexOf(K.kataToHira(q)) >= 0;
    });
    $("kBody").innerHTML = rows.map(function (o) {
      return '<tr data-k="' + esc(o.k) + '" class="' + (o.k === selected ? "sel " : "") + (o.disabled ? "off" : "") + '"><td class="kcell">' + esc(o.k) + "</td><td>" + (o.strokes || "") + "</td><td>" + esc((o.on || []).join("、")) +
        "</td><td>" + esc((o.kun || []).join("、")) + "</td><td>" + esc((o.nanori || []).join("、")) + "</td><td>" + esc((o.m || {}).ja || "") + "</td><td>" + o.pol + "/" + o.fit + "</td></tr>";
    }).join("");
    $("kCount").textContent = rows.length + " / " + data.kanjiDB.kanji.length + " 字";
  }
  function fillForm(o) {
    var f = $("kForm");
    o = o || { k: "", strokes: "", on: [], kun: [], nanori: [], creative: [], cats: [], pol: 4, fit: 4, m: {} };
    f.k.value = o.k; f.strokes.value = o.strokes || "";
    f.on.value = (o.on || []).join(","); f.kun.value = (o.kun || []).join(","); f.nanori.value = (o.nanori || []).join(","); f.creative.value = (o.creative || []).join(",");
    f.pol.value = o.pol; f.fit.value = o.fit; f.disabled.checked = !!o.disabled;
    LANGS.forEach(function (l) { f["m_" + l].value = (o.m || {})[l] || ""; });
    Array.prototype.forEach.call(f.querySelectorAll('[name="cat"]'), function (c) { c.checked = (o.cats || []).indexOf(c.value) >= 0; });
    $("kErr").hidden = true;
  }
  $("kSearch").addEventListener("input", renderKanji);
  $("kBody").addEventListener("click", function (e) {
    var tr = e.target.closest("[data-k]"); if (!tr) return;
    selected = tr.getAttribute("data-k");
    fillForm(data.kanjiDB.kanji.filter(function (o) { return o.k === selected; })[0]);
    renderKanji();
  });
  $("kNew").addEventListener("click", function () { selected = null; fillForm(null); renderKanji(); $("kForm").k.focus(); });
  $("kForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = this, err = [];
    var k = Array.from(f.k.value.trim())[0] || "";
    if (!/[㐀-鿿豈-﫿]/.test(k)) err.push("漢字を1文字入力してください。");
    if (String(data.kanjiDB.excluded).indexOf(k) >= 0) err.push("この漢字は除外漢字に登録されています（除外漢字タブで外せます）。");
    var on = list(f.on.value).map(K.hiraToKata), kun = list(f.kun.value).map(K.kataToHira), nanori = list(f.nanori.value).map(K.kataToHira), cr = list(f.creative.value).map(K.hiraToKata);
    if (!on.length && !kun.length && !nanori.length && !cr.length) err.push("読みを1つ以上入力してください。");
    [].concat(on, cr).forEach(function (r) { if (!/^[ァ-ー]+$/.test(r)) err.push("「" + r + "」はカタカナで入力してください。"); });
    [].concat(kun, nanori).forEach(function (r) { if (!/^[ぁ-ゟー]+$/.test(r)) err.push("「" + r + "」はひらがなで入力してください。"); });
    if (!f.m_ja.value.trim() || !f.m_en.value.trim()) err.push("意味（日本語・英語）は必須です。");
    if (err.length) { $("kErr").innerHTML = err.map(esc).join("<br>"); $("kErr").hidden = false; return; }
    var m = {}; LANGS.forEach(function (l) { var v = f["m_" + l].value.trim(); if (v) m[l] = v; });
    var obj = {
      k: k, strokes: +f.strokes.value || 0, on: on, kun: kun, nanori: nanori, creative: cr,
      cats: Array.prototype.filter.call(f.querySelectorAll('[name="cat"]'), function (c) { return c.checked; }).map(function (c) { return c.value; }),
      pol: Math.min(5, Math.max(1, +f.pol.value || 3)), fit: Math.min(5, Math.max(1, +f.fit.value || 3)), m: m
    };
    if (f.disabled.checked) obj.disabled = true;
    var idx = data.kanjiDB.kanji.findIndex(function (o) { return o.k === (selected || k); });
    if (selected && selected !== k && data.kanjiDB.kanji.some(function (o) { return o.k === k; })) { $("kErr").textContent = "その漢字はすでに登録されています。"; $("kErr").hidden = false; return; }
    if (idx >= 0) data.kanjiDB.kanji[idx] = obj; else data.kanjiDB.kanji.push(obj);
    selected = k; saveDraft(); renderKanji(); toast("保存しました：" + k);
  });
  $("kDelete").addEventListener("click", function () {
    if (!selected) return;
    var btn = this;
    if (btn.dataset.confirm !== selected) { btn.dataset.confirm = selected; btn.textContent = "もう一度押すと「" + selected + "」を削除"; return; }
    data.kanjiDB.kanji = data.kanjiDB.kanji.filter(function (o) { return o.k !== selected; });
    toast("削除しました：" + selected);
    selected = null; btn.dataset.confirm = ""; btn.textContent = "削除";
    fillForm(null); saveDraft(); renderKanji();
  });

  /* ---------- 除外漢字 ---------- */
  $("exArea").value = data.kanjiDB.excluded;
  $("exSave").addEventListener("click", function () {
    var v = Array.from($("exArea").value).filter(function (c) { return /[㐀-鿿豈-﫿]/.test(c); });
    data.kanjiDB.excluded = Array.from(new Set(v)).join("");
    $("exArea").value = data.kanjiDB.excluded;
    saveDraft(); toast("除外漢字を保存しました（" + data.kanjiDB.excluded.length + "字）");
  });

  /* ---------- 名前 ---------- */
  function renderNames() {
    var q = $("nSearch").value.trim().toLowerCase();
    $("nBody").innerHTML = data.namesDB.rows.filter(function (o) { return !q || o.name.toLowerCase().indexOf(q) >= 0 || o.kata.indexOf(q) >= 0; }).map(function (o, i) {
      var v = Object.keys(o.variants || {}).map(function (k) { return k + ":" + o.variants[k]; }).join(", ");
      return "<tr><td>" + esc(o.name) + "</td><td>" + esc(o.kata) + "</td><td>" + esc(v) + '</td><td><button class="chip-btn" type="button" data-del="' + esc(o.name) + '">削除</button></td></tr>';
    }).join("");
  }
  $("nSearch").addEventListener("input", renderNames);
  $("nForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var name = this.name.value.trim(), kata = K.hiraToKata(this.kata.value.trim());
    if (!name || !/^[ァ-ー・]+$/.test(kata)) { toast("読みはカタカナで入力してください"); return; }
    var variants = {};
    this.variants.value.split(/[,、]/).forEach(function (p) { var kv = p.split(":"); if (kv[1]) variants[kv[0].trim()] = K.hiraToKata(kv[1].trim()); });
    var key = K.nameKey(name);
    data.namesDB.rows = data.namesDB.rows.filter(function (o) { return K.nameKey(o.name) !== key; });
    data.namesDB.rows.unshift({ name: name, kata: kata, variants: variants });
    this.reset(); saveDraft(); renderNames(); toast("登録しました：" + name);
  });
  $("nBody").addEventListener("click", function (e) {
    var b = e.target.closest("[data-del]"); if (!b) return;
    var n = b.getAttribute("data-del");
    data.namesDB.rows = data.namesDB.rows.filter(function (o) { return o.name !== n; });
    saveDraft(); renderNames();
  });

  /* ---------- おすすめ当て字 ---------- */
  function engineNow() { return new E.Engine(data.kanjiDB); }
  function renderRec() {
    var rec = data.kanjiDB.recommended;
    var rows = [];
    Object.keys(rec).forEach(function (kata) { rec[kata].forEach(function (r, i) { rows.push({ kata: kata, i: i, r: r }); }); });
    $("rBody").innerHTML = rows.map(function (x) {
      return "<tr><td>" + esc(x.kata) + '</td><td class="kcell">' + esc(x.r.kanji) + "</td><td>" + esc((x.r.readings || []).join("・")) + "</td><td>" + esc(typeof x.r.note === "object" && x.r.note ? (x.r.note.ja || "") + " / " + (x.r.note.en || "") : (x.r.note || "")) +
        '</td><td><button class="chip-btn" type="button" data-kata="' + esc(x.kata) + '" data-i="' + x.i + '">削除</button></td></tr>';
    }).join("");
  }
  $("rForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var kata = K.hiraToKata(this.kata.value.trim()), kanji = this.kanji.value.trim();
    var readings = list(this.readings.value).map(K.hiraToKata);
    var eng = engineNow();
    var c = eng.buildFromKanji(kanji, K.tokenize(kata), kata, "recommended", readings.length ? readings : null);
    if (!c) {
      $("rErr").textContent = "「" + kanji + "」を「" + kata + "」と読む組み合わせを確認できませんでした。漢字が漢字データにあるか、各漢字の読みを入力してください。";
      $("rErr").hidden = false; return;
    }
    $("rErr").hidden = true;
    var rec = data.kanjiDB.recommended;
    var nt = this.note.value.trim();
    (rec[kata] = rec[kata] || []).push({ kanji: kanji, readings: c.segs.map(function (s) { return s.reading; }), note: nt ? { ja: nt, en: nt } : "" });
    this.reset(); saveDraft(); renderRec(); toast("登録しました：" + kanji);
  });
  $("rBody").addEventListener("click", function (e) {
    var b = e.target.closest("[data-kata]"); if (!b) return;
    var kata = b.getAttribute("data-kata"), i = +b.getAttribute("data-i");
    data.kanjiDB.recommended[kata].splice(i, 1);
    if (!data.kanjiDB.recommended[kata].length) delete data.kanjiDB.recommended[kata];
    saveDraft(); renderRec();
  });

  /* ---------- 変換テスト ---------- */
  $("tRun").addEventListener("click", function () {
    K.setNamesDB(data.namesDB);
    var v = $("tIn").value.trim(); if (!v) return;
    var est = K.estimateReading(v, $("tProf").value);
    var kata = est.kata.replace(/・/g, "");
    var res = engineNow().generate(kata, {});
    $("tOut").innerHTML = "<div>読み: " + esc(est.kata) + "（" + esc(K.kataToRomaji(kata)) + "）</div>" +
      (res.candidates.map(function (c) {
        return "<div><b>" + esc(c.kanji) + "</b> " + esc(c.theme) + " ／ " + esc(c.segs.map(function (s) { return s.k + "=" + s.reading; }).join(" ")) + " ／ 発音" + "★".repeat(c.stars) + (c.creative ? " ／ 創作" : "") + "</div>";
      }).join("") || "<div>候補なし（" + esc(res.status) + "）</div>");
  });

  /* ---------- 書き出し・読み込み ---------- */
  function download(name, text, type) {
    var blob = new Blob([text], { type: type || "text/plain" });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  function stamp() { var d = new Date(); return d.getFullYear() + "." + (d.getMonth() + 1) + "." + d.getDate() + "-admin"; }
  $("exKanjiJs").addEventListener("click", function () {
    var out = { version: stamp(), rows: data.kanjiDB.kanji, excluded: data.kanjiDB.excluded, recommended: data.kanjiDB.recommended, jpNames: data.kanjiDB.jpNames || {} };
    download("kanji-db.js", "/* 椿堂 漢字データベース（管理画面から書き出し） */\nglobalThis.TSUBAKIDO_KANJI_DB = " + JSON.stringify(out, null, 1) + ";\n", "text/javascript");
  });
  $("exNamesJs").addEventListener("click", function () {
    var out = { version: stamp(), rows: data.namesDB.rows };
    download("names-db.js", "/* 椿堂 外国人名の読み辞書（管理画面から書き出し） */\nglobalThis.TSUBAKIDO_NAMES_DB = " + JSON.stringify(out, null, 1) + ";\n", "text/javascript");
  });
  $("exJson").addEventListener("click", function () { download("tsubakido-data.json", JSON.stringify(data, null, 1), "application/json"); });
  $("imJson").addEventListener("change", function () {
    var file = this.files[0]; if (!file) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var d = JSON.parse(r.result);
        if (!d.kanjiDB || !Array.isArray(d.kanjiDB.kanji) || !d.namesDB) throw new Error("format");
        data = d; saveDraft(); renderAll(); toast("読み込みました");
      } catch (e) { toast("このファイルは読み込めません（形式が違います）"); }
    };
    r.readAsText(file);
  });
  $("applyLocal").addEventListener("click", function () {
    try {
      localStorage.setItem(KEY, JSON.stringify({ kanjiDB: { version: stamp(), kanji: data.kanjiDB.kanji, excluded: data.kanjiDB.excluded, recommended: data.kanjiDB.recommended, jpNames: data.kanjiDB.jpNames || {} }, namesDB: data.namesDB }));
      $("ioMsg").textContent = "このブラウザのアプリに反映しました。アプリを開き直すと編集データで動きます。";
    } catch (e) { $("ioMsg").textContent = "保存できませんでした（ブラウザの保存領域が使えません）。"; }
  });
  $("clearLocal").addEventListener("click", function () {
    try { localStorage.removeItem(KEY); localStorage.removeItem(KEY + "_draft"); } catch (e) {}
    data = fromDefaults(); renderAll();
    $("ioMsg").textContent = "反映を解除し、元のデータに戻しました。";
  });

  function renderAll() { renderKanji(); renderNames(); renderRec(); $("exArea").value = data.kanjiDB.excluded; fillForm(null); }
  renderAll();
})();

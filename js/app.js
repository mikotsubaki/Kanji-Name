/*
 * 椿堂 JAPANESE NAME MAKER — 画面の動き
 * 画面: ① 言語 → ② 名前・出身国 → ③ 読みの確認・好み → ④ 漢字の候補・意味・編集
 */
(function () {
  "use strict";
  var K = window.TKKana, I = window.TKI18n, C = window.TKCountries, CFG = window.TSUBAKIDO_CONFIG || {};
  var t = I.t;
  var $ = function (id) { return document.getElementById(id); };
  var engine, usingLocalData = false;

  var PREFS = [
    { id: "beautiful", k: "美" }, { id: "lucky", k: "福" }, { id: "strong", k: "勇" },
    { id: "elegant", k: "雅" }, { id: "nature", k: "花" }, { id: "traditional", k: "和" }
  ];
  var FAV_SUGGEST = "愛美幸光心夢和桜龍華星凛";
  var CAT_THEME = { be: "beauty", el: "beauty", lu: "luck", lo: "luck", st: "strength", na: "nature", ha: "nature", li: "nature", wi: "nature", tr: "tradition" };
  var TYPE_LABEL = {
    on: { ja: "音読み", en: "on reading" }, kun: { ja: "訓読み", en: "kun reading" }, nanori: { ja: "名乗り（人名の読み）", en: "name reading" },
    creative: { ja: "創作読み", en: "creative reading" }, mismatch: { ja: "読みは別", en: "different sound" }, given: { ja: "そのまま", en: "as given" }
  };

  var state = {
    lang: "en", country: null, countryChosen: false, name: "", est: null, kata: "", prefs: [], fav: "",
    result: null, cands: [], openDetails: {}
  };

  /* ---------- データ読み込み（管理画面のローカル編集データがあれば優先） ---------- */
  function loadData() {
    var kdb = window.TSUBAKIDO_KANJI_DB, ndb = window.TSUBAKIDO_NAMES_DB;
    try {
      var raw = localStorage.getItem("tsubakido_admin_data");
      if (raw) {
        var d = JSON.parse(raw);
        if (d && d.kanjiDB) { kdb = d.kanjiDB; usingLocalData = true; }
        if (d && d.namesDB) { ndb = d.namesDB; usingLocalData = true; }
      }
    } catch (e) { usingLocalData = false; }
    K.setNamesDB(ndb);
    engine = new window.TKEngine.Engine(kdb);
  }

  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function recall(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function toast(msg) {
    var el = $("toast"); el.textContent = msg; el.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(function () { el.hidden = true; }, 2200);
  }
  function quoteList(items) {
    var L = state.lang;
    var q = (L === "ja" || L === "zh-Hans" || L === "zh-Hant") ? ["「", "」"] : (L === "fr" ? ["« ", " »"] : (L === "de" ? ["„", "“"] : ["“", "”"]));
    var arr = items.map(function (x) { return q[0] + x + q[1]; });
    try { return new Intl.ListFormat(L, { style: "long", type: "conjunction" }).format(arr); } catch (e) { return arr.join(", "); }
  }
  function firstGloss(s) { return String(s || "").split(/[,、，;；]/)[0].replace(/（.*?）|\(.*?\)/g, "").trim(); }
  function romaji(kata) { return K.kataToRomaji(kata); }

  /* ---------- 画面遷移 ---------- */
  var SCREENS = { lang: "s-lang", name: "s-name", reading: "s-reading", cands: "s-cands" };
  var current = "lang";
  function go(name, push) {
    if (name === "reading" && !state.est) name = "name";
    if (name === "cands" && !state.cands.length) name = state.est ? "reading" : "name";
    Object.keys(SCREENS).forEach(function (k) { $(SCREENS[k]).hidden = k !== name; });
    current = name;
    var step = +$(SCREENS[name]).getAttribute("data-step");
    Array.prototype.forEach.call(document.querySelectorAll("#steps li"), function (li) {
      var s = +li.getAttribute("data-step");
      li.className = s < step ? "done" : (s === step ? "now" : "");
    });
    if (push !== false) { try { history.pushState({ s: name }, "", "#" + name); } catch (e) {} }
    window.scrollTo(0, 0);
  }
  window.addEventListener("popstate", function (e) {
    var s = (e.state && e.state.s) || (location.hash || "#lang").slice(1);
    go(SCREENS[s] ? s : "lang", false);
  });
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-go]");
    if (b) go(b.getAttribute("data-go"));
  });

  /* ---------- 多言語 ---------- */
  function applyI18n() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-i18n]"), function (el) { el.textContent = t(el.getAttribute("data-i18n")); });
    Array.prototype.forEach.call(document.querySelectorAll("[data-i18n-ph]"), function (el) { el.placeholder = t(el.getAttribute("data-i18n-ph")); });
    var meta = I.LANGS.filter(function (l) { return l.code === state.lang; })[0];
    $("langBtnLabel").textContent = meta ? meta.flag + " " + meta.name : state.lang;
    $("meaningLangNote").textContent = window.TKEngine.Engine.hasMeaningLang(state.lang) ? "" : t("meaningLangs");
    $("localBadge").hidden = !usingLocalData;
    $("localBadge").textContent = t("localData");
    renderLangGrid($("langGrid"));
    renderCountries();
    renderPrefs();
    renderFavChips();
    if (state.est) updateReadingMeta();
    if (state.cands.length) renderCands();
  }
  function setLang(code) {
    state.lang = I.setLang(code);
    store("tsubakido_lang", state.lang);
    if (!state.countryChosen) state.country = C.defaultFor(state.lang);
    applyI18n();
  }
  function renderLangGrid(container, onPick) {
    container.innerHTML = I.LANGS.map(function (l) {
      return '<button type="button" class="lang-btn' + (l.code === state.lang ? " on" : "") + '" data-lang="' + l.code + '" lang="' + l.code + '">' +
        '<span class="flag" aria-hidden="true">' + l.flag + '</span><span class="nm">' + esc(l.name) + "</span></button>";
    }).join("");
    Array.prototype.forEach.call(container.querySelectorAll("[data-lang]"), function (b) {
      b.addEventListener("click", function () {
        setLang(b.getAttribute("data-lang"));
        if (onPick) onPick(); else go("name");
      });
    });
  }

  /* ---------- ② 名前・出身国 ---------- */
  function renderCountries() {
    var sel = $("countrySelect");
    var list = C.list(state.lang);
    if (!state.country) state.country = C.defaultFor(state.lang);
    sel.innerHTML = list.map(function (c) {
      return '<option value="' + c.code + '"' + (c.code === state.country ? " selected" : "") + ">" + c.flag + " " + esc(c.name) + "</option>";
    }).join("");
    updateLevel();
  }
  function updateLevel() {
    var c = C.get(state.country);
    var el = $("levelBadge");
    el.textContent = c.level === "std" ? t("levelStd") : t("levelSimple");
    el.className = "level" + (c.level === "std" ? "" : " simple");
  }
  $("countrySelect").addEventListener("change", function () { state.country = this.value; state.countryChosen = true; updateLevel(); });

  $("nameForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var name = $("nameInput").value.trim();
    var msg = $("nameMsg");
    msg.hidden = true;
    if (!name) { $("nameInput").focus(); return; }
    var prof = C.get(state.country).profile;
    var est = K.estimateReading(name, prof);
    state.name = name;
    if (!est.parts.length && !est.hanText) {
      msg.textContent = t("unsupportedScript"); msg.hidden = false; return;
    }
    state.est = est;
    state.useWord = null;
    var words = est.parts;
    var all = words.map(function (p) { return p.kata; }).join("");
    if (words.length > 1) {
      if (prof === "zh") state.useWord = words.length - 1;
      else if (K.tokenize(all).length > 8) state.useWord = 0;
    }
    state.kata = state.useWord != null ? words[state.useWord].kata : est.kata;
    $("kataInput").value = state.kata;
    updateReadingMeta();
    renderReadingMsg();
    go("reading");
  });

  /* ---------- ③ 読み方 ---------- */
  function updateReadingMeta() {
    var k = $("kataInput").value;
    $("romajiOut").textContent = romaji(k.replace(/・/g, "")) || "—";
    var est = state.est;
    var src = $("srcBadge");
    if (est && est.parts.length) {
      var srcs = est.parts.map(function (p) { return p.source; });
      var rule = srcs.some(function (s) { return s !== "dict" && s !== "kana"; });
      src.textContent = rule ? t("srcRule") : t("srcDict");
      src.className = "src-badge" + (rule ? " rule" : "");
      src.hidden = srcs.every(function (s) { return s === "kana"; });
    } else src.hidden = true;
    var chips = $("wordChips");
    if (est && est.parts.length > 1) {
      chips.hidden = false;
      chips.innerHTML = est.parts.map(function (p, i) {
        return '<button type="button" class="chip-btn' + (state.useWord === i ? " on" : "") + '" data-w="' + i + '">' + esc(t("useWord")) + ": " + esc(p.word) + " (" + esc(p.kata) + ")</button>";
      }).join("") + '<button type="button" class="chip-btn' + (state.useWord == null ? " on" : "") + '" data-w="all">' + esc(t("useAll")) + "</button>";
    } else chips.hidden = true;
  }
  $("wordChips").addEventListener("click", function (e) {
    var b = e.target.closest("[data-w]"); if (!b) return;
    var w = b.getAttribute("data-w");
    state.useWord = w === "all" ? null : +w;
    $("kataInput").value = w === "all" ? state.est.kata : state.est.parts[+w].kata;
    updateReadingMeta();
  });
  function renderReadingMsg() {
    var m = $("readingMsg");
    var est = state.est;
    if (est && est.hanText) {
      m.textContent = t("kanjiInput") + " " + t("orType");
      m.hidden = false;
    } else if (est && est.unsupported.length) {
      m.textContent = t("unsupportedScript"); m.hidden = false;
    } else m.hidden = true;
  }
  function cleanKata(v) {
    v = K.hiraToKata(v);
    if (/[a-zA-Z]/.test(v) && document.activeElement !== $("kataInput")) v = K.romajiToKata(v.toLowerCase());
    return v.replace(/[^ァ-ーー・]/g, "");
  }
  $("kataInput").addEventListener("input", function () {
    var v = this.value;
    if (!/[a-zA-Z]/.test(v)) { var c = cleanKata(v); if (c !== v) this.value = c; }
    updateReadingMeta();
  });
  $("kataInput").addEventListener("blur", function () { this.value = cleanKata(this.value); updateReadingMeta(); });

  var PAD = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨーッラリルレロワヲンヴ・ガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポァィゥェォャュョ";
  function buildPad() {
    var html = Array.from(PAD).map(function (c) { return '<button type="button" data-k="' + c + '">' + c + "</button>"; }).join("");
    html += '<button type="button" class="fn" data-k="BS" aria-label="Backspace">⌫</button><button type="button" class="fn" data-k="CLR">' + esc(t("clear")) + "</button>";
    $("kanaPad").innerHTML = html;
  }
  $("padToggle").addEventListener("click", function () {
    var pad = $("kanaPad");
    if (pad.hidden) buildPad();
    pad.hidden = !pad.hidden;
    this.setAttribute("aria-expanded", String(!pad.hidden));
  });
  $("kanaPad").addEventListener("click", function (e) {
    var b = e.target.closest("[data-k]"); if (!b) return;
    var inp = $("kataInput"), k = b.getAttribute("data-k");
    var v = inp.value;
    if (k === "BS") v = Array.from(v).slice(0, -1).join("");
    else if (k === "CLR") v = "";
    else v += k;
    inp.value = v;
    updateReadingMeta();
  });

  function renderPrefs() {
    $("prefGrid").innerHTML = PREFS.map(function (p) {
      var on = state.prefs.indexOf(p.id) >= 0;
      return '<button type="button" class="pref" data-p="' + p.id + '" aria-pressed="' + on + '"><span class="k" aria-hidden="true">' + p.k + "</span><span>" + esc(t("pref_" + p.id)) + "</span></button>";
    }).join("");
  }
  $("prefGrid").addEventListener("click", function (e) {
    var b = e.target.closest("[data-p]"); if (!b) return;
    var id = b.getAttribute("data-p"), i = state.prefs.indexOf(id);
    if (i >= 0) state.prefs.splice(i, 1); else state.prefs.push(id);
    b.setAttribute("aria-pressed", String(i < 0));
  });
  function renderFavChips() {
    $("favChips").innerHTML = Array.from(FAV_SUGGEST).filter(function (k) { return engine.has(k); }).map(function (k) {
      return '<button type="button" class="chip-btn' + (state.fav === k ? " on" : "") + '" data-f="' + k + '">' + k + "</button>";
    }).join("");
  }
  $("favChips").addEventListener("click", function (e) {
    var b = e.target.closest("[data-f]"); if (!b) return;
    var k = b.getAttribute("data-f");
    state.fav = state.fav === k ? "" : k;
    $("favInput").value = state.fav;
    renderFavChips();
  });
  $("favInput").addEventListener("input", function () {
    var ch = Array.from(this.value.trim()).filter(function (c) { return /[㐀-鿿豈-﫿]/.test(c); }).pop() || "";
    state.fav = ch;
    if (!/[぀-ヿ]/.test(this.value)) this.value = ch;
    renderFavChips();
  });

  /* ---------- ⑤ 候補の生成 ---------- */
  $("generateBtn").addEventListener("click", function () {
    var kata = cleanKata($("kataInput").value);
    $("kataInput").value = kata;
    state.kata = kata;
    var fv = Array.from($("favInput").value || "").filter(function (c) { return /[㐀-鿿豈-﫿]/.test(c); })[0] || "";
    state.fav = fv;
    var m = $("readingMsg");
    if (!kata.replace(/[・ー]/g, "")) { m.textContent = t("noCand"); m.hidden = false; return; }
    var res = engine.generate(kata, { prefs: state.prefs.slice(), favorite: state.fav, max: CFG.MAX_CANDIDATES || 5 });
    state.result = res;
    if (res.status === "tooLong") { m.textContent = t("tooLong"); m.hidden = false; return; }
    if (!res.candidates.length) { m.textContent = t("noCand"); m.hidden = false; return; }
    m.hidden = true;
    state.cands = res.candidates;
    state.openDetails = {};
    renderCands();
    go("cands");
    askAI();
  });

  function askAI() {
    if (!window.TKAI || !window.TKAI.enabled()) return;
    var box = $("candMsg");
    box.textContent = "AI…"; box.hidden = false;
    window.TKAI.suggest({ name: state.name, katakana: state.kata, country: state.country, lang: state.lang, prefs: state.prefs, favorite: state.fav }, engine)
      .then(function (list) {
        box.hidden = true;
        var have = {};
        state.cands.forEach(function (c) { have[c.kanji] = true; });
        list.forEach(function (c) { if (!have[c.kanji]) { state.cands.push(c); have[c.kanji] = true; } });
        renderCands();
      });
  }

  function meaningOf(k) { return engine.meaning(k, state.lang); }
  function imageLineFor(c) {
    var glosses = c.segs.map(function (s) { return firstGloss(meaningOf(s.k).text); }).filter(Boolean);
    var seen = {}; glosses = glosses.filter(function (g) { if (seen[g]) return false; seen[g] = 1; return true; });
    return t("imageLine", { list: quoteList(glosses) });
  }
  function themeWords(c) {
    var cats = engine.imageThemes(c);
    var th = []; cats.forEach(function (x) { var tt = CAT_THEME[x]; if (tt && th.indexOf(tt) < 0) th.push(tt); });
    return th.map(function (x) { return t("theme_" + x); }).join(" · ");
  }
  /* おすすめの説明文：日本語なら ja、それ以外は en（文字列ならそのまま） */
  function noteText(n) {
    if (!n) return "";
    if (typeof n === "string") return n;
    return (state.lang === "ja" ? n.ja : (n[state.lang] || n.en)) || n.ja || "";
  }
  function starsHtml(n) {
    var s = ""; for (var i = 1; i <= 5; i++) s += i <= n ? "★" : '<span class="off">★</span>';
    return '<span class="stars" aria-label="' + n + '/5">' + s + "</span>";
  }
  function typeLabel(type) {
    var x = TYPE_LABEL[type] || TYPE_LABEL.creative;
    return state.lang === "ja" ? x.ja : x.en;
  }
  function detailsHtml(c) {
    var rows = c.segs.map(function (s) {
      var o = engine.get(s.k) || {};
      var m = meaningOf(s.k);
      var sub = [];
      if (s.reading) sub.push(t("readAs") + ": " + s.reading + " (" + romaji(s.reading).toLowerCase() + ") · " + typeLabel(s.type));
      if (o.strokes) sub.push(t("strokes", { n: o.strokes }));
      var warn = s.mismatch ? t("warnMismatch") : (s.type === "creative" ? t("warnCreative") : "");
      return '<div class="kmean"><div class="big" lang="ja">' + s.k + '</div><div class="txt"><div class="m">' + esc(m.text) +
        (m.fallback ? ' <span class="sub">' + esc(t("englishFallback")) + "</span>" : "") + "</div>" +
        '<div class="sub">' + esc(sub.join(" · ")) + "</div>" + (warn ? '<div class="warn">' + esc(warn) + "</div>" : "") + "</div></div>";
    }).join("");
    return '<div class="details"><div class="hint">' + esc(t("perKanji")) + "</div>" + rows +
      '<div class="img"><b>' + esc(t("nameImage")) + ":</b> " + esc(themeWords(c)) + "<br>" + esc(imageLineFor(c)) + "</div></div>";
  }
  function renderCands() {
    var box = $("cands");
    var notes = (state.result && state.result.notes) || [];
    var msgs = notes.map(function (n) { return t(n === "lowCloseness" ? "lowNote" : n); }).filter(Boolean);
    var cm = $("candMsg");
    if (msgs.length) { cm.textContent = msgs.join(" "); cm.hidden = false; } else cm.hidden = true;
    box.innerHTML = state.cands.map(function (c, i) {
      var reading = c.target.replace(/・/g, "");
      var kr = c.kanjiReading;
      var diff = kr && kr.replace(/ー/g, "") !== reading.replace(/ー/g, "");
      var tags = [];
      if (c.realJpName) tags.push('<span class="tag jp">' + esc(t("theme_jpname")) + "</span>");
      else tags.push(c.creative ? '<span class="tag creative">' + esc(t("creativeTag")) + "</span>" : '<span class="tag">' + esc(t("standardTag")) + "</span>");
      if (c.meaningFirst) tags.push('<span class="tag first">' + esc(t("meaningFirstTag")) + "</span>");
      var open = !!state.openDetails[i];
      return '<article class="cand" data-i="' + i + '">' +
        '<div class="cand-theme">' + esc(t("theme_" + (c.theme || "beauty"))) + "</div>" +
        '<div class="cand-kanji" lang="ja">' + Array.from(c.kanji).map(function (k) { return '<span class="ch">' + k + "</span>"; }).join("") + "</div>" +
        '<div class="cand-read"><span class="kt" lang="ja">' + esc(reading) + '</span><span class="rm">' + esc(romaji(reading)) + "</span></div>" +
        '<div class="meta-row"><span>' + esc(t("closeness")) + "</span> " + starsHtml(c.stars) + tags.join("") + "</div>" +
        (diff ? '<div class="meta-row">' + esc(t("kanjiReading")) + ": <span lang=\"ja\">" + esc(kr) + "</span></div>" : "") +
        (c.realJpName ? '<p class="cand-line">' + esc(t("jpNameReal")) + "</p>" : (c.jpNameSound ? '<p class="cand-line">' + esc(t("jpSound")) + "</p>" : "")) +
        '<p class="cand-line">' + esc(imageLineFor(c)) + "</p>" +
        (noteText(c.note) ? '<p class="cand-line note">' + esc(noteText(c.note)) + "</p>" : "") +
        (open ? detailsHtml(c) : "") +
        '<div class="cand-btns">' +
        '<button type="button" class="btn btn-ghost" data-act="details" aria-expanded="' + open + '">' + esc(open ? t("hideDetails") : t("showDetails")) + "</button>" +
        '<button type="button" class="btn btn-ghost" data-act="edit">' + esc(t("editKanji")) + "</button>" +
        "</div></article>";
    }).join("");
  }
  $("cands").addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]"); if (!b) return;
    var i = +b.closest(".cand").getAttribute("data-i");
    var act = b.getAttribute("data-act");
    if (act === "details") { state.openDetails[i] = !state.openDetails[i]; renderCands(); }
    else if (act === "edit") openEdit(i);
  });

  /* ---------- ⑦ 漢字の変更 ---------- */
  var edit = null;
  function openEdit(i) {
    edit = { index: i, work: state.cands[i], seg: 0 };
    $("editSheet").hidden = false;
    renderEdit();
  }
  function closeEdit() { $("editSheet").hidden = true; edit = null; }
  function renderEdit() {
    var c = edit.work;
    $("editName").innerHTML = c.segs.map(function (s, j) {
      return '<button type="button" lang="ja" data-seg="' + j + '" class="' + (j === edit.seg ? "on" : "") + '">' + s.k + "</button>";
    }).join("");
    var seg = c.segs[edit.seg];
    var alts = engine.alternatives(c, edit.seg, { prefs: state.prefs });
    $("editReading").textContent = t("readAs") + ": " + alts.sound + " (" + romaji(alts.sound) + ")";
    var warn = seg.mismatch ? t("warnMismatch") : (seg.type === "creative" ? t("warnCreative") : "");
    $("editWarn").textContent = warn; $("editWarn").hidden = !warn;
    function item(a, flag) {
      var m = meaningOf(a.k);
      return '<button type="button" class="alt' + (a.k === seg.k ? " on" : "") + '" data-k="' + a.k + '">' +
        '<span class="k" lang="ja">' + a.k + '</span><span class="m">' + esc(firstGloss(m.text) || m.text) + "</span>" +
        '<span class="r">' + esc(flag ? "≠" : (a.reading || "")) + "</span></button>";
    }
    var html = "";
    var sameList = alts.same.slice(0, 24), simList = alts.similar.slice(0, 16);
    if (sameList.length) html += '<div class="alt-group">' + esc(t("sameSound")) + "</div>" + sameList.map(function (a) { return item(a); }).join("");
    if (simList.length) html += '<div class="alt-group">' + esc(t("similarSound")) + "</div>" + simList.map(function (a) { return item(a); }).join("");
    if (!sameList.length && !simList.length) html += '<p class="hint">' + esc(t("noAlt")) + "</p>";
    /* 音は違っても意味で選びたい人向け */
    var used = {}; sameList.concat(simList).forEach(function (a) { used[a.k] = 1; });
    var other = engine.list.filter(function (o) { return !used[o.k] && o.pol >= 5 && o.fit >= 5; })
      .map(function (o) { return { k: o.k, s: engine.meaningScore(o, { prefs: state.prefs }) }; })
      .sort(function (a, b) { return b.s - a.s; }).slice(0, 12);
    html += '<div class="alt-group">' + esc(t("otherMeaning")) + "</div>" + other.map(function (a) { return item(a, true); }).join("");
    $("altList").innerHTML = html;
  }
  $("editName").addEventListener("click", function (e) {
    var b = e.target.closest("[data-seg]"); if (!b) return;
    edit.seg = +b.getAttribute("data-seg"); renderEdit();
  });
  $("altList").addEventListener("click", function (e) {
    var b = e.target.closest("[data-k]"); if (!b) return;
    var nc = engine.replaceKanji(edit.work, edit.seg, b.getAttribute("data-k"));
    if (nc) { edit.work = nc; renderEdit(); }
  });
  $("editApply").addEventListener("click", function () {
    var c = edit.work;
    state.cands[edit.index] = c;
    state.openDetails[edit.index] = true;
    closeEdit();
    renderCands();
  });
  $("editCancel").addEventListener("click", closeEdit);

  $("restartBtn").addEventListener("click", function () {
    state.est = null; state.cands = []; state.result = null; state.fav = "";
    $("nameInput").value = ""; $("favInput").value = "";
    renderFavChips();
    go("name");
  });

  /* ---------- モーダル ---------- */
  function openModal(title, html) {
    $("modalTitle").textContent = title;
    $("modalBody").innerHTML = html;
    $("modal").hidden = false;
  }
  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-close]")) { e.target.closest(".sheet-wrap").hidden = true; edit = null; }
    else if (e.target.classList && e.target.classList.contains("sheet-wrap")) { e.target.hidden = true; edit = null; }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { $("modal").hidden = true; $("editSheet").hidden = true; edit = null; }
  });
  $("langBtn").addEventListener("click", function () {
    openModal(t("langTitle"), '<div class="lang-grid modal-lang" id="modalLangs"></div>');
    renderLangGrid($("modalLangs"), function () { $("modal").hidden = true; });
  });
  $("aboutBtn").addEventListener("click", function () {
    var ja = state.lang === "ja";
    var rows = ja ? [
      ["画面の表示", "15言語（日本語・英語以外は初期翻訳。公開前にネイティブ確認を推奨）"],
      ["漢字の意味", "日本語・英語・中国語（簡体/繁体）・韓国語・フランス語・ドイツ語・スペイン語・イタリア語・ポルトガル語。タイ語・ベトナム語・インドネシア語・アラビア語・ヒンディー語は英語で表示"],
      ["発音の推定（標準）", "英語・フランス語・ドイツ語・スペイン語・イタリア語・ポルトガル語の綴り、中国語ピンイン、韓国語ハングル、ロシア語キリル文字、日本語ローマ字・かな＋名前辞書"],
      ["発音の推定（簡易）", "その他の国・地域（オランダ・北欧・東南アジア・中東・インドなど）。必ず読み方を確認"],
      ["入力できない文字", "アラビア文字・タイ文字・デーヴァナーガリー・ギリシャ文字・ヘブライ文字（ローマ字かカタカナで入力）"],
      ["AI連携", CFG.AI_ENDPOINT ? "接続中（辞書照合済みの候補のみ表示）" : "未接続（ローカル辞書と変換アルゴリズムで生成）"],
      ["漢字データ", engine.list.length + "字 / 名前辞書 " + Object.keys(window.TSUBAKIDO_NAMES_DB.rows || []).length + "件"]
    ] : [
      ["App text", "15 languages (non-Japanese/English texts are first translations; native review recommended)"],
      ["Kanji meanings", "Japanese, English, Chinese (Simplified/Traditional), Korean, French, German, Spanish, Italian, Portuguese. Thai, Vietnamese, Indonesian, Arabic and Hindi show English."],
      ["Pronunciation (standard)", "English, French, German, Spanish, Italian, Portuguese spelling; Chinese pinyin; Korean Hangul; Russian Cyrillic; Japanese romaji/kana; plus a name dictionary"],
      ["Pronunciation (simplified)", "Other countries and regions. Please always check the reading."],
      ["Scripts not yet supported", "Arabic, Thai, Devanagari, Greek, Hebrew (please type in Latin letters or katakana)"],
      ["AI", CFG.AI_ENDPOINT ? "Connected (only dictionary-verified ideas are shown)" : "Not connected (local dictionary and algorithm)"],
      ["Kanji data", engine.list.length + " kanji / " + (window.TSUBAKIDO_NAMES_DB.rows || []).length + " names"]
    ];
    openModal(t("about"), '<div class="about"><p>' + esc(t("aboutBody")) + "</p><p class=\"hint\">" + esc(t("meaningLangs")) + '</p><div class="scope-wrap"><table class="scope">' +
      rows.map(function (r) { return "<tr><th>" + esc(r[0]) + "</th><td>" + esc(r[1]) + "</td></tr>"; }).join("") + "</table></div></div>");
  });

  /* ---------- 起動 ---------- */
  loadData();
  var saved = recall("tsubakido_lang");
  var nav = (navigator.language || "en");
  var guess = saved || (/^zh-(TW|HK|Hant)/i.test(nav) ? "zh-Hant" : /^zh/i.test(nav) ? "zh-Hans" : nav.slice(0, 2));
  state.lang = I.setLang(guess);
  state.country = C.defaultFor(state.lang);
  applyI18n();
  go("lang", false);
  try { history.replaceState({ s: "lang" }, "", location.pathname + location.search); } catch (e) {}

  if ("serviceWorker" in navigator && location.protocol === "https:" && !/claude|anthropic/.test(location.hostname)) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }
})();

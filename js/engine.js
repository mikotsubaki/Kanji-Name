/*
 * 椿堂 JAPANESE NAME MAKER — 漢字変換エンジン
 * ------------------------------------------------------------
 * カタカナの読み（拍の並び）に対して、漢字データベースの読みを組み合わせ、
 *   ① 発音の近さ ② 意味の美しさ・縁起 ③ 読みの自然さ ④ 文字数（2〜4字を優先）⑤ 印影としてのバランス
 * を総合評価して候補を作ります（ビームサーチ）。
 * ブラウザでも Node.js でも動作します（テスト: tests/test-names.js）。
 */
(function (root) {
  "use strict";
  var K = root.TKKana || (typeof require !== "undefined" ? require("./kana.js") : null);

  var LANG_KEYS = ["ja", "en", "zh", "zt", "ko", "fr", "de", "es", "it", "pt"];
  var THEMES = {
    beauty:    { cats: ["be", "el"] },
    luck:      { cats: ["lu", "lo"] },
    strength:  { cats: ["st"] },
    nature:    { cats: ["na", "ha", "li"] },
    tradition: { cats: ["tr"] }
  };
  var THEME_ORDER = ["beauty", "luck", "strength", "nature", "tradition"];
  var PREF_CATS = {
    beautiful: ["be"], lucky: ["lu"], strong: ["st"], elegant: ["el"], nature: ["na", "li"], traditional: ["tr"]
  };
  /* 日本の名前の結びによく使われる字（伝統的な雰囲気の加点） */
  var JP_ENDINGS = "子美花奈香恵乃菜衣里郎斗太也人介音羽葉代穂実絵佳華央";
  /* 日本人の名前にもある響き（「日本人名にもある響き」の表示用） */
  var JP_NAME_SOUNDS = ("エマ ハナ マリア エリカ ケン ジョウ ジョー レン ナオミ エミリ マリ リサ ジュン ノア ルイ ケイ エリ ミア サラ アンナ ユナ カイ リナ ニナ マヤ " +
    "レオ リオ セナ ルナ アリサ ミナ エミ ナナ サキ アヤ ユキ ナツ ショウ ダイ リク ソラ ハル リン ミク カレン ルカ アイ メイ レイ ユイ セリナ ハンナ " +
    "サナ カナ マナ マオ ナオ ユウ リュウ ケンジ タク ジョージ エレナ アン ナミ リラ ミオ ノエル アキラ ハルカ マイ ユリ ジン サヤ トワ").split(" ");

  /* ---------- データベースの正規化 ---------- */
  function splitList(s) { return String(s || "").split(/[,、\s]+/).map(function (x) { return x.trim(); }).filter(Boolean); }

  function parseKanjiRow(row) {
    if (typeof row !== "string") return normalizeKanjiObj(row);
    var f = row.split("|");
    if (f.length < 10) return null;
    var m = {};
    LANG_KEYS.forEach(function (lk, i) { if (f[9 + i]) m[lk] = f[9 + i]; });
    return normalizeKanjiObj({
      k: f[0], strokes: +f[1] || 0, on: splitList(f[2]), kun: splitList(f[3]), nanori: splitList(f[4]), creative: splitList(f[5]),
      cats: splitList(f[6]), pol: +f[7] || 3, fit: +f[8] || 3, m: m
    });
  }
  function normalizeKanjiObj(o) {
    if (!o || !o.k) return null;
    var r = {
      k: String(o.k).charAt(0), strokes: +o.strokes || 0,
      on: (Array.isArray(o.on) ? o.on : splitList(o.on)).map(K.hiraToKata),
      kun: (Array.isArray(o.kun) ? o.kun : splitList(o.kun)).map(K.hiraToKata),
      nanori: (Array.isArray(o.nanori) ? o.nanori : splitList(o.nanori)).map(K.hiraToKata),
      creative: (Array.isArray(o.creative) ? o.creative : splitList(o.creative)).map(K.hiraToKata),
      cats: Array.isArray(o.cats) ? o.cats : splitList(o.cats),
      pol: +o.pol || 3, fit: +o.fit || 3, m: o.m || {}, disabled: !!o.disabled
    };
    return r;
  }

  function Engine(kanjiDB, opts) {
    opts = opts || {};
    this.excluded = {};
    var ex = (kanjiDB && kanjiDB.excluded) || "";
    (Array.isArray(ex) ? ex.join("") : String(ex)).split("").forEach(function (c) { if (c.trim()) this.excluded[c] = true; }, this);
    this.kanji = {};
    this.list = [];
    var rows = (kanjiDB && (kanjiDB.rows || kanjiDB.kanji)) || [];
    rows.forEach(function (row) {
      var o = parseKanjiRow(row);
      if (!o || o.disabled || this.excluded[o.k] || this.kanji[o.k]) return;
      this.kanji[o.k] = o;
      this.list.push(o);
    }, this);
    this.recommended = (kanjiDB && kanjiDB.recommended) || {};
    this.jpNames = (kanjiDB && kanjiDB.jpNames) || {};
    this._buildIndex();
  }

  Engine.prototype._buildIndex = function () {
    var idx = {};
    var self = this;
    this.list.forEach(function (o) {
      var seen = {};
      function add(reading, type) {
        var toks = K.tokenize(reading);
        if (!toks.length) return;
        var key = toks.join("");
        if (seen[key]) return;
        seen[key] = true;
        (idx[toks[0]] = idx[toks[0]] || []).push({ o: o, toks: toks, str: key, type: type });
      }
      o.on.forEach(function (r) { add(r, "on"); });
      o.kun.forEach(function (r) { add(r, "kun"); });
      o.nanori.forEach(function (r) { add(r, "nanori"); });
      o.creative.forEach(function (r) { add(r, "creative"); });
    });
    this.index = idx;
  };

  Engine.prototype.has = function (k) { return !!this.kanji[k]; };
  Engine.prototype.get = function (k) { return this.kanji[k] || null; };
  Engine.prototype.isExcluded = function (k) { return !!this.excluded[k]; };

  /* ---------- 音の置き換え ---------- */
  var VOICE = { "カ":"ガ","キ":"ギ","ク":"グ","ケ":"ゲ","コ":"ゴ","サ":"ザ","シ":"ジ","ス":"ズ","セ":"ゼ","ソ":"ゾ","タ":"ダ","チ":"ヂ","ツ":"ヅ","テ":"デ","ト":"ド","ハ":"バ","ヒ":"ビ","フ":"ブ","ヘ":"ベ","ホ":"ボ" };
  var UNVOICE = {}; Object.keys(VOICE).forEach(function (k) { UNVOICE[VOICE[k]] = k; });
  var HANDAKU = { "パ":["バ","ハ"],"ピ":["ビ","ヒ"],"プ":["ブ","フ"],"ペ":["ベ","ヘ"],"ポ":["ボ","ホ"] };
  var SPECIAL = {
    "ヴァ":[[["バ"],0.1]], "ヴィ":[[["ビ"],0.1]], "ヴ":[[["ブ"],0.1]], "ヴェ":[[["ベ"],0.1]], "ヴォ":[[["ボ"],0.1]],
    "ファ":[[["ハ"],0.3],[["フ","ア"],0.25]], "フィ":[[["ヒ"],0.3],[["フ","イ"],0.25]], "フェ":[[["ヘ"],0.3],[["フ","エ"],0.25]], "フォ":[[["ホ"],0.3],[["フ","オ"],0.25]],
    "ティ":[[["テ","イ"],0.25],[["チ"],0.3],[["テ"],0.35]], "ディ":[[["デ","イ"],0.25],[["ジ"],0.3],[["デ"],0.35]],
    "トゥ":[[["ト"],0.25],[["ツ"],0.3]], "ドゥ":[[["ド"],0.25],[["ズ"],0.35]],
    "ウィ":[[["ウ","イ"],0.1],[["イ"],0.35]], "ウェ":[[["ウ","エ"],0.1],[["エ"],0.35]], "ウォ":[[["ウ","オ"],0.1],[["オ"],0.3]],
    "シェ":[[["シ","エ"],0.25],[["セ"],0.3]], "ジェ":[[["ジ","エ"],0.25],[["ゼ"],0.35]], "チェ":[[["チ","エ"],0.25],[["セ"],0.45]],
    "イェ":[[["イ","エ"],0.1],[["エ"],0.2]], "ツァ":[[["ツ","ア"],0.25],[["サ"],0.35]], "ツェ":[[["ツ","エ"],0.25],[["セ"],0.35]], "ツォ":[[["ツ","オ"],0.25],[["ソ"],0.35]],
    "シャ":[[["サ"],0.35]], "シュ":[[["ス"],0.4],[["シ","ユ"],0.3]], "ショ":[[["ソ"],0.35]], "ジャ":[[["ザ"],0.4]], "ジョ":[[["ゾ"],0.45]],
    "デュ":[[["ジュ"],0.25],[["ド"],0.45]], "テュ":[[["チュ"],0.25]],
    "ヲ":[[["オ"],0]], "ヂ":[[["ジ"],0]], "ヅ":[[["ズ"],0]]
  };
  var VOWEL_KANA = { a: "ア", i: "イ", u: "ウ", e: "エ", o: "オ", "ア": 1, "イ": 1, "ウ": 1, "エ": 1, "オ": 1 };
  var SMALL_Y = { "ャ": "ヤ", "ュ": "ユ", "ョ": "ヨ" };

  function longVowelTokens(prev) {
    var v = K.vowelOf(prev);
    return { a: [["ア", 0.05]], i: [["イ", 0.05]], u: [["ウ", 0.05]], e: [["イ", 0.05], ["エ", 0.1]], o: [["ウ", 0.05], ["オ", 0.1]] }[v] || [];
  }

  function variants(t, prev) {
    var out = [[[t], 0]];
    if (t === "ー") {
      return longVowelTokens(prev).map(function (x) { return [[x[0]], x[1]]; });
    }
    if (SPECIAL[t]) out = out.concat(SPECIAL[t]);
    if (t.length === 2 && SMALL_Y[t[1]]) out.push([[t[0], SMALL_Y[t[1]]], 0.5]);
    var base = t[0], rest = t.slice(1);
    if (VOICE[base]) out.push([[VOICE[base] + rest], 0.4]);
    if (UNVOICE[base]) out.push([[UNVOICE[base] + rest], 0.4]);
    if (HANDAKU[base]) { out.push([[HANDAKU[base][0] + rest], 0.3]); out.push([[HANDAKU[base][1] + rest], 0.35]); }
    return out;
  }

  /*
   * 目標の拍列 T[pos..] と、ある漢字の読み R がどう対応するか。
   *   carryIn: 前の漢字が拍の前半だけを使ったときの残り（例: ジェ → ジ｜エ の「エ」）
   * 戻り値: [{ end, pen, carry, sub }]  end=次の位置, carry=この漢字が残した後半, sub=この漢字が受け持った音
   */
  function matchReading(T, pos, R, carryIn) {
    var best = {};
    function put(end, pen, carry, sub) {
      var key = end + "|" + (carry || "");
      if (!best[key] || best[key].pen > pen) best[key] = { end: end, pen: pen, carry: carry || null, sub: sub };
    }
    function tokAt(i) { return (i === pos && carryIn) ? carryIn : T[i]; }
    function rec(i, j, pen, sub) {
      if (pen > 1.2) return;
      if (j === R.length) { put(i, pen, null, sub); return; }
      /* 読みの末尾の長音（例: ソウ を ソ に当てる） */
      if (j === R.length - 1 && j > 0 && (R[j] === "ウ" || R[j] === "イ")) {
        var pv = K.vowelOf(R[j - 1]);
        if ((R[j] === "ウ" && (pv === "o" || pv === "u")) || (R[j] === "イ" && (pv === "e" || pv === "i"))) put(i, pen + 0.2, null, sub);
      }
      /* 「オン・エン」などの読みの母音が直前の音と同じなら溶け込ませる（ジョ＋オン → ジョーン ≈ ジョン） */
      if (j === 0 && R.length === 2 && R[1] === "ン" && i > 0 && !(i === pos && carryIn) && R[0] === VOWEL_KANA[K.vowelOf(T[i - 1])]) {
        rec(i, j + 1, pen + 0.2, sub);
      }
      if (i >= T.length) return;
      var t = tokAt(i);
      var vs = variants(t, i > pos ? tokAt(i - 1) : T[i - 1]);
      for (var a = 0; a < vs.length; a++) {
        var alt = vs[a][0], p = vs[a][1];
        var ok = true;
        for (var b = 0; b < alt.length; b++) { if (R[j + b] !== alt[b]) { ok = false; break; } }
        if (ok) { rec(i + 1, j + alt.length, pen + p, sub.concat([t])); continue; }
        /* 2つに分けた音の前半だけをこの漢字が受け持つ（後半は次の漢字へ） */
        if (alt.length === 2 && j === R.length - 1 && R[j] === alt[0]) put(i, pen + p, alt[1], sub.concat([alt[0]]));
      }
    }
    rec(pos, 0, 0, []);
    return Object.keys(best).map(function (k) { return best[k]; });
  }

  var TYPE_PEN = { on: 0, kun: 0, nanori: 0.05, creative: 0.35 };
  var SKIP_PEN = { "ー": 0.05, "ッ": 0.08, "ン": 0.7 };

  /* ---------- 評価 ---------- */
  Engine.prototype.meaningScore = function (o, ctx) {
    var s = ((o.pol - 1) / 4) * 0.55 + ((o.fit - 1) / 4) * 0.45;
    if (ctx.theme && THEMES[ctx.theme]) {
      if (o.cats.some(function (c) { return THEMES[ctx.theme].cats.indexOf(c) >= 0; })) s += 0.9;
    }
    (ctx.prefs || []).forEach(function (p) {
      var cs = PREF_CATS[p] || [];
      if (o.cats.some(function (c) { return cs.indexOf(c) >= 0; })) s += 0.35;
    });
    if (ctx.favorite && o.k === ctx.favorite) s += 5;
    if (o.strokes >= 21) s -= 0.2; else if (o.strokes >= 19) s -= 0.08;
    if (o.pol <= 2) s -= 0.6;
    if (o.fit <= 2) s -= 0.7;
    return s;
  };

  function countPen(n, len) {
    if (n === 1) return len > 3 ? 0.4 : 0.05;
    if (n <= 3) return 0;
    if (n === 4) return 0.18;
    if (n === 5) return 0.7;
    if (n === 6) return 1.2;
    return 1.9 + (n - 7) * 0.5;
  }

  Engine.prototype.totalScore = function (st, ctx, n) {
    var segs = st.segs;
    var k = segs.length;
    if (!k) return -99;
    var avg = st.mean / k;
    var score = 2.2 * avg - 1.5 * st.sound - 1.2 * st.typePen - countPen(k, n);
    var chars = segs.map(function (s) { return s.k; });
    var dupe = chars.length - new Set(chars).size;
    score -= dupe * 0.9;
    /* 画数のバランス（印影にしたとき極端な差が出ないように） */
    var strokes = segs.map(function (s) { return (this.kanji[s.k] || {}).strokes || 8; }, this);
    var mx = Math.max.apply(null, strokes), mn = Math.min.apply(null, strokes);
    if (mx - mn > 14) score -= 0.15;
    if (ctx.theme === "tradition" && JP_ENDINGS.indexOf(chars[chars.length - 1]) >= 0) score += 0.25;
    if (ctx.favorite && chars.indexOf(ctx.favorite) >= 0) score += 2;
    return score;
  };

  /* ---------- ビームサーチ ---------- */
  Engine.prototype.search = function (T, ctx, beamWidth) {
    var B = beamWidth || 48;
    var n = T.length;
    var layers = []; for (var i = 0; i <= n; i++) layers.push([]);
    layers[0].push({ pos: 0, carry: null, segs: [], sound: 0, typePen: 0, mean: 0, heavySkips: 0, lead: 0 });
    var self = this;
    function partialScore(st) {
      var k = Math.max(1, st.segs.length);
      return 2.2 * (st.mean / k) - 1.5 * st.sound - 1.2 * st.typePen - (st.segs.length > 4 ? (st.segs.length - 4) * 0.5 : 0);
    }
    function extendLast(st, p, pen, tok) {
      var segs2 = st.segs.slice();
      if (segs2.length) {
        var last = Object.assign({}, segs2[segs2.length - 1]);
        last.tEnd = p + 1; last.sound += pen; last.sub = (last.sub || []).concat([tok]);
        segs2[segs2.length - 1] = last;
      }
      return segs2;
    }
    for (var p = 0; p < n; p++) {
      var layer = layers[p];
      if (!layer.length) continue;
      layer.sort(function (a, b) { return partialScore(b) - partialScore(a); });
      if (layer.length > B) layer.length = B;
      /* 拍を分けた状態（carry）は同じ位置に追加されるので、キューとして処理する */
      for (var qi = 0; qi < layer.length && qi < B * 3; qi++) (function (st) {
        var t = st.carry || T[p];
        /* 1) 拍を読み飛ばす（ー・ッ・ン、分けた音の後半、またはどうしても合わない音） */
        var sp = st.carry ? 0.35 : SKIP_PEN[t];
        if (sp !== undefined || st.heavySkips < 1) {
          var pen = sp !== undefined ? sp : 1.1;
          var segs2 = extendLast(st, p, pen, t);
          layers[p + 1].push({ pos: p + 1, carry: null, segs: segs2, sound: st.sound + pen, typePen: st.typePen, mean: st.mean,
            heavySkips: st.heavySkips + (sp === undefined ? 1 : 0), lead: segs2.length ? st.lead : st.lead + 1 });
        }
        /* 2) 漢字を当てる */
        var firsts = {};
        variants(t, T[p - 1]).forEach(function (v) { firsts[v[0][0]] = true; });
        if (p > 0 && !st.carry) { var pv = VOWEL_KANA[K.vowelOf(T[p - 1])]; if (pv) firsts[pv] = true; }
        Object.keys(firsts).forEach(function (ft) {
          (self.index[ft] || []).forEach(function (ent) {
            var res = matchReading(T, p, ent.toks, st.carry);
            res.forEach(function (r) {
              if (r.end === p && !r.carry) return;
              var seg = { k: ent.o.k, reading: ent.str, type: ent.type, tStart: p, tEnd: r.carry ? r.end + 1 : r.end, sound: r.pen, sub: r.sub };
              layers[r.end].push({
                pos: r.end, carry: r.carry, segs: st.segs.concat([seg]), sound: st.sound + r.pen, typePen: st.typePen + TYPE_PEN[ent.type],
                mean: st.mean + self.meaningScore(ent.o, ctx), heavySkips: st.heavySkips, lead: st.lead
              });
            });
          });
        });
      })(layer[qi]);
      layers[p] = null;
    }
    var finals = layers[n].filter(function (s) { return s.segs.length && !(s.lead > 0) && !s.carry; });
    finals.forEach(function (s) { s.score = self.totalScore(s, ctx, n); });
    finals.sort(function (a, b) { return b.score - a.score; });
    /* 同じ漢字列の重複を除く */
    var seen = {}, out = [];
    finals.forEach(function (s) {
      var key = s.segs.map(function (x) { return x.k; }).join("");
      if (seen[key]) return;
      seen[key] = true;
      out.push(s);
    });
    return out;
  };

  function starsFromSound(sound) {
    if (sound <= 0.15) return 5;
    if (sound <= 0.4) return 4;
    if (sound <= 0.8) return 3;
    if (sound <= 1.4) return 2;
    return 1;
  }

  Engine.prototype.finalize = function (st, T, kata, theme) {
    var segs = st.segs.map(function (s) { return Object.assign({}, s); });
    var sound = segs.reduce(function (a, s) { return a + s.sound; }, 0);
    var creative = segs.some(function (s) { return s.type === "creative" || s.mismatch; }) || sound > 0.45;
    return {
      id: segs.map(function (s) { return s.k; }).join("") + ":" + (theme || ""),
      kanji: segs.map(function (s) { return s.k; }).join(""),
      segs: segs,
      theme: theme,
      target: kata,
      targetTokens: T,
      kanjiReading: segs.map(function (s) { return s.reading; }).join(""),
      sound: Math.round(sound * 100) / 100,
      stars: starsFromSound(sound),
      creative: creative,
      jpNameSound: JP_NAME_SOUNDS.indexOf(kata.replace(/ー/g, "")) >= 0 || JP_NAME_SOUNDS.indexOf(kata) >= 0,
      meaningFirst: segs.some(function (s) { return s.mismatch; }),
      score: Math.round((st.score || 0) * 100) / 100
    };
  };

  /*
   * 候補を作る
   *   kata: カタカナの読み（例: マイケル）
   *   opts: { prefs: ['beautiful',...], favorite: '愛', max: 5 }
   * 戻り値: { status: 'ok'|'empty'|'difficult'|'tooLong', candidates: [...], notes: [...] }
   */
  Engine.prototype.generate = function (kata, opts) {
    opts = opts || {};
    var clean = K.hiraToKata(String(kata || "")).replace(/[・\s=＝]/g, "");
    var T = K.tokenize(clean);
    var result = { status: "ok", candidates: [], notes: [], tokens: T };
    if (!T.length) { result.status = "empty"; return result; }
    if (T.length > 12) { result.status = "tooLong"; return result; }
    var prefs = opts.prefs || [];
    var fav = (opts.favorite || "").trim().charAt(0);
    if (fav && (!this.kanji[fav])) {
      result.notes.push(this.excluded[fav] ? "favExcluded" : "favNotInDb");
      fav = "";
    }
    var max = opts.max || 5;
    var chosen = [];
    var self = this;
    function overlapTooHigh(c) {
      return chosen.some(function (x) {
        if (x.kanji === c.kanji) return true;
        var a = x.kanji.split(""), b = c.kanji.split("");
        var same = b.filter(function (ch, i) { return a[i] === ch; }).length;
        return b.length >= 2 && same >= b.length - 1 && a.length === b.length;
      });
    }
    function pick(list, theme, strict) {
      for (var i = 0; i < Math.min(list.length, 25); i++) {
        var c = self.finalize(list[i], T, clean, theme);
        if (chosen.some(function (x) { return x.kanji === c.kanji; })) continue;
        if (strict && overlapTooHigh(c)) continue;
        return c;
      }
      return null;
    }

    /* 椿堂おすすめの当て字（名前の由来と意味がつながるもの） */
    var recs = this.recommended[clean] || [];
    recs.forEach(function (rec) {
      var c = self.buildFromKanji(rec.kanji, T, clean, "recommended", rec.readings);
      if (c) { c.note = rec.note || ""; chosen.push(c); }
    });
    /* 日本人の名前にもある音は、実際の日本の名前で使われる漢字を出す（最大2つ） */
    var jps = (this.jpNames[clean] || []).slice(0, 2);
    jps.forEach(function (jp) {
      if (chosen.some(function (x) { return x.kanji === jp.kanji; })) {
        chosen.forEach(function (x) { if (x.kanji === jp.kanji) x.realJpName = true; });
        return;
      }
      var c = self.buildFromKanji(jp.kanji, T, clean, "jpname", jp.readings);
      if (c) { c.realJpName = true; c.creative = false; chosen.push(c); }
    });
    var fixedCount = chosen.length;

    /* 好きな漢字を使った候補 */
    if (fav) {
      var favList = this.search(T, { theme: null, prefs: prefs, favorite: fav }, 64);
      var withFav = favList.filter(function (s) { return s.segs.some(function (x) { return x.k === fav; }); });
      if (withFav.length) {
        var fc = this.finalize(withFav[0], T, clean, "favorite");
        if (fc.stars >= 2) chosen.push(fc);
        else chosen.push(this.meaningFirst(withFav[0], favList, fav, T, clean));
      } else if (favList.length) {
        chosen.push(this.meaningFirst(null, favList, fav, T, clean));
      }
    }

    /* テーマ別の候補（好みのイメージに合うテーマを先に） */
    var order = THEME_ORDER.slice().sort(function (a, b) {
      function rel(t) { return prefs.reduce(function (acc, p) { return acc + ((PREF_CATS[p] || []).some(function (c) { return THEMES[t].cats.indexOf(c) >= 0; }) ? 1 : 0); }, 0); }
      return rel(b) - rel(a);
    });
    var bestSound = 99;
    order.forEach(function (theme) {
      if (chosen.length >= max + (fav ? 1 : 0) + Math.max(0, fixedCount - 1)) return;
      var list = self.search(T, { theme: theme, prefs: prefs }, 48);
      if (!list.length) return;
      var c = pick(list, theme, true) || pick(list, theme, false);
      if (!c) return;
      bestSound = Math.min(bestSound, c.sound);
      /* 品質が低すぎる候補は出さない（無理に5種類作らない） */
      if (c.stars <= 1) return;
      if (c.stars <= 2 && chosen.filter(function (x) { return x.stars >= 3; }).length >= 3) return;
      chosen.push(c);
    });

    /* よい候補（★4以上）があるときは、発音が遠い候補（★2以下）を出さない */
    if (chosen.some(function (c) { return c.stars >= 4; })) {
      chosen = chosen.filter(function (c) { return c.stars >= 3 || c.theme === "favorite" || c.theme === "recommended" || c.theme === "jpname"; });
    }
    result.candidates = chosen;
    if (!chosen.length) result.status = bestSound < 99 ? "difficult" : "empty";
    else if (chosen.every(function (c) { return c.stars <= 2; })) result.notes.push("lowCloseness");
    if (chosen.some(function (c) { return c.segs.length >= 5; })) result.notes.push("longName");
    return result;
  };

  /* 発音に合わない「好きな漢字」を、意味を優先して組み込む */
  Engine.prototype.meaningFirst = function (stWithFav, list, fav, T, kata) {
    if (stWithFav) return this.finalize(stWithFav, T, kata, "favorite");
    var base = list[0];
    var segs = base.segs.map(function (s) { return Object.assign({}, s); });
    /* 意味の点数が最も低い字を好きな漢字に置き換える */
    var self = this, worst = 0, worstScore = 99;
    segs.forEach(function (s, i) {
      var ms = self.meaningScore(self.kanji[s.k], {});
      if (ms < worstScore) { worstScore = ms; worst = i; }
    });
    var o = this.kanji[fav];
    var rd = (o.nanori[0] || o.kun[0] || o.on[0] || "");
    var old = segs[worst];
    segs[worst] = { k: fav, reading: rd, type: "mismatch", tStart: old.tStart, tEnd: old.tEnd, sound: 1.0, mismatch: true, sub: old.sub, originalSound: (old.sub || []).join("") };
    var st = { segs: segs, score: base.score };
    var c = this.finalize(st, T, kata, "favorite");
    c.meaningFirst = true;
    return c;
  };

  /* 漢字列（おすすめ当て字・AI候補）を読みに対応づけて候補にする。対応できなければ null */
  Engine.prototype.buildFromKanji = function (kanjiStr, T, kata, theme, readings) {
    var chars = Array.from(String(kanjiStr || ""));
    if (!chars.length || chars.some(function (c) { return !this.kanji[c]; }, this)) return null;
    var self = this;
    var found = null;
    function rec(ci, pos, carry, segs) {
      if (found) return;
      if (ci === chars.length) {
        if (carry) return;
        /* 残りの拍は ー ッ のみ許容 */
        var rest = T.slice(pos);
        if (rest.every(function (t) { return t === "ー" || t === "ッ"; })) {
          if (segs.length) { segs[segs.length - 1].tEnd = T.length; segs[segs.length - 1].sub = segs[segs.length - 1].sub.concat(rest); }
          found = segs;
        }
        return;
      }
      /* 名前の途中の「ー」「ッ」は、前の漢字の読みに含める */
      if (!carry && segs.length && (T[pos] === "ー" || T[pos] === "ッ")) {
        var last = Object.assign({}, segs[segs.length - 1]);
        last.tEnd = pos + 1; last.sub = (last.sub || []).concat([T[pos]]);
        rec(ci, pos + 1, null, segs.slice(0, -1).concat([last]));
      }
      var o = self.kanji[chars[ci]];
      var rs = [];
      if (readings && readings[ci]) rs.push({ r: K.hiraToKata(readings[ci]), type: "given" });
      ["on", "kun", "nanori", "creative"].forEach(function (type) { o[type].forEach(function (r) { rs.push({ r: r, type: type }); }); });
      rs.forEach(function (x) {
        var toks = K.tokenize(x.r);
        matchReading(T, pos, toks, carry).forEach(function (m) {
          if (m.pen > 0.5) return;
          var type = x.type === "given" ? self.readingType(o, toks.join("")) : x.type;
          rec(ci + 1, m.end, m.carry, segs.concat([{ k: chars[ci], reading: toks.join(""), type: type, tStart: pos, tEnd: m.carry ? m.end + 1 : m.end, sound: m.pen, sub: m.sub }]));
        });
      });
    }
    rec(0, 0, null, []);
    if (!found) return null;
    var st = { segs: found, score: 0 };
    return this.finalize(st, T, kata, theme);
  };

  /* その読みがその漢字のどの種類の読みか（辞書に無ければ創作読み） */
  Engine.prototype.readingType = function (o, reading) {
    var types = ["on", "kun", "nanori", "creative"];
    for (var i = 0; i < types.length; i++) {
      if (o[types[i]].some(function (r) { return K.tokenize(r).join("") === reading; })) return types[i];
    }
    return "creative";
  };

  /* AI 候補の検証（辞書と照合し、読みが成り立つものだけ採用） */
  Engine.prototype.validateExternal = function (items, kata) {
    var clean = K.hiraToKata(String(kata || "")).replace(/[・\s]/g, "");
    var T = K.tokenize(clean);
    var self = this;
    return (items || []).map(function (it) {
      var c = self.buildFromKanji(it.kanji, T, clean, "ai", it.readings);
      if (!c) return null;
      if (Array.from(it.kanji).some(function (ch) { return self.excluded[ch]; })) return null;
      c.aiComment = it.comment || "";
      return c;
    }).filter(Boolean);
  };

  /* ---------- 1文字ずつの変更 ---------- */
  Engine.prototype.alternatives = function (cand, segIndex, ctx) {
    var seg = cand.segs[segIndex];
    var T = cand.targetTokens;
    var sub = seg.sub && seg.sub.length ? seg.sub : T.slice(seg.tStart, seg.tEnd);
    var same = [], similar = [];
    var self = this;
    ctx = ctx || {};
    this.list.forEach(function (o) {
      var best = null;
      ["on", "kun", "nanori", "creative"].forEach(function (type) {
        o[type].forEach(function (r) {
          var toks = K.tokenize(r);
          matchReading(sub, 0, toks).forEach(function (m) {
            if (m.end !== sub.length || m.carry) return;
            var total = m.pen + TYPE_PEN[type] * 0.5;
            if (!best || total < best.total) best = { k: o.k, reading: toks.join(""), type: type, sound: m.pen, total: total };
          });
        });
      });
      /* ー・ッで終わる区切りは、その拍を除いても照合する */
      if (!best && sub.length > 1 && SKIP_PEN[sub[sub.length - 1]] !== undefined) {
        var sub2 = sub.slice(0, -1);
        ["on", "kun", "nanori", "creative"].forEach(function (type) {
          o[type].forEach(function (r) {
            var toks = K.tokenize(r);
            matchReading(sub2, 0, toks).forEach(function (m) {
              if (m.end !== sub2.length || m.carry) return;
              var pen = m.pen + SKIP_PEN[sub[sub.length - 1]];
              var total = pen + TYPE_PEN[type] * 0.5;
              if (!best || total < best.total) best = { k: o.k, reading: toks.join(""), type: type, sound: pen, total: total };
            });
          });
        });
      }
      if (!best) return;
      best.mscore = self.meaningScore(o, { prefs: ctx.prefs || [] });
      if (best.sound <= 0.1) same.push(best); else if (best.sound <= 0.6) similar.push(best);
    });
    function sorter(a, b) { return (b.mscore - b.total) - (a.mscore - a.total); }
    same.sort(sorter); similar.sort(sorter);
    return { sound: sub.join(""), same: same, similar: similar };
  };

  Engine.prototype.replaceKanji = function (cand, segIndex, k) {
    var o = this.kanji[k];
    if (!o) return null;
    var alts = this.alternatives(cand, segIndex);
    var hit = alts.same.concat(alts.similar).filter(function (a) { return a.k === k; })[0];
    var segs = cand.segs.map(function (s) { return Object.assign({}, s); });
    var old = segs[segIndex];
    if (hit) {
      segs[segIndex] = { k: k, reading: hit.reading, type: hit.type, tStart: old.tStart, tEnd: old.tEnd, sound: hit.sound, sub: old.sub };
    } else {
      segs[segIndex] = { k: k, reading: (o.nanori[0] || o.kun[0] || o.on[0] || ""), type: "mismatch", tStart: old.tStart, tEnd: old.tEnd, sound: 1.0, mismatch: true,
        sub: old.sub, originalSound: (old.sub || []).join("") };
    }
    var c = this.finalize({ segs: segs, score: cand.score }, cand.targetTokens, cand.target, cand.theme);
    c.edited = true;
    return c;
  };

  /* 意味の取得（言語ごと。無い場合は英語、英語も無ければ日本語） */
  var LANG_MAP = { ja: "ja", en: "en", "zh-Hans": "zh", "zh-Hant": "zt", ko: "ko", fr: "fr", de: "de", es: "es", it: "it", pt: "pt" };
  Engine.prototype.meaning = function (k, lang) {
    var o = this.kanji[k];
    if (!o) return { text: "", fallback: false };
    var key = LANG_MAP[lang];
    if (key && o.m[key]) return { text: o.m[key], fallback: false };
    if (o.m.en) return { text: o.m.en, fallback: lang !== "en" };
    return { text: o.m.ja || "", fallback: true };
  };
  Engine.hasMeaningLang = function (lang) { return !!LANG_MAP[lang]; };

  /* 名前全体のイメージ（テーマ）を判定 */
  Engine.prototype.imageThemes = function (cand) {
    var counts = {};
    var self = this;
    cand.segs.forEach(function (s) {
      var o = self.kanji[s.k];
      if (!o) return;
      o.cats.forEach(function (c) { counts[c] = (counts[c] || 0) + 1; });
    });
    return Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, 2);
  };

  var api = { Engine: Engine, THEMES: THEMES, PREF_CATS: PREF_CATS, parseKanjiRow: parseKanjiRow, matchReading: matchReading, LANG_KEYS: LANG_KEYS };
  root.TKEngine = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);

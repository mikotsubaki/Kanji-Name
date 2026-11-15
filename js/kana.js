/*
 * 椿堂 JAPANESE NAME MAKER — 読み推定（各国の文字 → カタカナ）
 * ------------------------------------------------------------
 * 1. 名前辞書（data/names-db.js）に登録があればそれを使う
 * 2. なければ発音プロファイル（国・地域）ごとの規則でカタカナを推定する
 * 推定結果は必ずお客様に確認・修正してもらう前提です。
 */
(function (root) {
  "use strict";

  /* ---------- 基本ユーティリティ ---------- */
  function hiraToKata(s) {
    return s.replace(/[ぁ-ゖ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) + 0x60); });
  }
  function kataToHira(s) {
    return s.replace(/[ァ-ヶ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0x60); });
  }
  function stripAccents(s) {
    return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
  }
  function nameKey(s) {
    return stripAccents(String(s || "").trim().toLowerCase()).replace(/[^a-z]/g, "");
  }

  var SMALL = "ァィゥェォャュョヮ";
  /* カタカナを拍（モーラ）に分ける。ー・ッ・ンもそれぞれ1拍 */
  function tokenize(kata) {
    var out = [];
    var s = String(kata || "");
    for (var i = 0; i < s.length; i++) {
      var c = s[i], n = s[i + 1];
      if (!/[ァ-ーー]/.test(c)) continue;
      if (n && SMALL.indexOf(n) >= 0) { out.push(c + n); i++; }
      else out.push(c);
    }
    return out;
  }

  var VOWEL_ROWS = {
    a: "アカガサザタダナハバパマヤラワャァヴァ",
    i: "イキギシジチヂニヒビピミリィ",
    u: "ウクグスズツヅヌフブプムユルゥュヴ",
    e: "エケゲセゼテデネヘベペメレェ",
    o: "オコゴソゾトドノホボポモヨロヲォョ"
  };
  function vowelOf(token) {
    if (!token) return "";
    var last = token[token.length - 1];
    for (var v in VOWEL_ROWS) if (VOWEL_ROWS[v].indexOf(last) >= 0) return v;
    return "";
  }

  /* ---------- カタカナ → ローマ字（ヘボン式） ---------- */
  var K2R = {
    "キャ":"kya","キュ":"kyu","キョ":"kyo","シャ":"sha","シュ":"shu","ショ":"sho","チャ":"cha","チュ":"chu","チョ":"cho",
    "ニャ":"nya","ニュ":"nyu","ニョ":"nyo","ヒャ":"hya","ヒュ":"hyu","ヒョ":"hyo","ミャ":"mya","ミュ":"myu","ミョ":"myo",
    "リャ":"rya","リュ":"ryu","リョ":"ryo","ギャ":"gya","ギュ":"gyu","ギョ":"gyo","ジャ":"ja","ジュ":"ju","ジョ":"jo",
    "ビャ":"bya","ビュ":"byu","ビョ":"byo","ピャ":"pya","ピュ":"pyu","ピョ":"pyo","シェ":"she","ジェ":"je","チェ":"che",
    "ティ":"ti","ディ":"di","トゥ":"tu","ドゥ":"du","ファ":"fa","フィ":"fi","フェ":"fe","フォ":"fo","ウィ":"wi","ウェ":"we","ウォ":"wo",
    "ヴァ":"va","ヴィ":"vi","ヴェ":"ve","ヴォ":"vo","イェ":"ye","ツァ":"tsa","ツィ":"tsi","ツェ":"tse","ツォ":"tso","デュ":"dyu","テュ":"tyu","フュ":"fyu",
    "ア":"a","イ":"i","ウ":"u","エ":"e","オ":"o","カ":"ka","キ":"ki","ク":"ku","ケ":"ke","コ":"ko","ガ":"ga","ギ":"gi","グ":"gu","ゲ":"ge","ゴ":"go",
    "サ":"sa","シ":"shi","ス":"su","セ":"se","ソ":"so","ザ":"za","ジ":"ji","ズ":"zu","ゼ":"ze","ゾ":"zo","タ":"ta","チ":"chi","ツ":"tsu","テ":"te","ト":"to",
    "ダ":"da","ヂ":"ji","ヅ":"zu","デ":"de","ド":"do","ナ":"na","ニ":"ni","ヌ":"nu","ネ":"ne","ノ":"no","ハ":"ha","ヒ":"hi","フ":"fu","ヘ":"he","ホ":"ho",
    "バ":"ba","ビ":"bi","ブ":"bu","ベ":"be","ボ":"bo","パ":"pa","ピ":"pi","プ":"pu","ペ":"pe","ポ":"po","マ":"ma","ミ":"mi","ム":"mu","メ":"me","モ":"mo",
    "ヤ":"ya","ユ":"yu","ヨ":"yo","ラ":"ra","リ":"ri","ル":"ru","レ":"re","ロ":"ro","ワ":"wa","ヲ":"o","ン":"n","ヴ":"vu",
    "ァ":"a","ィ":"i","ゥ":"u","ェ":"e","ォ":"o","ャ":"ya","ュ":"yu","ョ":"yo"
  };
  var MACRON = { a: "ā", i: "ī", u: "ū", e: "ē", o: "ō" };
  function kataToRomaji(kata, opts) {
    opts = opts || {};
    var toks = tokenize(hiraToKata(kata));
    var out = "";
    for (var i = 0; i < toks.length; i++) {
      var t = toks[i];
      if (t === "ー") {
        var lv = out.slice(-1);
        if (MACRON[lv]) out = out.slice(0, -1) + (opts.plain ? lv + lv : MACRON[lv]);
        continue;
      }
      if (t === "ッ") {
        var nx = K2R[toks[i + 1]] || "";
        out += nx ? (nx.indexOf("ch") === 0 ? "t" : nx[0]) : "";
        continue;
      }
      if (t === "ン") {
        var nx2 = K2R[toks[i + 1]] || "";
        out += (/^[aiueoy]/.test(nx2)) ? "n'" : "n";
        continue;
      }
      out += K2R[t] || "";
    }
    out = out.replace(/n'(?=[^aiueoy])/g, "n");
    return out ? out.charAt(0).toUpperCase() + out.slice(1) : "";
  }

  /* ---------- 内部ローマ字 → カタカナ ---------- */
  var R2K_LIST = [
    ["kya","キャ"],["kyu","キュ"],["kyo","キョ"],["gya","ギャ"],["gyu","ギュ"],["gyo","ギョ"],
    ["sha","シャ"],["shu","シュ"],["sho","ショ"],["shi","シ"],["she","シェ"],
    ["cha","チャ"],["chu","チュ"],["cho","チョ"],["chi","チ"],["che","チェ"],
    ["nya","ニャ"],["nyu","ニュ"],["nyo","ニョ"],["nye","ニェ"],["hya","ヒャ"],["hyu","ヒュ"],["hyo","ヒョ"],
    ["mya","ミャ"],["myu","ミュ"],["myo","ミョ"],["rya","リャ"],["ryu","リュ"],["ryo","リョ"],["rye","リェ"],
    ["bya","ビャ"],["byu","ビュ"],["byo","ビョ"],["pya","ピャ"],["pyu","ピュ"],["pyo","ピョ"],
    ["tsa","ツァ"],["tsi","ツィ"],["tsu","ツ"],["tse","ツェ"],["tso","ツォ"],
    ["dya","ジャ"],["dyu","デュ"],["dyo","ジョ"],["tyu","テュ"],["fyu","フュ"],["vyu","ヴュ"],
    ["ja","ジャ"],["ji","ジ"],["ju","ジュ"],["je","ジェ"],["jo","ジョ"],
    ["ka","カ"],["ki","キ"],["ku","ク"],["ke","ケ"],["ko","コ"],
    ["ga","ガ"],["gi","ギ"],["gu","グ"],["ge","ゲ"],["go","ゴ"],
    ["sa","サ"],["si","シ"],["su","ス"],["se","セ"],["so","ソ"],
    ["za","ザ"],["zi","ジ"],["zu","ズ"],["ze","ゼ"],["zo","ゾ"],
    ["ta","タ"],["ti","ティ"],["tu","トゥ"],["te","テ"],["to","ト"],
    ["da","ダ"],["di","ディ"],["du","ドゥ"],["de","デ"],["do","ド"],
    ["na","ナ"],["ni","ニ"],["nu","ヌ"],["ne","ネ"],["no","ノ"],
    ["ha","ハ"],["hi","ヒ"],["hu","フ"],["he","ヘ"],["ho","ホ"],
    ["fa","ファ"],["fi","フィ"],["fu","フ"],["fe","フェ"],["fo","フォ"],
    ["ba","バ"],["bi","ビ"],["bu","ブ"],["be","ベ"],["bo","ボ"],
    ["pa","パ"],["pi","ピ"],["pu","プ"],["pe","ペ"],["po","ポ"],
    ["va","ヴァ"],["vi","ヴィ"],["vu","ヴ"],["ve","ヴェ"],["vo","ヴォ"],
    ["ma","マ"],["mi","ミ"],["mu","ム"],["me","メ"],["mo","モ"],
    ["ya","ヤ"],["yi","イ"],["yu","ユ"],["ye","イェ"],["yo","ヨ"],
    ["ra","ラ"],["ri","リ"],["ru","ル"],["re","レ"],["ro","ロ"],
    ["la","ラ"],["li","リ"],["lu","ル"],["le","レ"],["lo","ロ"],
    ["wa","ワ"],["wi","ウィ"],["wu","ウ"],["we","ウェ"],["wo","ウォ"],
    ["a","ア"],["i","イ"],["u","ウ"],["e","エ"],["o","オ"]
  ];
  var BARE = { t:"ト", d:"ド", k:"ク", g:"グ", s:"ス", z:"ズ", f:"フ", h:"フ", b:"ブ", p:"プ", r:"ル", l:"ル", v:"ヴ", w:"ウ", y:"イ", c:"ク", q:"ク", j:"ジ", m:"ム", x:"クス" };

  function romajiToKata(r) {
    r = String(r || "").toLowerCase().replace(/[^a-z\-']/g, "");
    var out = "", i = 0;
    while (i < r.length) {
      var ch = r[i];
      if (ch === "-" ) { out += "ー"; i++; continue; }
      if (ch === "'") { i++; continue; }
      /* 長音: 同じ母音の連続 */
      if ("aiueo".indexOf(ch) >= 0 && i > 0 && r[i - 1] === ch && out.length) { out += "ー"; i++; continue; }
      /* ン */
      if (ch === "n" && (i + 1 >= r.length || ("aiueoy".indexOf(r[i + 1]) < 0) || r[i + 1] === "'")) {
        if (r[i + 1] === "n" && "aiueoy".indexOf(r[i + 2] || "") >= 0) { out += "ン"; i++; continue; }
        out += "ン"; i++; continue;
      }
      if (ch === "m" && "bpm".indexOf(r[i + 1] || "#") >= 0 && r[i + 1] !== undefined) {
        if (r[i + 1] === "m" && "aiueo".indexOf(r[i + 2] || "") >= 0) { out += "ン"; i++; continue; }
        if (r[i + 1] !== "m") { out += "ン"; i++; continue; }
      }
      /* 促音: 同じ子音の連続 */
      if ("aiueon".indexOf(ch) < 0 && r[i + 1] === ch && "aiueo".indexOf(r[i + 2] || "#") >= 0 || (ch === "t" && r.substr(i + 1, 2) === "ch")) {
        out += "ッ"; i++; continue;
      }
      if (ch === "k" && r[i + 1] === "k") { out += "ッ"; i++; continue; }
      var hit = null;
      for (var j = 0; j < R2K_LIST.length; j++) {
        var p = R2K_LIST[j][0];
        if (r.substr(i, p.length) === p) { hit = R2K_LIST[j]; break; }
      }
      if (hit) { out += hit[1]; i += hit[0].length; continue; }
      /* 母音のつかない子音 */
      if (r.substr(i, 2) === "ch") { out += "チ"; i += 2; continue; }
      if (r.substr(i, 2) === "sh") { out += "シュ"; i += 2; continue; }
      if (r.substr(i, 2) === "ts") { out += "ツ"; i += 2; continue; }
      if (BARE[ch]) { out += BARE[ch]; i++; continue; }
      i++;
    }
    return out;
  }

  /* ---------- 各言語の綴り → 内部ローマ字 ---------- */
  var V = "aeiouy";
  function isV(c) { return !!c && "aeiouyàâäéèêëîïôöûùüœæåøãõáíóú".indexOf(c) >= 0; }

  function ruleEngine(word, rules) {
    var out = "", i = 0;
    while (i < word.length) {
      var matched = false;
      for (var k = 0; k < rules.length; k++) {
        var rule = rules[k];
        var re = rule[0];
        re.lastIndex = i;
        var m = re.exec(word);
        if (m && m.index === i) {
          var rep = typeof rule[1] === "function" ? rule[1](m, word, i, out) : rule[1];
          out += rep;
          i += m[0].length;
          matched = true;
          break;
        }
      }
      if (!matched) { out += word[i]; i++; }
    }
    return out;
  }
  function R(src, flags) { return new RegExp(src, "y" + (flags || "")); }

  /* 英語 */
  function enRomaji(w) {
    w = stripAccents(w.toLowerCase()).replace(/[^a-z]/g, "");
    if (!w) return "";
    w = w.replace(/tion$/, "shon");
    w = w.replace(/([^aeiou])(ey|ie|y)$/, "$1ii");
    w = w.replace(/ay$/, "ei").replace(/oy$/, "oi");
    /* マジックe */
    w = w.replace(/([^aeiou]|^)([aeiou])([^aeiouwxy])e(s?)$/, function (m, pre, v, c, s) {
      var long = { a: "ei", i: "ai", o: "oo", u: "uu", e: "ii" }[v];
      return pre + long + c + s;
    });
    w = w.replace(/([^aeiou])e$/, "$1");
    var rules = [
      [R("tch"), "ch"], [R("sch"), "sk"], [R("ch"), "ch"], [R("sh"), "sh"], [R("th"), "s"], [R("ph"), "f"], [R("wh"), "w"],
      [R("gh"), function (m, w, i) { return (i > 0 && isV(w[i - 1])) ? "" : "g"; }],
      [R("ck$"), "kk"], [R("ck"), "k"], [R("qu"), "kw"],
      [R("x$"), "kks"], [R("x"), "ks"],
      [R("c(?=[eiy])"), "s"], [R("c"), "k"],
      [R("g(?=[eiy])"), function (m, w, i) { return i === 0 ? "g" : "j"; }],
      [R("ee|ea"), "ii"], [R("oo"), "uu"], [R("ou"), "au"], [R("ow$"), "ou"], [R("ai|ay"), "ei"], [R("au|aw"), "oo"], [R("oa"), "oo"], [R("ey"), "ei"], [R("ie"), "ii"],
      [R("(?:er|ir|ur)(?=[^aeiouy]|$)"), "aa"], [R("ar(?=[^aeiouy]|$)"), "aa"], [R("or(?=[^aeiouy]|$)"), "oo"],
      [R("y(?=[aeiou])"), function (m, w, i) { return (i === 0 || isV(w[i - 1])) ? "y" : "i"; }], [R("y"), "i"],
      [R("ll|l"), "r"], [R("rr"), "r"],
      [R("tt$"), "tt"], [R("pp$"), "pp"],
      [R("([bdfgkmnprstvz])\\1"), function (m) { return m[1]; }],
      [R("v"), "b"],
      [R("w(?=[aeiou])"), "w"], [R("w"), "u"],
      [R("s(?=[aeiou])"), function (m, w, i) { return (i > 0 && isV(w[i - 1])) ? "z" : "s"; }],
      [R("u(?=[^aeiouy]{2}|[^aeiouy]$)"), "a"]
    ];
    return ruleEngine(w, rules);
  }

  /* フランス語 */
  function frRomaji(w) {
    w = w.toLowerCase().replace(/[^a-zàâäéèêëîïôöûùüçœæÿ]/g, "");
    if (!w) return "";
    w = w.replace(/er$/, "é").replace(/ez$/, "é");
    w = w.replace(/([^aeiouéèêëàâîïôûù])e$/, "$1").replace(/es$/, "");
    w = w.replace(/(?:[tdsxzp]|nt)$/, function (m) { return m === "nt" ? "n" : ""; });
    w = w.replace(/ille$/, "iyu").replace(/ill(?=[aeiou])/, "iy");
    var rules = [
      [R("eau|au"), "o"], [R("oû|ou|où"), "u"], [R("oi"), "wa"], [R("oin"), "wan"],
      [R("ai|ei|ê|è|ë"), "e"], [R("é"), "e"],
      [R("(?:eu|œu)"), "u"],
      [R("gn"), "ny"], [R("ch"), "sh"], [R("ph"), "f"], [R("th"), "t"], [R("qu"), "k"], [R("gu(?=[eiéèê])"), "g"],
      [R("ç"), "s"], [R("c(?=[eiyéèê])"), "s"], [R("c"), "k"], [R("g(?=[eiyéèê])"), "j"], [R("j"), "j"], [R("h"), ""],
      [R("(?:an|am|en|em)(?=[^aeiouyéèên]|$)"), "an"],
      [R("(?:ain|ein|in|im|un)(?=[^aeiouyéèên]|$)"), "an"],
      [R("(?:on|om)(?=[^aeiouyéèên]|$)"), "on"],
      [R("à|â"), "a"], [R("î|ï"), "i"], [R("ô"), "o"], [R("û|ù|ü"), "yu"],
      [R("u"), function (m, w, i, out) { return "yu"; }],
      [R("ll|l"), "r"], [R("ss"), "s"],
      [R("s(?=[aeiouéèê])"), function (m, w, i) { return (i > 0 && isV(w[i - 1])) ? "z" : "s"; }],
      [R("([bdfgkmprtvz])\\1"), function (m) { return m[1]; }],
      [R("y"), "i"], [R("x"), "ks"], [R("w"), "w"]
    ];
    var r = ruleEngine(w, rules);
    return r.replace(/([rk])yu/g, "$1yu");
  }

  /* ドイツ語 */
  function deRomaji(w) {
    w = w.toLowerCase().replace(/[^a-zäöüß]/g, "");
    if (!w) return "";
    w = w.replace(/^sp/, "shp").replace(/^st/, "sht");
    w = w.replace(/er$/, "aa");
    var rules = [
      [R("tsch"), "ch"], [R("sch"), "sh"],
      [R("ch"), function (m, w, i) { if (/[aou]/.test(w[i - 1] || "")) return (i + 2 >= w.length) ? "hha" : "h"; return "hi"; }],
      [R("tth"), "t"],
      [R("ck"), "k"], [R("tz|z"), "ts"], [R("ei|ai"), "ai"], [R("ie"), "ii"], [R("eu|äu"), "oi"], [R("au"), "au"],
      [R("ä"), "e"], [R("ö"), "e"], [R("ü"), "yu"], [R("ß"), "s"],
      [R("ph"), "f"], [R("th"), "t"], [R("qu"), "kv"],
      [R("w"), "v"], [R("v"), "f"], [R("j"), "y"],
      [R("s(?=[aeiouäöü])"), function (m, w, i) { return (i === 0 || isV(w[i - 1])) ? "z" : "s"; }],
      [R("h"), function (m, w, i) { return (i > 0 && isV(w[i - 1])) ? "" : "h"; }],
      [R("ll|l"), "r"], [R("rr"), "r"],
      [R("([bdfgkmprstv])\\1"), function (m) { return m[1]; }],
      [R("y"), "yu"], [R("c"), "k"], [R("x"), "ks"]
    ];
    return ruleEngine(w, rules).replace(/rr/g, "r");
  }

  /* スペイン語 */
  function esRomaji(w) {
    w = w.toLowerCase().replace(/[^a-zñáéíóúü]/g, "");
    if (!w) return "";
    w = w.replace(/[áéíóú]/g, function (c) { return stripAccents(c); }).replace(/^x/, "j");
    var rules = [
      [R("ch"), "ch"], [R("ll"), "y"], [R("ñ"), "ny"], [R("rr"), "r"],
      [R("qu"), "k"], [R("gu(?=[ei])"), "g"], [R("gü"), "gw"],
      [R("j"), "h"], [R("g(?=[ei])"), "h"],
      [R("c(?=[ei])"), "s"], [R("c"), "k"], [R("z"), "s"], [R("h"), ""], [R("v"), "b"],
      [R("y$"), "i"], [R("x"), "ks"], [R("l"), "r"]
    ];
    return ruleEngine(w, rules);
  }

  /* イタリア語 */
  function itRomaji(w) {
    w = stripAccents(w.toLowerCase()).replace(/[^a-z]/g, "");
    if (!w) return "";
    var rules = [
      [R("sci(?=[aeou])"), "sh"], [R("sc(?=[ei])"), "sh"],
      [R("cci(?=[aeou])"), "tch"], [R("cc(?=[ei])"), "tch"],
      [R("ci(?=[aeou])"), "ch"], [R("c(?=[ei])"), "ch"], [R("ch"), "k"], [R("c"), "k"],
      [R("ggi(?=[aeou])"), "jj"], [R("gg(?=[ei])"), "jj"],
      [R("gi(?=[aeou])"), "j"], [R("g(?=[ei])"), "j"], [R("gh"), "g"],
      [R("gli"), "ri"], [R("gn"), "ny"], [R("qu"), "kw"], [R("zz|z"), "ts"], [R("h"), ""],
      [R("ll"), "rr"], [R("l"), "r"], [R("x"), "ks"], [R("j"), "y"], [R("w"), "v"]
    ];
    return ruleEngine(w, rules);
  }

  /* ポルトガル語 */
  function ptRomaji(w) {
    w = w.toLowerCase().replace(/[^a-zãõáéíóúâêôçà]/g, "");
    if (!w) return "";
    w = w.replace(/ão$/, "an").replace(/ões$/, "oins").replace(/em$/, "en").replace(/im$/, "in");
    w = stripAccents(w.replace(/ç/g, "SS")).replace(/S/g, "s");
    var rules = [
      [R("nh"), "ny"], [R("lh"), "ry"], [R("ch"), "sh"], [R("qu(?=[ei])"), "k"], [R("gu(?=[ei])"), "g"],
      [R("j"), "j"], [R("g(?=[ei])"), "j"], [R("c(?=[ei])"), "s"], [R("c"), "k"], [R("x"), "sh"], [R("h"), ""],
      [R("rr"), "h"], [R("ss"), "s"], [R("s(?=[aeiou])"), function (m, w, i) { return (i > 0 && isV(w[i - 1])) ? "z" : "s"; }],
      [R("ll|l"), "r"], [R("z$"), "s"], [R("v"), "v"], [R("w"), "w"], [R("y"), "i"]
    ];
    return ruleEngine(w, rules);
  }

  /* オランダ語・北欧などの簡易版 */
  function nlRomaji(w) {
    w = w.toLowerCase();
    w = w.replace(/å/g, "o").replace(/[øö]/g, "e").replace(/[æä]/g, "e").replace(/ü/g, "yu");
    w = stripAccents(w).replace(/[^a-z]/g, "");
    var rules = [
      [R("ij"), "ei"], [R("oe"), "u"], [R("ui"), "ai"], [R("ou|au"), "au"], [R("ee"), "ee"], [R("aa"), "aa"], [R("oo"), "oo"],
      [R("sch"), "sh"], [R("ch"), "h"], [R("sj"), "sh"], [R("g"), "h"], [R("j"), "y"], [R("w"), "v"], [R("v"), "f"],
      [R("c(?=[eiy])"), "s"], [R("c"), "k"], [R("ll|l"), "r"], [R("([bdfkmprst])\\1"), function (m) { return m[1]; }],
      [R("y"), "i"], [R("x"), "ks"], [R("q"), "k"], [R("z"), "z"]
    ];
    return ruleEngine(w, rules);
  }

  /* 汎用（ローマ字読みに近い読み方。インドネシア語・ベトナム語・アラビア語・ヒンディー語などのラテン文字表記に使用） */
  function genericRomaji(w, opts) {
    opts = opts || {};
    w = w.toLowerCase().replace(/đ/g, "d");
    w = stripAccents(w).replace(/[^a-z]/g, "");
    if (!w) return "";
    var rules = [
      [R("sh|sy"), "sh"], [R("ch"), "ch"], [R("th"), "t"], [R("ph"), "f"], [R("kh"), "k"], [R("gh"), "g"], [R("dh"), "d"], [R("bh"), "b"],
      [R("ng(?=[aeiou])"), "ng"], [R("ng$"), "n"],
      [R("c"), opts.cIsCh ? "ch" : "k"], [R("q"), "k"], [R("x"), opts.xIsS ? "s" : "ks"],
      [R("j"), "j"], [R("v"), "b"], [R("ll|l"), "r"],
      [R("y(?=[aeiou])"), "y"], [R("y"), "i"], [R("w(?=[aeiou])"), "w"], [R("w"), "u"],
      [R("([bdfgkmprstz])\\1"), function (m) { return m[1]; }]
    ];
    return ruleEngine(w, rules);
  }

  /* 日本語のローマ字表記（ヘボン式・訓令式）をそのまま読む */
  function jaRomaji(w) {
    return stripAccents(w.toLowerCase()).replace(/ō/g, "oo").replace(/ū/g, "uu").replace(/[^a-z']/g, "")
      .replace(/(^|[^s])si/g, "$1shi").replace(/(^|[^c])ti/g, "$1chi").replace(/(^|[^s])tu/g, "$1tsu").replace(/(^|[^sc])hu/g, "$1fu");
  }

  /* ---------- 中国語（拼音） ---------- */
  var PY_INIT = ["zh","ch","sh","b","p","m","f","d","t","n","l","g","k","h","j","q","x","r","z","c","s","y","w"];
  var PY_FINAL = ["iang","iong","uang","ueng","ang","eng","ing","ong","ian","iao","uai","uan","van","üan","ai","ei","ao","ou","an","en","in","un","vn","ün","ia","ie","iu","ua","uo","ui","ue","ve","üe","er","a","o","e","i","u","v","ü"];
  function pinyinToRomaji(w) {
    w = w.toLowerCase().normalize("NFD").replace(/[̀-̄̌]/g, "").normalize("NFC").replace(/[^a-zü]/g, "");
    var out = [], i = 0, guard = 0;
    while (i < w.length && guard++ < 40) {
      var ini = "";
      for (var a = 0; a < PY_INIT.length; a++) if (w.substr(i, PY_INIT[a].length) === PY_INIT[a]) { ini = PY_INIT[a]; break; }
      var fin = "";
      for (var b = 0; b < PY_FINAL.length; b++) if (w.substr(i + ini.length, PY_FINAL[b].length) === PY_FINAL[b]) { fin = PY_FINAL[b]; break; }
      if (!fin) { if (ini) { out.push(ini); i += ini.length; } else i++; continue; }
      /* "...n" + 母音 は後ろの音節の頭子音に回す（例: xian + an） */
      var next = w[i + ini.length + fin.length];
      if (/n$/.test(fin) && next && "aeiouv".indexOf(next) >= 0 && !/ng$/.test(fin)) fin = fin.slice(0, -1);
      if (/ng$/.test(fin) && next && "aeiouv".indexOf(next) >= 0) fin = fin.slice(0, -1);
      i += ini.length + fin.length;
      out.push(pySyl(ini, fin));
    }
    return out.join("");
  }
  function pySyl(ini, fin) {
    var I = { b:"b",p:"p",m:"m",f:"f",d:"d",t:"t",n:"n",l:"r",g:"g",k:"k",h:"h",j:"j",q:"ch",x:"sh",zh:"j",ch:"ch",sh:"sh",r:"r",z:"z",c:"ts",s:"s",y:"y",w:"w" }[ini] || "";
    var palatal = (ini === "j" || ini === "q" || ini === "x" || ini === "y");
    fin = fin.replace(/ü/g, "v");
    if (palatal && fin[0] === "u") fin = "v" + fin.slice(1);
    var F = {
      a:"a", o:"o", e:"o", er:"aru", ai:"ai", ei:"ei", ao:"ao", ou:"ou", an:"an", en:"en", ang:"an", eng:"on", ong:"on",
      i:"i", ia:"ya", ie:"ie", iao:"yao", iu:"yuu", ian:"en", in:"in", iang:"yan", ing:"in", iong:"yon",
      u:"u", ua:"wa", uo:"uo", uai:"wai", ui:"ei", uan:"wan", un:"un", uang:"wan", ueng:"won",
      v:"yu", ve:"yue", ue:"yue", van:"yuen", vn:"yun"
    }[fin] || fin;
    if ((ini === "zh" || ini === "ch" || ini === "sh" || ini === "r" || ini === "z" || ini === "c" || ini === "s") && fin === "i") F = (ini === "z" || ini === "c" || ini === "s") ? "u" : "i";
    if (palatal && I !== "y") {
      if (F === "ya") F = "a"; else if (F === "yao") F = "ao"; else if (F === "yan") F = "an"; else if (F === "yon") F = "on"; else if (F === "yuu") F = "ou";
      else if (F === "yu") F = "u"; else if (F === "yue") F = "ue"; else if (F === "yuen") F = "en"; else if (F === "yun") F = "un";
      if (I === "j") return "j" + F; if (I === "ch") return "ch" + F; if (I === "sh") return "sh" + F;
    }
    if (I === "y") { return "y" + F.replace(/^y/, "").replace(/^i/, F.length > 1 ? "" : "i"); }
    if (I === "w") { return "w" + F.replace(/^w/, "").replace(/^u/, F.length > 1 ? "" : "u"); }
    if (I === "h" && F[0] === "w") return "ho" + F.slice(1);
    if (I === "h" && F[0] === "u") return "f" + F.slice(1).replace(/^$/, "u");
    return I + F;
  }

  /* ---------- ハングル → カタカナ ---------- */
  var HG_INIT = ["k","kk","n","t","tt","r","m","p","pp","s","ss","","ch","cch","ch2","k2","t2","p2","h"];
  var HG_MED = ["a","e","ya","ye","o","e","yo","ye","o","wa","we","we","yo","u","wo","we","wi","yu","u","ui","i"];
  var HG_FIN = ["","k","k","k","n","n","n","t","r","r","r","r","r","r","r","r","m","p","p","s","s","ng","t","t","k","t","p","t"];
  function hangulToKata(s) {
    var syl = [];
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i) - 0xAC00;
      if (c < 0 || c > 11171) continue;
      syl.push({ i: Math.floor(c / 588), m: Math.floor((c % 588) / 28), f: c % 28 });
    }
    var r = "";
    for (var j = 0; j < syl.length; j++) {
      var x = syl[j];
      var ini = HG_INIT[x.i].replace(/2$/, "");
      var prevFin = j > 0 ? HG_FIN[syl[j - 1].f] : "";
      var voiced = j > 0 && (prevFin === "" || prevFin === "n" || prevFin === "m" || prevFin === "ng" || prevFin === "r");
      if (voiced) ini = { k: "g", t: "d", p: "b", ch: "j" }[ini] || ini;
      if (ini === "kk") ini = "k"; if (ini === "tt") ini = "t"; if (ini === "pp") ini = "p"; if (ini === "ss") ini = "s"; if (ini === "cch") ini = "ch";
      var med = HG_MED[x.m];
      if (ini && med === "we" && /^(ch|s|j|h|t|d|n|r|m)$/.test(ini)) med = "e";
      if (ini === "s" && (med === "i" || med[0] === "y")) ini = med === "i" ? "sh" : "sh";
      var syll = ini + med;
      syll = syll.replace(/^shy/, "sh").replace(/^jy/, "j").replace(/^chy/, "ch");
      r += syll;
      var fin = HG_FIN[x.f];
      if (fin === "ng") r += "n";
      else if (fin === "n") r += "n'";
      else if (fin === "m") r += "mu";
      else if (fin === "r") r += "ru";
      else if (fin === "k") r += "ku";
      else if (fin === "p") r += "pu";
      else if (fin === "t" || fin === "s") r += "t-";
    }
    r = r.replace(/t-/g, "Q");
    var kata = romajiToKata(r.replace(/Q/g, "tsu"));
    return kata.replace(/ツ(?=[カキクケコタチツテトパピプペポサシスセソ])/g, "ッ");
  }

  /* ---------- キリル文字 → 内部ローマ字 ---------- */
  var CYR = { "а":"a","б":"b","в":"v","г":"g","д":"d","е":"e","ё":"yo","ж":"j","з":"z","и":"i","й":"y","к":"k","л":"r","м":"m","н":"n","о":"o","п":"p","р":"r","с":"s","т":"t","у":"u","ф":"f","х":"h","ц":"ts","ч":"ch","ш":"sh","щ":"sh","ъ":"","ы":"i","ь":"","э":"e","ю":"yu","я":"ya","і":"i","ї":"yi","є":"ye","ґ":"g" };
  function cyrillicToRomaji(w) {
    w = w.toLowerCase();
    var out = "";
    for (var i = 0; i < w.length; i++) {
      var c = w[i];
      if (c === "е" && (i === 0 || "аеёиоуыэюяьъ".indexOf(w[i - 1]) >= 0)) { out += "ye"; continue; }
      if (c === "в" && i === w.length - 1) { out += "f"; continue; }
      if (c === "й" && i === w.length - 1) { out += "i"; continue; }
      out += (CYR[c] !== undefined) ? CYR[c] : "";
    }
    return out;
  }

  /* ---------- 文字種の判定 ---------- */
  function scriptOf(word) {
    if (/^[゠-ヿ぀-ゟ・ー\s]+$/.test(word)) return "kana";
    if (/[가-힣]/.test(word)) return "hangul";
    if (/[Ѐ-ӿ]/.test(word)) return "cyrillic";
    if (/[一-鿿㐀-䶿豈-﫿]/.test(word)) return "han";
    if (/^[A-Za-zÀ-ɏ'’\-\.]+$/.test(word)) return "latin";
    if (/[؀-ۿ]/.test(word)) return "arabic";
    if (/[฀-๿]/.test(word)) return "thai";
    if (/[ऀ-ॿ]/.test(word)) return "devanagari";
    if (/[Ͱ-Ͽ]/.test(word)) return "greek";
    if (/[֐-׿]/.test(word)) return "hebrew";
    return "other";
  }

  var PROFILE_FN = { en: enRomaji, fr: frRomaji, de: deRomaji, es: esRomaji, it: itRomaji, pt: ptRomaji, nl: nlRomaji, ja: jaRomaji, zh: pinyinToRomaji,
    id: function (w) { return genericRomaji(w, { cIsCh: true }); }, vi: function (w) { return genericRomaji(w, {}); }, generic: genericRomaji, ru: genericRomaji, ko: genericRomaji };

  var _namesIndex = null;
  function buildNamesIndex(db) {
    var idx = {};
    (db && db.rows || []).forEach(function (row) {
      var o = typeof row === "string" ? parseNameRow(row) : row;
      if (!o || !o.name) return;
      var key = nameKey(o.name);
      if (key && !idx[key]) idx[key] = o;
    });
    return idx;
  }
  function parseNameRow(row) {
    var f = row.split("|");
    var o = { name: f[0], kata: f[1], variants: {} };
    if (f[2]) f[2].split(",").forEach(function (p) { var kv = p.split(":"); if (kv[1]) o.variants[kv[0].trim()] = kv[1].trim(); });
    return o;
  }
  function setNamesDB(db) { _namesIndex = buildNamesIndex(db); }
  function namesIndex() {
    if (!_namesIndex) _namesIndex = buildNamesIndex(root.TSUBAKIDO_NAMES_DB);
    return _namesIndex;
  }

  /*
   * 名前（入力文字列）→ カタカナ推定
   * 戻り値: { kata, parts:[{word, kata, source}], unsupported:[script...], hanText: string|null }
   *   source: dict（辞書）/ rule（推定）/ kana（カナ入力）/ hangul / cyrillic / pinyin
   */
  function estimateReading(input, profile) {
    profile = profile || "en";
    var words = String(input || "").trim().split(/[\s　,，]+|(?<=[a-zà-ÿ])-(?=[A-Za-zÀ-ÿ])/i).filter(Boolean);
    var parts = [], unsupported = [], han = [];
    var idx = namesIndex();
    words.forEach(function (word) {
      var sc = scriptOf(word);
      if (sc === "kana") { parts.push({ word: word, kata: hiraToKata(word).replace(/[・\s]/g, ""), source: "kana" }); return; }
      if (sc === "hangul") { parts.push({ word: word, kata: hangulToKata(word), source: "hangul" }); return; }
      if (sc === "cyrillic") { parts.push({ word: word, kata: romajiToKata(cyrillicToRomaji(word)), source: "cyrillic" }); return; }
      if (sc === "han") { han.push(word); return; }
      if (sc === "latin") {
        var clean = word.replace(/[’'.]/g, "");
        var d = idx[nameKey(clean)];
        if (d && profile !== "ja" && profile !== "zh") {
          var k = d.variants[profile] || d.kata;
          parts.push({ word: word, kata: k, source: "dict" });
          return;
        }
        var fn = PROFILE_FN[profile] || genericRomaji;
        var rom = fn(clean);
        parts.push({ word: word, kata: romajiToKata(rom), source: profile === "zh" ? "pinyin" : "rule" });
        return;
      }
      unsupported.push(sc);
    });
    return {
      kata: parts.map(function (p) { return p.kata; }).filter(Boolean).join("・"),
      parts: parts, unsupported: unsupported, hanText: han.length ? han.join("") : null
    };
  }

  var api = {
    hiraToKata: hiraToKata, kataToHira: kataToHira, tokenize: tokenize, vowelOf: vowelOf,
    kataToRomaji: kataToRomaji, romajiToKata: romajiToKata, estimateReading: estimateReading,
    scriptOf: scriptOf, setNamesDB: setNamesDB, nameKey: nameKey, parseNameRow: parseNameRow,
    _rules: { en: enRomaji, fr: frRomaji, de: deRomaji, es: esRomaji, it: itRomaji, pt: ptRomaji, zh: pinyinToRomaji, ru: cyrillicToRomaji, ko: hangulToKata, generic: genericRomaji }
  };
  root.TKKana = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);

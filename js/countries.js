/*
 * 出身国・地域 → 発音プロファイル
 *   level: "std"  = 規則・辞書を用意した標準対応
 *          "simple" = 汎用規則による簡易推定（必ず読み方の確認を案内）
 * 国名の表示は Intl.DisplayNames で各言語に自動翻訳されます。
 */
(function (root) {
  "use strict";
  var C = [
    ["US","en"],["GB","en"],["CA","en"],["AU","en"],["NZ","en"],["IE","en"],["ZA","en"],["SG","en"],["PH","en"],["NG","en"],["KE","en"],
    ["FR","fr"],["BE","fr"],["LU","fr"],["MC","fr"],
    ["DE","de"],["AT","de"],["CH","de"],
    ["ES","es"],["MX","es"],["AR","es"],["CO","es"],["CL","es"],["PE","es"],["VE","es"],["CU","es"],["UY","es"],["EC","es"],
    ["IT","it"],["PT","pt"],["BR","pt"],
    ["NL","nl"],["SE","nl"],["NO","nl"],["DK","nl"],["FI","generic"],
    ["PL","generic"],["CZ","generic"],["HU","generic"],["GR","generic"],["RO","generic"],["TR","generic"],
    ["RU","ru"],["UA","ru"],
    ["CN","zh"],["TW","zh"],["HK","zh"],
    ["KR","ko"],["JP","ja"],
    ["VN","vi"],["TH","generic"],["ID","id"],["MY","id"],
    ["IN","generic"],["PK","generic"],["SA","generic"],["AE","generic"],["EG","generic"],["MA","generic"],["IL","generic"],["IR","generic"],
    ["ZZ","generic"]
  ];
  var STD = { en: 1, fr: 1, de: 1, es: 1, it: 1, pt: 1, zh: 1, ko: 1, ru: 1, ja: 1 };
  var DEFAULT_BY_LANG = { ja: "US", en: "US", "zh-Hans": "CN", "zh-Hant": "TW", ko: "KR", fr: "FR", de: "DE", es: "ES", it: "IT", pt: "BR", th: "TH", vi: "VN", id: "ID", ar: "SA", hi: "IN" };
  var EN_NAMES = { ZZ: "Other / not listed" };
  var OTHER = { ja: "その他・リストにない", "zh-Hans": "其他", "zh-Hant": "其他", ko: "기타", fr: "Autre", de: "Andere", es: "Otro", it: "Altro", pt: "Outro", th: "อื่น ๆ", vi: "Khác", id: "Lainnya", ar: "أخرى", hi: "अन्य" };

  function flag(code) {
    if (code === "ZZ") return "🌐";
    return String.fromCodePoint.apply(null, code.split("").map(function (c) { return 0x1F1E6 + c.charCodeAt(0) - 65; }));
  }
  function list(lang) {
    var dn = null;
    try { dn = new Intl.DisplayNames([lang, "en"], { type: "region" }); } catch (e) { dn = null; }
    var items = C.map(function (c) {
      var name = c[0] === "ZZ" ? (OTHER[lang] || EN_NAMES.ZZ) : (dn ? dn.of(c[0]) : c[0]);
      return { code: c[0], profile: c[1], level: STD[c[1]] ? "std" : "simple", name: name, flag: flag(c[0]) };
    });
    var other = items.pop();
    var coll;
    try { coll = new Intl.Collator(lang); } catch (e) { coll = new Intl.Collator("en"); }
    items.sort(function (a, b) { return coll.compare(a.name, b.name); });
    items.push(other);
    return items;
  }
  function get(code) {
    var c = C.filter(function (x) { return x[0] === code; })[0] || ["ZZ", "generic"];
    return { code: c[0], profile: c[1], level: STD[c[1]] ? "std" : "simple" };
  }
  root.TKCountries = { list: list, get: get, defaultFor: function (lang) { return DEFAULT_BY_LANG[lang] || "US"; } };
})(typeof window !== "undefined" ? window : globalThis);

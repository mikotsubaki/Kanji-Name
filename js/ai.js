/*
 * 椿堂 JAPANESE NAME MAKER — AI 連携アダプター
 * ------------------------------------------------------------
 * TSUBAKIDO_CONFIG.AI_ENDPOINT が空のときは何もしません（ローカル辞書だけで動作）。
 * AI の提案は、漢字データベースと照合して「読みが成り立つ」「除外漢字を含まない」ものだけを採用します。
 * 意味の説明は AI の文章ではなく、データベースの意味を表示します。
 */
(function (root) {
  "use strict";
  function suggest(payload, engine) {
    var cfg = root.TSUBAKIDO_CONFIG || {};
    if (!cfg.AI_ENDPOINT) return Promise.resolve([]);
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 15000);
    return fetch(cfg.AI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) { return r.ok ? r.json() : { candidates: [] }; })
      .then(function (data) {
        clearTimeout(timer);
        var items = (data && data.candidates) || [];
        return engine.validateExternal(items, payload.katakana);
      })
      .catch(function () { clearTimeout(timer); return []; });
  }
  root.TKAI = { suggest: suggest, enabled: function () { return !!(root.TSUBAKIDO_CONFIG || {}).AI_ENDPOINT; } };
})(typeof window !== "undefined" ? window : globalThis);

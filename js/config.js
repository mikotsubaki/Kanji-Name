/*
 * 椿堂 JAPANESE NAME MAKER — 設定
 * APIキーはここに書かないでください（サーバー側の環境変数で管理します）。
 */
window.TSUBAKIDO_CONFIG = {
  /* AI連携（初期版は無効）。Vercel に api/kanji-ai.js をデプロイし、
     環境変数 ANTHROPIC_API_KEY を設定したら "/api/kanji-ai" を指定します。 */
  AI_ENDPOINT: "",

  /* 生成する候補数の上限 */
  MAX_CANDIDATES: 5
};

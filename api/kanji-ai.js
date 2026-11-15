/*
 * 椿堂 JAPANESE NAME MAKER — AI 候補 API（Vercel Serverless Function）
 * ------------------------------------------------------------
 * 初期版では使いません。有効にする手順は README の「AI連携」を参照。
 *   1. Vercel の環境変数に ANTHROPIC_API_KEY を設定（コードには書かない）
 *   2. 必要なら ANTHROPIC_MODEL でモデルを指定
 *   3. js/config.js の AI_ENDPOINT を "/api/kanji-ai" にする
 * AI の返した候補は、ブラウザ側で漢字データベースと照合してから表示します。
 */
const MAX_LEN = 40;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { res.status(503).json({ error: "AI is not configured", candidates: [] }); return; }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const name = String((body && body.name) || "").slice(0, MAX_LEN);
  const katakana = String((body && body.katakana) || "").replace(/[^゠-ヿ]/g, "").slice(0, 24);
  const prefs = Array.isArray(body && body.prefs) ? body.prefs.slice(0, 6).map(String) : [];
  const favorite = String((body && body.favorite) || "").slice(0, 1);
  if (!katakana) { res.status(400).json({ error: "katakana required", candidates: [] }); return; }

  const prompt =
    "You create Japanese ateji (kanji art names) for a foreign name, for a hanko (seal) shop.\n" +
    `Name: ${name}\nKatakana reading: ${katakana}\nPreferred image: ${prefs.join(", ") || "none"}\nFavorite kanji: ${favorite || "none"}\n\n` +
    "Rules: 2-4 kanji when possible; each kanji must use one of its real on/kun/name readings; the readings joined must match the katakana as closely as possible; " +
    "only positive, auspicious meanings; avoid rare or hard-to-carve characters.\n" +
    'Reply with JSON only: {"candidates":[{"kanji":"舞花瑠","readings":["マイ","ケ","ル"],"comment":"short reason in English"}]} with up to 5 candidates.';

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
        max_tokens: 800,
        messages: [{ role: "user", content: prompt }]
      })
    });
    if (!r.ok) { res.status(502).json({ error: "AI request failed", candidates: [] }); return; }
    const data = await r.json();
    const text = (data.content || []).map((c) => c.text || "").join("");
    const m = text.match(/\{[\s\S]*\}/);
    const parsed = m ? JSON.parse(m[0]) : { candidates: [] };
    const candidates = (parsed.candidates || []).slice(0, 5).map((c) => ({
      kanji: String(c.kanji || "").slice(0, 6),
      readings: Array.isArray(c.readings) ? c.readings.slice(0, 6).map(String) : [],
      comment: String(c.comment || "").slice(0, 200)
    }));
    res.status(200).json({ candidates });
  } catch (e) {
    res.status(500).json({ error: "AI error", candidates: [] });
  }
};

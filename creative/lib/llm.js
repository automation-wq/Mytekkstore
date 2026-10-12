// Optional language-model adapter (Anthropic). With ANTHROPIC_API_KEY set, the analysis and the concepts get an extra,
// clearly labelled interpretation; without it everything still works from the deterministic rules. Never used for facts.
const KEY = process.env.ANTHROPIC_API_KEY || "", MODEL = process.env.CREATIVE_MODEL || "claude-sonnet-5";
const available = () => !!KEY;
async function ask(system, user, maxTokens = 1200) {
  if (!KEY) return null;
  const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "content-type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }), signal: AbortSignal.timeout(45000) });
  if (!r.ok) throw new Error("The language model answered " + r.status + ".");
  return ((await r.json()).content || []).map(c => c.text || "").join("");
}
async function json(system, user, maxTokens) { const t = await ask(system, user, maxTokens); if (!t) return null; try { return JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1)); } catch { return null; } }
module.exports = { available, ask, json, MODEL };

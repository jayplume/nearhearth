/**
 * The AI keeper's call to NEAR AI Cloud (OpenAI-compatible API; the model runs
 * in a TEE). The key is read from NEARAI_API_KEY and never leaves the runner.
 * Without a key the keeper passes and says why.
 */
import { AI_MODEL, type Decision, type RecentRound, type View, aiDecision, aiPrompt } from "@nearhearth/hearth";

const API = "https://cloud-api.near.ai/v1";

export async function aiKeeperDecide(v: View, pledgers: number, recent: RecentRound[], fetcher: typeof fetch = fetch): Promise<Decision & { model: string; asked: string; capped: boolean }> {
  const key = process.env.NEARAI_API_KEY?.trim();
  if (!key) return { pledge: 0n, reason: "No NEAR AI Cloud key on this runner (NEARAI_API_KEY), so the AI keeper passes.", model: AI_MODEL, asked: "", capped: false };
  const { system, user } = aiPrompt(v, pledgers, recent);
  try {
    const res = await fetcher(`${API}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ model: AI_MODEL, stream: false, temperature: 0.2, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) return { pledge: 0n, reason: `NEAR AI Cloud answered ${res.status}, so the AI keeper passes this round.`, model: AI_MODEL, asked: "", capped: false };
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return { ...aiDecision(body.choices?.[0]?.message?.content ?? "", v), model: AI_MODEL };
  } catch (e) {
    return { pledge: 0n, reason: `NEAR AI Cloud did not answer (${(e as Error).message.slice(0, 80)}), so the AI keeper passes.`, model: AI_MODEL, asked: "", capped: false };
  }
}

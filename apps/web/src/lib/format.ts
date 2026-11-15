const ONE = 10n ** 18n;
/** Whole EMBER with thousands separators; one decimal under 100. */
export function em(x: bigint | string): string {
  const v = typeof x === "string" ? BigInt(x) : x;
  const neg = v < 0n;
  const a = neg ? -v : v;
  const whole = a / ONE;
  const tenth = ((a % ONE) * 10n) / ONE;
  const s = whole < 100n && tenth > 0n ? `${whole.toLocaleString("en-US")}.${tenth}` : whole.toLocaleString("en-US");
  return `${neg ? "−" : ""}${s}`;
}
export const emNum = (x: bigint | string) => Number((typeof x === "string" ? BigInt(x) : x) / 10n ** 15n) / 1000;
export const toYocto = (ember: number) => (BigInt(Math.round(ember * 1000)) * 10n ** 15n).toString();
export const short = (a: string) => a.replace(".nearhearth.testnet", "").replace(".testnet", "");
export function clock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
export function ago(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return `${Math.round(s / 3600)} h ago`;
}

/**
 * When the keeper swarm next plays. The GitHub Action runs at minute 17 of
 * hours 0, 8 and 16 UTC (.github/workflows/swarm.yml); GitHub may start it a
 * few minutes late, so the page says "around".
 */
export const SWARM_HOURS_UTC = [0, 8, 16];
export function nextSwarmSession(now: number): Date {
  const d = new Date(now);
  for (let day = 0; day < 2; day++) {
    for (const h of SWARM_HOURS_UTC) {
      const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + day, h, 17);
      if (t > now) return new Date(t);
    }
  }
  return new Date(now + 8 * 3_600_000);
}

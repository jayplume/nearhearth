/**
 * Signing for the scripts (keepers, council, setup), testnet only. Keys come from
 * NEAR_KEYS (JSON {"account.testnet":"ed25519:..."}) or the NEAR CLI keychain in
 * ~/.near-credentials/testnet. No key is ever written to the repository.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { WRITE_RPCS } from "@nearhearth/hearth";
import { Account, KeyPair, actions } from "near-api-js";

const keychain = () => join(process.env.NEAR_CREDENTIALS_DIR ?? join(homedir(), ".near-credentials"), "testnet");

export function loadKey(accountId: string): string {
  if (process.env.NEAR_KEYS) {
    const key = (JSON.parse(process.env.NEAR_KEYS) as Record<string, unknown>)[accountId];
    if (typeof key === "string") return key;
  }
  const path = join(keychain(), `${accountId}.json`);
  const raw = JSON.parse(readFileSync(path, "utf8"));
  if (typeof raw.private_key !== "string") throw new Error(`no private_key in ${path}`);
  return raw.private_key;
}

export interface Sent {
  hash: string;
  ok: boolean;
  value?: unknown;
  failure?: string;
}

export interface Call {
  method: string;
  args: unknown;
  deposit?: string;
  gas?: string;
}

const rpcs = () => (process.env.NEAR_RPC ? [process.env.NEAR_RPC, ...WRITE_RPCS] : WRITE_RPCS);
const account = (id: string, rpc: string) => new Account(id, rpc, loadKey(id) as any);

/** Sends through the first RPC that does not rate-limit. A 429 means the transaction was not accepted, so retrying is safe. */
async function sendVia(signer: string, tx: Record<string, unknown>): Promise<any> {
  let last: unknown;
  for (const rpc of rpcs()) {
    try {
      return await account(signer, rpc).signAndSendTransaction(tx as any);
    } catch (e) {
      last = e;
      const limited = /429|rate|Too Many/i.test(String((e as any)?.cause ?? "") + String(e));
      if (!limited) throw e;
    }
  }
  throw last;
}

function outcome(res: any): Sent {
  const hash = res?.transaction?.hash ?? res?.transaction_outcome?.id ?? "?";
  const status = res?.status;
  if (status && typeof status === "object" && "Failure" in status) return { hash, ok: false, failure: JSON.stringify(status.Failure).slice(0, 400) };
  const b64 = status?.SuccessValue;
  let value: unknown;
  if (b64) {
    try {
      value = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
    } catch {
      value = undefined;
    }
  }
  return { hash, ok: true, value };
}

/** One transaction with one or more function calls to `contractId`. */
export async function callMany(signer: string, contractId: string, calls: Call[]): Promise<Sent> {
  const res = await sendVia(signer, {
    receiverId: contractId,
    actions: calls.map((c) =>
      actions.functionCall(c.method, new TextEncoder().encode(JSON.stringify(c.args)), BigInt(c.gas ?? "30000000000000"), BigInt(c.deposit ?? "0")),
    ),
    waitUntil: "EXECUTED_OPTIMISTIC",
    throwOnFailure: false,
  });
  return outcome(res);
}

export const call = (signer: string, contractId: string, method: string, args: unknown, deposit = "0", gas = "30000000000000") =>
  callMany(signer, contractId, [{ method, args, deposit, gas }]);

/** Creates `sub` under `parent` with a fresh full-access key saved to the CLI keychain. */
export async function createSubAccount(parent: string, sub: string, yoctoNear: bigint): Promise<Sent> {
  const path = join(keychain(), `${sub}.json`);
  const key = existsSync(path) ? KeyPair.fromString(loadKey(sub) as any) : KeyPair.fromRandom("ed25519");
  if (!existsSync(path)) {
    writeFileSync(path, JSON.stringify({ account_id: sub, public_key: key.getPublicKey().toString(), private_key: key.toString() }), { mode: 0o600 });
  }
  const res = await sendVia(parent, {
    receiverId: sub,
    actions: [actions.createAccount(), actions.transfer(yoctoNear), actions.addFullAccessKey(key.getPublicKey())],
    waitUntil: "EXECUTED_OPTIMISTIC",
    throwOnFailure: false,
  });
  return outcome(res);
}

/** Sends NEAR from one account to another (storage top-ups). */
export async function transferNear(from: string, to: string, yoctoNear: bigint): Promise<Sent> {
  const res = await sendVia(from, { receiverId: to, actions: [actions.transfer(yoctoNear)], waitUntil: "EXECUTED_OPTIMISTIC", throwOnFailure: false });
  return outcome(res);
}

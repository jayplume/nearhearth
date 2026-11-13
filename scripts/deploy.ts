/**
 * Upgrades the code at fire.nearhearth.testnet (no re-init: every round, pledge and balance is kept).
 * Only views may be added this way; the state layout must not change.
 *
 *   pnpm tsx scripts/deploy.ts path/to/nearhearth.wasm
 */
import { readFileSync } from "node:fs";
import { HEARTH_CONTRACT, RPC, txUrl } from "@nearhearth/hearth";
import { Account } from "near-api-js";
import { loadKey } from "./lib/signer.js";

const wasm = process.argv[2];
if (!wasm) throw new Error("usage: tsx scripts/deploy.ts <wasm>");
const acct = new Account(HEARTH_CONTRACT, process.env.NEAR_RPC ?? RPC, loadKey(HEARTH_CONTRACT) as any);
const res: any = await acct.deployContract(readFileSync(wasm));
console.log(`deployed ${wasm} to ${HEARTH_CONTRACT}: ${JSON.stringify(res?.status).slice(0, 40)}\n${txUrl(res?.transaction?.hash)}`);

// biome-ignore lint/style/useNodejsImportProtocol: the npm "buffer" polyfill for browsers, not Node's module
import { Buffer } from "buffer";
import { setupWalletSelector, type Wallet, type WalletSelector } from "@near-wallet-selector/core";
import { setupHereWallet } from "@near-wallet-selector/here-wallet";
import { setupIntearWallet } from "@near-wallet-selector/intear-wallet";
import { setupMeteorWallet } from "@near-wallet-selector/meteor-wallet";
import { setupSender } from "@near-wallet-selector/sender";
import { CALL_GAS, HEARTH_CONTRACT, NETWORK } from "@nearhearth/hearth";

// Some browser wallets call Buffer on their own.
(globalThis as any).Buffer ??= Buffer;

export const WALLETS = [
  { id: "meteor-wallet", label: "Meteor", kind: "Browser extension or web" },
  { id: "intear-wallet", label: "Intear", kind: "Web wallet" },
  { id: "here-wallet", label: "HERE", kind: "Mobile or web" },
  { id: "sender", label: "Sender", kind: "Browser extension" },
] as const;

let selectorPromise: Promise<WalletSelector> | null = null;
const getSelector = () => {
  selectorPromise ??= setupWalletSelector({ network: NETWORK, modules: [setupMeteorWallet(), setupIntearWallet(), setupHereWallet(), setupSender()] });
  return selectorPromise;
};

export async function connect(walletId: string): Promise<string> {
  const wallet = await (await getSelector()).wallet(walletId);
  const accounts = await wallet.signIn({ contractId: undefined as any, methodNames: [] } as any);
  const id = accounts[0]?.accountId ?? (await wallet.getAccounts())[0]?.accountId;
  if (!id) throw new Error("The wallet did not return an account.");
  return id;
}

async function current(): Promise<{ wallet: Wallet; accountId: string } | null> {
  const selector = await getSelector();
  if (!selector.isSignedIn()) return null;
  const wallet = await selector.wallet();
  const accountId = (await wallet.getAccounts())[0]?.accountId;
  return accountId ? { wallet, accountId } : null;
}

export const connectedAccount = async () => (await current())?.accountId ?? null;

/** Signs out. Some wallets never answer signOut, so after 5 s the session is forgotten locally. */
export async function disconnect() {
  const w = await current();
  if (!w) return;
  const answered = await Promise.race([w.wallet.signOut().then(() => true, () => false), new Promise<boolean>((r) => setTimeout(() => r(false), 5000))]);
  if (answered) return;
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith("near-wallet-selector:")) localStorage.removeItem(k);
  } catch {
    /* storage blocked: nothing to forget */
  }
  selectorPromise = null;
}

export interface Sent {
  hash: string;
  value: unknown;
}

/** Calls the hearth contract from the connected wallet. wallet-selector 10 wants near-api-js style actions. */
export async function send(method: string, args: Record<string, unknown>, depositYocto: string): Promise<Sent> {
  const w = await current();
  if (!w) throw new Error("Connect a wallet first.");
  const outcome: any = await w.wallet.signAndSendTransaction({
    receiverId: HEARTH_CONTRACT,
    actions: [
      { functionCall: { methodName: method, args: new TextEncoder().encode(JSON.stringify(args)), gas: BigInt(CALL_GAS), deposit: BigInt(depositYocto) } },
    ] as any,
  });
  const failure = outcome?.status?.Failure;
  if (failure) {
    const m = JSON.stringify(failure).match(/Smart contract panicked: ([^"\\]+)/);
    throw new Error(m ? `The hearth refused: ${m[1]}.` : `The transaction failed: ${JSON.stringify(failure).slice(0, 160)}`);
  }
  const hash: string = outcome?.transaction?.hash ?? outcome?.transaction_outcome?.id ?? "";
  let value: unknown = null;
  const b64 = outcome?.status?.SuccessValue;
  if (b64) {
    try {
      value = JSON.parse(atob(b64));
    } catch {
      value = null;
    }
  }
  return { hash, value };
}

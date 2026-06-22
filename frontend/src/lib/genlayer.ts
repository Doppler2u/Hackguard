import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

export function createGenlayerClient(account: string) {
  if (!account) return null;
  return createClient({
    chain: studionet,
    account: account as `0x${string}`,
  });
}

export async function connectWallet(): Promise<string> {
  const ethereum = (window as any).ethereum;
  if (!ethereum) {
    throw new Error("MetaMask not found. Install MetaMask and switch to GenLayer Studionet.");
  }
  const accounts = await ethereum.request({ method: "eth_requestAccounts" });
  const account = accounts?.[0];
  if (!account) throw new Error("No account returned by wallet");
  return account;
}

export function shortAddress(address: string) {
  if (!address) return "";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

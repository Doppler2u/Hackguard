import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

// Use a proxy endpoint to avoid CORS issues on Vercel.
// In dev, Vite proxies /api/rpc -> studio.genlayer.com/api
// In prod, vercel.json rewrites /api/rpc -> studio.genlayer.com/api
const RPC_ENDPOINT = typeof window !== "undefined" && window.location.hostname === "localhost"
  ? "https://studio.genlayer.com/api"
  : `${window.location.origin}/api/rpc`;

export function createGenlayerClient(walletAddress: string) {
  if (!walletAddress || typeof window === "undefined" || !(window as any).ethereum) return null;
  return createClient({ 
    chain: studionet, 
    endpoint: RPC_ENDPOINT,
    provider: (window as any).ethereum, 
    account: walletAddress as `0x${string}` 
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

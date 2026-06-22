import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const GENLAYER_CHAIN_ID = "0xf22f";

export async function switchToGenlayer() {
  const ethereum = (window as any).ethereum;
  if (!ethereum) return;
  try {
    await ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: GENLAYER_CHAIN_ID }] });
  } catch (e: any) {
    if (e.code === 4902) {
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: GENLAYER_CHAIN_ID,
          chainName: "GenLayer Studio Network",
          nativeCurrency: { name: "GEN Token", symbol: "GEN", decimals: 18 },
          rpcUrls: ["https://studio.genlayer.com/api"],
          blockExplorerUrls: ["https://explorer-studio.genlayer.com"],
        }],
      });
    }
  }
}

export function createGenlayerClient(walletAddress: string) {
  if (!walletAddress || typeof window === "undefined" || !(window as any).ethereum) return null;
  return createClient({
    chain: studionet,
    provider: (window as any).ethereum,
    account: walletAddress as `0x${string}`,
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

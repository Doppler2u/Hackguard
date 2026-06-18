import { readFileSync } from "fs";
import path from "path";
import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

function readEnvFile() {
  const envPath = path.resolve(process.cwd(), ".env");
  const envText = readFileSync(envPath, "utf-8");

  return Object.fromEntries(
    envText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        const key = line.slice(0, index).trim();
        const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
        return [key, value];
      }),
  );
}

const envVars = readEnvFile();
const rawKey = envVars.PRI_KEY || envVars.PRIVATE_KEY;

if (!rawKey) {
  console.error("PRI_KEY (or PRIVATE_KEY) not in .env");
  process.exit(1);
}

const privateKey = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;

const account = createAccount(privateKey);
const client = createClient({ chain: studionet, account });

async function main() {
  console.log("🛡️  Deploying HackGuard to GenLayer Studionet...");
  console.log("Account:", account.address);

  const contractPath = path.resolve(process.cwd(), "contracts/hack_guard.py");
  const contractCode = new Uint8Array(readFileSync(contractPath));

  const hash = await client.deployContract({ code: contractCode, args: [] });
  console.log("TX Hash:", hash);

  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: "ACCEPTED",
    retries: 200,
  });

  console.log("✅ HackGuard Contract Address:", receipt.data?.contract_address);
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exit(1);
});

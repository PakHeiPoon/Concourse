import hre from "hardhat";
import { ethers } from "ethers";

async function main() {
  // Read compiled artifact
  const artifact = await hre.artifacts.readArtifact("MerchantRegistry");

  // Connect to 0G Testnet
  const provider = new ethers.JsonRpcProvider("https://evmrpc-testnet.0g.ai");
  const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);

  console.log(`Deploying from: ${wallet.address}`);

  const balance = await provider.getBalance(wallet.address);
  console.log(`Balance: ${ethers.formatEther(balance)} A0GI`);

  if (balance === 0n) {
    throw new Error("No A0GI balance. Get testnet tokens from https://faucet.0g.ai");
  }

  // Deploy
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  console.log("Deploying MerchantRegistry...");

  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`\nMerchantRegistry deployed to: ${address}`);
  console.log(`Explorer: https://chainscan-galileo.0g.ai/address/${address}`);
  console.log(`\nUpdate frontend/src/contracts/MerchantRegistry.ts with this address.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

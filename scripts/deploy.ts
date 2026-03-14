import hre from "hardhat"; // ✅ Import padrão Hardhat
import fs from "fs";

const { ethers, network, run: hardhatRun } = hre;

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log("🚀 Deploying FundChain...");
  console.log("   Network:  ", network.name);
  console.log("   Deployer: ", deployer.address);
  console.log("   Balance:  ", ethers.formatEther(balance), "ETH\n");

  const Factory = await ethers.getContractFactory("FundChain");
  const contract = await Factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("✅ FundChain deployed to:", address);
  console.log("   Etherscan:", `https://sepolia.etherscan.io/address/${address}`);

  if (network.name === "sepolia") {
    console.log("\n⏳ Waiting for confirmations before verifying...");
    await contract.deploymentTransaction()?.wait(5);

    console.log("🔍 Verifying on Etherscan...");
    try {
      await hardhatRun("verify:verify", { address, constructorArguments: [] });
      console.log("✅ Verified!");
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message.includes("Already Verified")) {
          console.log("ℹ️  Already verified.");
        } else {
          console.error("Verification error:", err.message);
        }
      } else {
        console.error("Unknown verification error:", err);
      }
    }
  }

  const artifact = {
    address,
    network: network.name,
    abi: JSON.parse(contract.interface.formatJson()),
    deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync("./deployments.json", JSON.stringify(artifact, null, 2));
  console.log("\n📄 Deployment saved to deployments.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

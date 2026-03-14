import hre from 'hardhat';

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log('deployer', deployer.address);

  const Factory = await hre.ethers.getContractFactory('FundChain');
  const contract = await Factory.deploy();
  await contract.waitForDeployment();

  const tx = await contract.createCampaign('My Title', 'desc', hre.ethers.parseEther('1'), 7);
  const receipt = await tx.wait();
  console.log('receipt logs', receipt.logs);

  const parsed = receipt.logs.map(log => {
    try {
      return contract.interface.parseLog(log);
    } catch (err) {
      return { error: (err as Error).message };
    }
  });

  console.log('parsed', parsed);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
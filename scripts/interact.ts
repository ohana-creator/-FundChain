import hre from 'hardhat';
import fs from 'fs';

async function main() {
  const network = hre.network.name;
  const path = './deployments.json';

  let deployments = { address: undefined };
  if (fs.existsSync(path)) {
    deployments = JSON.parse(fs.readFileSync(path, 'utf8'));
  }

  let address = deployments.address;

  const code = address ? await hre.ethers.provider.getCode(address) : '0x';
  if (!address || code === '0x') {
    console.log('No existing contract on this network; deploying new FundChain for interaction script...');
    const Factory = await hre.ethers.getContractFactory('FundChain');
    const deployed = await Factory.deploy();
    await deployed.waitForDeployment();
    address = await deployed.getAddress();
    console.log('Deployed FundChain at', address);

    const artifact = {
      address,
      network,
      abi: JSON.parse(deployed.interface.formatJson()),
      deployedAt: new Date().toISOString(),
    };
    fs.writeFileSync(path, JSON.stringify(artifact, null, 2));
  }

  console.log(`• network=${network} address=${address}`);

  const fundChain = await hre.ethers.getContractAt('FundChain', address);
  const [deployer, alice] = await hre.ethers.getSigners();

  console.log('1) Criando campaign com deployer...');
  const goal = hre.ethers.parseEther('0.1');
  const tx1 = await fundChain.connect(deployer).createCampaign('Quick Test', 'Interacting with deployed contract', goal, 1);
  const rc1 = await tx1.wait();
  console.log('  createCampaign tx hash:', tx1.hash);
  console.log('  createCampaign confirmed, status:', rc1.status);

  const campaignId = await fundChain.campaignCount();
  console.log('  campaignId from campaignCount =', campaignId.toString());

  console.log('2) Alice contribuindo 0.03 ETH...');
  await fundChain.connect(alice).fund(campaignId, { value: hre.ethers.parseEther('0.03') });

  console.log('3) Verificando status...');
  const contribution = await fundChain.getContribution(campaignId, alice.address);
  const progress = await fundChain.getProgress(campaignId);
  const active = await fundChain.isActive(campaignId);

  console.log({ contribution: contribution.toString(), progress: progress.toString(), active });

  console.log('4) Buscando dados da campaign...');
  const camp = await fundChain.getCampaign(campaignId);
  console.log({ owner: camp.owner, raised: camp.raised.toString(), goal: camp.goal.toString(), deadline: camp.deadline.toString() });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
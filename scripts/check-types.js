const hre = require('hardhat');

async function main(){
  const [owner]=await hre.ethers.getSigners();
  const a=await hre.ethers.provider.getBalance(owner.address);
  console.log('type', typeof a, a); // check BigInt or string
  const tx=await hre.ethers.getContractFactory('FundChain');
  const c=await tx.deploy(); await c.waitForDeployment();
  const r1=await c.createCampaign('Valid title','desc',hre.ethers.parseEther('1'),1);
  const rc=await r1.wait();
  console.log('gasUsed type', typeof rc.gasUsed, rc.gasUsed);
  console.log('effectiveGasPrice type', typeof rc.effectiveGasPrice, rc.effectiveGasPrice);
  const cg=(rc.gasUsed*rc.effectiveGasPrice);
  console.log('claimGas type', typeof cg, cg);
}
main().catch(e=>{ console.error(e); process.exit(1);});
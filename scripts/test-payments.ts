import hre from 'hardhat';
import fs from 'fs';
import assert from 'assert';

async function main() {
  const path = './deployments.json';
  let address: string | undefined;

  if (fs.existsSync(path)) {
    try {
      const deployments = JSON.parse(fs.readFileSync(path, 'utf8'));
      if (deployments.address) {
        const code = await hre.ethers.provider.getCode(deployments.address);
        if (code !== '0x') {
          address = deployments.address;
          console.log('Using existing contract', address);
        }
      }
    } catch (error) {
      console.warn('deployments.json parse failed, will redeploy:', error);
    }
  }

  try {
    if (!address) {
      console.log('Deploying new FundChain for integration test...');
      const Factory = await hre.ethers.getContractFactory('FundChain');
      const deployed = await Factory.deploy();
      await deployed.waitForDeployment();
      address = await deployed.getAddress();
      console.log('Deployed:', address);
      const artifact = {
        address,
        network: hre.network.name,
        abi: JSON.parse(deployed.interface.formatJson()),
        deployedAt: new Date().toISOString(),
      };
      fs.writeFileSync(path, JSON.stringify(artifact, null, 2));
    }

    const [owner, alice, bob] = await hre.ethers.getSigners();
    const fundChain = await hre.ethers.getContractAt('FundChain', address);

    // Create campaign
    const goal = hre.ethers.parseEther('1.0');
    const durationDays = 2;
    const tx = await fundChain.connect(owner).createCampaign('Payment Test', 'Test sending and claiming', goal, durationDays);
    const receipt = await tx.wait();
    assert.equal(receipt.status, 1, 'createCampaign tx failed');

    const campaignId = await fundChain.campaignCount();
    assert.equal(campaignId.toString(), '1', 'campaignCount should be 1');

    // Fund with partial value
    const partial = hre.ethers.parseEther('0.3');
    await fundChain.connect(alice).fund(campaignId, { value: partial });

    const aliceContribution = await fundChain.getContribution(campaignId, alice.address);
    assert.equal(aliceContribution.toString(), partial.toString(), 'alice contribution mismatch');

    const progress30 = await fundChain.getProgress(campaignId);
    assert.equal(progress30.toString(), '30', 'progress should be 30');

    const activeBefore = await fundChain.isActive(campaignId);
    assert.equal(activeBefore, true, 'campaign should be active');

    // Try claim too early / goal too low
    await assert.rejects(
      fundChain.connect(owner).claimFunds(campaignId),
      /GoalNotReached|CampaignNotEnded/, 
      'claimFunds should revert before goal reached/deadline'
    );

    // Fund to reach goal
    const more = hre.ethers.parseEther('0.7');
    await fundChain.connect(bob).fund(campaignId, { value: more });

    const totalRaised = (await fundChain.getCampaign(campaignId)).raised;
    assert.equal(totalRaised.toString(), goal.toString(), 'totalRaised should equal goal');

    // Advance time past deadline
    await hre.network.provider.send('evm_increaseTime', [durationDays * 24 * 3600 + 1]);
    await hre.network.provider.send('evm_mine');

    // Claim funds by non-owner should revert
    await assert.rejects(
      fundChain.connect(alice).claimFunds(campaignId),
      /NotOwner/,
      'non-owner should not be able to claim'
    );

    const claimTx = await fundChain.connect(owner).claimFunds(campaignId);
    const claimRc = await claimTx.wait();
    assert.equal(claimRc.status, 1, 'claimFunds returned status 1');

    const campaignNow = await fundChain.getCampaign(campaignId);
    assert.equal(campaignNow.claimed, true, 'campaign should be marked claimed');
    assert.equal(campaignNow.raised.toString(), goal.toString(), 'raised stays goal');

    // Refund path should now revert because goal reached
    await assert.rejects(
      fundChain.connect(alice).refund(campaignId),
      /GoalAlreadyReached/,
      'refund should revert when goal reached'
    );

    console.log('All payment integration tests passed!');
  } catch (err) {
    console.error('Integration test failed - dumping diagnostics...');
    try {
      if (address) {
        const contract = await hre.ethers.getContractAt('FundChain', address);
        const allCampaigns = [];
        const count = await contract.campaignCount();
        for (let i = 1n; i <= count; i++) {
          const c = await contract.getCampaign(i);
          allCampaigns.push({
            id: i.toString(),
            owner: c.owner,
            raised: c.raised.toString(),
            goal: c.goal.toString(),
            deadline: c.deadline.toString(),
            claimed: c.claimed,
          });
        }
        console.error('contract', address, 'campaignCount', count.toString());
        console.error('campaigns', JSON.stringify(allCampaigns, null, 2));

        const ownerBalance = await hre.ethers.provider.getBalance((await hre.ethers.getSigners())[0].address);
        const aliceBalance = await hre.ethers.provider.getBalance((await hre.ethers.getSigners())[1].address);
        console.error('balances', {
          owner: ownerBalance.toString(),
          alice: aliceBalance.toString(),
        });

        // last event logs
        const filter = contract.filters.CampaignCreated();
        const events = await contract.queryFilter(filter, 0, 'latest');
        console.error('CampaignCreated events', events.map(e => ({ args: e.args, txHash: e.transactionHash })));
      }
    } catch (dumpErr) {
      console.error('Diagnostics failed:', dumpErr);
    }
    console.error(err);
    process.exit(1);
  }
}


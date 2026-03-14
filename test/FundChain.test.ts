import hre from 'hardhat';
import { expect } from 'chai';
import '@nomicfoundation/hardhat-chai-matchers';
import { time } from '@nomicfoundation/hardhat-network-helpers';

const { ethers } = hre;

describe('FundChain', () => {
  let contract: any;
  let owner: any;
  let alice: any;
  let bob: any;
  let ownerAddress: string;
  let aliceAddress: string;
  let bobAddress: string;

  const GOAL = ethers.parseEther('1.0'); // 1 ETH
  const DURATION = 7;                    // 7 days

  async function deploy() {
    [owner, alice, bob] = await ethers.getSigners();
    ownerAddress = await owner.getAddress();
    aliceAddress = await alice.getAddress();
    bobAddress = await bob.getAddress();

    const Factory = await ethers.getContractFactory('FundChain', owner);
    contract = await Factory.deploy();
    await contract.waitForDeployment();

    return { contract, owner, alice, bob };
  }

  async function createCampaign(signer = owner) {
    const tx = await contract.connect(signer).createCampaign(
      'Test Campaign',
      'A campaign for testing purposes',
      GOAL,
      DURATION,
    );
    const receipt = await tx.wait();

    const event = receipt.logs
      .map((log: any) => {
        try {
          return contract.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((e: any) => e?.name === 'CampaignCreated');

    if (!event) {
      throw new Error('CampaignCreated event not found');
    }

    return event.args.id as bigint;
  }

  // ─────────────────────────────────────────────
  //  createCampaign
  // ─────────────────────────────────────────────
  describe('createCampaign', () => {
    beforeEach(deploy);

    it('creates campaign with correct data', async () => {
      const id = await createCampaign();
      const c = await contract.getCampaign(id);

      expect(c.title).to.equal('Test Campaign');
      expect(c.goal).to.equal(GOAL);
      expect(c.raised).to.equal(0);
      expect(c.owner).to.equal(ownerAddress);
      expect(c.claimed).to.be.false;
    });

    it('increments campaign count', async () => {
      await createCampaign();
      await createCampaign();
      expect(await contract.campaignCount()).to.equal(2);
    });

    it('emits CampaignCreated event', async () => {
      const tx = await contract.createCampaign('My Title', 'desc', GOAL, DURATION);
      const receipt = await tx.wait();
      const event = receipt.logs
        .map((log: any) => {
          try {
            return contract.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((e: any) => e?.name === 'CampaignCreated');

      expect(event).not.to.be.undefined;
      expect(event!.args.id).to.equal(1);
      expect(event!.args.owner).to.equal(ownerAddress);
      expect(event!.args.title).to.equal('My Title');
      expect(event!.args.goal).to.equal(GOAL);
    });

    it('reverts if title too short', async () => {
      await expect(contract.createCampaign('abc', 'desc', GOAL, DURATION))
        .to.be.revertedWithCustomError(contract, 'TitleTooShort');
    });

    it('reverts if goal is zero', async () => {
      await expect(contract.createCampaign('My Title', 'desc', 0, DURATION))
        .to.be.revertedWithCustomError(contract, 'GoalMustBePositive');
    });

    it('reverts if duration is zero', async () => {
      await expect(contract.createCampaign('My Title', 'desc', GOAL, 0))
        .to.be.revertedWithCustomError(contract, 'DeadlineMustBeInFuture');
    });
  });

  // ─────────────────────────────────────────────
  //  fund
  // ─────────────────────────────────────────────
  describe('fund', () => {
    let campaignId: bigint;
    beforeEach(async () => {
      await deploy();
      campaignId = await createCampaign();
    });

    it('accepts contributions and tracks them', async () => {
      const amount = ethers.parseEther('0.5');
      await contract.connect(alice).fund(campaignId, { value: amount });

      const c = await contract.getCampaign(campaignId);
      expect(c.raised).to.equal(amount);
      expect(await contract.getContribution(campaignId, aliceAddress)).to.equal(amount);
    });

    it('accumulates multiple contributions', async () => {
      await contract.connect(alice).fund(campaignId, { value: ethers.parseEther('0.3') });
      await contract.connect(bob).fund(campaignId, { value: ethers.parseEther('0.4') });

      const c = await contract.getCampaign(campaignId);
      expect(c.raised).to.equal(ethers.parseEther('0.7'));
    });

    it('emits Funded event', async () => {
      const amount = ethers.parseEther('0.5');
      const tx = await contract.connect(alice).fund(campaignId, { value: amount });
      const receipt = await tx.wait();
      const event = receipt.logs
        .map((log: any) => {
          try {
            return contract.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((e: any) => e?.name === 'Funded');

      expect(event).not.to.be.undefined;
      expect(event!.args.campaignId).to.equal(campaignId);
      expect(event!.args.contributor).to.equal(aliceAddress);
      expect(event!.args.amount).to.equal(amount);
      expect(event!.args.totalRaised).to.equal(amount);
    });

    it('reverts after deadline', async () => {
      await time.increase(DURATION * 24 * 60 * 60 + 1);
      await expect(contract.connect(alice).fund(campaignId, { value: ethers.parseEther('0.1') }))
        .to.be.revertedWithCustomError(contract, 'CampaignEnded');
    });

    it('reverts with zero value', async () => {
      await expect(contract.connect(alice).fund(campaignId, { value: 0 }))
        .to.be.revertedWithCustomError(contract, 'ZeroContribution');
    });

    it('reverts for non-existent campaign', async () => {
      await expect(contract.connect(alice).fund(999, { value: ethers.parseEther('0.1') }))
        .to.be.revertedWithCustomError(contract, 'CampaignNotFound');
    });
  });

  // ─────────────────────────────────────────────
  //  claimFunds
  // ─────────────────────────────────────────────
  describe('claimFunds', () => {
    let campaignId: bigint;
    beforeEach(async () => {
      await deploy();
      campaignId = await createCampaign();
    });

    it('owner claims funds after successful campaign', async () => {
      await contract.connect(alice).fund(campaignId, { value: GOAL });
      await time.increase(DURATION * 24 * 60 * 60 + 1);

      const before = await ethers.provider.getBalance(ownerAddress);
      const tx = await contract.connect(owner).claimFunds(campaignId);
      const receipt = await tx.wait();
      const gasCost = BigInt(receipt!.gasUsed) * BigInt(receipt!.gasPrice ?? 0n);
      const after = await ethers.provider.getBalance(ownerAddress);

      expect(after - before + gasCost).to.equal(GOAL);
      expect((await contract.getCampaign(campaignId)).claimed).to.be.true;
    });

    it('emits FundsClaimed', async () => {
      await contract.connect(alice).fund(campaignId, { value: GOAL });
      await time.increase(DURATION * 24 * 60 * 60 + 1);

      const tx = await contract.connect(owner).claimFunds(campaignId);
      const receipt = await tx.wait();
      const event = receipt.logs
        .map((log: any) => {
          try {
            return contract.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((e: any) => e?.name === 'FundsClaimed');

      expect(event).not.to.be.undefined;
      expect(event!.args.campaignId).to.equal(campaignId);
      expect(event!.args.owner).to.equal(ownerAddress);
      expect(event!.args.amount).to.equal(GOAL);
    });

    it('reverts if not owner', async () => {
      await contract.connect(alice).fund(campaignId, { value: GOAL });
      await time.increase(DURATION * 24 * 60 * 60 + 1);
      await expect(contract.connect(alice).claimFunds(campaignId))
        .to.be.revertedWithCustomError(contract, 'NotOwner');
    });

    it('reverts if goal not reached', async () => {
      await contract.connect(alice).fund(campaignId, { value: ethers.parseEther('0.1') });
      await time.increase(DURATION * 24 * 60 * 60 + 1);
      await expect(contract.connect(owner).claimFunds(campaignId))
        .to.be.revertedWithCustomError(contract, 'GoalNotReached');
    });

    it('reverts if already claimed', async () => {
      await contract.connect(alice).fund(campaignId, { value: GOAL });
      await time.increase(DURATION * 24 * 60 * 60 + 1);
      await contract.connect(owner).claimFunds(campaignId);
      await expect(contract.connect(owner).claimFunds(campaignId))
        .to.be.revertedWithCustomError(contract, 'AlreadyClaimed');
    });

    it('reverts before deadline', async () => {
      await contract.connect(alice).fund(campaignId, { value: GOAL });
      await expect(contract.connect(owner).claimFunds(campaignId))
        .to.be.revertedWithCustomError(contract, 'CampaignNotEnded');
    });
  });

  // ─────────────────────────────────────────────
  //  refund
  // ─────────────────────────────────────────────
  describe('refund', () => {
    let campaignId: bigint;
    beforeEach(async () => {
      await deploy();
      campaignId = await createCampaign();
    });

    it('contributor gets refund after failed campaign', async () => {
      const amount = ethers.parseEther('0.3');
      await contract.connect(alice).fund(campaignId, { value: amount });
      await time.increase(DURATION * 24 * 60 * 60 + 1);

      const before = await ethers.provider.getBalance(aliceAddress);
      const tx = await contract.connect(alice).refund(campaignId);
      const receipt = await tx.wait();
      const gasCost = BigInt(receipt!.gasUsed) * BigInt(receipt!.gasPrice ?? 0n);
      const after = await ethers.provider.getBalance(aliceAddress);

      expect(after - before + gasCost).to.equal(amount);
    });

    it('emits Refunded', async () => {
      const amount = ethers.parseEther('0.3');
      await contract.connect(alice).fund(campaignId, { value: amount });
      await time.increase(DURATION * 24 * 60 * 60 + 1);

      const tx = await contract.connect(alice).refund(campaignId);
      const receipt = await tx.wait();
      const event = receipt.logs
        .map((log: any) => {
          try {
            return contract.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((e: any) => e?.name === 'Refunded');

      expect(event).not.to.be.undefined;
      expect(event!.args.campaignId).to.equal(campaignId);
      expect(event!.args.contributor).to.equal(aliceAddress);
      expect(event!.args.amount).to.equal(amount);
    });

    it('reverts if goal was reached', async () => {
      await contract.connect(alice).fund(campaignId, { value: GOAL });
      await time.increase(DURATION * 24 * 60 * 60 + 1);
      await expect(contract.connect(alice).refund(campaignId))
        .to.be.revertedWithCustomError(contract, 'GoalAlreadyReached');
    });

    it('reverts if nothing to refund', async () => {
      await time.increase(DURATION * 24 * 60 * 60 + 1);
      await expect(contract.connect(bob).refund(campaignId))
        .to.be.revertedWithCustomError(contract, 'NothingToRefund');
    });

    it('prevents double refund', async () => {
      await contract.connect(alice).fund(campaignId, { value: ethers.parseEther('0.1') });
      await time.increase(DURATION * 24 * 60 * 60 + 1);
      await contract.connect(alice).refund(campaignId);
      await expect(contract.connect(alice).refund(campaignId))
        .to.be.revertedWithCustomError(contract, 'NothingToRefund');
    });
  });

  // ─────────────────────────────────────────────
  //  View helpers
  // ─────────────────────────────────────────────
  describe('view functions', () => {
    let campaignId: bigint;
    beforeEach(async () => {
      await deploy();
      campaignId = await createCampaign();
    });

    it('getProgress returns correct percentage', async () => {
      await contract.connect(alice).fund(campaignId, { value: ethers.parseEther('0.5') });
      expect(await contract.getProgress(campaignId)).to.equal(50);
    });

    it('isActive returns true while open', async () => {
      expect(await contract.isActive(campaignId)).to.be.true;
    });

    it('isActive returns false after deadline', async () => {
      await time.increase(DURATION * 24 * 60 * 60 + 1);
      expect(await contract.isActive(campaignId)).to.be.false;
    });
  });
});

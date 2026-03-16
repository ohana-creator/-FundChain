import express from 'express';
import cors from 'cors';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const app  = express();
const PORT = process.env.PORT ?? 3333;

app.use(cors());
app.use(express.json());

// ─────────────────────────────────────────────
//  Setup ethers — read-only provider (no private key needed)
// ─────────────────────────────────────────────
const SEPOLIA_RPC = process.env.SEPOLIA_RPC_URL ?? 'https://rpc.sepolia.org';
const provider    = new ethers.JsonRpcProvider(SEPOLIA_RPC);

let contractAddress: string;
let abi: any[];

try {
  const deployment = JSON.parse(fs.readFileSync(path.join(__dirname, '../../deployments.json'), 'utf-8'));
  contractAddress  = deployment.address;
  abi              = deployment.abi;
  console.log(`📄 Contract loaded: ${contractAddress}`);
} catch {
  console.warn('⚠️  deployments.json not found. Run: npx hardhat run scripts/deploy.ts --network sepolia');
  contractAddress = process.env.CONTRACT_ADDRESS ?? '';
  abi = [];
}

const contract = new ethers.Contract(contractAddress, abi, provider);

// ─────────────────────────────────────────────
//  Routes
// ─────────────────────────────────────────────

// GET /api/campaigns/:id
app.get('/api/campaigns/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const c  = await contract.getCampaign(id);

    res.json({
      id:          Number(c.id),
      owner:       c.owner,
      title:       c.title,
      description: c.description,
      goal:        ethers.formatEther(c.goal),
      deadline:    Number(c.deadline),
      raised:      ethers.formatEther(c.raised),
      claimed:     c.claimed,
      progress:    Number(await contract.getProgress(id)),
      isActive:    await contract.isActive(id),
    });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// GET /api/campaigns/count
app.get('/api/campaigns/count', async (_req, res) => {
  try {
    const count = await contract.campaignCount();
    res.json({ count: Number(count) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/campaigns
app.get('/api/campaigns', async (_req, res) => {
  try {
    const count = Number(await contract.campaignCount());
    const campaigns = await Promise.all(
      Array.from({ length: count }, (_, i) => i + 1).map(async (id) => {
        const c = await contract.getCampaign(id);
        return {
          id:       Number(c.id),
          owner:    c.owner,
          title:    c.title,
          goal:     ethers.formatEther(c.goal),
          raised:   ethers.formatEther(c.raised),
          deadline: Number(c.deadline),
          progress: Number(await contract.getProgress(id)),
          isActive: await contract.isActive(id),
        };
      })
    );
    res.json({ campaigns, total: count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/contribution/:campaignId/:address
app.get('/api/contribution/:campaignId/:address', async (req, res) => {
  try {
    const { campaignId, address } = req.params;
    const amount = await contract.getContribution(Number(campaignId), address);
    res.json({ amount: ethers.formatEther(amount) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/contract
app.get('/api/contract', (_req, res) => {
  res.json({
    address:  contractAddress,
    network:  'sepolia',
    explorer: `https://sepolia.etherscan.io/address/${contractAddress}`,
  });
});

// Health
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`\n🟢 FundChain API running at http://localhost:${PORT}`);
  console.log(`   Docs: http://localhost:${PORT}/api/campaigns`);
});

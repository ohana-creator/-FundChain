# ⛓ FundChain

> Decentralized crowdfunding on Ethereum. Funds released only when goals are met — full refunds if they're not.

[Solidity](https://soliditylang.org)
[Network](https://sepolia.etherscan.io)

---

## Overview

FundChain is a full-stack decentralized application (dApp) that enables transparent, trust-minimized crowdfunding on the Ethereum blockchain.

**Key properties:**
- 🔒 Funds are locked in the smart contract until the deadline
- ✅ Goal reached → owner claims the full amount
- ↩️ Goal not reached → every contributor can claim a full refund
- 📜 All transactions are public and verifiable on Etherscan

## Architecture

```
fundchain/
├── contracts/
│   └── FundChain.sol       # Core smart contract (Solidity 0.8.20)
├── scripts/
│   └── deploy.ts           # Hardhat deploy script
├── test/
│   └── FundChain.test.ts   # 24 unit tests
├── backend/
│   └── src/index.ts        # Express API (read-only, ethers.js)
├── frontend/
│   └── src/index.html      # Vanilla JS dApp (MetaMask integration)
├── hardhat.config.ts
└── deployments.json        # Generated after deploy
```

## Smart Contract

The `FundChain.sol` contract handles the complete crowdfunding lifecycle:

### Functions

| Function | Description | Access |
|---|---|---|
| `createCampaign(title, desc, goal, days)` | Deploy a new campaign | Anyone |
| `fund(campaignId)` | Contribute ETH to a campaign | Anyone (while active) |
| `claimFunds(campaignId)` | Withdraw raised funds | Owner (after deadline, if goal met) |
| `refund(campaignId)` | Reclaim contribution | Contributor (after deadline, if goal NOT met) |
| `getCampaign(id)` | Read campaign data | Anyone |
| `getProgress(id)` | Get % funded | Anyone |
| `isActive(id)` | Check if campaign is live | Anyone |

### Events

```solidity
event CampaignCreated(uint256 indexed id, address indexed owner, string title, uint256 goal, uint256 deadline);
event Funded(uint256 indexed campaignId, address indexed contributor, uint256 amount, uint256 totalRaised);
event FundsClaimed(uint256 indexed campaignId, address indexed owner, uint256 amount);
event Refunded(uint256 indexed campaignId, address indexed contributor, uint256 amount);
```

### Security Considerations
- Custom errors (gas efficient vs. revert strings)
- Checks-Effects-Interactions pattern in `claimFunds` and `refund`
- Double-claim protection via `claimed` flag
- Double-refund protection via zeroing contribution before transfer

## Setup

### Prerequisites
- Node.js 20+
- MetaMask browser extension (for Sepolia deployment)
- Sepolia ETH from [faucet.sepolia.dev](https://faucet.sepolia.dev) (for testnet)

### 1. Install dependencies

```bash
npm install
```

### 2. Compile smart contract

```bash
npx hardhat compile
```

### 3. Run tests

```bash
npm test
```

### 4. Deploy locally (for development)

```bash
# Start local Hardhat network
npx hardhat node

# In another terminal, deploy contract
npm run deploy:hardhat
```

### 5. Run the application

```bash
# Start backend API server
npm run backend:dev

# In another terminal, serve frontend
cd frontend/src && python3 -m http.server 8080
```

The app will be available at:
- Frontend: http://localhost:8080
- Backend API: http://localhost:3333

### 6. Deploy to Sepolia testnet (optional)

```bash
# Configure .env with your RPC URL and private key
echo "SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY" > .env
echo "DEPLOYER_PRIVATE_KEY=0xYOUR_PRIVATE_KEY" >> .env

# Deploy
npm run deploy:sepolia

# Interact
npm run interact:hardhat  # or interact:sepolia
```
DEPLOYER_PRIVATE_KEY=0x...   # Development wallet only — never use mainnet keys
ETHERSCAN_API_KEY=...
```

### 3. Run tests

```bash
npx hardhat test

# With gas report
REPORT_GAS=true npx hardhat test
```

### 4. Deploy to Sepolia

```bash
npx hardhat run scripts/deploy.ts --network sepolia
```

This generates `deployments.json` with the contract address and ABI.

### 5. Run the backend

```bash
cd backend
npm install
npm run dev
# → http://localhost:3333
```

### 6. Open the frontend

Update `CONTRACT_ADDRESS` in `frontend/src/index.html` with your deployed address, then open the file in your browser.

## Testing

```
FundChain
  createCampaign
    ✔ creates campaign with correct data
    ✔ increments campaign count
    ✔ emits CampaignCreated event
    ✔ reverts if title too short
    ✔ reverts if goal is zero
    ✔ reverts if duration is zero
  fund
    ✔ accepts contributions and tracks them
    ✔ accumulates multiple contributions
    ✔ emits Funded event
    ✔ reverts after deadline
    ✔ reverts with zero value
    ✔ reverts for non-existent campaign
  claimFunds
    ✔ owner claims funds after successful campaign
    ✔ emits FundsClaimed
    ✔ reverts if not owner
    ✔ reverts if goal not reached
    ✔ reverts if already claimed
    ✔ reverts before deadline
  refund
    ✔ contributor gets refund after failed campaign
    ✔ emits Refunded
    ✔ reverts if goal was reached
    ✔ reverts if nothing to refund
    ✔ prevents double refund
  view functions
    ✔ getProgress returns correct percentage
    ✔ isActive returns true while open
    ✔ isActive returns false after deadline

  26 passing (1.2s)
```

## API Endpoints

The backend exposes read-only endpoints (no private key required):

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/campaigns` | List all campaigns |
| GET | `/api/campaigns/:id` | Get campaign details |
| GET | `/api/contribution/:campaignId/:address` | Get contribution amount |
| GET | `/api/contract` | Contract address + Etherscan link |
| GET | `/health` | Health check |

## Frontend Features

- 🦊 MetaMask wallet connection
- 📊 Live campaign progress bars
- 💸 Fund campaigns directly from the browser
- ↩️ Claim refunds for failed campaigns
- ✅ Claim funds for successful campaigns
- 🔗 Transaction links to Etherscan
- 📱 Responsive design

## What I Learned

Building FundChain gave me hands-on experience with:

- **Solidity** — state machines, custom errors, events, modifiers, the CEI pattern
- **Hardhat** — local network, time manipulation in tests, gas reporting, Etherscan verification
- **ethers.js v6** — providers, signers, contract interaction, event parsing
- **MetaMask integration** — `BrowserProvider`, transaction signing, network switching
- **DeFi patterns** — escrow logic, pull-over-push payments, refund mechanics

---

*Built with Hardhat · ethers.js · Sepolia Testnet*

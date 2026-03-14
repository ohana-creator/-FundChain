require('dotenv').config();
require('ts-node').register({
  project: './tsconfig.json',
  transpileOnly: true,
});
require('@nomicfoundation/hardhat-toolbox');

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL,
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
      chainId: 11155111,
    },
    hardhat: {},
  },
  etherscan: { apiKey: process.env.ETHERSCAN_API_KEY || "" },
};

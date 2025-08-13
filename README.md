# ERC20 Multi-Token Deployment Script

A production-ready Node.js script for deploying multiple ERC20 tokens with custom parameters to any EVM-compatible blockchain.

## Features

- **Batch Deployment**: Deploy multiple ERC20 tokens in a single execution
- **Customizable Parameters**: Configure each token's name, symbol, decimals, and initial supply
- **Optional Features**: Enable/disable mintable, burnable, and pausable functionality per token
- **Initial Distribution**: Automatically distribute tokens to specified addresses after deployment
- **OpenZeppelin Standards**: Uses battle-tested OpenZeppelin contracts for security
- **Gas Optimization**: Automatic gas estimation with configurable buffer
- **Deployment Reports**: Generates detailed JSON reports of all deployments
- **Multi-Network Support**: Works with any EVM-compatible blockchain

## Prerequisites

- Node.js v16+ and npm
- An Ethereum wallet with sufficient ETH/native tokens for gas fees
- RPC endpoint (Alchemy, Infura, local node, etc.)

## Installation

1. Clone or download this repository:
```bash
git clone <repository-url>
cd erc20-multi-deployer
```

2. Install dependencies:
```bash
npm install
```

3. Copy the environment example file:
```bash
cp .env.example .env
```

4. Edit `.env` and add your configuration:
```env
RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
PRIVATE_KEY=0xYOUR_PRIVATE_KEY
DEPLOYER_ADDRESS=0xYOUR_WALLET_ADDRESS
```

## Configuration

### Token Configuration (tokens.json)

Edit `tokens.json` to define the tokens you want to deploy:

```json
{
  "network": "mainnet",
  "tokens": [
    {
      "name": "My Token",
      "symbol": "MTK",
      "decimals": 18,
      "initialSupply": "1000000",
      "mintable": true,
      "burnable": true,
      "pausable": false,
      "initialHolders": [
        {
          "address": "0x...",
          "amount": "1000"
        }
      ]
    }
  ]
}
```

### Token Parameters

- **name**: Full name of the token (e.g., "Bitcoin")
- **symbol**: Token symbol (e.g., "BTC")
- **decimals**: Number of decimal places (usually 18 for most tokens, 6 for USDC/USDT style)
- **initialSupply**: Initial token supply (without decimals - actual minted = initialSupply * 10^decimals)
- **mintable**: Whether new tokens can be minted after deployment
- **burnable**: Whether tokens can be burned
- **pausable**: Whether token transfers can be paused
- **initialHolders**: Optional array of addresses to receive initial token distribution

## Usage

### Deploy All Tokens

Run the deployment script:

```bash
npm run deploy
```

Or directly with Node.js:

```bash
node deployTokens.js
```

### Use Custom Configuration File

```bash
node deployTokens.js ./path/to/custom-tokens.json
```

### Test on Local Network

1. Start a local Hardhat/Ganache node:
```bash
npx hardhat node
# or
ganache-cli
```

2. Update `.env` with local RPC:
```env
RPC_URL=http://127.0.0.1:8545
```

3. Run deployment:
```bash
npm run deploy
```

## Deployment Process

1. **Validation**: Checks environment variables and network connection
2. **Compilation**: Compiles the Solidity contract
3. **Gas Estimation**: Estimates gas for each deployment
4. **Deployment**: Deploys each token sequentially
5. **Verification**: Confirms deployment and checks contract code
6. **Distribution**: Sends initial tokens to specified holders
7. **Reporting**: Saves deployment results to JSON files

## Output Files

After deployment, the script generates:

- `deployments/deployment-{network}-{timestamp}.json` - Complete deployment report
- `deployments/latest-addresses.json` - Simple address mapping for integration
- `deployments/ERC20Token.abi.json` - Contract ABI for interaction

## Network Configuration

### Mainnet
```env
RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
```

### Testnets
```env
# Sepolia
RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY

# Goerli
RPC_URL=https://eth-goerli.g.alchemy.com/v2/YOUR_KEY
```

### Layer 2 / Alternative Chains
```env
# Polygon
RPC_URL=https://polygon-rpc.com/

# BSC
RPC_URL=https://bsc-dataseed.binance.org/

# Arbitrum
RPC_URL=https://arb1.arbitrum.io/rpc

# Optimism
RPC_URL=https://mainnet.optimism.io

# Avalanche
RPC_URL=https://api.avax.network/ext/bc/C/rpc
```

## Contract Features

### Access Control

- **Owner**: Full admin rights, can grant/revoke roles
- **MINTER_ROLE**: Can mint new tokens (if mintable)
- **PAUSER_ROLE**: Can pause/unpause transfers (if pausable)

### Functions

For mintable tokens:
```solidity
mint(address to, uint256 amount)
```

For burnable tokens:
```solidity
burn(uint256 amount)
burnFrom(address account, uint256 amount)
```

For pausable tokens:
```solidity
pause()
unpause()
```

## Gas Optimization

The script automatically:
- Estimates gas for each deployment
- Adds a 20% buffer for safety
- Uses Solidity optimizer with 200 runs

To override gas settings, add to `.env`:
```env
GAS_PRICE_GWEI=30
GAS_LIMIT=3000000
```

## Security Considerations

1. **Private Key Security**: Never commit `.env` files. Use hardware wallets or secure key management in production
2. **Contract Verification**: Always verify contracts on Etherscan after deployment
3. **Initial Distribution**: Double-check recipient addresses before deployment
4. **Role Management**: Carefully manage admin roles after deployment
5. **Testing**: Always test on testnets before mainnet deployment

## Troubleshooting

### "Insufficient funds for gas"
- Ensure your deployer wallet has enough ETH/native tokens
- Check gas price settings in `.env`

### "Contract deployment failed"
- Verify RPC endpoint is correct and accessible
- Check network is not congested
- Increase gas limit buffer in the script

### "Compilation failed"
- Ensure all dependencies are installed: `npm install`
- Check Solidity version compatibility

### "Transaction reverted"
- Check token parameters are valid (decimals 0-18, valid addresses)
- Ensure initial supply doesn't exceed uint256 max

## Example Deployment Output

```
════════════════════════════════════════════════════════
                  ERC20 TOKEN DEPLOYMENT                    
════════════════════════════════════════════════════════

Tokens to deploy: 3
Network: mainnet
Deployer address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb7

Deploying Wrapped Bitcoin (WBTC)...
  Estimated gas: 1825420
  Transaction hash: 0xabc...
  ✓ Deployed at: 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599
  Block number: 15847930
  Gas used: 1520350

✓ Successfully Deployed:
  WBTC: 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599
    Name: Wrapped Bitcoin
    Initial Supply: 21000000 (8 decimals)
    Features: Mintable, Burnable
```

## Contributing

Contributions are welcome! Please ensure:
- Code follows existing style
- All tests pass
- Documentation is updated

## License

MIT License - see LICENSE file for details

## Support

For issues or questions:
- Open an issue on GitHub
- Check existing issues for solutions
- Review the troubleshooting section

## Disclaimer

This software is provided as-is. Always audit and test thoroughly before using in production. The authors are not responsible for any losses incurred through the use of this software.
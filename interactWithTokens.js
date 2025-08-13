// interactWithTokens.js - Utility script for interacting with deployed tokens
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function mint(address to, uint256 amount)",
  "function burn(uint256 amount)",
  "function pause()",
  "function unpause()",
  "function paused() view returns (bool)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function grantRole(bytes32 role, address account)",
  "function revokeRole(bytes32 role, address account)",
  "function MINTER_ROLE() view returns (bytes32)",
  "function PAUSER_ROLE() view returns (bytes32)",
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)"
];

class TokenInteractor {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
    this.tokens = {};
  }

  async loadTokenAddresses() {
    const addressesPath = path.join(__dirname, 'deployments', 'latest-addresses.json');
    if (!fs.existsSync(addressesPath)) {
      throw new Error('No deployment addresses found. Run deployment first.');
    }
    this.tokens = JSON.parse(fs.readFileSync(addressesPath, 'utf8'));
  }

  async getTokenInfo(symbol) {
    const tokenData = this.tokens[symbol];
    if (!tokenData) {
      throw new Error(`Token ${symbol} not found`);
    }

    const contract = new ethers.Contract(tokenData.address, ERC20_ABI, this.provider);
    
    const [name, totalSupply, decimals, balance] = await Promise.all([
      contract.name(),
      contract.totalSupply(),
      contract.decimals(),
      contract.balanceOf(this.wallet.address)
    ]);

    return {
      name,
      symbol,
      address: tokenData.address,
      decimals,
      totalSupply: ethers.formatUnits(totalSupply, decimals),
      balance: ethers.formatUnits(balance, decimals)
    };
  }

  async transfer(symbol, to, amount) {
    const tokenData = this.tokens[symbol];
    if (!tokenData) {
      throw new Error(`Token ${symbol} not found`);
    }

    const contract = new ethers.Contract(tokenData.address, ERC20_ABI, this.wallet);
    const decimals = await contract.decimals();
    const amountWei = ethers.parseUnits(amount.toString(), decimals);

    console.log(`Transferring ${amount} ${symbol} to ${to}...`);
    const tx = await contract.transfer(to, amountWei);
    console.log(`Transaction hash: ${tx.hash}`);
    
    const receipt = await tx.wait();
    console.log(`✓ Transfer confirmed in block ${receipt.blockNumber}`);
    return receipt;
  }

  async approve(symbol, spender, amount) {
    const tokenData = this.tokens[symbol];
    if (!tokenData) {
      throw new Error(`Token ${symbol} not found`);
    }

    const contract = new ethers.Contract(tokenData.address, ERC20_ABI, this.wallet);
    const decimals = await contract.decimals();
    const amountWei = ethers.parseUnits(amount.toString(), decimals);

    console.log(`Approving ${amount} ${symbol} for ${spender}...`);
    const tx = await contract.approve(spender, amountWei);
    console.log(`Transaction hash: ${tx.hash}`);
    
    const receipt = await tx.wait();
    console.log(`✓ Approval confirmed in block ${receipt.blockNumber}`);
    return receipt;
  }

  async mint(symbol, to, amount) {
    const tokenData = this.tokens[symbol];
    if (!tokenData) {
      throw new Error(`Token ${symbol} not found`);
    }

    const contract = new ethers.Contract(tokenData.address, ERC20_ABI, this.wallet);
    
    // Check if caller has minter role
    const MINTER_ROLE = await contract.MINTER_ROLE();
    const hasMinterRole = await contract.hasRole(MINTER_ROLE, this.wallet.address);
    
    if (!hasMinterRole) {
      throw new Error(`Address ${this.wallet.address} does not have MINTER_ROLE`);
    }

    const decimals = await contract.decimals();
    const amountWei = ethers.parseUnits(amount.toString(), decimals);

    console.log(`Minting ${amount} ${symbol} to ${to}...`);
    const tx = await contract.mint(to, amountWei);
    console.log(`Transaction hash: ${tx.hash}`);
    
    const receipt = await tx.wait();
    console.log(`✓ Minting confirmed in block ${receipt.blockNumber}`);
    return receipt;
  }

  async burn(symbol, amount) {
    const tokenData = this.tokens[symbol];
    if (!tokenData) {
      throw new Error(`Token ${symbol} not found`);
    }

    const contract = new ethers.Contract(tokenData.address, ERC20_ABI, this.wallet);
    const decimals = await contract.decimals();
    const amountWei = ethers.parseUnits(amount.toString(), decimals);

    console.log(`Burning ${amount} ${symbol}...`);
    const tx = await contract.burn(amountWei);
    console.log(`Transaction hash: ${tx.hash}`);
    
    const receipt = await tx.wait();
    console.log(`✓ Burn confirmed in block ${receipt.blockNumber}`);
    return receipt;
  }

  async grantRole(symbol, role, account) {
    const tokenData = this.tokens[symbol];
    if (!tokenData) {
      throw new Error(`Token ${symbol} not found`);
    }

    const contract = new ethers.Contract(tokenData.address, ERC20_ABI, this.wallet);
    
    let roleHash;
    switch(role.toUpperCase()) {
      case 'MINTER':
        roleHash = await contract.MINTER_ROLE();
        break;
      case 'PAUSER':
        roleHash = await contract.PAUSER_ROLE();
        break;
      case 'ADMIN':
        roleHash = await contract.DEFAULT_ADMIN_ROLE();
        break;
      default:
        roleHash = role; // Assume it's already a hash
    }

    console.log(`Granting ${role} role to ${account}...`);
    const tx = await contract.grantRole(roleHash, account);
    console.log(`Transaction hash: ${tx.hash}`);
    
    const receipt = await tx.wait();
    console.log(`✓ Role granted in block ${receipt.blockNumber}`);
    return receipt;
  }

  async pause(symbol) {
    const tokenData = this.tokens[symbol];
    if (!tokenData) {
      throw new Error(`Token ${symbol} not found`);
    }

    const contract = new ethers.Contract(tokenData.address, ERC20_ABI, this.wallet);
    
    console.log(`Pausing ${symbol}...`);
    const tx = await contract.pause();
    console.log(`Transaction hash: ${tx.hash}`);
    
    const receipt = await tx.wait();
    console.log(`✓ Token paused in block ${receipt.blockNumber}`);
    return receipt;
  }

  async unpause(symbol) {
    const tokenData = this.tokens[symbol];
    if (!tokenData) {
      throw new Error(`Token ${symbol} not found`);
    }

    const contract = new ethers.Contract(tokenData.address, ERC20_ABI, this.wallet);
    
    console.log(`Unpausing ${symbol}...`);
    const tx = await contract.unpause();
    console.log(`Transaction hash: ${tx.hash}`);
    
    const receipt = await tx.wait();
    console.log(`✓ Token unpaused in block ${receipt.blockNumber}`);
    return receipt;
  }

  async listAllTokens() {
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('                    DEPLOYED TOKENS                      ');
    console.log('═══════════════════════════════════════════════════════\n');

    for (const [symbol, data] of Object.entries(this.tokens)) {
      try {
        const info = await this.getTokenInfo(symbol);
        console.log(`${info.name} (${symbol})`);
        console.log(`  Address: ${info.address}`);
        console.log(`  Total Supply: ${info.totalSupply}`);
        console.log(`  Your Balance: ${info.balance}`);
        console.log('');
      } catch (error) {
        console.log(`${symbol}: Error loading - ${error.message}\n`);
      }
    }
  }
}

// CLI Interface
async function main() {
  const interactor = new TokenInteractor();
  await interactor.loadTokenAddresses();

  const command = process.argv[2];
  const args = process.argv.slice(3);

  try {
    switch(command) {
      case 'list':
        await interactor.listAllTokens();
        break;
      
      case 'info':
        if (args.length < 1) {
          console.error('Usage: node interactWithTokens.js info <SYMBOL>');
          process.exit(1);
        }
        const info = await interactor.getTokenInfo(args[0]);
        console.log(info);
        break;
      
      case 'transfer':
        if (args.length < 3) {
          console.error('Usage: node interactWithTokens.js transfer <SYMBOL> <TO_ADDRESS> <AMOUNT>');
          process.exit(1);
        }
        await interactor.transfer(args[0], args[1], args[2]);
        break;
      
      case 'approve':
        if (args.length < 3) {
          console.error('Usage: node interactWithTokens.js approve <SYMBOL> <SPENDER> <AMOUNT>');
          process.exit(1);
        }
        await interactor.approve(args[0], args[1], args[2]);
        break;
      
      case 'mint':
        if (args.length < 3) {
          console.error('Usage: node interactWithTokens.js mint <SYMBOL> <TO_ADDRESS> <AMOUNT>');
          process.exit(1);
        }
        await interactor.mint(args[0], args[1], args[2]);
        break;
      
      case 'burn':
        if (args.length < 2) {
          console.error('Usage: node interactWithTokens.js burn <SYMBOL> <AMOUNT>');
          process.exit(1);
        }
        await interactor.burn(args[0], args[1]);
        break;
      
      case 'grant-role':
        if (args.length < 3) {
          console.error('Usage: node interactWithTokens.js grant-role <SYMBOL> <ROLE> <ACCOUNT>');
          process.exit(1);
        }
        await interactor.grantRole(args[0], args[1], args[2]);
        break;
      
      case 'pause':
        if (args.length < 1) {
          console.error('Usage: node interactWithTokens.js pause <SYMBOL>');
          process.exit(1);
        }
        await interactor.pause(args[0]);
        break;
      
      case 'unpause':
        if (args.length < 1) {
          console.error('Usage: node interactWithTokens.js unpause <SYMBOL>');
          process.exit(1);
        }
        await interactor.unpause(args[0]);
        break;
      
      default:
        console.log('ERC20 Token Interaction Utility\n');
        console.log('Commands:');
        console.log('  list                                    - List all deployed tokens');
        console.log('  info <SYMBOL>                          - Get token information');
        console.log('  transfer <SYMBOL> <TO> <AMOUNT>        - Transfer tokens');
        console.log('  approve <SYMBOL> <SPENDER> <AMOUNT>    - Approve token spending');
        console.log('  mint <SYMBOL> <TO> <AMOUNT>            - Mint new tokens (requires MINTER_ROLE)');
        console.log('  burn <SYMBOL> <AMOUNT>                 - Burn tokens');
        console.log('  grant-role <SYMBOL> <ROLE> <ACCOUNT>   - Grant role to account');
        console.log('  pause <SYMBOL>                         - Pause token transfers');
        console.log('  unpause <SYMBOL>                       - Unpause token transfers');
        console.log('\nExamples:');
        console.log('  node interactWithTokens.js list');
        console.log('  node interactWithTokens.js info WBTC');
        console.log('  node interactWithTokens.js transfer USDC 0x742d... 1000');
        console.log('  node interactWithTokens.js mint WETH 0x742d... 100');
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = TokenInteractor;
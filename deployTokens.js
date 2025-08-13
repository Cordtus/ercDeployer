// deployTokens.js - Main ERC20 deployment script
const { ethers } = require('ethers');
const solc = require('solc');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

class TokenDeployer {
  constructor() {
    this.validateEnvironment();
    this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
    this.deployments = [];
    this.contractBytecode = null;
    this.contractABI = null;
  }

  validateEnvironment() {
    const required = ['RPC_URL', 'PRIVATE_KEY', 'DEPLOYER_ADDRESS'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      console.error('Missing required environment variables:', missing.join(', '));
      console.log('Please copy .env.example to .env and fill in your values');
      process.exit(1);
    }

    // Validate private key format
    if (!process.env.PRIVATE_KEY.startsWith('0x') || process.env.PRIVATE_KEY.length !== 66) {
      console.error('Invalid private key format. Must be 64 hex characters prefixed with 0x');
      process.exit(1);
    }

    // Validate deployer address matches private key
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY);
    if (wallet.address.toLowerCase() !== process.env.DEPLOYER_ADDRESS.toLowerCase()) {
      console.error('DEPLOYER_ADDRESS does not match the address derived from PRIVATE_KEY');
      console.log(`Expected: ${wallet.address}`);
      console.log(`Got: ${process.env.DEPLOYER_ADDRESS}`);
      process.exit(1);
    }
  }

  async compileContract() {
    console.log('Compiling ERC20Token contract...');
    
    const contractPath = path.join(__dirname, 'contracts', 'ERC20Token.sol');
    const contractSource = fs.readFileSync(contractPath, 'utf8');

    // Prepare OpenZeppelin imports
    const ozPath = path.join(__dirname, 'node_modules', '@openzeppelin', 'contracts');
    
    const input = {
      language: 'Solidity',
      sources: {
        'ERC20Token.sol': {
          content: contractSource
        }
      },
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        },
        outputSelection: {
          '*': {
            '*': ['abi', 'evm.bytecode']
          }
        }
      }
    };

    function findImports(importPath) {
      if (importPath.startsWith('@openzeppelin/')) {
        const actualPath = path.join(__dirname, 'node_modules', importPath);
        if (fs.existsSync(actualPath)) {
          return {
            contents: fs.readFileSync(actualPath, 'utf8')
          };
        }
      }
      return { error: `File not found: ${importPath}` };
    }

    const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

    if (output.errors) {
      const errors = output.errors.filter(e => e.severity === 'error');
      if (errors.length > 0) {
        console.error('Compilation errors:');
        errors.forEach(err => console.error(err.formattedMessage));
        process.exit(1);
      }
    }

    const contract = output.contracts['ERC20Token.sol']['ERC20Token'];
    this.contractBytecode = contract.evm.bytecode.object;
    this.contractABI = contract.abi;

    console.log('✓ Contract compiled successfully\n');

    // Save ABI for future use
    this.saveABI();
  }

  saveABI() {
    const deploymentDir = path.join(__dirname, 'deployments');
    if (!fs.existsSync(deploymentDir)) {
      fs.mkdirSync(deploymentDir, { recursive: true });
    }

    const abiPath = path.join(deploymentDir, 'ERC20Token.abi.json');
    fs.writeFileSync(abiPath, JSON.stringify(this.contractABI, null, 2));
  }

  async loadTokenConfig() {
    const configPath = process.env.TOKENS_CONFIG_PATH || path.join(__dirname, 'tokens.json');
    
    if (!fs.existsSync(configPath)) {
      console.error(`Token configuration file not found: ${configPath}`);
      console.log('Please create a tokens.json file with your token configurations');
      process.exit(1);
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    // Validate token configurations
    for (const token of config.tokens) {
      this.validateTokenConfig(token);
    }

    return config;
  }

  validateTokenConfig(token) {
    const required = ['name', 'symbol', 'decimals', 'initialSupply'];
    const missing = required.filter(key => token[key] === undefined);
    
    if (missing.length > 0) {
      throw new Error(`Token ${token.name || 'unnamed'} missing required fields: ${missing.join(', ')}`);
    }

    if (token.decimals < 0 || token.decimals > 18) {
      throw new Error(`Token ${token.name} has invalid decimals: ${token.decimals}. Must be 0-18`);
    }

    if (token.initialHolders) {
      for (const holder of token.initialHolders) {
        if (!ethers.isAddress(holder.address)) {
          throw new Error(`Invalid holder address for ${token.name}: ${holder.address}`);
        }
      }
    }
  }

  async estimateGas(token) {
    const factory = new ethers.ContractFactory(this.contractABI, this.contractBytecode, this.wallet);
    
    const initialSupplyWei = ethers.parseUnits(token.initialSupply, token.decimals);
    
    try {
      const estimatedGas = await factory.getDeployTransaction(
        token.name,
        token.symbol,
        token.decimals,
        initialSupplyWei,
        token.mintable || false,
        token.burnable || false,
        token.pausable || false
      ).estimateGas();

      // Add 20% buffer
      return estimatedGas * 120n / 100n;
    } catch (error) {
      console.error(`Failed to estimate gas for ${token.name}:`, error.message);
      // Return default gas limit if estimation fails
      return 3000000n;
    }
  }

  async deployToken(token) {
    console.log(`Deploying ${token.name} (${token.symbol})...`);

    const factory = new ethers.ContractFactory(this.contractABI, this.contractBytecode, this.wallet);
    
    const initialSupplyWei = ethers.parseUnits(token.initialSupply, token.decimals);
    
    // Estimate gas
    const gasLimit = await this.estimateGas(token);
    console.log(`  Estimated gas: ${gasLimit}`);

    // Deploy contract
    const contract = await factory.deploy(
      token.name,
      token.symbol,
      token.decimals,
      initialSupplyWei,
      token.mintable || false,
      token.burnable || false,
      token.pausable || false,
      {
        gasLimit: gasLimit
      }
    );

    console.log(`  Transaction hash: ${contract.deploymentTransaction().hash}`);
    
    // Wait for deployment
    await contract.waitForDeployment();
    const address = await contract.getAddress();
    
    console.log(`  ✓ Deployed at: ${address}`);
    
    const receipt = await contract.deploymentTransaction().wait();
    console.log(`  Block number: ${receipt.blockNumber}`);
    console.log(`  Gas used: ${receipt.gasUsed}\n`);

    // Distribute initial tokens if configured
    if (token.initialHolders && token.initialHolders.length > 0) {
      await this.distributeTokens(contract, token);
    }

    // Store deployment info
    this.deployments.push({
      name: token.name,
      symbol: token.symbol,
      address: address,
      decimals: token.decimals,
      initialSupply: token.initialSupply,
      mintable: token.mintable || false,
      burnable: token.burnable || false,
      pausable: token.pausable || false,
      deploymentTx: contract.deploymentTransaction().hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString()
    });

    return address;
  }

  async distributeTokens(contract, token) {
    console.log(`  Distributing initial tokens...`);
    
    for (const holder of token.initialHolders) {
      const amount = ethers.parseUnits(holder.amount, token.decimals);
      
      console.log(`    Sending ${holder.amount} ${token.symbol} to ${holder.address}`);
      const tx = await contract.transfer(holder.address, amount);
      await tx.wait();
      console.log(`    ✓ Transfer confirmed`);
    }
  }

  async verifyDeployment(address) {
    const code = await this.provider.getCode(address);
    return code !== '0x';
  }

  async getNetworkInfo() {
    const network = await this.provider.getNetwork();
    const balance = await this.provider.getBalance(this.wallet.address);
    
    return {
      chainId: network.chainId.toString(),
      name: network.name || 'unknown',
      deployerBalance: ethers.formatEther(balance)
    };
  }

  saveDeploymentReport(network) {
    const deploymentDir = path.join(__dirname, 'deployments');
    if (!fs.existsSync(deploymentDir)) {
      fs.mkdirSync(deploymentDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(deploymentDir, `deployment-${network}-${timestamp}.json`);
    
    const report = {
      timestamp: new Date().toISOString(),
      network: network,
      deployer: this.wallet.address,
      deployments: this.deployments
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`Deployment report saved: ${reportPath}`);

    // Also save a simple address mapping for easy access
    const addressMap = {};
    this.deployments.forEach(d => {
      addressMap[d.symbol] = {
        address: d.address,
        decimals: d.decimals
      };
    });

    const addressPath = path.join(deploymentDir, 'latest-addresses.json');
    fs.writeFileSync(addressPath, JSON.stringify(addressMap, null, 2));
    console.log(`Address mapping saved: ${addressPath}`);
  }

  async deploy() {
    console.log('\n════════════════════════════════════════════════════════');
    console.log('                  ERC20 TOKEN DEPLOYMENT                    ');
    console.log('════════════════════════════════════════════════════════\n');

    try {
      // Get network info
      const networkInfo = await this.getNetworkInfo();
      console.log(`Network: ${networkInfo.name} (Chain ID: ${networkInfo.chainId})`);
      console.log(`Deployer: ${this.wallet.address}`);
      console.log(`Balance: ${networkInfo.deployerBalance} ETH\n`);

      // Load token configurations
      const config = await this.loadTokenConfig();
      console.log(`Tokens to deploy: ${config.tokens.length}\n`);

      // Compile contract
      await this.compileContract();

      // Deploy each token
      for (const token of config.tokens) {
        try {
          await this.deployToken(token);
        } catch (error) {
          console.error(`Failed to deploy ${token.name}:`, error.message);
          if (config.continueOnError) {
            continue;
          } else {
            throw error;
          }
        }
      }

      // Summary
      console.log('════════════════════════════════════════════════════════');
      console.log('                  DEPLOYMENT SUMMARY                     ');
      console.log('════════════════════════════════════════════════════════\n');

      if (this.deployments.length > 0) {
        console.log('✓ Successfully Deployed:');
        this.deployments.forEach(d => {
          console.log(`  ${d.symbol}: ${d.address}`);
          console.log(`    Name: ${d.name}`);
          console.log(`    Initial Supply: ${d.initialSupply} (${d.decimals} decimals)`);
          const features = [];
          if (d.mintable) features.push('Mintable');
          if (d.burnable) features.push('Burnable');
          if (d.pausable) features.push('Pausable');
          if (features.length > 0) {
            console.log(`    Features: ${features.join(', ')}`);
          }
          console.log('');
        });

        // Save deployment report
        this.saveDeploymentReport(config.network || networkInfo.name);
      } else {
        console.log('No tokens were deployed successfully.');
      }

    } catch (error) {
      console.error('\n✗ Deployment failed:', error.message);
      process.exit(1);
    }
  }
}

// Main execution
async function main() {
  const deployer = new TokenDeployer();
  await deployer.deploy();
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = TokenDeployer;
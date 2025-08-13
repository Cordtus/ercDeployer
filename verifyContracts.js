// verifyContracts.js - Optional Etherscan verification script
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const ETHERSCAN_APIS = {
  mainnet: 'https://api.etherscan.io/api',
  sepolia: 'https://api-sepolia.etherscan.io/api',
  goerli: 'https://api-goerli.etherscan.io/api',
  polygon: 'https://api.polygonscan.com/api',
  bsc: 'https://api.bscscan.com/api',
  arbitrum: 'https://api.arbiscan.io/api',
  optimism: 'https://api-optimistic.etherscan.io/api',
  avalanche: 'https://api.snowtrace.io/api'
};

class ContractVerifier {
  constructor(network, apiKey) {
    this.network = network;
    this.apiKey = apiKey;
    this.apiUrl = ETHERSCAN_APIS[network] || ETHERSCAN_APIS.mainnet;
  }

  async loadDeploymentReport() {
    const deploymentDir = path.join(__dirname, 'deployments');
    const files = fs.readdirSync(deploymentDir);
    
    // Find the most recent deployment file
    const deploymentFiles = files.filter(f => f.startsWith('deployment-') && f.endsWith('.json'));
    if (deploymentFiles.length === 0) {
      throw new Error('No deployment files found');
    }
    
    deploymentFiles.sort().reverse();
    const latestFile = deploymentFiles[0];
    
    const reportPath = path.join(deploymentDir, latestFile);
    return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  }

  async loadContractSource() {
    const contractPath = path.join(__dirname, 'contracts', 'ERC20Token.sol');
    return fs.readFileSync(contractPath, 'utf8');
  }

  async verifyContract(deployment) {
    console.log(`Verifying ${deployment.symbol} at ${deployment.address}...`);

    try {
      const sourceCode = await this.loadContractSource();
      
      // Prepare constructor arguments
      const constructorArgs = this.encodeConstructorArgs(deployment);

      // Submit verification request
      const response = await axios.post(this.apiUrl, {
        apikey: this.apiKey,
        module: 'contract',
        action: 'verifysourcecode',
        contractaddress: deployment.address,
        sourceCode: sourceCode,
        codeformat: 'solidity-single-file',
        contractname: 'ERC20Token',
        compilerversion: 'v0.8.20+commit.a1b79de6',
        optimizationUsed: 1,
        runs: 200,
        constructorArguements: constructorArgs,
        evmversion: 'paris',
        licenseType: 3 // MIT
      });

      if (response.data.status === '1') {
        const guid = response.data.result;
        console.log(`  Verification submitted. GUID: ${guid}`);
        
        // Check verification status
        const status = await this.checkVerificationStatus(guid);
        if (status.success) {
          console.log(`  ✓ ${deployment.symbol} verified successfully!`);
          return true;
        } else {
          console.log(`  ✗ ${deployment.symbol} verification failed: ${status.message}`);
          return false;
        }
      } else {
        console.log(`  ✗ Failed to submit verification: ${response.data.result}`);
        return false;
      }
    } catch (error) {
      console.error(`  ✗ Error verifying ${deployment.symbol}:`, error.message);
      return false;
    }
  }

  encodeConstructorArgs(deployment) {
    // This would need proper ABI encoding - simplified version shown
    const { ethers } = require('ethers');
    const abiCoder = new ethers.AbiCoder();
    
    return abiCoder.encode(
      ['string', 'string', 'uint8', 'uint256', 'bool', 'bool', 'bool'],
      [
        deployment.name,
        deployment.symbol,
        deployment.decimals,
        ethers.parseUnits(deployment.initialSupply, deployment.decimals),
        deployment.mintable,
        deployment.burnable,
        deployment.pausable
      ]
    ).slice(2); // Remove 0x prefix
  }

  async checkVerificationStatus(guid, attempts = 30) {
    for (let i = 0; i < attempts; i++) {
      await this.sleep(3000); // Wait 3 seconds between checks
      
      try {
        const response = await axios.get(this.apiUrl, {
          params: {
            apikey: this.apiKey,
            module: 'contract',
            action: 'checkverifystatus',
            guid: guid
          }
        });

        if (response.data.status === '1') {
          return { success: true, message: 'Verified' };
        } else if (response.data.result === 'Pending in queue') {
          console.log('    Still pending...');
        } else {
          return { success: false, message: response.data.result };
        }
      } catch (error) {
        console.error('    Error checking status:', error.message);
      }
    }
    
    return { success: false, message: 'Verification timeout' };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async verifyAll() {
    if (!process.env.ETHERSCAN_API_KEY) {
      console.log('ETHERSCAN_API_KEY not found in .env - skipping verification');
      return;
    }

    console.log('\n════════════════════════════════════════════════════════');
    console.log('              ETHERSCAN CONTRACT VERIFICATION              ');
    console.log('════════════════════════════════════════════════════════\n');

    try {
      const report = await this.loadDeploymentReport();
      console.log(`Network: ${report.network}`);
      console.log(`Contracts to verify: ${report.deployments.length}\n`);

      const results = {
        verified: [],
        failed: []
      };

      for (const deployment of report.deployments) {
        const success = await this.verifyContract(deployment);
        if (success) {
          results.verified.push(deployment.symbol);
        } else {
          results.failed.push(deployment.symbol);
        }
        
        // Rate limiting
        await this.sleep(1000);
      }

      console.log('\n════════════════════════════════════════════════════════');
      console.log('                  VERIFICATION SUMMARY                     ');
      console.log('════════════════════════════════════════════════════════\n');
      
      if (results.verified.length > 0) {
        console.log('✓ Verified:', results.verified.join(', '));
      }
      
      if (results.failed.length > 0) {
        console.log('✗ Failed:', results.failed.join(', '));
      }

      // Save verification results
      const verificationReport = {
        timestamp: new Date().toISOString(),
        network: report.network,
        results: results
      };

      const reportPath = path.join(__dirname, 'deployments', 'verification-report.json');
      fs.writeFileSync(reportPath, JSON.stringify(verificationReport, null, 2));
      console.log(`\nVerification report saved: ${reportPath}`);

    } catch (error) {
      console.error('Verification failed:', error.message);
    }
  }
}

// Main execution
async function main() {
  const network = process.argv[2] || 'mainnet';
  const apiKey = process.env.ETHERSCAN_API_KEY;

  if (!apiKey) {
    console.error('Error: ETHERSCAN_API_KEY not found in .env file');
    console.log('Add ETHERSCAN_API_KEY=your_api_key to your .env file');
    process.exit(1);
  }

  const verifier = new ContractVerifier(network, apiKey);
  await verifier.verifyAll();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = ContractVerifier;
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-web3"); //For openzeppelin
require('@openzeppelin/hardhat-upgrades');
require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-waffle");
require("solidity-coverage");
require('hardhat-dependency-compiler');


const loadJsonFile = require('load-json-file')
const keys = loadJsonFile.sync("./keys.json")

module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
    },
    testnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      gasPrice: 20000000000,
      accounts: [keys.networks.ropsten.privateKey]
    },
    mainnet: {
      url: "https://bsc-dataseed.binance.org/",
      chainId: 56,
      gasPrice: 20000000000,
      accounts: [keys.networks.mainnet.privateKey]
    }
  },
  solidity: {
    compilers: [
      {
        version: "0.6.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      },
      {
        version: "0.5.16",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      }
    ]    
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  mocha: {
    timeout: 20000
  },
  dependencyCompiler: {
    paths: [
      '@uniswap/v2-periphery/contracts/UniswapV2Router02.sol',
      '@uniswap/v2-core/contracts/UniswapV2Factory.sol'
    ],
  }
}
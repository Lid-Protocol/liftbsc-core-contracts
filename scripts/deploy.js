const { BigNumber } = require("ethers")
const { ethers, upgrades } = require("hardhat")
const loadJsonFile = require('load-json-file')
const settings = loadJsonFile.sync("./scripts/settings.json").networks.ropsten


async function main() {

    //Silences "struct" warnings
    //WARNING: do NOT add new properties, structs, mappings etc to these contracts in upgrades.
    upgrades.silenceWarnings()

    // We get the contract to deploy
    const LiftoffSettings = await ethers.getContractFactory("LiftoffSettings")
    const LiftoffEngine = await ethers.getContractFactory("LiftoffEngine")
    const LiftoffInsurance = await ethers.getContractFactory("LiftoffInsurance")
    const LiftoffRegistration = await ethers.getContractFactory("LiftoffRegistration")
    const LiftoffPartnerships = await ethers.getContractFactory("LiftoffPartnerships")

    console.log("Starting deployments...")

    const liftoffSettings = await upgrades.deployProxy(LiftoffSettings, [], {unsafeAllowCustomTypes: true})
    await liftoffSettings.deployed()
    console.log("LiftoffSettings deployed to:", liftoffSettings.address)

    const liftoffEngine = await upgrades.deployProxy(LiftoffEngine, [liftoffSettings.address], {unsafeAllowCustomTypes: true})
    await liftoffEngine.deployed()
    console.log("LiftoffEngine deployed to:", liftoffEngine.address)

    const liftoffInsurance = await upgrades.deployProxy(LiftoffInsurance, [liftoffSettings.address], {unsafeAllowCustomTypes: true})
    await liftoffInsurance.deployed()
    console.log("LiftoffInsurance deployed to:", liftoffInsurance.address)

    const liftoffPartnerships = await upgrades.deployProxy(LiftoffPartnerships, [addresses.LiftoffSettings], {unsafeAllowCustomTypes: true});
    await liftoffPartnerships.deployed();
    console.log("LiftoffPartnerships deployed to:", liftoffPartnerships.address);

    const liftoffRegistration = await upgrades.deployProxy(LiftoffRegistration, [
        settings.minTimeToLaunch,
        settings.maxTimeToLaunch,
        settings.softCapTimer,
        liftoffEngine.address
      ], {unsafeAllowCustomTypes: true})
    await liftoffRegistration.deployed()
    console.log("LiftoffRegistration deployed to:", liftoffRegistration.address)

    console.log("setting uints")
    await liftoffSettings.setAllUints(
      settings.busdLockBP,
      settings.tokenUserBP,
      settings.insurancePeriod,
      settings.baseFeeBP,
      settings.ethBuyBP,
      settings.projectDevBP,
      settings.mainFeeBP,
      settings.lidPoolBP,
      settings.airdropBP
    )

    console.log("setting addresses")
    await liftoffSettings.setAllAddresses(
      liftoffInsurance.address,
      liftoffRegistration.address,
      liftoffEngine.address,
      liftoffPartnerships.address,
      settings.busd,
      settings.uniswapRouter,
      settings.uniswapFactory,
      settings.lidTreasury,
      settings.lidPoolManager,
      settings.airdropDistributor
    )
  }
  
  main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error)
      process.exit(1)
    });
  
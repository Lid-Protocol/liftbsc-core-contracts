const chai = require("chai");
const { solidity } = require("ethereum-waffle");
const { expect } = chai;
const { time } = require("@openzeppelin/test-helpers");

chai.use(solidity);

describe('LiftoffSettings', function () {
  let liftoffSettings;

  before(async function () {
    LiftoffSettings = await ethers.getContractFactory("LiftoffSettings");
    liftoffSettings = await upgrades.deployProxy(LiftoffSettings, []);
    await liftoffSettings.deployed();
  });

  it('setAllUints', async function () {
    await liftoffSettings.setAllUints(
      240,
      7931,
      time.duration.days(7).toNumber(),
      200,
      1500,
      7200,
      317,
      543
    );
    expect(await liftoffSettings.getBusdLockBP()).to.equal(240);
    expect(await liftoffSettings.getTokenUserBP()).to.equal(7931);
    expect(await liftoffSettings.getInsurancePeriod()).to.equal(time.duration.days(7).toNumber());
    expect(await liftoffSettings.getBaseFeeBP()).to.equal(200);
    expect(await liftoffSettings.getEthBuyBP()).to.equal(1500);
    expect(await liftoffSettings.getProjectDevBP()).to.equal(7200);
    expect(await liftoffSettings.getMainFeeBP()).to.equal(317);
    expect(await liftoffSettings.getLidPoolBP()).to.equal(543);
  });

  it('setAllAddresses', async function () {
    const [
      liftoffInsurance,
      liftoffRegistration,
      liftoffEngine,
      liftoffPartnerships,
      busd,
      uniswapRouter,
      uniswapFactory,
      lidTreasury,
      lidPoolManager
    ] = await ethers.getSigners();
    await liftoffSettings.setAllAddresses(
      liftoffInsurance.address,
      liftoffRegistration.address,
      liftoffEngine.address,
      liftoffPartnerships.address,
      busd.address,
      uniswapRouter.address,
      uniswapFactory.address,
      lidTreasury.address,
      lidPoolManager.address
    );
    expect(await liftoffSettings.getLiftoffInsurance()).to.equal(liftoffInsurance.address);
    expect(await liftoffSettings.getLiftoffRegistration()).to.equal(liftoffRegistration.address);
    expect(await liftoffSettings.getLiftoffEngine()).to.equal(liftoffEngine.address);
    expect(await liftoffSettings.getLiftoffPartnerships()).to.equal(liftoffPartnerships.address);
    expect(await liftoffSettings.getBUSD()).to.equal(busd.address);
    expect(await liftoffSettings.getUniswapRouter()).to.equal(uniswapRouter.address);
    expect(await liftoffSettings.getUniswapFactory()).to.equal(uniswapFactory.address);
    expect(await liftoffSettings.getLidTreasury()).to.equal(lidTreasury.address);
    expect(await liftoffSettings.getLidPoolManager()).to.equal(lidPoolManager.address);
  });

  it('set/get TokenUserBP', async function () {
    await liftoffSettings.setTokenUserBP(1000);
    expect(await liftoffSettings.getTokenUserBP()).to.equal(1000);
  });

  it('set/get LiftoffInsurance', async function () {
    const [liftOffInsurance] = await ethers.getSigners();
    await liftoffSettings.setLiftoffInsurance(liftOffInsurance.address);
    expect(await liftoffSettings.getLiftoffInsurance()).to.equal(liftOffInsurance.address);
  });

  it('set/get LiftOffRegistration', async function () {
    const [liftOffRegistration] = await ethers.getSigners();
    await liftoffSettings.setLiftoffRegistration(liftOffRegistration.address);
    expect(await liftoffSettings.getLiftoffRegistration()).to.equal(liftOffRegistration.address);
  });

  it('set/get LiftoffEngine', async function () {
    const [liftOffEngine] = await ethers.getSigners();
    await liftoffSettings.setLiftoffEngine(liftOffEngine.address);
    expect(await liftoffSettings.getLiftoffEngine()).to.equal(liftOffEngine.address);
  });

  it('set/get LiftoffPartnerships', async function () {
    const [liftoffPartnerships] = await ethers.getSigners();
    await liftoffSettings.setLiftoffPartnerships(liftoffPartnerships.address);
    expect(await liftoffSettings.getLiftoffPartnerships()).to.equal(liftoffPartnerships.address);
  });

  it('set/get BUSD', async function () {
    const [busd] = await ethers.getSigners();
    await liftoffSettings.setBUSD(busd.address);
    expect(await liftoffSettings.getBUSD()).to.equal(busd.address);
  });

  it('set/get UniswapRouter', async function () {
    const [uniswapRouter] = await ethers.getSigners();
    await liftoffSettings.setUniswapRouter(uniswapRouter.address);
    expect(await liftoffSettings.getUniswapRouter()).to.equal(uniswapRouter.address);
  });

  it('set/get UniswapFactory', async function () {
    const [uniswapFactory] = await ethers.getSigners();
    await liftoffSettings.setUniswapFactory(uniswapFactory.address);
    expect(await liftoffSettings.getUniswapFactory()).to.equal(uniswapFactory.address);
  });

  it('set/get InsurancePeriod', async function () {
    await liftoffSettings.setInsurancePeriod(time.duration.days(7).toNumber());
    expect(await liftoffSettings.getInsurancePeriod()).to.equal(time.duration.days(7).toNumber());
  });

  it('set/get LidTreasury', async function () {
    const [lidTreasury] = await ethers.getSigners();
    await liftoffSettings.setLidTreasury(lidTreasury.address);
    expect(await liftoffSettings.getLidTreasury()).to.equal(lidTreasury.address);
  });

  it('set/get LidPoolManager', async function () {
    const [lidPoolManager] = await ethers.getSigners();
    await liftoffSettings.setLidPoolManager(lidPoolManager.address);
    expect(await liftoffSettings.getLidPoolManager()).to.equal(lidPoolManager.address);
  });

  it('setBusdBP should revert if sum of BP params is less than 10000', async function () {
    await expect(liftoffSettings.setBusdBP(500, 1000, 2000, 3000, 2000, 1000)).to.be.revertedWith("Must allocate 100% of eth raised");
  });

  it('set/get BusdBP Params', async function () {
    await liftoffSettings.setBusdBP(500, 500, 2000, 3000, 2000, 2000);
    expect(await liftoffSettings.getBusdLockBP()).to.equal(500);
    expect(await liftoffSettings.getBaseFeeBP()).to.equal(500);
    expect(await liftoffSettings.getEthBuyBP()).to.equal(2000);
    expect(await liftoffSettings.getProjectDevBP()).to.equal(3000);
    expect(await liftoffSettings.getMainFeeBP()).to.equal(2000);
    expect(await liftoffSettings.getLidPoolBP()).to.equal(2000);
  });
});
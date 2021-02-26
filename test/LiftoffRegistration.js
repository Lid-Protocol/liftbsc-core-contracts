const { expect } = require('chai');
const { ether, time } = require("@openzeppelin/test-helpers");

describe('LiftoffRegistration', function () {
  let liftoffRegistration;

  before(async function () {
    LiftoffSettings = await ethers.getContractFactory("LiftoffSettings");
    liftoffSettings = await upgrades.deployProxy(LiftoffSettings, []);
    await liftoffSettings.deployed();
    
    LiftoffEngine = await ethers.getContractFactory("LiftoffEngine");
    liftoffEngine = await upgrades.deployProxy(LiftoffEngine, [liftoffSettings.address], { unsafeAllowCustomTypes: true });
    await liftoffEngine.deployed();

    LiftoffRegistration = await ethers.getContractFactory("LiftoffRegistration");
    liftoffRegistration = await upgrades.deployProxy(
      LiftoffRegistration, 
      [time.duration.hours(24).toNumber(), 
        time.duration.days(7).toNumber(), 
        time.duration.hours(24).toNumber(), 
        liftoffEngine.address]
      );
    await liftoffRegistration.deployed();

    await liftoffSettings.setLiftoffRegistration(liftoffRegistration.address);
  });
 
  describe('registerProject', async function () {
    it('should revert if launchTime is before minLaunchTime', async function () {
      const currentTime = await time.latest();
      await expect(liftoffRegistration.registerProject(
        "QmWWQSuPMS6aXCbZKpEjPHPUZN2NjB3YrhJTHsV4X3vb2t", 
        currentTime.toNumber(), 
        ether("1000").toString(),
        ether("3000").toString(),
        ether("10").toString(),
        "TestToken", 
        "tkn"
      )).to.be.revertedWith("Not allowed to launch before minLaunchTime");
    });

    it('should revert if launchTime is after maxLaunchTime', async function () {
      await time.increase(time.duration.days(14));
      await time.advanceBlock();
      const currentTime = await time.latest();
      await expect(liftoffRegistration.registerProject(
        "QmWWQSuPMS6aXCbZKpEjPHPUZN2NjB3YrhJTHsV4X3vb2t", 
        currentTime.toNumber() + time.duration.days(8).toNumber(), 
        ether("1000").toString(),
        ether("3000").toString(),
        ether("10").toString(),
        "TestToken", 
        "tkn"
      )).to.be.revertedWith("Not allowed to launch after maxLaunchTime");
    });

    it('Should revert if fixedRateWad is less than minimum', async function () {
      await time.increase(time.duration.days(1));
      await time.advanceBlock();
      const currentTime = await time.latest();
      await expect(liftoffRegistration.registerProject(
        "QmWWQSuPMS6aXCbZKpEjPHPUZN2NjB3YrhJTHsV4X3vb2t", 
        currentTime.toNumber() + time.duration.days(2).toNumber(), 
        ether("1000").toString(),
        ether("3000").toString(),
        ether("0.0000000009").toString(),
        "TestToken", 
        "tkn"
      )).to.be.revertedWith("FixedRateWad is less than minimum");
    });

    it('Should revert if fixedRateWad is more than maximum', async function () {
      const currentTime = await time.latest();
      await expect(liftoffRegistration.registerProject(
        "QmWWQSuPMS6aXCbZKpEjPHPUZN2NjB3YrhJTHsV4X3vb2t", 
        currentTime.toNumber() + time.duration.days(2).toNumber(), 
        ether("1000").toString(),
        ether("3000").toString(),
        ether("1000000000.1").toString(),
        "TestToken", 
        "tkn"
      )).to.be.revertedWith("FixedRateWad is more than maximum");
    });

    it('should revert if softcap is less than 10 ether', async function () {
      const currentTime = await time.latest();
      await expect(liftoffRegistration.registerProject(
        "QmWWQSuPMS6aXCbZKpEjPHPUZN2NjB3YrhJTHsV4X3vb2t", 
        currentTime.toNumber() + time.duration.days(2).toNumber(), 
        ether("9").toString(),
        ether("3000").toString(),
        ether("10").toString(),
        "TestToken", 
        "tkn"
      )).to.be.revertedWith("Cannot launch if softcap is less than 10 ether");
    });

    it('success', async function () {
      const currentTime = await time.latest();
      await liftoffRegistration.registerProject(
        "QmWWQSuPMS6aXCbZKpEjPHPUZN2NjB3YrhJTHsV4X3vb2t", 
        currentTime.toNumber() + time.duration.days(2).toNumber(), 
        ether("1000").toString(),
        ether("3000").toString(),
        ether("10").toString(),
        "TestToken", 
        "tkn"
      );
    });
  });
});
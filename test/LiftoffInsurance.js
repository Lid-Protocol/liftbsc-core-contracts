const chai = require('chai');
const { solidity } = require("ethereum-waffle");
const { expect } = chai;
const { ether, time, BN } = require("@openzeppelin/test-helpers");
const { UniswapDeployAsync } = require("../tools/UniswapDeployAsync");
const loadJsonFile = require('load-json-file');
const settings = loadJsonFile.sync("./scripts/settings.json").networks.hardhat;

chai.use(solidity);

describe('LiftoffInsurance', function () {
  let liftoffSettings, liftoffEngine, liftoffPartnerships;
  let liftoffInsurance, sweepReceiver, projectDev, ignitor1, ignitor2, ignitor3, partner1, partner2;
  let IERC20;

  before(async function () {
    const accounts = await ethers.getSigners();
    liftoffRegistration = accounts[0];
    sweepReceiver = accounts[1];
    projectDev = accounts[2];
    ignitor1 = accounts[3];
    ignitor2 = accounts[4];
    ignitor3 = accounts[5];
    lidTreasury = accounts[6];
    lidPoolManager = accounts[7];
    partner1 = accounts[8];
    partner2 = accounts[9];

    upgrades.silenceWarnings();

    IERC20 = await ethers.getContractAt("@uniswap/v2-core/contracts/interfaces/IERC20.sol:IERC20",ethers.constants.AddressZero)

    const { uniswapV2Router02, uniswapV2Factory } = await UniswapDeployAsync(ethers);

    LiftoffSettings = await ethers.getContractFactory("LiftoffSettings");
    liftoffSettings = await upgrades.deployProxy(LiftoffSettings, []);
    await liftoffSettings.deployed();

    LiftoffInsurance = await ethers.getContractFactory("LiftoffInsurance");
    liftoffInsurance = await upgrades.deployProxy(LiftoffInsurance, [liftoffSettings.address], { unsafeAllowCustomTypes: true });
    await liftoffInsurance.deployed();    

    LiftoffEngine = await ethers.getContractFactory("LiftoffEngine");
    liftoffEngine = await upgrades.deployProxy(LiftoffEngine, [liftoffSettings.address], { unsafeAllowCustomTypes: true });
    await liftoffEngine.deployed(); 

    LiftoffPartnerships = await ethers.getContractFactory("LiftoffPartnerships");
    liftoffPartnerships = await upgrades.deployProxy(LiftoffPartnerships, [liftoffSettings.address], { unsafeAllowCustomTypes: true });
    await liftoffPartnerships.deployed();

    BUSD = await ethers.getContractFactory("ERC20Blacklist");
    busd = await BUSD.deploy("TestToken", "TKN", ether("3000").toString(), liftoffEngine.address);
    await busd.deployed();

    await liftoffSettings.setAllUints(
      settings.busdLockBP,
      settings.tokenUserBP,
      settings.insurancePeriod,
      settings.baseFeeBP,
      settings.ethBuyBP,
      settings.projectDevBP,
      settings.mainFeeBP,
      settings.lidPoolBP
    );

    await liftoffSettings.setAllAddresses(
      liftoffInsurance.address,
      liftoffRegistration.address,
      liftoffEngine.address,
      liftoffPartnerships.address,
      busd.address,
      uniswapV2Router02.address,
      uniswapV2Factory.address,
      lidTreasury.address,
      lidPoolManager.address
    );
  });

  describe("Stateless", function() {
    let tokenSaleId, tokenSaleId2;
    describe("setLiftoffSettings", function() {
      it("Should revert if not owner", async function() {
        let contract = liftoffInsurance.connect(projectDev);
        await expect(
          contract.setLiftoffSettings(liftoffSettings.address)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
      it("Should set insurance liftoff settings", async function() {
        await liftoffInsurance.setLiftoffSettings(liftoffSettings.address);
        const settingsAddress = await liftoffInsurance.liftoffSettings();
        expect(settingsAddress.toString()).to.be.eq(liftoffSettings.address.toString())
      })
    })
    describe("isInsuranceExhausted", function() {
      let currentTime, startTime, insurancePeriod, busdValue, 
        claimedBusd, baseBusd, redeemedBusd, isUnwound;
      before(async function () {
        startTime = await time.latest();
        insurancePeriod = new BN(settings.insurancePeriod);
        currentTime = startTime.add(insurancePeriod).add(time.duration.days(1));
        busdValue = ether("10");
        baseBusd = ether("100");
        redeemedBusd = ether("75");
        claimedBusd = ether("20");
        isUnwound = false;
      });
      it("Should be true if not isUnwound, currentTime > startTime+insurancePeriod, and baseBusd < redeemedBusd + claimedBusd + busdValue", async function() {
        const isExhausted = await liftoffInsurance.isInsuranceExhausted(
          currentTime.toString(),
          startTime.toString(),
          insurancePeriod.toString(),
          busdValue.toString(),
          baseBusd.toString(),
          redeemedBusd.toString(),
          claimedBusd.toString(),
          isUnwound
        );
        expect(isExhausted).to.be.true;
      });
      it("Should be false if isUnwound", async function() {
        const isExhausted = await liftoffInsurance.isInsuranceExhausted(
          currentTime.toString(),
          startTime.toString(),
          insurancePeriod.toString(),
          busdValue.toString(),
          baseBusd.toString(),
          redeemedBusd.toString(),
          claimedBusd.toString(),
          true
        );
        expect(isExhausted).to.be.false;
      });
      it("Should be false if currentTime <= startTime+insurancePeriod", async function() {
        const isExhausted = await liftoffInsurance.isInsuranceExhausted(
          startTime.add(insurancePeriod).toString(),
          startTime.toString(),
          insurancePeriod.toString(),
          busdValue.toString(),
          baseBusd.toString(),
          redeemedBusd.toString(),
          claimedBusd.toString(),
          isUnwound
        );
        expect(isExhausted).to.be.false;
      });
      it("Should be false if baseBusd > redeemedBusd + busdValue + claimedBusd", async function() {
        const isExhausted = await liftoffInsurance.isInsuranceExhausted(
          currentTime.toString(),
          startTime.toString(),
          insurancePeriod.toString(),
          busdValue.toString(),
          baseBusd.toString(),
          ether("0").toString(),
          claimedBusd.toString(),
          isUnwound
        );
        expect(isExhausted).to.be.false;
      });
    });
    describe("canCreateInsurance", function() {
      let insuranceIsInitialized, tokenIsRegistered;
      before(async function() {
        insuranceIsInitialized = false;
        tokenIsRegistered = true;
      });
      it("Should be true if not insuranceIsInitialized and is tokenRegistered", async function() {
        const canCreateInsurance = await liftoffInsurance.canCreateInsurance(
          insuranceIsInitialized,
          tokenIsRegistered
        );
        expect(canCreateInsurance).to.be.true;
      });
      it("Should be false if insuranceIsInitialized", async function() {
        const canCreateInsurance = await liftoffInsurance.canCreateInsurance(
          true,
          tokenIsRegistered
        );
        expect(canCreateInsurance).to.be.false;
      });
      it("Should be false if not tokenRegistered", async function() {
        const canCreateInsurance = await liftoffInsurance.canCreateInsurance(
          insuranceIsInitialized,
          false
        );
        expect(canCreateInsurance).to.be.false;
      });
    });
    describe("getRedeemValue", function() {
      it("Should be equal to amount divided by tokens/busd when price is above one", async function() {
        const amount = ether("3193.12321");
        const tokensPerEthWad = ether("3241.2313");
        const redeemValue = await liftoffInsurance.getRedeemValue(
          amount.toString(),
          tokensPerEthWad.toString()
        );
        const expectedAmount = amount.mul(ether("1")).div(tokensPerEthWad).toString();
        expect(redeemValue).to.be.bignumber.above(ether("0.8").toString());
        expect(redeemValue).to.be.bignumber.below(ether("1").toString());
        expect(redeemValue).to.be.bignumber.equal(expectedAmount);
      });
      it("Should be equal to amount divided by tokens/busd when price is below one", async function() {
        const amount = ether("0.12321");
        const tokensPerEthWad = ether("0.001313121187");
        const redeemValue = await liftoffInsurance.getRedeemValue(
          amount.toString(),
          tokensPerEthWad.toString()
        );
        const expectedAmount = amount.mul(ether("1")).div(tokensPerEthWad).toString();
        expect(redeemValue).to.be.bignumber.above(ether("80").toString());
        expect(redeemValue).to.be.bignumber.below(ether("100").toString());
        expect(redeemValue).to.be.bignumber.equal(expectedAmount);
      });
    });
    describe("getTotalTokenClaimable", function() {
      it("Should be 0 when cycles are 0", async function() {
        const totalClaimable = await liftoffInsurance.getTotalTokenClaimable(
          ether("12000").toString(),
          0,
          0
        );
        expect(totalClaimable).to.be.bignumber.equal(0);
      });
      it("Should be base*cycles/10-claimed when cycles less than 10", async function() {
        const base = ether("12000");
        const claimed = ether("3600");
        const cycles = new BN("6");
        const totalClaimable = await liftoffInsurance.getTotalTokenClaimable(
          base.toString(),
          cycles.toString(),
          claimed.toString()
        );
        expect(totalClaimable).to.be.bignumber.equal(base.mul(cycles).div(new BN("10")).sub(claimed).toString());
      });
      it("Should be base-claimed when cycles greater than 10", async function() {
        const base = ether("12000");
        const claimed = ether("3600");
        const cycles = new BN("11");
        const totalClaimable = await liftoffInsurance.getTotalTokenClaimable(
          base.toString(),
          cycles.toString(),
          claimed.toString()
        );
        expect(totalClaimable).to.be.bignumber.equal(base.sub(claimed).toString());
      });
    });
    describe("getTotalBusdClaimable", function() {
      let totalIgnited, redeemedBusd, claimedBusd;
      before(async function() {
        totalIgnited = ether("3500");
        redeemedBusd = ether("1200");
        claimedBusd = ether("230");
        cycles = new BN("3");
      })
      it("Should be 0 when cycles are 0", async function() {
        const totalClaimable = await liftoffInsurance.getTotalBusdClaimable(
          totalIgnited.toString(),
          redeemedBusd.toString(),
          claimedBusd.toString(),
          0
        );
        expect(totalClaimable).to.be.bignumber.equal(0);
      });
      it("Should be (total - redeemedBusd - claimedBusd)  * cycles / 10 - claimed when cycles are 3", async function() {
        const totalClaimable = await liftoffInsurance.getTotalBusdClaimable(
          totalIgnited.toString(),
          redeemedBusd.toString(),
          claimedBusd.toString(),
          cycles.toString()
        );
        const expectedValue = totalIgnited.sub(redeemedBusd).sub(claimedBusd).mul(cycles).div(new BN("10"));
        expect(totalClaimable).to.be.bignumber.equal(expectedValue.toString());
      });
      it("Should be (total - redeemedBusd - claimed when cycles are greater than 10", async function() {
        const totalClaimable = await liftoffInsurance.getTotalBusdClaimable(
          totalIgnited.toString(),
          redeemedBusd.toString(),
          claimedBusd.toString(),
          "12"
        );
        const expectedValue = totalIgnited.sub(redeemedBusd).sub(claimedBusd);
        expect(totalClaimable).to.be.bignumber.equal(expectedValue.toString());
      });
    });
  });
  describe("State: PreRegisteration", function() {
    describe("register", function() {
      it("should revert if sender is not liftoffEngine", async function() {
        await expect(
          liftoffInsurance.register(0)
        ).to.be.revertedWith("Sender must be Liftoff Engine")
      });
    });
    describe("redeem", function() {
      it("should revert if insurance is not initialized for tokenSaleId", async function() {
        await expect(
          liftoffInsurance.redeem(0,0)
        ).to.be.revertedWith("Insurance not initialized")
      });
    });
    describe("claim", function() {
      it("should revert if insurance is not initialized for tokenSaleId", async function() {
        await expect(
          liftoffInsurance.claim(0)
        ).to.be.revertedWith("Insurance not initialized")
      });
    });
    describe("createInsurance", function() {
      it("should revert if insurance is not initialized for tokenSaleId", async function() {
        await expect(
          liftoffInsurance.createInsurance(0)
        ).to.be.revertedWith("Cannot create insurance")
      });
    });
    describe("increaseInsuranceBonus", function() {
      it("should revert if not owner", async function() {
        await expect(
          liftoffInsurance.connect(ignitor1).increaseInsuranceBonus(0, ignitor1.address, 100)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      });
    });
    describe("decreaseInsuranceBonus", function() {
      it("should revert if not owner", async function() {
        await expect(
          liftoffInsurance.connect(ignitor1).decreaseInsuranceBonus(0, ignitor1.address, 100)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      });
    });
  });
  describe("State: Cycle 0", function() {
    let tokenInsurance, tokenSale;
    before(async function(){
      const currentTime = await time.latest();
      tokenSaleId = await liftoffEngine.launchToken(
        currentTime.toNumber() + time.duration.hours(1).toNumber(),
        currentTime.toNumber() + time.duration.days(7).toNumber(),
        ether("500").toString(),
        ether("1000").toString(),
        ether("10").toString(),
        "TestToken",
        "TKN",
        projectDev.address
      );
      await time.increase(
        time.duration.days(1)
      );
      await time.advanceBlock();

      await busd.transfer(ignitor1.address, ether("300").toString());
      let contract = busd.connect(ignitor1);
      await contract.approve(liftoffEngine.address, ether("300").toString());
      await liftoffEngine.connect(ignitor1).ignite(
        tokenSaleId.value,
        ignitor1.address,
        ether("300").toString()
      );
        await busd.transfer(ignitor2.address, ether("200").toString());
      contract = busd.connect(ignitor2);
      await contract.approve(liftoffEngine.address, ether("200").toString());
      await liftoffEngine.connect(ignitor2).ignite(
        tokenSaleId.value,
        ignitor2.address,
        ether("200").toString()
      );
      await busd.transfer(ignitor3.address, ether("600").toString());
      contract = busd.connect(ignitor3);
      await contract.approve(liftoffEngine.address, ether("600").toString());
      await liftoffEngine.connect(ignitor3).ignite(
        tokenSaleId.value,
        ignitor3.address,
        ether("600").toString()
      );
      await time.increase(
        time.duration.days(6)
      );
      await time.advanceBlock();
    });
    describe("register", function() {
      it("should register new token", async function() {
        await expect(liftoffEngine.spark(tokenSaleId.value))
        .to.emit(liftoffInsurance,'Register')
        .withArgs(tokenSaleId.value);
      });
      it("should set tokenIsRegistered[id] to true", async function() {
        const isRegistered = await liftoffInsurance.tokenIsRegistered(0);
        expect(isRegistered).to.be.true;
      });
    });
    describe("createInsurance", function() {
      let currentTime;
      before(async function() {
        await liftoffInsurance.createInsurance(tokenSaleId.value);
        currentTime = await time.latest();
        const tokenInsuranceUints = await liftoffInsurance.getTokenInsuranceUints(tokenSaleId.value);
        const tokenInsuranceOthers = await liftoffInsurance.getTokenInsuranceOthers(tokenSaleId.value);
        tokenInsurance = Object.assign({}, tokenInsuranceUints, tokenInsuranceOthers);
        tokenSale = await liftoffEngine.getTokenSaleForInsurance(tokenSaleId.value);
      });
      it("should revert if run again", async function() {
        await expect(
          liftoffInsurance.createInsurance(tokenSaleId.value)
        ).to.be.revertedWith("Cannot create insurance")
      });
      it("should revert if insurance is not initialized for tokenSaleId", async function() {
        await expect(
          liftoffInsurance.createInsurance(tokenSaleId.value+1)
        ).to.be.revertedWith("Cannot create insurance")
      });
      it("should set insuranceIsInitialized[tokensaleid] to true", async function () {
        const isInitialized = await liftoffInsurance.insuranceIsInitialized(tokenSaleId.value);
        expect(isInitialized).to.be.true;
      });
      it("should set tokenInsurance.startTime to current time.", async function() {
        expect(tokenInsurance.startTime).to.equal(currentTime.toNumber());
      });
      it("should set tokenInsurance.totalIgnited to liftoffEngine totalIgnited", async function() {
        expect(tokenInsurance.totalIgnited).to.equal(tokenSale.totalIgnited);
      });
      it("Should set tokensPerEthWad s.t. rewardSupply/tokensPerBusd = totalIgnited minus base fee", async function() {
        expect(tokenInsurance.tokensPerEthWad).to.be.gt(ether("0.01").toString());
        expect(tokenInsurance.tokensPerEthWad).to.be.lt(ether("100").toString());
        const calcValue = tokenSale.rewardSupply
          .mul(ether("1").toString())
          .div(tokenInsurance.tokensPerEthWad);
        const expValue = tokenInsurance.totalIgnited.mul(10000-settings.baseFeeBP).div(10000);
        expect(calcValue).to.be.lt(expValue);
        expect(calcValue).to.be.gt(expValue.sub(100));
      })
      it("should set baseBusd to total ignited minus buy", async function() {
        expect(tokenInsurance.baseBusd).to.equal(
          tokenSale.totalIgnited
          .mul(10000-settings.ethBuyBP).div(10000)
        );
      });
      it("should set baseTokenLidPool to insurance token balance", async function() {
        const token = IERC20.attach(tokenInsurance.deployed);
        const balance = await token.balanceOf(liftoffInsurance.address);
        expect(tokenInsurance.baseTokenLidPool).to.equal(balance);
      });
    });
    describe("redeem", function() {
      let token;
      before(async function() {
        await liftoffEngine.claimReward(tokenSaleId.value, ignitor1.address);
        await liftoffEngine.claimReward(tokenSaleId.value, ignitor2.address);
        await liftoffEngine.claimReward(tokenSaleId.value, ignitor3.address);
        token = IERC20.attach(tokenInsurance.deployed);
        await token.connect(ignitor1).approve(liftoffInsurance.address, ethers.constants.MaxUint256);
        await token.connect(ignitor2).approve(liftoffInsurance.address, ethers.constants.MaxUint256);
        await token.connect(ignitor3).approve(liftoffInsurance.address, ethers.constants.MaxUint256);
      })
      it("should refund all deposited busd minus base fee when all tokens redeemed", async function() {
        const tokenBalance = await token.balanceOf(ignitor1.address);
        await liftoffInsurance.connect(ignitor1).redeem(tokenSaleId.value, tokenBalance);
        const busdBalance = await busd.balanceOf(ignitor1.address);
        const expectedRedeemValue = ethers.utils.parseEther("300")
          .mul(10000-settings.baseFeeBP)
          .div(10000)
        expect(busdBalance).to.be.lt(expectedRedeemValue);
        expect(busdBalance).to.be.gt(expectedRedeemValue.sub(100));
      });
      it("should refund all deposited busd minus base fee when all tokens redeemed in 2 parts", async function() {
        let tokenBalance = await token.balanceOf(ignitor2.address);
        await liftoffInsurance.connect(ignitor2).redeem(tokenSaleId.value, tokenBalance.div(2));
        tokenBalance = await token.balanceOf(ignitor2.address);
        await liftoffInsurance.connect(ignitor2).redeem(tokenSaleId.value, tokenBalance);
        const busdBalance = await busd.balanceOf(ignitor2.address);
        const expectedRedeemValue = ethers.utils.parseEther("200")
          .mul(10000-settings.baseFeeBP)
          .div(10000)
        expect(busdBalance).to.be.lt(expectedRedeemValue);
        expect(busdBalance).to.be.gt(expectedRedeemValue.sub(100));
      });
      it("should trigger unwind if all redeemed busd is greater than baseBusd", async function() {
        let tokenBalance = await token.balanceOf(ignitor3.address);
        await liftoffInsurance.connect(ignitor3).redeem(tokenSaleId.value, tokenBalance.div(2));
        tokenBalance = await token.balanceOf(ignitor3.address);
        // Following redeem doesn't work atm since insurance doesn't have enough busd to pay even though swap happened
        const preBusdBalance = await busd.balanceOf(ignitor3.address);
        await liftoffInsurance.connect(ignitor3).redeem(tokenSaleId.value, tokenBalance);
        const tokenInsuranceOthers = await liftoffInsurance.getTokenInsuranceOthers(tokenSaleId.value);
        const tokenInsuranceUnits = await liftoffInsurance.getTokenInsuranceUints(tokenSaleId.value);
        const expectedRedeemValue = await liftoffInsurance.getRedeemValue(tokenBalance, tokenInsuranceUnits.tokensPerEthWad);
        const busdBalance = await busd.balanceOf(ignitor3.address);
        expect(busdBalance).to.be.bignumber.equal(preBusdBalance.add(expectedRedeemValue));
        expect(tokenInsuranceOthers.isUnwound).to.be.true;
      });
    });
    describe("claim", function() {
      before(async function() {
        const currentTime = await time.latest();
      await liftoffEngine.launchToken(
        currentTime.toNumber() + time.duration.hours(1).toNumber(),
        currentTime.toNumber() + time.duration.days(7).toNumber(),
        ether("50").toString(),
        ether("100").toString(),
        ether("10").toString(),
        "TestToken2",
        "TKN2",
        projectDev.address
      );
      const tokenSaleId = (await liftoffEngine.totalTokenSales()).sub(1);
      await liftoffPartnerships.setPartner(0, partner1.address, "QmWWQSuPMS6aXCbZKpEjPHPUZN2NjB3YrhJTHsV4X3vb2t")
      await liftoffPartnerships.setPartner(1, partner2.address, "QmWWQSuPMS6aXCbZKpEjPHPUZN2NjB3YrhJTHsV4X3vb2t")
      await liftoffPartnerships.requestPartnership(0, tokenSaleId, 150)
      await liftoffPartnerships.requestPartnership(1, tokenSaleId, 200)
      await liftoffPartnerships.acceptPartnership(tokenSaleId, 0)
      await liftoffPartnerships.acceptPartnership(tokenSaleId, 1)
      await time.increase(
        time.duration.days(1)
      );
      await time.advanceBlock();
      await busd.transfer(ignitor1.address, ether("30").toString());
      let contract = busd.connect(ignitor1);
      await contract.approve(liftoffEngine.address, ether("30").toString());
      await liftoffEngine.connect(ignitor1).ignite(
        tokenSaleId,
        ignitor1.address,
        ether("30").toString()
      );
        await busd.transfer(ignitor2.address, ether("20").toString());
      contract = busd.connect(ignitor2);
      await contract.approve(liftoffEngine.address, ether("20").toString());
      await liftoffEngine.connect(ignitor2).ignite(
        tokenSaleId,
        ignitor2.address,
        ether("20").toString()
      );
      await busd.transfer(ignitor3.address, ether("60").toString());
      contract = busd.connect(ignitor3);
      await contract.approve(liftoffEngine.address, ether("60").toString());
      await liftoffEngine.connect(ignitor3).ignite(
        tokenSaleId,
        ignitor3.address,
        ether("60").toString()
      );
      await time.increase(
        time.duration.days(6)
      );
      await time.advanceBlock();
      await liftoffEngine.spark(1);
      await liftoffInsurance.createInsurance(1);
      await liftoffEngine.claimReward(1, ignitor1.address);
      await liftoffEngine.claimReward(1, ignitor2.address);
      await liftoffEngine.claimReward(1, ignitor3.address);
      });
      it("Should claim base fee, even if unwound",async function() {
        await liftoffInsurance.claim(0);
        const treasuryBalance =  await busd.balanceOf(lidTreasury.address);
        expect(
          treasuryBalance
        ).to.eq(
          ethers.utils.parseEther("1000").mul(settings.baseFeeBP-30).div(10000)
        );
        expect(treasuryBalance).to.be.gt(ethers.utils.parseEther("10"));
        expect(treasuryBalance).to.be.lt(ethers.utils.parseEther("100"));
      });
      it("Should revert if unwound and not claiming base fee",async function() {
        await expect(
          liftoffInsurance.claim(0)
        ).to.be.revertedWith("Token insurance is unwound.")
      });
      it("Should revert if not unwound an base fee already claimed", async function() {
        await liftoffInsurance.claim(1);
        await expect(liftoffInsurance.claim(1)).to.be.revertedWith("Cannot claim until after first cycle ends.");
      });
    });
  });
  describe("State: Insurance Cycle 1", function() {
    let token;
    before(async function() {
      token = IERC20.attach(
          (
            await liftoffInsurance.getTokenInsuranceOthers(1)
          ).deployed
        );
      await token.connect(ignitor1).approve(liftoffInsurance.address, ethers.constants.MaxUint256);
      await token.connect(ignitor2).approve(liftoffInsurance.address, ethers.constants.MaxUint256);
      await token.connect(ignitor3).approve(liftoffInsurance.address, ethers.constants.MaxUint256);
      await time.increase(
        time.duration.days(7)
      );
      await time.advanceBlock();
    });
    describe("redeem", function() {
      it("Should revert if exceeds base eth, instead of unwind", async function() {
        const tokenBalance1 = await token.balanceOf(ignitor1.address);
        const tokenBalance2 = await token.balanceOf(ignitor2.address);
        const tokenBalance3 = await token.balanceOf(ignitor3.address);
        await liftoffInsurance.connect(ignitor1).redeem(1,tokenBalance1);
        await liftoffInsurance.connect(ignitor2).redeem(1,tokenBalance2);
        await expect(
          liftoffInsurance.connect(ignitor3).redeem(1,tokenBalance3)
        ).to.be.revertedWith("Redeem request exceeds available insurance.");
      });
      it("Should redeem from bonusInsurance if it has positive amount", async function() {
        // check increaseInsuranceBonus
        const basicBusdBalanceInInsurance = await busd.balanceOf(liftoffInsurance.address);
        let preBusdBalanceInInsurance = basicBusdBalanceInInsurance;
        await busd.connect(ignitor3).approve(liftoffInsurance.address, ethers.constants.MaxUint256);
        await liftoffInsurance.increaseInsuranceBonus(1, ignitor3.address, ether("40").toString());
        let busdBalanceInInsurance = await busd.balanceOf(liftoffInsurance.address);
        expect(busdBalanceInInsurance).to.be.bignumber.equal(preBusdBalanceInInsurance.add(ether("40").toString()));

        // check decreaseInsuranceBonus
        preBusdBalanceInInsurance = busdBalanceInInsurance;
        await liftoffInsurance.decreaseInsuranceBonus(1, ignitor3.address, ether("5").toString());
        busdBalanceInInsurance = await busd.balanceOf(liftoffInsurance.address);
        expect(busdBalanceInInsurance).to.be.bignumber.equal(preBusdBalanceInInsurance.sub(ether("5").toString()));

        // In case of bonusInsurance amount is bigger than getRedeemValue
        let tokenBalance = await token.balanceOf(ignitor3.address);
        const tokenInsuranceUnits = await liftoffInsurance.getTokenInsuranceUints(1);
        let expectedBusdValue = await liftoffInsurance.getRedeemValue(tokenBalance.div(2), tokenInsuranceUnits.tokensPerEthWad);
        let expectedBusdBalanceInIgnitor3 = (await busd.balanceOf(ignitor3.address)).add(expectedBusdValue);
        await liftoffInsurance.connect(ignitor3).redeem(1, tokenBalance.div(2));
        let busdBalanceInIgnitor3 = await busd.balanceOf(ignitor3.address);
        expect(busdBalanceInIgnitor3).to.be.bignumber.equal(expectedBusdBalanceInIgnitor3);

        // In case of bonusInsurance amount is less than getRedeemValue
        // check busd balance
        tokenBalance = await token.balanceOf(ignitor3.address);
        expectedBusdValue = (await busd.balanceOf(liftoffInsurance.address)).sub(basicBusdBalanceInInsurance);
        expectedBusdBalanceInIgnitor3 = (await busd.balanceOf(ignitor3.address)).add(expectedBusdValue);
        await liftoffInsurance.connect(ignitor3).redeem(1,tokenBalance);
        busdBalanceInIgnitor3 = await busd.balanceOf(ignitor3.address);
        expect(busdBalanceInIgnitor3).to.be.bignumber.equal(expectedBusdBalanceInIgnitor3);

        // check token balance
        const expectedTokenValue = expectedBusdValue.mul(tokenInsuranceUnits.tokensPerEthWad).div(ether("1").toString());
        const preTokenBalance = tokenBalance;
        tokenBalance = await token.balanceOf(ignitor3.address);
        expect(tokenBalance).to.be.bignumber.equal(preTokenBalance.sub(expectedTokenValue));
      });
    });
    describe("claim", function() {
      it("Should distribute busd and xxx to lidpoolmanager, projectdev, lid treasury, partner1, partner2", async function() {
        const tokenInsurance = await liftoffInsurance.getTokenInsuranceUints(1);
        const totalMaxClaim = tokenInsurance.totalIgnited.sub(tokenInsurance.redeemedBusd)
        let busdLidTrsrInitial = await busd.balanceOf(lidTreasury.address);
        await liftoffInsurance.claim(1)
        let busdPoolBal = await busd.balanceOf(lidPoolManager.address);
        let busdProjDev = await busd.balanceOf(projectDev.address);
        let busdLidTrsr = await busd.balanceOf(lidTreasury.address);
        let busdPartnr1 = await busd.balanceOf(partner1.address);
        let busdPartnr2 = await busd.balanceOf(partner2.address);
        let busdtrsrDlt = busdLidTrsr.sub(busdLidTrsrInitial);
        expect(busdProjDev).to.be.bignumber.gt(ether("3.4").toString());
        expect(busdProjDev).to.be.bignumber.lt(ether("3.5").toString());
        expect(busdProjDev).to.be.bignumber.eq(
          totalMaxClaim.mul(settings.projectDevBP-150-200).div(10000).div(10)
        );
        expect(busdtrsrDlt).to.be.bignumber.gt(ether("0.16").toString());
        expect(busdtrsrDlt).to.be.bignumber.lt(ether("0.17").toString());
        expect(busdtrsrDlt).to.be.bignumber.eq(
          totalMaxClaim.mul(settings.mainFeeBP).div(10000).div(10)
        );
        expect(busdPoolBal).to.be.bignumber.gt(ether("0.27").toString());
        expect(busdPoolBal).to.be.bignumber.lt(ether("0.28").toString());
        expect(busdPoolBal).to.be.bignumber.eq(
          totalMaxClaim.mul(settings.lidPoolBP).div(10000).div(10)
        );
        expect(busdPartnr1).to.be.bignumber.gt(ether("0.07").toString());
        expect(busdPartnr1).to.be.bignumber.lt(ether("0.08").toString());
        expect(busdPartnr1).to.be.bignumber.eq(
          totalMaxClaim.mul(150).div(10000).div(10)
        );
        expect(busdPartnr2).to.be.bignumber.gt(ether("0.10").toString());
        expect(busdPartnr2).to.be.bignumber.lt(ether("0.11").toString());
        expect(busdPartnr2).to.be.bignumber.eq(
          totalMaxClaim.mul(200).div(10000).div(10)
        );
      });
      it("Should revert if double claim in the same cycle",async function() {
        await expect(
          liftoffInsurance.claim(1)
        ).to.be.revertedWith("Already claimed for this cycle.");
      });
      it("Should work for cycle2 claim",async function() {
        await time.increase(
          time.duration.days(7)
        );
        await time.advanceBlock();
        await expect(
          liftoffInsurance.claim(1)
        );
      });
    });
  });
});
const chai = require('chai');
const { solidity } = require("ethereum-waffle");
const { expect } = chai;
const { ether, time } = require("@openzeppelin/test-helpers");
const { UniswapDeployAsync } = require("../tools/UniswapDeployAsync");
const loadJsonFile = require('load-json-file');
const settings = loadJsonFile.sync("./scripts/settings.json").networks.hardhat;

chai.use(solidity);

describe('LiftoffEngine', function () {
  let liftoffSettings, liftoffEngine;
  let liftoffRegistration, liftoffPartnerships, sweepReceiver, projectDev, ignitor1, ignitor2, ignitor3;
  let tokenSaleId, startTime;

  before(async function () {
    const accounts = await ethers.getSigners();
    liftoffRegistration = accounts[0];
    liftoffPartnerships = accounts[1];
    sweepReceiver = accounts[2];
    projectDev = accounts[3];
    ignitor1 = accounts[4];
    ignitor2 = accounts[5];
    ignitor3 = accounts[6];
    ignitor4 = accounts[7];
    lidTreasury = accounts[8];
    lidPoolManager = accounts[9];

    upgrades.silenceWarnings();

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
    describe("launchToken", function () {  
      it("Should revert if sender is not Launcher", async function () {
        const currentTime = await time.latest();
        const contract = liftoffEngine.connect(projectDev);
        await expect(
          contract.launchToken(
            currentTime.toNumber() + time.duration.hours(1).toNumber(),
            currentTime.toNumber() + time.duration.days(7).toNumber(),
            ether("1000").toString(),
            ether("3000").toString(),
            ether("10").toString(),
            "TestToken",
            "TKN",
            projectDev.address
          )
        ).to.be.revertedWith("Sender must be LiftoffRegistration");
      })

      it("Should revert if endTime is before startTime", async function () {
        const currentTime = await time.latest();
        const contract = liftoffEngine.connect(liftoffRegistration);
        await expect(
          contract.launchToken(
            currentTime.toNumber() + time.duration.days(7).toNumber(),
            currentTime.toNumber() + time.duration.hours(1).toNumber(),
            ether("1000").toString(),
            ether("3000").toString(),
            ether("10").toString(),
            "TestToken",
            "TKN",
            projectDev.address
          )
        ).to.be.revertedWith("Must end after start");
      })

      it("Should revert if startTime is before now", async function () {
        const currentTime = await time.latest();
        const contract = liftoffEngine.connect(liftoffRegistration);
        await expect(
          contract.launchToken(
            currentTime.toNumber() - time.duration.hours(1).toNumber(),
            currentTime.toNumber() + time.duration.days(7).toNumber(),
            ether("1000").toString(),
            ether("3000").toString(),
            ether("10").toString(),
            "TestToken",
            "TKN",
            projectDev.address
          )
        ).to.be.revertedWith("Must start in the future");
      })

      it("Should revert if Hardcap is less than SoftCap", async function () {
        const currentTime = await time.latest();
        const contract = liftoffEngine.connect(liftoffRegistration);
        await expect(
          contract.launchToken(
            currentTime.toNumber() + time.duration.days(1).toNumber(),
            currentTime.toNumber() + time.duration.days(7).toNumber(),
            ether("3000").toString(),
            ether("1000").toString(),
            ether("10").toString(),
            "TestToken",
            "TKN",
            projectDev.address
          )
        ).to.be.revertedWith("Hardcap must be at least softCap");
      })
      
      it("Should revert if Softcap is less than 10 ehter", async function () {
        const currentTime = await time.latest();
        const contract = liftoffEngine.connect(liftoffRegistration);
        await expect(
          contract.launchToken(
            currentTime.toNumber() + time.duration.days(1).toNumber(),
            currentTime.toNumber() + time.duration.days(7).toNumber(),
            ether("9").toString(),
            ether("3000").toString(),
            ether("10").toString(),
            "TestToken",
            "TKN",
            projectDev.address
          )
        ).to.be.revertedWith("Softcap must be at least 10 ether");
      })

      it("Should revert if fixedRateWad is less than minimum", async function () {
        const currentTime = await time.latest();
        const contract = liftoffEngine.connect(liftoffRegistration);
        await expect(
          contract.launchToken(
            currentTime.toNumber() + time.duration.days(1).toNumber(),
            currentTime.toNumber() + time.duration.days(7).toNumber(),
            ether("1000").toString(),
            ether("3000").toString(),
            ether("0.0000000009").toString(),
            "TestToken",
            "TKN",
            projectDev.address
          )
        ).to.be.revertedWith("FixedRateWad is less than minimum");
      })
  
      it("Should revert if fixedRateWad is more than maximum", async function () {
        const currentTime = await time.latest();
        const contract = liftoffEngine.connect(liftoffRegistration);
        await expect(
          contract.launchToken(
            currentTime.toNumber() + time.duration.days(1).toNumber(),
            currentTime.toNumber() + time.duration.days(7).toNumber(),
            ether("1000").toString(),
            ether("3000").toString(),
            ether("1000000000.1").toString(),
            "TestToken",
            "TKN",
            projectDev.address
          )
        ).to.be.revertedWith("FixedRateWad is more than maximum");
      })
    })
  })

  describe("State: Before Liftoff Launch",function() {
    before(async function(){
      const currentTime = await time.latest()
      startTime = currentTime.toNumber() + time.duration.hours(1).toNumber()
      tokenSaleId = await liftoffEngine.launchToken(
        startTime,
        currentTime.toNumber() + time.duration.days(7).toNumber(),
        ether("500").toString(),
        ether("2000").toString(),
        ether("10").toString(),
        "TestToken",
        "TKN",
        projectDev.address
      )
    })

    describe("ignite", function () {
      it("Should revert if token not started yet", async function () {
        await expect(
          liftoffEngine.ignite(tokenSaleId.value, ignitor1.address, ether("300").toString())
        ).to.be.revertedWith("Not igniting.");
      })
    })

    describe("undoIgnite", function () {
      it("Should revert if token not started yet", async function () {
        await expect(
          liftoffEngine.undoIgnite(tokenSaleId.value)
        ).to.be.revertedWith("Not igniting.");
      })
    })

    describe("spark", function () {
      it("Should revert if token not started yet", async function () {
        await expect(
          liftoffEngine.spark(tokenSaleId.value)
        ).to.be.revertedWith("Not spark ready");
      })
    })

    describe("claimReward", function() {
      it("Should revert if token not started yet", async function () {
        await expect(
          liftoffEngine.claimReward(tokenSaleId.value, ignitor1.address)
        ).to.be.revertedWith("Token must have been sparked.");
      })
    })
  })

  describe("State: Pre Spark",function() {
    before(async function () {
      //Advance forward 1 day into post launch but pre spark period
      await time.increase(
        time.duration.hours(1)
      );
      await time.advanceBlock();
    })
    
    describe("ignite", function () {
      it("Should ignite", async function () {
        // first ignitor
        await busd.transfer(ignitor1.address, ether("300").toString());
        let contract = busd.connect(ignitor1);
        await contract.approve(liftoffEngine.address, ether("300").toString());
        contract = liftoffEngine.connect(ignitor1);
        await contract.ignite(
          tokenSaleId.value,
          ignitor1.address,
          ether("300").toString()
        );

        let tokenInfo = await liftoffEngine.getTokenSale(tokenSaleId.value);
        expect(tokenInfo.totalIgnited.toString()).to.equal(ether("300").toString());

        // second ignitor
        await busd.transfer(ignitor2.address, ether("200").toString());
        contract = busd.connect(ignitor2);
        await contract.approve(liftoffEngine.address, ether("200").toString());
        contract = liftoffEngine.connect(ignitor2);
        await contract.ignite(
          tokenSaleId.value,
          ignitor2.address,
          ether("200").toString()
        );

        tokenInfo = await liftoffEngine.getTokenSale(tokenSaleId.value);
        expect(tokenInfo.totalIgnited.toString()).to.equal(ether("500").toString());

        // third ignitor
        await busd.transfer(ignitor3.address, ether("500").toString());
        contract = busd.connect(ignitor3);
        await contract.approve(liftoffEngine.address, ether("500").toString());
        contract = liftoffEngine.connect(ignitor3);
        await contract.ignite(
          tokenSaleId.value,
          ignitor3.address,
          ether("500").toString()
        );

        tokenInfo = await liftoffEngine.getTokenSale(tokenSaleId.value);
        expect(tokenInfo.totalIgnited.toString()).to.equal(ether("1000").toString());

        // fourth ignitor
        await busd.transfer(ignitor4.address, ether("500").toString());
        contract = busd.connect(ignitor4);
        await contract.approve(liftoffEngine.address, ether("500").toString());
        contract = liftoffEngine.connect(ignitor4);
        await contract.ignite(
          tokenSaleId.value,
          ignitor4.address,
          ether("500").toString()
        );

        tokenInfo = await liftoffEngine.getTokenSale(tokenSaleId.value);
        expect(tokenInfo.totalIgnited.toString()).to.equal(ether("1500").toString());
      })
    })

    describe("undoIgnite", function () {
      it("Success", async function () {
        // fourth ignitor
        contract = liftoffEngine.connect(ignitor4);
        await contract.undoIgnite(tokenSaleId.value);

        tokenInfo = await liftoffEngine.getTokenSale(tokenSaleId.value);
        expect(tokenInfo.totalIgnited.toString()).to.equal(ether("1000").toString());
        expect((await busd.balanceOf(ignitor4.address)).toString()).to.equal(ether("500").toString());
      })
    })

    describe("claimReward", function() {
      it("Should revert if token not sparked yet", async function () {
        await expect(
          liftoffEngine.claimReward(tokenSaleId.value, ignitor1.address)
        ).to.be.revertedWith("Token must have been sparked.");
      })
    })

    describe("claimRefund", function() {
      it("Should revert if it already reached to softcap", async function () {
        await expect(
          liftoffEngine.claimRefund(tokenSaleId.value, ignitor1.address)
        ).to.be.revertedWith("Not refunding");
      })
    })

    describe("updateEndTime", function() {
      it("Should revert if caller is not the owner", async function () {
        let contract = liftoffEngine.connect(ignitor1);
        await expect(
          contract.updateEndTime(691200, tokenSaleId.value)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      })

      it("Success", async function () {
        await liftoffEngine.updateEndTime(691200, tokenSaleId.value); // _delta: 8 days
      })
    })

    describe("spark", function () {
      before(async function () {
        // reached to original endTime and confirm if new endTime was applied
        await time.increase(
          time.duration.days(7)
        );
        await time.advanceBlock();
      })

      it("Should revert", async function () {
        await expect(
          liftoffEngine.spark(tokenSaleId.value)
        ).to.be.revertedWith("Not spark ready");
      })
    })
  })

   describe("State: Post Spark", function () {
     let deployed;
     before(async function(){
       await time.increase(
         time.duration.days(1)
       );
       await time.advanceBlock();
       await liftoffEngine.spark(tokenSaleId.value);
     })
     describe("spark", function () {
       it("Should revert if token already sparked", async function () {
         await expect(
           liftoffEngine.spark(tokenSaleId.value)
         ).to.be.revertedWith("Not spark ready");
       })
     })

     describe("getTokenSale", function() {
        it("Should get correct total supply", async function () {
          let tokenInfo = await liftoffEngine.getTokenSale(tokenSaleId.value);
          expect(tokenInfo.totalSupply.toString()).to.be.bignumber.above(ether("11988").toString());
          expect(tokenInfo.totalSupply.toString()).to.be.bignumber.below(ether("11989").toString());
        })
      })

     describe("getTokenSaleForInsurance", function() {
       it("Should get token sale info for insurance", async function () {
         let tokenInfo = await liftoffEngine.getTokenSaleForInsurance(tokenSaleId.value);
         deployed = tokenInfo.deployed.toString();
         expect(tokenInfo.totalIgnited.toString()).to.equal(ether("1000").toString());
         expect(tokenInfo.pair.toString()).to.be.properAddress;
         expect(tokenInfo.deployed.toString()).to.be.properAddress;
         expect(tokenInfo.rewardSupply.toString()).to.be.bignumber.above(ether("7494").toString());
         expect(tokenInfo.rewardSupply.toString()).to.be.bignumber.below(ether("7495").toString());
       })
     })

     describe("getTokenSaleProjectDev", function() {
      it("Should get project dev for token sale", async function () {
        let address = await liftoffEngine.getTokenSaleProjectDev(tokenSaleId.value);
        expect(address.toString()).to.equal(projectDev.address.toString());
      })
    })

    describe("getTokenSaleStartTime", function() {
      it("Should get start time for token sale", async function () {
        let time = await liftoffEngine.getTokenSaleStartTime(tokenSaleId.value);
        expect(time).to.equal(startTime);
      })
    })

    describe("claimReward", function () {
      it("Should claim rewards", async function () {
        await liftoffEngine.claimReward(
          tokenSaleId.value,
          ignitor1.address
        );
        // ignitor1 ignited 300ETH of total 1000ETH
        // ignite1's rewards = 300 * rewardSupply / 1000
        const token = await ethers.getContractAt("ERC20Blacklist", deployed);
        expect((await token.balanceOf(ignitor1.address)).toString()).to.be.bignumber.above(ether("2248").toString());
        expect((await token.balanceOf(ignitor1.address)).toString()).to.be.bignumber.below(ether("2249").toString());
      })

      it("revert if ignitor already claimed", async function () {
        await expect(
          liftoffEngine.claimReward(tokenSaleId.value, ignitor1.address)
        ).to.be.revertedWith("Ignitor has already claimed");
      })

      it("revert if ignitor has no rewards to claim", async function () {
        await expect(
          liftoffEngine.claimReward(tokenSaleId.value, ignitor4.address)
        ).to.be.revertedWith("Must have some rewards to claim.");
      })
    })

     describe("setLiftoffSettings", function() {
       it("Should revert if caller is not the owner", async function () {
         let contract = liftoffEngine.connect(ignitor1);
         await expect(
           contract.setLiftoffSettings(ignitor1.address)
         ).to.be.revertedWith("Ownable: caller is not the owner");
       })

       it("success", async function () {
          liftoffEngine.setLiftoffSettings(liftoffSettings.address);
      })
     })
   })

  describe("Refund",function() {
    before(async function(){
      const currentTime = await time.latest()
      tokenSaleId = await liftoffEngine.launchToken(
        currentTime.toNumber() + time.duration.hours(1).toNumber(),
        currentTime.toNumber() + time.duration.days(1).toNumber(),
        ether("1000").toString(),
        ether("3000").toString(),
        ether("10").toString(),
        "TestToken",
        "TKN",
        projectDev.address
      );
      await time.increase(
        time.duration.hours(1)
      );
      await time.advanceBlock();
    })

    describe("ignite", function () {
      it("Should ignite", async function () {
        await busd.transfer(ignitor1.address, ether("500").toString());
        let contract = busd.connect(ignitor1);
        await contract.approve(liftoffEngine.address, ether("500").toString());
        contract = liftoffEngine.connect(ignitor1);
        await contract.ignite(
          1,
          ignitor2.address,
          ether("300").toString()
        );

        expect((await busd.balanceOf(ignitor1.address)).toString()).to.equal(ether("200").toString());

        let tokenInfo = await liftoffEngine.getTokenSale(1);
        expect(tokenInfo.totalIgnited.toString()).to.equal(ether("300").toString());
      })
    })

    describe("claimRefund", function() {
      it("Should revert if it is before endTime", async function () {
        await expect(
          liftoffEngine.claimRefund(1, ignitor2.address)
        ).to.be.revertedWith("Not refunding");
      })

      it("Should refund", async function () {
        await time.increase(
          time.duration.days(1)
        );
        await time.advanceBlock();
        await liftoffEngine.claimRefund(1, ignitor2.address);
        expect((await busd.balanceOf(ignitor2.address)).toString()).to.equal(ether("300").toString());
      })

      it("revert if ignitor already refunded", async function () {
        await expect(
          liftoffEngine.claimRefund(1, ignitor2.address)
        ).to.be.revertedWith("Ignitor has already refunded");
      })
    })
  })
});
pragma solidity =0.6.6;

import "./interfaces/ILiftoffSettings.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";

contract LiftoffSettings is
    ILiftoffSettings,
    Initializable,
    OwnableUpgradeable
{
    using SafeMathUpgradeable for uint256;

    uint256 private busdLockBP;
    uint256 private tokenUserBP;

    uint256 private insurancePeriod;

    uint256 private ethBuyBP;
    uint256 private baseFee;
    uint256 private projectDevBP;
    uint256 private mainFeeBP;
    uint256 private lidPoolBP;

    address private liftoffInsurance;
    address private liftoffRegistration;
    address private liftoffEngine;
    address private BUSD;
    address private uniswapRouter;
    address private uniswapFactory;

    address private lidTreasury;
    address private lidPoolManager;

    address private liftoffPartnerships;

    event LogTokenUserBP(uint256 tokenUserBP);
    event LogInsurancePeriod(uint256 insurancePeriod);
    event LogBusdBP(
        uint256 busdLockBP,
        uint256 baseFee,
        uint256 ethBuyBP,
        uint256 projectDevBP,
        uint256 mainFeeBP,
        uint256 lidPoolBP
    );
    event LogLidTreasury(address lidTreasury);
    event LogLidPoolManager(address lidPoolManager);
    event LogLiftoffInsurance(address liftoffInsurance);
    event LogLiftoffLauncher(address liftoffLauncher);
    event LogLiftoffEngine(address liftoffEngine);
    event LogLiftoffPartnerships(address liftoffPartnerships);
    event LogBUSD(address BUSD);
    event LogUniswapRouter(address uniswapRouter);
    event LogUniswapFactory(address uniswapFactory);

    function initialize() external initializer {
        OwnableUpgradeable.__Ownable_init();
    }

    function setAllUints(
        uint256 _busdLockBP,
        uint256 _tokenUserBP,
        uint256 _insurancePeriod,
        uint256 _baseFeeBP,
        uint256 _ethBuyBP,
        uint256 _projectDevBP,
        uint256 _mainFeeBP,
        uint256 _lidPoolBP
    ) external override onlyOwner {
        setTokenUserBP(_tokenUserBP);
        setInsurancePeriod(_insurancePeriod);
        setBusdBP(_busdLockBP, _baseFeeBP, _ethBuyBP, _projectDevBP, _mainFeeBP, _lidPoolBP);
    }

    function setAllAddresses(
        address _liftoffInsurance,
        address _liftoffRegistration,
        address _liftoffEngine,
        address _liftoffPartnerships,
        address _BUSD,
        address _uniswapRouter,
        address _uniswapFactory,
        address _lidTreasury,
        address _lidPoolManager
    ) external override onlyOwner {
        setLiftoffInsurance(_liftoffInsurance);
        setLiftoffRegistration(_liftoffRegistration);
        setLiftoffEngine(_liftoffEngine);
        setLiftoffPartnerships(_liftoffPartnerships);
        setBUSD(_BUSD);
        setUniswapRouter(_uniswapRouter);
        setUniswapFactory(_uniswapFactory);
        setLidTreasury(_lidTreasury);
        setLidPoolManager(_lidPoolManager);
    }

    function getBusdLockBP() external view override returns (uint256) {
        return busdLockBP;
    }

    function setTokenUserBP(uint256 _val) public override onlyOwner {
        tokenUserBP = _val;

        emit LogTokenUserBP(tokenUserBP);
    }

    function getTokenUserBP() external view override returns (uint256) {
        return tokenUserBP;
    }

    function setLiftoffInsurance(address _val) public override onlyOwner {
        liftoffInsurance = _val;

        emit LogLiftoffInsurance(liftoffInsurance);
    }

    function getLiftoffInsurance() external view override returns (address) {
        return liftoffInsurance;
    }

    function setLiftoffRegistration(address _val) public override onlyOwner {
        liftoffRegistration = _val;

        emit LogLiftoffLauncher(liftoffRegistration);
    }

    function getLiftoffRegistration() external view override returns (address) {
        return liftoffRegistration;
    }

    function setLiftoffEngine(address _val) public override onlyOwner {
        liftoffEngine = _val;

        emit LogLiftoffEngine(liftoffEngine);
    }

    function getLiftoffEngine() external view override returns (address) {
        return liftoffEngine;
    }

    function setLiftoffPartnerships(address _val) public override onlyOwner {
        liftoffPartnerships = _val;

        emit LogLiftoffPartnerships(liftoffPartnerships);
    }

    function getLiftoffPartnerships() external view override returns (address) {
        return liftoffPartnerships;
    }

    function setBUSD(address _val) public override onlyOwner {
        BUSD = _val;

        emit LogBUSD(BUSD);
    }

    function getBUSD() external view override returns (address) {
        return BUSD;
    }
    function setUniswapRouter(address _val) public override onlyOwner {
        uniswapRouter = _val;

        emit LogUniswapRouter(uniswapRouter);
    }

    function getUniswapRouter() external view override returns (address) {
        return uniswapRouter;
    }

    function setUniswapFactory(address _val) public override onlyOwner {
        uniswapFactory = _val;

        emit LogUniswapFactory(uniswapFactory);
    }

    function getUniswapFactory() external view override returns (address) {
        return uniswapFactory;
    }

    function setInsurancePeriod(uint256 _val) public override onlyOwner {
        insurancePeriod = _val;

        emit LogInsurancePeriod(insurancePeriod);
    }

    function getInsurancePeriod() external view override returns (uint256) {
        return insurancePeriod;
    }

    function setLidTreasury(address _val) public override onlyOwner {
        lidTreasury = _val;

        emit LogLidTreasury(lidTreasury);
    }

    function getLidTreasury() external view override returns (address) {
        return lidTreasury;
    }

    function setLidPoolManager(address _val) public override onlyOwner {
        lidPoolManager = _val;

        emit LogLidPoolManager(lidPoolManager);
    }

    function getLidPoolManager() external view override returns (address) {
        return lidPoolManager;
    }

    function setBusdBP(
        uint256 _busdLockBP,
        uint256 _baseFeeBP,
        uint256 _ethBuyBP,
        uint256 _projectDevBP,
        uint256 _mainFeeBP,
        uint256 _lidPoolBP
    ) public override onlyOwner {
        require(
            _busdLockBP.add(_baseFeeBP).add(_ethBuyBP).add(_projectDevBP).add(_mainFeeBP).add(
                _lidPoolBP
            ) == 10000,
            "Must allocate 100% of eth raised"
        );
        busdLockBP = _busdLockBP;
        baseFee = _baseFeeBP;
        ethBuyBP = _ethBuyBP;
        projectDevBP = _projectDevBP;
        mainFeeBP = _mainFeeBP;
        lidPoolBP = _lidPoolBP;

        emit LogBusdBP(busdLockBP, baseFee, ethBuyBP, projectDevBP, mainFeeBP, lidPoolBP);
    }

    function getBaseFeeBP() external view override returns (uint256) {
        return baseFee;
    }

    function getEthBuyBP() external view override returns (uint256) {
        return ethBuyBP;
    }

    function getProjectDevBP() external view override returns (uint256) {
        return projectDevBP;
    }

    function getMainFeeBP() external view override returns (uint256) {
        return mainFeeBP;
    }

    function getLidPoolBP() external view override returns (uint256) {
        return lidPoolBP;
    }
}

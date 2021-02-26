pragma solidity =0.6.6;

interface ILiftoffSettings {
    function setAllUints(
        uint256 _busdLockBP,
        uint256 _tokenUserBP,
        uint256 _insurancePeriod,
        uint256 _baseFeeBP,
        uint256 _ethBuyBP,
        uint256 _projectDevBP,
        uint256 _mainFeeBP,
        uint256 _lidPoolBP
    ) external;

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
    ) external;

    function setBusdLockBP(uint256 _val) external;

    function getBusdLockBP() external view returns (uint256);

    function setTokenUserBP(uint256 _val) external;

    function getTokenUserBP() external view returns (uint256);

    function setLiftoffInsurance(address _val) external;

    function getLiftoffInsurance() external view returns (address);

    function setLiftoffRegistration(address _val) external;

    function getLiftoffRegistration() external view returns (address);

    function setLiftoffEngine(address _val) external;

    function getLiftoffEngine() external view returns (address);

    function setLiftoffPartnerships(address _val) external;

    function getLiftoffPartnerships() external view returns (address);

    function setBUSD(address _val) external;

    function getBUSD() external view returns (address);

    function setUniswapRouter(address _val) external;

    function getUniswapRouter() external view returns (address);

    function setUniswapFactory(address _val) external;

    function getUniswapFactory() external view returns (address);

    function setInsurancePeriod(uint256 _val) external;

    function getInsurancePeriod() external view returns (uint256);

    function setLidTreasury(address _val) external;

    function getLidTreasury() external view returns (address);

    function setLidPoolManager(address _val) external;

    function getLidPoolManager() external view returns (address);

    function setBusdBP(
        uint256 _baseFeeBP,
        uint256 _ethBuyBP,
        uint256 _projectDevBP,
        uint256 _mainFeeBP,
        uint256 _lidPoolBP
    ) external;

    function getBaseFeeBP() external view returns (uint256);

    function getEthBuyBP() external view returns (uint256);

    function getProjectDevBP() external view returns (uint256);

    function getMainFeeBP() external view returns (uint256);

    function getLidPoolBP() external view returns (uint256);
}

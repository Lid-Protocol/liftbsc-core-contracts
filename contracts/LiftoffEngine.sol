pragma solidity =0.6.6;

import "./interfaces/ILiftoffEngine.sol";
import "./interfaces/ILiftoffSettings.sol";
import "./interfaces/ILiftoffInsurance.sol";
import "./library/BasisPoints.sol";
import "./ERC20/ERC20Blacklist.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/v2-periphery/contracts/libraries/UniswapV2Library.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/math/MathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";

contract LiftoffEngine is
    ILiftoffEngine,
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable
{
    using BasisPoints for uint256;
    using SafeMathUpgradeable for uint256;
    using MathUpgradeable for uint256;

    struct TokenSale {
        uint256 startTime;
        uint256 endTime;
        uint256 softCap;
        uint256 hardCap;
        uint256 totalIgnited;
        uint256 totalSupply;
        uint256 rewardSupply;
        address projectDev;
        address deployed;
        address pair;
        bool isSparked;
        string name;
        string symbol;
        mapping(address => Ignitor) ignitors;
    }

    struct Ignitor {
        uint256 ignited;
        bool hasClaimed;
        bool hasRefunded;
    }

    ILiftoffSettings public liftoffSettings;

    mapping(uint256 => TokenSale) public tokens;
    uint256 public totalTokenSales;
    mapping(uint256 => uint256) public fixedRateWads;

    event LaunchToken(
        uint256 tokenId,
        uint256 startTime,
        uint256 endTime,
        uint256 softCap,
        uint256 hardCap,
        uint256 fixedRateWad,
        string name,
        string symbol,
        address dev
    );
    event Spark(uint256 tokenId, address deployed, uint256 rewardSupply);
    event Ignite(uint256 tokenId, address igniter, uint256 toIgnite);
    event ClaimReward(uint256 tokenId, address igniter, uint256 reward);
    event ClaimRefund(uint256 tokenId, address igniter);
    event UpdateEndTime(uint256 tokenId, uint256 endTime);
    event UndoIgnite(
        uint256 _tokenSaleId,
        address igniter,
        uint256 wadUnIgnited
    );

    function initialize(ILiftoffSettings _liftoffSettings)
        external
        initializer
    {
        OwnableUpgradeable.__Ownable_init();
        PausableUpgradeable.__Pausable_init();
        liftoffSettings = _liftoffSettings;
    }

    function setLiftoffSettings(ILiftoffSettings _liftoffSettings)
        public
        onlyOwner
    {
        liftoffSettings = _liftoffSettings;
    }

    function updateEndTime(uint256 _delta, uint256 _tokenId)
        external
        onlyOwner
    {
        TokenSale storage tokenSale = tokens[_tokenId];
        uint256 endTime = tokenSale.startTime.add(_delta);
        tokenSale.endTime = endTime;
        emit UpdateEndTime(_tokenId, endTime);
    }

    function launchToken(
        uint256 _startTime,
        uint256 _endTime,
        uint256 _softCap,
        uint256 _hardCap,
        uint256 _fixedRateWad,
        string calldata _name,
        string calldata _symbol,
        address _projectDev
    ) external override whenNotPaused returns (uint256 tokenId) {
        require(
            msg.sender == liftoffSettings.getLiftoffRegistration(),
            "Sender must be LiftoffRegistration"
        );
        require(_endTime > _startTime, "Must end after start");
        require(_startTime > now, "Must start in the future");
        require(_hardCap >= _softCap, "Hardcap must be at least softCap");
        require(_softCap >= 10 ether, "Softcap must be at least 10 ether");
        require(_fixedRateWad >= (10**9), "FixedRateWad is less than minimum");
        require(_fixedRateWad <= (10**27), "FixedRateWad is more than maximum");

        tokenId = totalTokenSales;

        tokens[tokenId] = TokenSale({
            startTime: _startTime,
            endTime: _endTime,
            softCap: _softCap,
            hardCap: _hardCap,
            totalIgnited: 0,
            totalSupply: 0,
            rewardSupply: 0,
            projectDev: _projectDev,
            deployed: address(0),
            pair: address(0),
            name: _name,
            symbol: _symbol,
            isSparked: false
        });

        fixedRateWads[tokenId] = _fixedRateWad;

        totalTokenSales++;

        emit LaunchToken(
            tokenId,
            _startTime,
            _endTime,
            _softCap,
            _hardCap,
            _fixedRateWad,
            _name,
            _symbol,
            _projectDev
        );
    }

    function ignite(
        uint256 _tokenSaleId,
        address _for,
        uint256 _amountBusd
    ) external override whenNotPaused {
        TokenSale storage tokenSale = tokens[_tokenSaleId];
        require(
            isIgniting(
                tokenSale.startTime,
                tokenSale.endTime,
                tokenSale.totalIgnited,
                tokenSale.hardCap
            ),
            "Not igniting."
        );
        uint256 toIgnite =
            getAmountToIgnite(
                _amountBusd,
                tokenSale.hardCap,
                tokenSale.totalIgnited
            );

        require(
            IERC20(liftoffSettings.getBUSD()).transferFrom(
                msg.sender,
                address(this),
                toIgnite
            ),
            "Transfer Failed"
        );
        _addIgnite(tokenSale, _for, toIgnite);

        emit Ignite(_tokenSaleId, _for, toIgnite);
    }

    function undoIgnite(uint256 _tokenSaleId) external override whenNotPaused {
        TokenSale storage tokenSale = tokens[_tokenSaleId];
        require(
            isIgniting(
                tokenSale.startTime,
                tokenSale.endTime,
                tokenSale.totalIgnited,
                tokenSale.hardCap
            ),
            "Not igniting."
        );
        uint256 wadToUndo = tokenSale.ignitors[msg.sender].ignited;
        tokenSale.ignitors[msg.sender].ignited = 0;
        delete tokenSale.ignitors[msg.sender];
        tokenSale.totalIgnited = tokenSale.totalIgnited.sub(wadToUndo);
        require(
            IERC20(liftoffSettings.getBUSD()).transfer(msg.sender, wadToUndo),
            "Transfer failed"
        );
        emit UndoIgnite(_tokenSaleId, msg.sender, wadToUndo);
    }

    function claimReward(uint256 _tokenSaleId, address _for)
        external
        override
        whenNotPaused
    {
        TokenSale storage tokenSale = tokens[_tokenSaleId];
        Ignitor storage ignitor = tokenSale.ignitors[_for];

        require(tokenSale.isSparked, "Token must have been sparked.");
        require(!ignitor.hasClaimed, "Ignitor has already claimed");

        uint256 reward =
            getReward(
                ignitor.ignited,
                tokenSale.rewardSupply,
                tokenSale.totalIgnited
            );
        require(reward > 0, "Must have some rewards to claim.");

        ignitor.hasClaimed = true;
        require(
            IERC20(tokenSale.deployed).transfer(_for, reward),
            "Transfer failed"
        );

        emit ClaimReward(_tokenSaleId, _for, reward);
    }

    function spark(uint256 _tokenSaleId) external override whenNotPaused {
        TokenSale storage tokenSale = tokens[_tokenSaleId];

        require(
            isSparkReady(
                tokenSale.endTime,
                tokenSale.totalIgnited,
                tokenSale.hardCap,
                tokenSale.softCap,
                tokenSale.isSparked
            ),
            "Not spark ready"
        );

        tokenSale.isSparked = true;
        tokenSale.totalSupply =
            uint256(10000).mul(fixedRateWads[_tokenSaleId]).mul(
                tokenSale.totalIgnited
            ) /
            liftoffSettings.getTokenUserBP() /
            (10**18);

        uint256 busdBuy = _deploy(tokenSale);
        _allocateTokensPostDeploy(tokenSale);
        _insuranceRegistration(tokenSale, _tokenSaleId, busdBuy);

        emit Spark(_tokenSaleId, tokenSale.deployed, tokenSale.rewardSupply);
    }

    function claimRefund(uint256 _tokenSaleId, address _for)
        external
        override
        whenNotPaused
    {
        TokenSale storage tokenSale = tokens[_tokenSaleId];
        Ignitor storage ignitor = tokenSale.ignitors[_for];

        require(
            isRefunding(
                tokenSale.endTime,
                tokenSale.softCap,
                tokenSale.totalIgnited
            ),
            "Not refunding"
        );

        require(!ignitor.hasRefunded, "Ignitor has already refunded");
        ignitor.hasRefunded = true;

        require(
            IERC20(liftoffSettings.getBUSD()).transfer(_for, ignitor.ignited),
            "Transfer failed"
        );

        emit ClaimRefund(_tokenSaleId, _for);
    }

    function getTokenSale(uint256 _tokenSaleId)
        external
        view
        override
        returns (
            uint256 startTime,
            uint256 endTime,
            uint256 softCap,
            uint256 hardCap,
            uint256 totalIgnited,
            uint256 totalSupply,
            uint256 rewardSupply,
            address projectDev,
            address deployed,
            bool isSparked
        )
    {
        TokenSale storage tokenSale = tokens[_tokenSaleId];

        startTime = tokenSale.startTime;
        endTime = tokenSale.endTime;
        softCap = tokenSale.softCap;
        hardCap = tokenSale.hardCap;
        totalIgnited = tokenSale.totalIgnited;
        totalSupply = tokenSale.totalSupply;
        rewardSupply = tokenSale.rewardSupply;
        projectDev = tokenSale.projectDev;
        deployed = tokenSale.deployed;
        isSparked = tokenSale.isSparked;
    }

    function getTokenSaleForInsurance(uint256 _tokenSaleId)
        external
        view
        override
        returns (
            uint256 totalIgnited,
            uint256 rewardSupply,
            address projectDev,
            address pair,
            address deployed
        )
    {
        TokenSale storage tokenSale = tokens[_tokenSaleId];
        totalIgnited = tokenSale.totalIgnited;
        rewardSupply = tokenSale.rewardSupply;
        projectDev = tokenSale.projectDev;
        pair = tokenSale.pair;
        deployed = tokenSale.deployed;
    }

    function getTokenSaleProjectDev(uint256 _tokenSaleId)
        external
        view
        override
        returns (address projectDev)
    {
        projectDev = tokens[_tokenSaleId].projectDev;
    }

    function getTokenSaleStartTime(uint256 _tokenSaleId)
        external
        view
        override
        returns (uint256 startTime)
    {
        startTime = tokens[_tokenSaleId].startTime;
    }

    function isSparkReady(
        uint256 endTime,
        uint256 totalIgnited,
        uint256 hardCap,
        uint256 softCap,
        bool isSparked
    ) public view override returns (bool) {
        if (
            (now <= endTime && totalIgnited < hardCap) ||
            totalIgnited < softCap ||
            isSparked
        ) {
            return false;
        } else {
            return true;
        }
    }

    function isIgniting(
        uint256 startTime,
        uint256 endTime,
        uint256 totalIgnited,
        uint256 hardCap
    ) public view override returns (bool) {
        if (now < startTime || now > endTime || totalIgnited >= hardCap) {
            return false;
        } else {
            return true;
        }
    }

    function isRefunding(
        uint256 endTime,
        uint256 softCap,
        uint256 totalIgnited
    ) public view override returns (bool) {
        if (totalIgnited >= softCap || now <= endTime) {
            return false;
        } else {
            return true;
        }
    }

    function getReward(
        uint256 ignited,
        uint256 rewardSupply,
        uint256 totalIgnited
    ) public pure override returns (uint256 reward) {
        return ignited.mul(rewardSupply).div(totalIgnited);
    }

    function getAmountToIgnite(
        uint256 amountBusd,
        uint256 hardCap,
        uint256 totalIgnited
    ) public pure returns (uint256 toIgnite) {
        uint256 maxIgnite = hardCap.sub(totalIgnited);

        if (maxIgnite < amountBusd) {
            toIgnite = maxIgnite;
        } else {
            toIgnite = amountBusd;
        }
    }

    function _deploy(TokenSale storage tokenSale)
        internal
        returns (uint256 busdBuy)
    {
        uint256 busdLocked =
            tokenSale.totalIgnited.mulBP(liftoffSettings.getBusdLockBP());
        busdBuy = tokenSale.totalIgnited.mulBP(liftoffSettings.getEthBuyBP());

        address deployed =
            address(
                new ERC20Blacklist(
                    tokenSale.name,
                    tokenSale.symbol,
                    tokenSale.totalSupply,
                    address(this)
                )
            );

        //Lock symbol/busd liquidity
        address pair =
            _lockLiquidity(tokenSale.totalSupply, busdLocked, deployed);

        _swapExactBusdForTokens(
            busdBuy,
            IERC20(liftoffSettings.getBUSD()),
            IUniswapV2Pair(pair)
        );

        tokenSale.pair = pair;
        tokenSale.deployed = deployed;

        return busdBuy;
    }

    function _lockLiquidity(
        uint256 wadToken,
        uint256 wadBusd,
        address token
    ) internal returns (address pair) {
        address _uniswapRouter = liftoffSettings.getUniswapRouter();
        IERC20(token).approve(_uniswapRouter, wadToken);

        IERC20 busd = IERC20(liftoffSettings.getBUSD());
        busd.approve(_uniswapRouter, wadBusd);

        pair = _addLiquidity(IERC20(token), busd, wadToken, wadBusd);

        return pair;
    }

    function _addLiquidity(
        IERC20 token,
        IERC20 busd,
        uint256 wadToken,
        uint256 wadBusd
    ) internal returns (address pair) {
        pair = IUniswapV2Factory(liftoffSettings.getUniswapFactory()).createPair(
            address(busd),
            address(token)
        );
        (uint256 reserve0, uint256 reserve1, ) =
            IUniswapV2Pair(pair).getReserves();
        require(reserve0 == 0 && reserve1 == 0, "Pair already has reserves");

        require(token.transfer(pair, wadToken), "Transfer Failed");
        require(busd.transfer(pair, wadBusd), "Transfer Failed");
        IUniswapV2Pair(pair).mint(address(0x0));
    }

    function _allocateTokensPostDeploy(TokenSale storage tokenSale) internal {
        IERC20 deployed = IERC20(tokenSale.deployed);
        uint256 balance = deployed.balanceOf(address(this));
        tokenSale.rewardSupply = balance.mulBP(
            liftoffSettings.getTokenUserBP()
        );
    }

    function _insuranceRegistration(
        TokenSale storage tokenSale,
        uint256 _tokenSaleId,
        uint256 _busdBuy
    ) internal {
        IERC20 deployed = IERC20(tokenSale.deployed);
        uint256 toInsurance =
            deployed.balanceOf(address(this)).sub(tokenSale.rewardSupply);
        address liftoffInsurance = liftoffSettings.getLiftoffInsurance();
        deployed.transfer(liftoffInsurance, toInsurance);
        IERC20(liftoffSettings.getBUSD()).transfer(
            liftoffInsurance,
            tokenSale.totalIgnited.sub(_busdBuy)
        );

        ILiftoffInsurance(liftoffInsurance).register(_tokenSaleId);
    }

    function _addIgnite(
        TokenSale storage tokenSale,
        address _for,
        uint256 toIgnite
    ) internal {
        Ignitor storage ignitor = tokenSale.ignitors[_for];
        ignitor.ignited = ignitor.ignited.add(toIgnite);
        tokenSale.totalIgnited = tokenSale.totalIgnited.add(toIgnite);
    }

    //WARNING: Not tested with transfer tax tokens. Will probably fail with such.
    function _swapExactBusdForTokens(
        uint256 amountIn,
        IERC20 busd,
        IUniswapV2Pair pair
    ) internal {
        (uint256 reserve0, uint256 reserve1, ) = pair.getReserves();
        bool token0IsBusd = pair.token0() == address(busd);
        (uint256 reserveIn, uint256 reserveOut) =
            token0IsBusd ? (reserve0, reserve1) : (reserve1, reserve0);
        uint256 amountOut =
            UniswapV2Library.getAmountOut(amountIn, reserveIn, reserveOut);
        require(busd.transfer(address(pair), amountIn), "Transfer failed");
        (uint256 amount0Out, uint256 amount1Out) =
            token0IsBusd ? (uint256(0), amountOut) : (amountOut, uint256(0));
        pair.swap(amount0Out, amount1Out, address(this), new bytes(0));
    }
}

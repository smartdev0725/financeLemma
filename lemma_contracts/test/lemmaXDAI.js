const { ethers } = require("hardhat");
const hre = require("hardhat");
const { BigNumber } = require("ethers");
const TEST_USDC_ABI = require('../abis/TestUsdc_abi.json');
const { expect } = require("chai");
const { EventEmitter } = require("events");
contract("LemmaToken", accounts => {
    let LemmaPerpetualContract;
    let LemmaTokenContract;
    const collateral = "0xe0B887D54e71329318a036CF50f30Dbe4444563c";
    const ambBridgeOnXDai = "0xc38D4991c951fE8BCE1a12bEef2046eF36b0FA4A";
    const multiTokenMediatorOnXDai = "0xA34c65d76b997a824a5E384471bBa73b0013F5DA";
    const trustedForwaderXDAI = "0x86C80a8aa58e0A4fa09A69624c31Ab2a6CAD56b8";
    const lemmaMainnet = "0xFE17F35aED616212B7670a2A73ABB674F9FAcEb0";

    const clearingHouseAddress = "0xd1ab46526D555285E9b61f066B7673bb9b9B51b6";
    const clearingHouseViewerAddress = "0x2b53BA3d842F76e4D96FecEA77d345d237680E2e";
    const ammAddress = "0xF75C8c9EADBCA5D26dA43466aD5Be511Cb281668";
    const testusdcAddress = "0xe0B887D54e71329318a036CF50f30Dbe4444563c";
    const zeroAddress = "0x0000000000000000000000000000000000000000";
    const myEmitter = new EventEmitter();
    let ambBridgeContract;

    before(async function () {
        accounts = await ethers.getSigners();
        const LemmaToken = await ethers.getContractFactory("LemmaToken");
        const LemmaPerpetual = await ethers.getContractFactory("LemmaPerpetual");
        const AMBBridge = await ethers.getContractFactory("MockAMB");

        ambBridgeContract = await upgrades.deployProxy(AMBBridge, [], { initializer: 'initialize' });        
        LemmaPerpetualContract = await upgrades.deployProxy(LemmaPerpetual, [clearingHouseAddress, clearingHouseViewerAddress, ammAddress, testusdcAddress], { initializer: 'initialize' });
        LemmaTokenContract = await upgrades.deployProxy(LemmaToken, [collateral, LemmaPerpetualContract.address, ambBridgeContract.address, multiTokenMediatorOnXDai, trustedForwaderXDAI], { initializer: 'initialize' });
        testusdc = new ethers.Contract(testusdcAddress, TEST_USDC_ABI, accounts[0]);
    });

    it("Set LemmaMainnet on xdai contract", async function() {
        await LemmaTokenContract.connect(accounts[0]).setLemmaMainnet(lemmaMainnet);
        expect(await LemmaTokenContract.lemmaMainnet()).to.equal(lemmaMainnet);
    });

    it("Set LemmaMainnet on perpetual contract", async function() {
        await LemmaPerpetualContract.setLemmaToken(LemmaTokenContract.address);
        expect(await LemmaPerpetualContract.lemmaToken()).to.equal(LemmaTokenContract.address);
    });

    it("Only ambBridge contract can call setDepositInfo function", async function() {
        let depositUSDCAmountOut = BigNumber.from(2 * 10 ** 6);
        try {
            await LemmaTokenContract.connect(accounts[0]).setDepositInfo(accounts[0].address, depositUSDCAmountOut);
        }
        catch (error) {
            expect(error.message).to.equal("VM Exception while processing transaction: revert not ambBridge");
        }
    });

    it("Can not deposit if ambBridge's messageSender() is not the same as lemmaMainnet", async function() {
        let depositUSDCAmountOut = BigNumber.from(2 * 10 ** 6);
        await ambBridgeContract.setXDAIContract(LemmaTokenContract.address);
        try {
            await ambBridgeContract.setDepositInfo(accounts[0].address, depositUSDCAmountOut);
        }
        catch (error) {
            expect(error.message).to.equal("VM Exception while processing transaction: revert ambBridge's messageSender is not lemmaMainnet");
        }
    });

    it("Set xdai and mainnet contract on AMB", async function() {
        await ambBridgeContract.setMainnetContract(lemmaMainnet);
        expect(await ambBridgeContract.mainnetContract()).to.equal(lemmaMainnet);
    });

    it("Set gasLimit", async function() {
        await LemmaTokenContract.connect(accounts[0]).setGasLimit(1000000);
        expect(await LemmaTokenContract.gasLimit()).to.equal(1000000);
    });

    it("Set Deposit", async function() {
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [accounts[1].address]
        });
        const impersonate_account2 = await ethers.provider.getSigner(accounts[1].address);

        let minimumUSDCAmountOut = BigNumber.from(1 * 10 ** 6);
        let test_usdc_balance_1 = await testusdc.balanceOf(accounts[1].address);
    
        let  amountTransfer = BigNumber.from(7 * 10 ** 6);
     
        await testusdc.connect(impersonate_account2).approve(LemmaTokenContract.address, amountTransfer);
      
        await testusdc.connect(impersonate_account2).transfer(LemmaTokenContract.address, amountTransfer);
      
        expect(await ambBridgeContract.setDepositInfo(accounts[1].address, minimumUSDCAmountOut)).to.emit(LemmaTokenContract, "DepositInfoAdded").withArgs(accounts[1].address, minimumUSDCAmountOut);
      
        expect(await ambBridgeContract.setDepositInfo(accounts[1].address, minimumUSDCAmountOut)).to.emit(LemmaTokenContract, "USDCDeposited").withArgs(accounts[1].address, minimumUSDCAmountOut);
        let test_usdc_balance_2 = await testusdc.balanceOf(accounts[1].address);
        expect(test_usdc_balance_2).to.equal(test_usdc_balance_1 - amountTransfer);
    });

    it("Deposit in the case of existing totalSupply", async function() {
        let minimumUSDCAmountOut_2 = BigNumber.from(2 * 10 ** 6);
        let getTotalCollateral = await LemmaPerpetualContract.getTotalCollateral();
        let lemmaBalance_1 = await LemmaTokenContract.balanceOf(accounts[1].address);
        await ambBridgeContract.setDepositInfo(accounts[1].address, minimumUSDCAmountOut_2);
        let lemmaBalance_2 = await LemmaTokenContract.balanceOf(accounts[1].address);
        let amount_mint = lemmaBalance_1 * minimumUSDCAmountOut_2 / getTotalCollateral;
        expect(lemmaBalance_2 / 10000).to.equal(lemmaBalance_1 / 10000 + amount_mint / 10000);
    }); 

    it("Can not mint more amount than the contract's balance", async function() {
        let minimumUSDCAmount = BigNumber.from(10 * 10 ** 6);
        let test_usdc_balance_beforeDeposit = await testusdc.balanceOf(accounts[1].address);
        await ambBridgeContract.setDepositInfo(accounts[1].address, minimumUSDCAmount);
        let test_usdc_balance_afterDeposit = await testusdc.balanceOf(accounts[1].address);
        expect(test_usdc_balance_beforeDeposit).to.equal(test_usdc_balance_afterDeposit);
    });

    it("Can not withdraw LemmaToken before setting lemmaMainnet", async function() {
        await LemmaTokenContract.connect(accounts[0]).setLemmaMainnet(zeroAddress);
        let amountWithdraw_1 = BigNumber.from(1e18.toString());

        try {
            await LemmaTokenContract.connect(accounts[1]).withdraw(amountWithdraw_1);
        } catch (error) {BigNumber.from(2e18.toString());
            expect(error.message).to.equal("VM Exception while processing transaction: revert receiver is empty");
        };
    });

    it("Withdraw LemmaToken", async function() {
        await LemmaTokenContract.connect(accounts[0]).setLemmaMainnet(lemmaMainnet);
        let amountWithdraw = BigNumber.from(1e18.toString());
        let lemmabalanceBeforeWithdraw = await LemmaTokenContract.balanceOf(accounts[1].address);
        await LemmaTokenContract.connect(accounts[1]).withdraw(amountWithdraw);
       
        let test_usdc_balance_after_withdraw = await testusdc.balanceOf(LemmaTokenContract.address);
        expect(test_usdc_balance_after_withdraw).to.equal(3000000);
    });
  });
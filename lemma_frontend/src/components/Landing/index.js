import React, { useState, useEffect } from "react";
import { withStyles } from "@material-ui/core/styles";
import {
  Grid,
  Button,
  TextField,
  Paper,
  Snackbar,
  Typography,
  Tab,
  Slider,
} from "@material-ui/core";
import { TabPanel, TabContext, Alert, TabList } from "@material-ui/lab";
import Web3 from "web3";

import { ethers, BigNumber, utils } from "ethers";
import { Biconomy } from "@biconomy/mexa";
import erc20 from "../../abis/ERC20.json";
import addresses from "../../abis/addresses.json";
import LemmaMainnet from "../../abis/LemmaMainnet.json";
import LemmaToken from "../../abis/LemmaToken.json";
import IUniswapV2Router02 from "@uniswap/v2-periphery/build/IUniswapV2Router02.json";
import LemmaPerpetual from "../../abis/LemmaPerpetual.json";
import { useConnectedWeb3Context } from "../../context";

import { styles } from "./styles";

function LandingPage({ classes }) {
  const {
    account,
    signer,
    provider,
    ethBalance,
    isConnected,
    onConnect,
  } = useConnectedWeb3Context();

  const [amount, setAmount] = useState("");
  const [tabIndex, setTabIndex] = useState("1");
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [withdrawableETH, setWithdrawableETH] = useState(BigNumber.from(0));
  const [deposited, setDeposited] = useState(BigNumber.from(0));
  const [earnings, setEarings] = useState(BigNumber.from(0));
  const XDAI_URL = "https://rpc.xdaichain.com/";
  const XDAI_WSS_URL = "wss://rpc.xdaichain.com/wss";

  const convertTo18Decimals = (number, decimals = 18) => {
    return ethers.utils.parseUnits(number.toString(), decimals);
  };

  const convertToReadableFormat = (bignumber, decimals = 18) => {
    return ethers.utils.formatUnits(bignumber, decimals);
  };

  const ONE = convertTo18Decimals(1);

  const handleAmountChange = (event) => {
    if (event.target.value !== "" && isNaN(parseFloat(event.target.value))) {
      alert("Please enter a number!");
    } else {
      setAmount(event.target.value);
    }
  };

  const handleSliderChange = (event, value) => {
    if (!isConnected) {
      return;
    }

    setAmount((value * convertToReadableFormat(ethBalance)) / 100);
  };

  const handleWithdrawSliderChange = (event, value) => {
    if (!isConnected) {
      return;
    }
    setAmount((value * convertToReadableFormat(withdrawableETH)) / 100);
  };

  const handleDepositSubmit = async () => {
    if (!isConnected) {
      handleConnectWallet();
      return;
    }

    const lemmaMainnet = new ethers.Contract(
      addresses.rinkeby.lemmaMainnet,
      LemmaMainnet.abi,
      provider
    ).connect(signer);

    await lemmaMainnet.deposit(0, { value: convertTo18Decimals(amount) });

    // await refreshBalances();
    setMessage(
      "Deposit completed successfully, you should receive your LUSDT in ~1 min!"
    );
    setStatus("success");
    setOpen(true);

    //set a listener for minting LUSDC on
    // const lemmaMainnetEthers = new ethers.Contract(addresses.rinkeby.lemmaMainnet, LemmaMainnet.abi, provider);
    // const DepositFilter = lemmaMainnetEthers.filters.ETHDeposited(accounts[0]);
    const lemmaToken = new ethers.Contract(
      addresses.xDAIRinkeby.lemmaxDAI,
      erc20.abi,
      ethers.getDefaultProvider(XDAI_WSS_URL)
    );
    const lusdcMintedFilter = lemmaToken.filters.Transfer(
      /**from ==*/ ethers.constants.AddressZero,
      /**to == */ account
    );
    lemmaToken.once(lusdcMintedFilter, onSuccesfulDeposit);
  };

  const handleWithdrawSubmit = async () => {
    if (!isConnected) {
      handleConnectWallet();
      return;
    }

    const lemmaToken = new ethers.Contract(
      addresses.xDAIRinkeby.lemmaxDAI,
      erc20.abi,
      ethers.getDefaultProvider(XDAI_URL)
    );
    const userBalanceOfLUSDC = await lemmaToken.balanceOf(account);
    console.log(
      "useBalanceOFLUSDC",
      convertToReadableFormat(userBalanceOfLUSDC)
    );

    const ethToWithdraw = convertTo18Decimals(amount);
    console.log("ethToWithdraw", amount);
    console.log("withdrwableETH", convertToReadableFormat(withdrawableETH));
    //TODO: This is temperary fix
    //make sure frontend deals with only bignumbers
    let lUSDCAmount;

    const percentageOfETHToWithdraw = withdrawableETH
      .sub(ethToWithdraw)
      .mul(ONE)
      .div(withdrawableETH);
    lUSDCAmount = userBalanceOfLUSDC.sub(
      userBalanceOfLUSDC.mul(percentageOfETHToWithdraw).div(ONE)
    );

    if (lUSDCAmount.gt(userBalanceOfLUSDC)) {
      lUSDCAmount = userBalanceOfLUSDC;
    }
    console.log("lUSDCAmount", convertToReadableFormat(lUSDCAmount));

    const xDAIProvider = new Web3.providers.HttpProvider(XDAI_URL);
    const biconomy = new Biconomy(xDAIProvider, {
      walletProvider: window.ethereum,
      apiKey: "8u2bSHCoH.849e2a72-c03f-4784-bc0e-8ad964ee3ad5",
      apiId: "13905749-edfe-4367-a4e8-c1fdf7cf9e1b",
      debug: true,
    });
    // const web3Biconomy = new Web3(biconomy);

    // const amountToWithdraw = BigNumber.from(amount);
    // const amountToWithdrawWithDecimals = amountToWithdraw.mul(BigNumber.from(10).pow(BigNumber.from(18)));

    let userAddress = account;
    biconomy
      .onEvent(biconomy.READY, async () => {
        // Initialize your dapp here like getting user accounts etc
        // const lemmaxDAI = new web3Biconomy.eth.Contract(LemmaToken.abi, addresses.xDAIRinkeby.lemmaxDAI);
        // await lemmaxDAI.methods.withdraw(amountToWithdrawWithDecimals).send({ from: accounts[0], signatureType: biconomy.EIP712_SIGN });
        // Initialize Constants
        let contract = new ethers.Contract(
          addresses.xDAIRinkeby.lemmaxDAI,
          LemmaToken.abi,
          biconomy.getSignerByAddress(userAddress)
        );
        // let contractInterface = new ethers.utils.Interface(LemmaToken.abi);

        // Create your target method signature.. here we are calling setQuote() method of our contract
        let { data } = await contract.populateTransaction.withdraw(lUSDCAmount);
        let provider = biconomy.getEthersProvider();

        // you can also use networkProvider created above
        let gasLimit = await provider.estimateGas({
          to: addresses.xDAIRinkeby.lemmaxDAI,
          from: userAddress,
          data: data,
        });
        console.log("Gas limit : ", gasLimit);

        let txParams = {
          data: data,
          to: addresses.xDAIRinkeby.lemmaxDAI,
          from: userAddress,
          gasLimit: gasLimit, // optional
          signatureType: "EIP712_SIGN",
        };

        // as ethers does not allow providing custom options while sending transaction
        // you can also use networkProvider created above
        // signature will be taken by mexa using normal provider (metamask wallet etc) that you passed in Biconomy options
        let tx = await provider.send("eth_sendTransaction", [txParams]);
        console.log("Transaction hash : ", tx);

        //event emitter methods
        provider.once(tx, (transaction) => {
          // Emitted when the transaction has been mined
          //show success message
          console.log(transaction);

          setMessage(
            "Withdraw started successfully, you will receive your ETH back in ~1 minutes"
          );
          setStatus("success");
          setOpen(true);

          const lemmaMainnet = new ethers.Contract(
            addresses.rinkeby.lemmaMainnet,
            LemmaMainnet.abi,
            new ethers.providers.Web3Provider(window.ethereum)
          );
          const lemmaMainnetETHWithdrawedFilter = lemmaMainnet.filters.ETHWithdrawed(
            account
          );
          lemmaMainnet.once(
            lemmaMainnetETHWithdrawedFilter,
            onSuccesfulWithdrawal
          );
          //do something with transaction hash
        });
      })
      .onEvent(biconomy.ERROR, (error, message) => {
        // Handle error while initializing mexa
        console.log(error);
      });
    handleConnectWallet();
  };

  const handleConnectWallet = async () => {
    await onConnect();
  };

  const refreshBalances = async () => {
    // const usdcBalance = await getBalance(addresses.usdc, account);
    // setBalance(usdcBalance);
    // const LusdcBalance = await getBalance(addresses.lusdc, account);
    // setLBalance(LusdcBalance);

    // await setWeb3(new Web3(window.ethereum));

    const lemmaToken = new ethers.Contract(
      addresses.xDAIRinkeby.lemmaxDAI,
      erc20.abi,
      ethers.getDefaultProvider(XDAI_URL)
    );
    const lemmaPerpetual = new ethers.Contract(
      addresses.xDAIRinkeby.lemmaPerpetual,
      LemmaPerpetual.abi,
      ethers.getDefaultProvider(XDAI_URL)
    );
    const uniswapV2Router02 = new ethers.Contract(
      addresses.rinkeby.uniswapV2Router02,
      IUniswapV2Router02.abi,
      provider
    );
    const lemmaMainnet = new ethers.Contract(
      addresses.rinkeby.lemmaMainnet,
      LemmaMainnet.abi,
      provider
    );

    const userBalanceOfLUSDC = await lemmaToken.balanceOf(account);
    console.log(
      "userBalanceOfLUSDC",
      convertToReadableFormat(userBalanceOfLUSDC)
    );

    let maxWithdrwableEth = new BigNumber.from("0");

    if (userBalanceOfLUSDC.gt(BigNumber.from("0"))) {
      const totalCollateral = await lemmaPerpetual.getTotalCollateral();
      console.log(
        "totalCollateral",
        convertToReadableFormat(totalCollateral, 6)
      );
      const totalSupplyOfLUSDC = await lemmaToken.totalSupply();
      console.log(
        "totalSupplyOfLUSDC",
        convertToReadableFormat(totalSupplyOfLUSDC)
      );
      //TODO: add 0.1% perp fees that is not considered in following formula
      const usdcDeservedByUser = totalCollateral
        .mul(userBalanceOfLUSDC)
        .div(totalSupplyOfLUSDC);
      console.log(
        "usdcDeservedByUser",
        convertToReadableFormat(usdcDeservedByUser, 6)
      );

      const amounts = await uniswapV2Router02.getAmountsOut(
        usdcDeservedByUser,
        [addresses.rinkeby.usdc, addresses.rinkeby.weth]
      );
      console.log(convertToReadableFormat(amounts[1]));
      maxWithdrwableEth = amounts[1];

      setWithdrawableETH(maxWithdrwableEth);
    }
    //to get the deposited balance

    //look for the deposit events on the lemmaMainnet
    //look at the mint and burn events on lemmaToken

    const ethDepositedFilter = lemmaMainnet.filters.ETHDeposited(
      /*accounts == */ account
    );
    const ethDepositedEvents = await lemmaMainnet.queryFilter(
      ethDepositedFilter
    );
    console.log(ethDepositedEvents);
    let totalETHDeposited = BigNumber.from("0");
    ethDepositedEvents.forEach((ethDepositedEvent) => {
      const ethDeposited = ethDepositedEvent.args.amount;
      totalETHDeposited = totalETHDeposited.add(ethDeposited);
    });
    console.log(
      "totalETHDeposited",
      convertToReadableFormat(totalETHDeposited)
    );

    const lusdcMintedFilter = lemmaToken.filters.Transfer(
      /**from ==*/ ethers.constants.AddressZero,
      /**to == */ account
    );
    const lusdcMintedEvents = await lemmaToken.queryFilter(lusdcMintedFilter);
    console.log(lusdcMintedEvents);
    let totalLUSDCMinted = BigNumber.from("0");
    lusdcMintedEvents.forEach((lusdcMintedEvents) => {
      const lUSDCMinted = lusdcMintedEvents.args.value;
      totalLUSDCMinted = totalLUSDCMinted.add(lUSDCMinted);
    });
    console.log("totalLUSDCMinted", convertToReadableFormat(totalLUSDCMinted));

    const lusdcBurntFilter = lemmaToken.filters.Transfer(
      /**from ==*/ account,
      /**to == */ ethers.constants.AddressZero
    );
    const lusdcBurntEvents = await lemmaToken.queryFilter(lusdcBurntFilter);
    console.log(lusdcBurntEvents);
    let totalLUSDCBurnt = BigNumber.from("0");
    lusdcBurntEvents.forEach((lusdcBurntEvents) => {
      const lUSDCBurnt = lusdcBurntEvents.args.value;
      totalLUSDCBurnt = totalLUSDCBurnt.add(lUSDCBurnt);
    });
    console.log("totalLUSDCBurnt", convertToReadableFormat(totalLUSDCBurnt));

    const percentageOfLUSDCWithdrawed = totalLUSDCMinted
      .sub(totalLUSDCBurnt)
      .mul(ONE)
      .div(totalLUSDCMinted);
    const ETHDeposited = totalETHDeposited
      .mul(percentageOfLUSDCWithdrawed)
      .div(ONE);

    console.log("ETHDeposited", convertToReadableFormat(ETHDeposited));

    //according to those decide the total deposited balance
    setDeposited(ETHDeposited);
    const earnings = maxWithdrwableEth.sub(ETHDeposited);

    console.log("earings", convertToReadableFormat(earnings));
    setEarings(earnings);
  };

  const onSuccesfulDeposit = async () => {
    refreshBalances();
    setMessage("Deposit completed successfully");
    setStatus("success");
    setOpen(true);
  };
  const onSuccesfulWithdrawal = async () => {
    refreshBalances();
    setMessage("Withdraw completed successfully");
    setStatus("success");
    setOpen(true);
  };

  const handleTabChange = (event, newValue) => {
    setTabIndex(newValue);
  };

  const handleClose = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }
    setOpen(false);
  };

  const alertAnchor = {
    vertical: "top",
    horizontal: "center",
  };

  const ethData = {
    image_url: require("../../assets/img/eth.png"),
    asset: "ETH",
    balance: "0",
    deposit: "0",
    apy: "90%",
    earnings: "0",
    assetNumber: "0",
  };

  useEffect(() => {
    if (isConnected) {
      refreshBalances();
    }
  }, [isConnected]);

  return (
    <div className={classes.root}>
      <Snackbar
        open={open}
        autoHideDuration={6000}
        onClose={handleClose}
        anchorOrigin={alertAnchor}
      >
        <Alert
          elevation={6}
          variant="filled"
          onClose={handleClose}
          severity={status}
        >
          {message}
        </Alert>
      </Snackbar>
      <div className={classes.body}>
        <Grid container justify="center">
          <Grid
            container
            item
            xs={11}
            md={9}
            xl={8}
            className={classes.navigationContainer}
            justify="space-between"
          >
            <Grid item container xs={4} alignItems="center">
              <Grid item>
                <img
                  className={classes.logoImg}
                  src={require("../../assets/img/logo.png")}
                  alt=""
                />
              </Grid>
              <Grid item>
                <Typography className={classes.logo} variant="body2">
                  <b>LEMMA</b>
                </Typography>
              </Grid>
            </Grid>
            <Grid item container xs={8} justify="flex-end" spacing={5}>
              <Grid item>
                <Button className={classes.navButton} href="/registration">
                  Reserve Allocation!
                </Button>
              </Grid>
              <Grid item>
                <Button
                  className={classes.connectButton}
                  variant="outlined"
                  onClick={() => handleConnectWallet()}
                >
                  {isConnected ? account.slice(0, 8) + "..." : "Connect Wallet"}
                </Button>
              </Grid>
            </Grid>
          </Grid>

          <Grid
            container
            item
            xs={10}
            md={9}
            xl={8}
            className={classes.mainContainer}
            justify="center"
          >
            <Grid container item direction="column">
              <Grid item className={classes.title}>
                Superior, low risk, sustainable yield.
              </Grid>
              <Grid item className={classes.subtitle}>
                Deposit ETH and we’ll earn you more ETH via basis trading.
              </Grid>
            </Grid>

            <Grid
              container
              item
              className={classes.contentContainer}
              justify="center"
            >
              <Grid
                container
                item
                xs={12}
                md={5}
                lg={4}
                className={classes.paperContainer}
              >
                <Paper className={classes.actionPaper} elevation={5}>
                  <Grid
                    container
                    item
                    className={classes.actionContainer}
                    direction="column"
                    alignItems="center"
                    spacing={4}
                  >
                    <Grid item>
                      <img
                        className={classes.assetLogo}
                        src={ethData.image_url}
                        alt=""
                      />
                    </Grid>
                    <Grid container item justify="center">
                      <TabContext value={tabIndex}>
                        <TabList
                          onChange={handleTabChange}
                          indicatorColor="primary"
                          centered
                        >
                          <Tab
                            label="Deposit"
                            value="1"
                            className={classes.tab}
                          />
                          <Tab
                            label="Withdraw"
                            value="2"
                            className={classes.tab}
                          />
                        </TabList>
                        <TabPanel value="1" className={classes.tabContent}>
                          <Grid container item spacing={4}>
                            <Grid
                              container
                              item
                              xs={12}
                              direction="row"
                              justify="center"
                            >
                              <Grid
                                container
                                item
                                xs={6}
                                direction="column"
                                alignItems="center"
                              >
                                <Grid item>
                                  {" "}
                                  <Typography variant="body1">
                                    Earn APY
                                  </Typography>{" "}
                                </Grid>
                                <Grid item>
                                  {" "}
                                  <Typography variant="body1">
                                    <b>{ethData.apy}</b>
                                  </Typography>{" "}
                                </Grid>
                              </Grid>
                              <Grid
                                container
                                item
                                xs={6}
                                direction="column"
                                alignItems="center"
                              >
                                <Grid item>
                                  {" "}
                                  <Typography variant="body1">
                                    Wallet Balance
                                  </Typography>{" "}
                                </Grid>
                                <Grid item>
                                  {" "}
                                  <Typography variant="body1">
                                    <b>
                                      {isConnected
                                        ? Number(
                                            utils.formatEther(ethBalance)
                                          ).toFixed(6)
                                        : 0}
                                    </b>
                                  </Typography>{" "}
                                </Grid>
                              </Grid>
                            </Grid>
                            <Grid
                              container
                              item
                              xs={12}
                              direction="row"
                              justify="space-between"
                            >
                              <TextField
                                color="primary"
                                variant="filled"
                                value={amount}
                                autoFocus={true}
                                className={classes.input}
                                label={`${ethData.asset} Amount`}
                                onChange={(e) => handleAmountChange(e)}
                              />
                            </Grid>
                            <Grid item container xs={12} justify="center">
                              <Grid item xs={11}>
                                <Slider
                                  defaultValue={0}
                                  aria-labelledby="discrete-slider"
                                  valueLabelDisplay="off"
                                  onChange={(e, v) => handleSliderChange(e, v)}
                                  step={25}
                                  marks={[
                                    { value: 0, label: "0%" },
                                    { value: 25, label: "25%" },
                                    { value: 50, label: "50%" },
                                    { value: 75, label: "75%" },
                                    { value: 100, label: "100%" },
                                  ]}
                                  min={0}
                                  max={100}
                                />
                              </Grid>
                            </Grid>
                            <Grid item xs={12}>
                              <Button
                                fullWidth
                                className={classes.button}
                                color="primary"
                                variant="contained"
                                onClick={() => handleDepositSubmit()}
                              >
                                Deposit
                              </Button>
                            </Grid>
                          </Grid>
                        </TabPanel>
                        <TabPanel value="2" className={classes.tabContent}>
                          <Grid container item spacing={4}>
                            <Grid
                              container
                              item
                              xs={12}
                              direction="row"
                              justify="center"
                            >
                              <Grid
                                container
                                item
                                xs={6}
                                direction="column"
                                alignItems="center"
                              >
                                <Grid item>
                                  {" "}
                                  <Typography variant="body1">
                                    Deposited
                                  </Typography>{" "}
                                </Grid>
                                <Grid item>
                                  {" "}
                                  <Typography variant="body1">
                                    {Number(
                                      convertToReadableFormat(deposited)
                                    ).toFixed(6)}
                                  </Typography>{" "}
                                </Grid>
                              </Grid>
                              <Grid
                                container
                                item
                                xs={6}
                                direction="column"
                                alignItems="center"
                              >
                                <Grid item>
                                  {" "}
                                  <Typography variant="body1">
                                    Earnings
                                  </Typography>{" "}
                                </Grid>
                                <Grid item>
                                  {" "}
                                  <Typography variant="body1">
                                    {Number(
                                      convertToReadableFormat(earnings)
                                    ).toFixed(6)}
                                  </Typography>{" "}
                                </Grid>
                              </Grid>
                            </Grid>
                            <Grid
                              container
                              item
                              xs={12}
                              direction="row"
                              justify="space-between"
                            >
                              <TextField
                                color="primary"
                                variant="filled"
                                value={amount}
                                autoFocus={true}
                                className={classes.input}
                                label={`${ethData.asset} Amount`}
                                onChange={(e) => handleAmountChange(e)}
                              />
                            </Grid>
                            <Grid item container xs={12} justify="center">
                              <Grid item xs={11}>
                                <Slider
                                  defaultValue={0}
                                  aria-labelledby="discrete-slider"
                                  valueLabelDisplay="off"
                                  onChange={(e, v) =>
                                    handleWithdrawSliderChange(e, v)
                                  }
                                  step={25}
                                  marks={[
                                    { value: 0, label: "0%" },
                                    { value: 25, label: "25%" },
                                    { value: 50, label: "50%" },
                                    { value: 75, label: "75%" },
                                    { value: 100, label: "100%" },
                                  ]}
                                  min={0}
                                  max={100}
                                />
                              </Grid>
                            </Grid>
                            <Grid item xs={12}>
                              <Button
                                fullWidth
                                className={classes.button}
                                color="primary"
                                variant="contained"
                                onClick={() => handleWithdrawSubmit()}
                              >
                                Withdraw
                              </Button>
                            </Grid>
                          </Grid>
                        </TabPanel>
                      </TabContext>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </div>
    </div>
  );
}

export default withStyles(styles)(LandingPage);

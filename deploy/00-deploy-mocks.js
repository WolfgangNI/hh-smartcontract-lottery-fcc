const { network } = require("hardhat")
const { developmentChains } = require("../helper-hardhat-config")

const BASE_FEE = ethers.utils.parseEther("0.25") // Premium see https://docs.chain.link/vrf/v2/subscription/supported-networks/#goerli-testnet
const GAS_PRICE_LINK = 1e9 // I dont understand how to decide which Value to choose here...

module.exports = async function ({ getNamedAccounts, deployments }) {
    // taking those arguments as its input variables from the hardhat runtime enviroment (hre)
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const args = [BASE_FEE, GAS_PRICE_LINK]

    if (developmentChains.includes(network.name)) {
        log("Local network detected! Deploying mocks...")
        // deploy a mock vrfcoordinator...
        await deploy("VRFCoordinatorV2Mock", {
            from: deployer,
            log: true,
            args: args, // the constructor of the VRFCoordinatorV2Mock has the following arguments: constructor(uint96 _baseFee, uint96 _gasPriceLink) {
        })
        log("Mocks Deployed!")
        log("--------------------------------------")
    }
}

module.exports.tags = ["all", "mocks"]

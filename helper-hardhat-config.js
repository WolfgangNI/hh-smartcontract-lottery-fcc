const { ethers } = require("hardhat")

const networkConfig = {
	5: {
		name: "goerli",
		vrfCoordinatorV2: "0x2Ca8E0C643bDe4C2E08ab1fA0da3401AdAD7734D",
		entranceFee: ethers.utils.parseEther("0.01"),
		gasLane: "0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15",
		subscriptionId: "9526",
		callbackGasLimit: "500000",
		interval: "30", // seconds
	},
	31337: {
		name: "hardhat",
		entranceFee: ethers.utils.parseEther("0.01"),
		gasLane: "0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15", // This is gonna be mocked anyway so no need to put the actual gaslane address in here
		callbackGasLimit: "500000",
		interval: "20",
	},
}

const developmentChains = ["hardhat", "localhost"]

module.exports = {
	networkConfig,
	developmentChains,
}

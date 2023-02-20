const { network, ethers } = require("hardhat") // since I use the network.config.blockConfirmations hardhat network needs to be imported, which actually gets this value from the hardhat.config.js
const { developmentChains, networkConfig } = require("../helper-hardhat-config") // networkConfig acceses helper-hardhat-config,js
const { verify } = require("../utils/verify") // imports the verify.js from the utils folder

const VRF_SUB_FUND_AMOUNT = ethers.utils.parseEther("2")

module.exports = async function ({ getNamedAccounts, deployments }) {
	const { deploy, log } = deployments
	const { deployer } = await getNamedAccounts()
	const chainId = network.config.chainId //Patrick said we should use network.name ... // network accesses harhat.config.js through hardhat Runtime emviroment i think
	let vrfCoordinatorV2Address, subscriptionId, vrfCoordinatorV2Mock

	if (developmentChains.includes(network.name)) {
		vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
		vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address
		const transactionResponse = await vrfCoordinatorV2Mock.createSubscription()
		const transactionReceipt = await transactionResponse.wait(1)
		// console.log("Log: subscriptionId before event call is " + subscriptionId) // this was for debugging
		subscriptionId = transactionReceipt.events[0].args.subId
		// console.log("Log: subscriptionId from events is " + subscriptionId) // this was for debugging
		await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT)
	} else {
		vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"]
		subscriptionId = networkConfig[chainId]["subscriptionId"]
	}

	const entranceFee = networkConfig[chainId]["entranceFee"]
	const gasLane = networkConfig[chainId]["gasLane"]
	const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"]
	const interval = networkConfig[chainId]["interval"]

	const args = [
		vrfCoordinatorV2Address,
		entranceFee,
		gasLane,
		subscriptionId,
		callbackGasLimit,
		interval,
	]
	const raffle = await deploy("Raffle_2", {
		from: deployer,
		args: args,
		log: true,
		waitConfimrations: network.config.blockConfirmations || 1,
	})

	// verify piece // and including raffle as a consumer for vrfCoordinatorV2Mock
	if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
		log("Verifying...")
		await verify(raffle.address, args)
	} else {
		await vrfCoordinatorV2Mock.addConsumer(subscriptionId, raffle.address) // to not get the Error of invalidConsumer() when using vrfCoordinatorMockV2 I have to add the consumer for my contract or sth like that.
	}

	log("----------------------------")
}

module.exports.tags = ["all", "raffle"]

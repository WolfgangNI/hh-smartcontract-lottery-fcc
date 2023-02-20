const { network, ethers } = require("hardhat") // since I use the network.config.blockConfirmations hardhat network needs to be imported, which actually gets this value from the hardhat.config.js
const { developmentChains, networkConfig } = require("../helper-hardhat-config") // networkConfig acceses helper-hardhat-config,js
const { verify } = require("../utils/verify") // imports the verify.js from the utils folder

async function verifyRaffle() {
	const { deploy, log } = deployments
	const { deployer } = await getNamedAccounts()
	const chainId = network.config.chainId

	// deployer = (await getNamedAccounts()).deployer
	raffle = await ethers.getContract("Raffle_2", deployer)

	vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"]
	const entranceFee = networkConfig[chainId]["entranceFee"]
	const gasLane = networkConfig[chainId]["gasLane"]
	subscriptionId = networkConfig[chainId]["subscriptionId"]
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

	log("Verifying...")
	await verify(raffle.address, args)
}

verifyRaffle()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error)
		process.exit(1)
	})

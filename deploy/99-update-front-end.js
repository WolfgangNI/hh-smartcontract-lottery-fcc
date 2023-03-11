const { ethers } = require("hardhat")
const fs = require("fs")

const FRONT_END_ADDRESSES_FILE =
	"../nextjs-smartcontract-lottery-fcc/constants/contractAddresses.json"
const FRONT_END_ABI_FILE = "../nextjs-smartcontract-lottery-fcc/constants/abi.json"

module.exports = async function () {
	if (process.env.UPDATE_FRONT_END) {
		console.log("Updating front end...")
		console.log("----------------------------")
		updateContractAddresses()
		updateAbi()
	}
}

async function updateAbi() {
	const raffle = await ethers.getContract("Raffle_2")
	fs.writeFileSync(FRONT_END_ABI_FILE, raffle.interface.format(ethers.utils.FormatTypes.json)) // raffle.interface.format(ethers.utils.FormatTypes.json) This is an ethers function to get the ABI https://docs.ethers.org/v5/api/utils/abi/interface/
}

async function updateContractAddresses() {
	const raffle = await ethers.getContract("Raffle_2")
	const chainId = network.config.chainId.toString()
	const currentAddresses = JSON.parse(fs.readFileSync(FRONT_END_ADDRESSES_FILE, "utf8"))
	if (chainId in currentAddresses) {
		if (!currentAddresses[chainId].includes(raffle.address)) {
			currentAddresses[chainId].push(raffle.address)
		}
	}
	{
		currentAddresses[chainId] = [raffle.address] // why isnt this part of the "if" as the "else"? and shouldnt i in this situation just add a new chain id with a new address? This isnt creating a new chain id in the currentAddresses.json...
	}
	fs.writeFileSync(FRONT_END_ADDRESSES_FILE, JSON.stringify(currentAddresses)) // why do we use .stringify and not .toString?
}

module.exports.tags = ["all", "frontend"]

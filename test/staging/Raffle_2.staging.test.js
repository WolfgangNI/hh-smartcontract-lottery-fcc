//staging tests don't work https://github.com/smartcontractkit/full-blockchain-solidity-course-js/discussions/4172

const { assert, expect } = require("chai")
const { getNamedAccounts, deployments, ethers, network } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

let raffle,
	raffleEntranceFee,
	deployer,
	startingTimeStamp,
	accounts,
	recentWinner,
	raffleState,
	winnerEndingBalance,
	endingTimeStamp,
	txRpEnterRaffle,
	txRcEnterRaffle,
	winnerStartingBalance,
	gasCostEnterRaffle

developmentChains.includes(network.name)
	? describe.skip
	: describe("Raffle Staging Tests", function () {
			beforeEach(async () => {
				deployer = (await getNamedAccounts()).deployer // this way the deployer is available for the other functions too. if I initialized this here then it would only be available inside the before each function: const { deployer } = await getNamedAccounts() // explanation from ChatGPT: So in summary, this line of code: (await getNamedAccounts()).deployer  is waiting for the getNamedAccounts() function to return the object containing the accounts addresses, and then it is extracting the deployer property from the object and it is going to be assigned to the variable with the same name.
				console.log("deployer: " + deployer)

				raffle = await ethers.getContract("Raffle_2", deployer) // means we get the Raffle Contract and connect it to our deployer
				console.log("Raffle Contract: " + raffle)
				raffleEntranceFee = await raffle.getEntranceFee()
				console.log("raffleEntranceFee: " + raffleEntranceFee)
			})

			describe("fullfillRandomWords", function () {
				it("Setup", async () => {
					console.log("Setting up test...")
					startingTimeStamp = await raffle.getLatestTimeStamp()
					console.log("startingTimeStamp: " + startingTimeStamp)
					accounts = await ethers.getSigners()
					console.log("accounts: " + accounts)

					console.log("Setting up Listener...")
					await new Promise(async (resolve, reject) => {
						console.log("Promise started")

						// setup listener before we enter the raffle
						// just in case  the blockchain moves REALLY fast

						raffle.once("WinnerPicked", async () => {
							// await new Promise((resolve) => setTimeout(resolve, 2 * 60 * 1000))
							console.log("WinnerPicked event fired!")
							try {
								console.log("try block started")
								recentWinner = await raffle.getRecentWinner()
								console.log("recentWinner: " + recentWinner)
								raffleState = await raffle.getRaffleState()
								winnerEndingBalance = await accounts[0].getBalance()
								endingTimeStamp = await raffle.getLatestTimeStamp()
								console.log("about to resolve")
								// resolve()
							} catch (error) {
								console.log(error)
								reject(error)
							}
							console.log("try block done")
							resolve()
						})

						// Then entering the raffle

						console.log("Entering the Raffle...")
						txRpEnterRaffle = await raffle.enterRaffle({ value: raffleEntranceFee })
						txRcEnterRaffle = await txRpEnterRaffle.wait(1)
						console.log("Ok, time to wait...")
						winnerStartingBalance = await accounts[0].getBalance()
						console.log("winnerStartingBalance: " + winnerStartingBalance)

						// finding out the gas costs:

						{
							const { gasUsed, effectiveGasPrice } = txRcEnterRaffle
							gasCostEnterRaffle = gasUsed.mul(effectiveGasPrice)
						}
						console.log("gasCostEnterRaffle: " + gasCostEnterRaffle)

						// and this ode WONT complete until our listener has finsihed listening!
					})
				})
				it("expects raffle.getPlayer to be reverted", async () => {
					console.log("assertion incoming")
					await expect(raffle.getPlayer(0)).to.be.reverted // check if the Players Array has been reseted
				})
				it("asserts recentWinner to be 0", async () => {
					console.log("assertion incoming")
					assert.equal(recentWinner.toString(), accounts[0].address) // check if the recentWinner works
				})
				it("asserts raffleState to be 0", async () => {
					console.log("assertion incoming")
					assert.equal(raffleState, 0) // check if the raffleState Enum has been reseted
				})
				it("asserts endingTimeStamp > startingTimeStamp", async () => {
					console.log("assertion incoming")
					assert(endingTimeStamp > startingTimeStamp) // check if TimeStamps make sense
				})
				it("asserts that the winner gets all the money minus the gascosts", async () => {
					console.log("assertion incoming")
					assert.equal(
						winnerEndingBalance.toString(),
						winnerStartingBalance
							.add(raffleEntranceFee)
							.sub(gasCostEnterRaffle)
							.add(gasCostEnterRaffle)
							.toString()
					)
				})
			})
	  })

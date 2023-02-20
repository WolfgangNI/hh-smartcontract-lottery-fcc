const { assert, expect } = require("chai")
const { getNamedAccounts, deployments, ethers, network } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")
const { BigNumber } = require("ethers") // using this to hardcode in that the gasCosts should be considered

!developmentChains.includes(network.name)
	? describe.skip
	: describe("Raffle Unit Tests", function () {
			let raffle, raffleEntranceFee, deployer, interval //, vrfCoordinatorV2Mock (This was commented out. Not sure why. and weird that it works that way...)
			const chainId = network.config.chainId

			beforeEach(async () => {
				deployer = (await getNamedAccounts()).deployer // this way the deployer is available for the other functions too. if I used this then it would only be available inside the before each function: const { deployer } = await getNamedAccounts() // explanation from ChatGPT: So in summary, this line of code: (await getNamedAccounts()).deployer  is waiting for the getNamedAccounts() function to return the object containing the accounts addresses, and then it is extracting the deployer property from the object and it is going to be assigned to the variable with the same name.
				await deployments.fixture(["all"]) // this deploys the contracts using the deploy scripts with the tag "all" // Cited from hh deploy comment: ["fixture"...] execute deployment as fixture for test // use evm_snapshot to revert back
				raffle = await ethers.getContract("Raffle_2", deployer) // means we get the Raffle Contract and connect it to our deployer
				vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
				raffleEntranceFee = await raffle.getEntranceFee()
				interval = await raffle.getInterval()
			})

			describe("constructor", function () {
				it("Initializes the raffle correctly", async () => {
					const raffleState = await raffle.getRaffleState()
					const subscriptionId = await raffle.getSubscriptionId()
					assert.equal(raffleState.toString(), "0")
					assert.equal(interval.toString(), networkConfig[chainId]["interval"]) // why does patrick use [] instead of . here?
					//   assert.equal(subscriptionId.toString(), "0")
				})
			})
			describe("enterRaffle", function () {
				it("reverts when you don't pay enough", async () => {
					await expect(
						raffle.enterRaffle({ value: ethers.utils.parseEther("0.001") }) // this is how to send a eth value with the functioncall
					).to.be.revertedWith("Raffle__NotEnoughETHEntered")
				})
				it("records players when they enter", async () => {
					await raffle.enterRaffle({ value: raffleEntranceFee })
					const recordedPlayer = await raffle.getPlayer(0)
					assert.equal(recordedPlayer, deployer)
				})
				it("emits event on enter", async () => {
					await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(
						raffle, // expects the RAFFLE contract to
						"RaffleEnter" // emit RAFFLEENTER
					)
				})
				it("doesn't allow entrance when raffle is calculating", async () => {
					await raffle.enterRaffle({ value: raffleEntranceFee })
					await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]) // this is one of those: hardhat.org/hardhat-network/docs/reference#evm_increasetime
					await network.provider.send("evm_mine", []) // mines the next block with. Empty array means no special stuff. Could have also doen it like this: await network.provider.request({method: "evm_mine", params: []})
					// We pretend to be a Chainlink Keeper
					await raffle.performUpkeep([]) // another way to send a blank bytes object is to send "0x"
					await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.be.revertedWith(
						"Raffle__NotOpen"
					)
				})
			})
			describe("checkUpkeep", function () {
				it("retuns false if people haven't sent any ETH", async () => {
					await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]) // this is one of those: hardhat.org/hardhat-network/docs/reference#evm_increasetime
					await network.provider.send("evm_mine", []) // mines the next block with. Empty array means no special stuff. Could have also doen it like this: await network.provider.request({method: "evm_mine", params: []})
					const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]) // callstatic lets me just call the function without setting off a transaction (cGPT:  .callStatic allows the code to retrieve information from the smart contract without changing its state.) . extrapulate or sth is what we do before the = . This normally would be called destructuring Extrapolate is not a word used in JS (source cGPT)
					assert(!upkeepNeeded) // upkeepNeeded should be false since it isnt needed
				})
				it("retuns false if raffle isn't open", async () => {
					await raffle.enterRaffle({ value: raffleEntranceFee })
					await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]) // this is one of those: hardhat.org/hardhat-network/docs/reference#evm_increasetime
					await network.provider.send("evm_mine", []) // mines the next block with. Empty array means no special stuff. Could have also doen it like this: await network.provider.request({method: "evm_mine", params: []})
					await raffle.performUpkeep("0x") // another way to send a blank bytes object is to send "0x"
					const raffleState = await raffle.getRaffleState()
					const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]) // callstatic lets me just call the function without setting off a transaction (cGPT:  .callStatic allows the code to retrieve information from the smart contract without changing its state.) . extrapulate or sth is what we do before the = . This normally would be called destructuring Extrapolate is not a word used in JS (source cGPT)
					assert.equal(raffleState.toString(), "1")
					assert(!upkeepNeeded) // upkeepNeeded should be false since it isnt needed
				})
				it("returns false if enough time hasn't passed", async () => {
					await raffle.enterRaffle({ value: raffleEntranceFee })
					await network.provider.send("evm_increaseTime", [interval.toNumber() - 5]) // use a higher number here if this test fails
					await network.provider.request({ method: "evm_mine", params: [] })
					const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
					assert(!upkeepNeeded)
				})
				it("returns true if enough time has passed, has players, eth, and is open", async () => {
					await raffle.enterRaffle({ value: raffleEntranceFee })
					await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]) // unit of the time is seconds
					await network.provider.request({ method: "evm_mine", params: [] })
					const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
					assert(upkeepNeeded)
				})
			})
			describe("performUpkeep", function () {
				it("can only run if checkupkeep is true", async () => {
					await raffle.enterRaffle({ value: raffleEntranceFee })
					await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]) // unit of the time is seconds
					await network.provider.request({ method: "evm_mine", params: [] })
					const txResponse = await raffle.performUpkeep([])
					assert(txResponse)
				})
				it("reverts when checkUpkeep is false", async () => {
					//   const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x") // those are not necessary but I put them in to make sure that upkeep is not needed
					//   assert(!upkeepNeeded)
					const balance = await raffle.getBalance() // have to wait to get those values befor performing the assertion below. Thats why i added these constants
					const numberOfPlayers = await raffle.getNumberOfPlayers()
					const raffleState = await raffle.getRaffleState()
					await expect(raffle.performUpkeep([])).to.be.revertedWith(
						`Raffle__UpkeepNotNeeded(${balance}, ${numberOfPlayers}, ${raffleState})` // string interpolation // not necessary but if i want to make sure certain arguments are reverted with it this is how to do it
					)
				})
				it("updates the raffle state, emits an event and calls the vrf coordinator", async () => {
					await raffle.enterRaffle({ value: raffleEntranceFee })
					await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]) // unit of the time is seconds
					await network.provider.request({ method: "evm_mine", params: [] })
					const txResponse = await raffle.performUpkeep([])
					const txReceipt = await txResponse.wait(1)
					const requestId = txReceipt.events[1].args.requestId
					assert(requestId /*.toNumber()*/ > 0)
					const raffleState = await raffle.getRaffleState()
					assert(raffleState /*.toString()*/ == 1)
				})
			})
			describe("fullfillRandomWords", function () {
				beforeEach(async () => {
					await raffle.enterRaffle({ value: raffleEntranceFee })
					await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]) // unit of the time is seconds
					await network.provider.request({ method: "evm_mine", params: [] })
				})
				it("can only be called after performUpkeep", async () => {
					await expect(
						vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)
					).to.be.revertedWith("nonexistent request")
					await expect(
						vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address)
					).to.be.revertedWith("nonexistent request")
				})
				it("picks a winner, resets the lottery, and sends money", async () => {
					const additionalEntrants = 3 // we will have 3 accounts entering the lottery
					const startingAccountIndex = 1 // deployer = 0
					const accounts = await ethers.getSigners()
					for (let i = startingAccountIndex; i < startingAccountIndex + additionalEntrants; i++) {
						const accountConnectedRaffle = raffle.connect(accounts[i])
						await raffle.enterRaffle({ value: raffleEntranceFee })
					}
					const startingTimeStamp = await raffle.getLatestTimeStamp()
					// performUpkeep (mock being Chainlink Keepers)
					// fulfillRandomWords (mock being the Chainlink VRF)
					// We will have to wait for the fulfillRandomWords to be called // so we are setting up a listner // the promise is to make sure that the test isnt finished before the listner is done listening
					await new Promise(async (resolve, reject) => {
						// this is a classic setup of a promise
						raffle.once("WinnerPicked", async () => {
							console.log("Found the event!")
							// I set the timeout of 200s in the hardhat.config.js at mocha
							try {
								const recentWinner = await raffle.getRecentWinner()
								console.log("Winner:" + recentWinner)
								console.log("Deployer:" + accounts[0].address) // .address to only print out the address value of the signer and not all the data of the signer
								console.log("Contestant 1:" + accounts[1].address)
								console.log("Contestant 2:" + accounts[2].address)
								console.log("Contestant 3:" + accounts[3].address)
								const raffleState = await raffle.getRaffleState()
								const endingTimestamp = await raffle.getLatestTimeStamp()
								const numPlayers = await raffle.getNumberOfPlayers()
								const winnerEndingBalance = await accounts[0].getBalance()
								assert.equal(numPlayers.toString(), "0")
								assert.equal(raffleState.toString(), "0")
								assert(endingTimestamp > startingTimeStamp)

								assert.equal(
									winnerEndingBalance.toString(),
									winnerStartingBalance
										.add(
											raffleEntranceFee.mul(additionalEntrants).add(raffleEntranceFee).sub(gasCost)
										)
										.toString()
								)
								resolve() // if try passes, resolves the promise

								// since we use a timeout which would result in failing we want to be able to catch this error with the try catch thingy
							} catch (e) {
								console.log(e)
								reject(e)
							}
						}) // listen for this "WinnerPicked" event // so this will be fired later when raffle emits this event, until then the other stuff in this "Promise" will be performed
						const tx = await raffle.performUpkeep([])
						const txReceipt = await tx.wait(1)
						const winnerStartingBalance = await accounts[0].getBalance() // since in my case for the Mock it will always be the account[0] (deployer) i can just hardcode it like this
						const transactionResponse = await vrfCoordinatorV2Mock.fulfillRandomWords(
							txReceipt.events[1].args.requestId,
							raffle.address
						)
						// finding out the gas costs:
						const transactionReceipt = await transactionResponse.wait(1)
						const { gasUsed, effectiveGasPrice } = transactionReceipt
						const gasCost = gasUsed.mul(effectiveGasPrice)
					})
				})
			})
	  })

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.7;

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol"; // have to run yarn add --dev @chainlink/contracts
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/KeeperCompatibleInterface.sol";

error Raffle__NotEnoughETHEntered();
error Raffle__TransferFailed();
error Raffle__NotOpen();
error Raffle__UpkeepNotNeeded(uint256 currentBalance, uint256 numPlayers, uint256 raffleState);

/**
 * @title A sample Raffle Contract
 * @author Wolfgang
 * @notice This contract is for creating an untamperable decentralized smart contract
 * @dev This impleents Chainlink VRF v2 and Chanlink Keepers
 */

// "is VRFConsumerBaseV2" makes our contract inherit the VRFConsumerBaseV2.sol contract
contract Raffle_2 is VRFConsumerBaseV2, KeeperCompatibleInterface {
	/* Type declarations */
	enum RaffleState {
		OPEN,
		CALCULATING
	} // uint256 0 = OPEN, 1 = CALCULATING

	/* State Variables */
	uint256 private immutable i_entranceFee;
	address payable[] private s_players;
	VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
	bytes32 private immutable i_gasLane;
	uint64 private immutable i_subscriptionId;
	uint16 private constant REQUEST_CONFIRMATIONS = 3;
	uint32 private immutable i_callbackGasLimit;
	uint32 private constant NUM_WORDS = 1;

	// Lottery Variables - also State Variables
	address private s_recentWinner;
	RaffleState private s_raffleState;
	uint256 private s_lastTimeStamp;
	uint256 private immutable i_interval;

	/* Events */
	event RaffleEnter(address indexed player);
	event RequestedRaffleWinner(uint256 indexed requestId);
	event WinnerPicked(address indexed winner);

	/* Functions */
	constructor(
		address vrfCoordinatorV2, // contract: Mock has to be created
		uint256 entranceFee,
		bytes32 gasLane,
		uint64 subscriptionId,
		uint32 callbackGasLimit,
		uint256 interval
	) VRFConsumerBaseV2(vrfCoordinatorV2) {
		i_entranceFee = entranceFee;
		i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
		i_gasLane = gasLane;
		i_subscriptionId = subscriptionId;
		i_callbackGasLimit = callbackGasLimit;
		s_raffleState = RaffleState.OPEN;
		s_lastTimeStamp = block.timestamp;
		i_interval = interval;
	}

	function enterRaffle() public payable {
		// uses more gas than an custom error message: require (msg.value > i_entranceFee, "Not enough ETH!")
		if (msg.value < i_entranceFee) {
			revert Raffle__NotEnoughETHEntered();
		}
		if (s_raffleState != RaffleState.OPEN) {
			revert Raffle__NotOpen();
		}
		s_players.push(payable(msg.sender)); //typecasted msg.sender as payable
		// Emit an event when we update a dynamic array or mapping
		// Named events with the function name reversed
		emit RaffleEnter(msg.sender);
	}

	/**
	 * @dev This is the function that the Chainlink Keeper nodes call
	 * they look for the `upkeepNeeded` to return true
	 * The following should be true in order to return true:
	 * 1. Our time interval should have passed
	 * 2. The lottery should have at least 1 player, and have some ETH
	 * 3. Our subscription is funded with LINK
	 * 4. The lottery should be in an "open" state.
	 */
	function checkUpkeep(
		//for testing purposes this can not be a view function
		bytes memory /* checkData */ //changed from calldata to memory bc calldata cant work with strings and we give this and empty sting by ("") in performUpkeep
	) public view override returns (bool upkeepNeeded, bytes memory /* perform Data */) {
		bool isOpen = (RaffleState.OPEN == s_raffleState);
		bool timePassed = ((block.timestamp - s_lastTimeStamp) > i_interval);
		bool hasPlayers = (s_players.length > 0);
		bool hasBalance = address(this).balance > 0;
		upkeepNeeded = (isOpen && timePassed && hasPlayers && hasBalance);
	}

	function performUpkeep(bytes calldata /* checkData */) external override {
		// Request the random number
		(bool upkeepNeeded, ) = checkUpkeep("");
		if (!upkeepNeeded) {
			revert Raffle__UpkeepNotNeeded(
				address(this).balance,
				s_players.length,
				uint256(s_raffleState)
			);
		}
		s_raffleState = RaffleState.CALCULATING;
		uint256 requestId = i_vrfCoordinator.requestRandomWords(
			i_gasLane, // keyHash / gasLane -> means max gas i'm willing to pay
			i_subscriptionId,
			REQUEST_CONFIRMATIONS,
			i_callbackGasLimit,
			NUM_WORDS
		);
		emit RequestedRaffleWinner(requestId); // This is redundant! since vrfCoordinator.sol already emits this on its own

		// 2 transaction process
	}

	// Once we get it, do soething with it
	function fulfillRandomWords(
		uint256 /* requestId */,
		uint256[] memory randomWords
	) internal override {
		// fulfillRandomWords needs the uint256 (requestId), but since we dont use the requestId we comment it out and just give an empty uint256 to the function
		// Modulo: 202(RandomWord) % 10(s_players size) = 2
		uint256 indexOfWinner = randomWords[0] % s_players.length;
		address payable recentWinner = s_players[indexOfWinner];
		s_recentWinner = recentWinner;
		(bool success, ) = recentWinner.call{value: address(this).balance}(""); //this is sending the winner the balance of this contract
		if (!success) {
			revert Raffle__TransferFailed();
		}
		emit WinnerPicked(recentWinner);
		s_players = new address payable[](0);
		s_lastTimeStamp = block.timestamp;
		s_raffleState = RaffleState.OPEN;
	}

	/* View / Pure functions */
	function getEntranceFee() public view returns (uint256) {
		return i_entranceFee;
	}

	function getPlayer(uint256 index) public view returns (address) {
		return s_players[index];
	}

	function getRecentWinner() public view returns (address) {
		return s_recentWinner;
	}

	function getRaffleState() public view returns (RaffleState) {
		return s_raffleState;
	}

	function getNumWords() public pure returns (uint256) {
		// bc this isnt reading from storage (we just set it to 1) this can be a pure
		return NUM_WORDS;
	}

	function getNumberOfPlayers() public view returns (uint256) {
		return s_players.length;
	}

	function getLatestTimeStamp() public view returns (uint256) {
		return s_lastTimeStamp;
	}

	function getRequestConfirmations() public pure returns (uint16) {
		return REQUEST_CONFIRMATIONS;
	}

	function getInterval() public view returns (uint256) {
		return i_interval;
	}

	function getSubscriptionId() public view returns (uint64) {
		return i_subscriptionId;
	}

	function getBalance() public view returns (uint256) {
		return address(this).balance;
	}
}

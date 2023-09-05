"use strict"

const FLN = "FLN"
const FRA = "FRA"

var states = {}
var game = null
var view = null

exports.scenarios = [ "Standard" ]

exports.roles = [ FLN, FRA ]

function gen_action(action, argument) {
	if (!(action in view.actions))
		view.actions[action] = []
	view.actions[action].push(argument)
}

function gen_action_token(token) {
	gen_action("token", token)
}

exports.action = function (state, player, action, arg) {
	game = state
	let S = states[game.state]
	if (action in S)
		S[action](arg, player)
	else if (action === "undo" && game.undo && game.undo.length > 0)
		pop_undo()
	else
		throw new Error("Invalid action: " + action)
	return game
}

exports.view = function(state, player) {
	game = state

	view = {
		log: game.log,
		prompt: null,
	}

	if (game.state === "game_over") {
		view.prompt = game.victory
	} else if (player !== game.active) {
		let inactive = states[game.state].inactive || game.state
		view.prompt = `Waiting for ${game.active} \u2014 ${inactive}...`
	} else {
		view.actions = {}
		states[game.state].prompt()
		if (game.undo && game.undo.length > 0)
			view.actions.undo = 1
		else
			view.actions.undo = 0
	}

	return view
}

exports.resign = function (state, player) {
	game = state
	if (game.state !== 'game_over') {
		if (player === FLN)
			goto_game_over(FRA, "FLN resigned.")
		if (player === FRA)
			goto_game_over(FLN, "France resigned.")
	}
	return game
}

function goto_game_over(result, victory) {
	game.state = "game_over"
	game.active = "None"
	game.result = result
	game.victory = victory
	log("")
	log(game.victory)
	return false
}

states.game_over = {
	prompt() {
		view.prompt = game.victory
	},
}

// === PREPARATION ===

exports.setup = function (seed, scenario, options) {
	game = {
		seed: seed,
		state: null,
		log: [],
		undo: [],
	}

	game.active =  RED
	goto_random_event()

	return game
}

// === FLOW OF PLAY ===

function goto_random_event() {
	game.state = "random_event"
}

states.random_event = {
	inactive: "to roll for a random event",
	prompt() {
		view.prompt = "Roll for a random event."
		gen_action("roll")
	},
	roll() {
		clear_undo()
		let rnd = 10 * roll_d6() + roll_d6()
		log("Random event roll " + rnd)
		// goto_reinforcement_phase()
	},
}

function goto_reinforcement_phase() {
	game.state = "reinforcement"
}

// === COMMON LIBRARY ===

function log(msg) {
	game.log.push(msg)
}

function clear_undo() {
	game.undo.length = 0
}

function push_undo() {
	let copy = {}
	for (let k in game) {
		let v = game[k]
		if (k === "undo")
			continue
		else if (k === "log")
			v = v.length
		else if (typeof v === "object" && v !== null)
			v = object_copy(v)
		copy[k] = v
	}
	game.undo.push(copy)
}

function pop_undo() {
	let save_log = game.log
	let save_undo = game.undo
	game = save_undo.pop()
	save_log.length = game.log
	game.log = save_log
	game.undo = save_undo
}

function random(range) {
	// An MLCG using integer arithmetic with doubles.
	// https://www.ams.org/journals/mcom/1999-68-225/S0025-5718-99-00996-5/S0025-5718-99-00996-5.pdf
	// m = 2**35 − 31
	return (game.seed = game.seed * 200105 % 34359738337) % range
}

function shuffle(list) {
	// Fisher-Yates shuffle
	for (let i = list.length - 1; i > 0; --i) {
		let j = random(i + 1)
		let tmp = list[j]
		list[j] = list[i]
		list[i] = tmp
	}
}

function roll_d6() {
	return random(6) + 1;
}

// Fast deep copy for objects without cycles
function object_copy(original) {
	if (Array.isArray(original)) {
		let n = original.length
		let copy = new Array(n)
		for (let i = 0; i < n; ++i) {
			let v = original[i]
			if (typeof v === "object" && v !== null)
				copy[i] = object_copy(v)
			else
				copy[i] = v
		}
		return copy
	} else {
		let copy = {}
		for (let i in original) {
			let v = original[i]
			if (typeof v === "object" && v !== null)
				copy[i] = object_copy(v)
			else
				copy[i] = v
		}
		return copy
	}
}

// Array remove and insert (faster than splice)

function array_remove(array, index) {
	let n = array.length
	for (let i = index + 1; i < n; ++i)
		array[i - 1] = array[i]
	array.length = n - 1
}

function array_remove_item(array, item) {
	let n = array.length
	for (let i = 0; i < n; ++i)
		if (array[i] === item)
			return array_remove(array, i)
}

"use strict"

const RED = "Red"
const BLUE = "Blue"

var game, states

exports.scenarios = [ "Standard" ]

exports.roles = [ RED, BLUE ]

exports.setup = function (seed, scenario, options) {
	game = {
		seed: seed,
		state: null,
		log: [],
		undo: [],
	}
	return game
}

exports.action = function (state, player, action, arg) {
	game = state
	let S = states[game.state]
	if (action in S)
		S[action](arg, player)
	else
		throw new Error("Invalid action: " + action)
	return game
}

exports.resign = function (state, player) {
	game = state
	if (game.state !== 'game_over') {
		if (player === RED)
			goto_game_over(BLUE, "Red resigned.")
		if (player === BLUE)
			goto_game_over(RED, "Blue resigned.")
	}
	return game
}

exports.view = function(state, player) {
	game = state

	let view = {
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

	return view;
}

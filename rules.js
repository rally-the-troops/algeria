"use strict"

const FLN = "FLN"
const GOV = "Government"
const BOTH = "Both"

const unit_count = 120

const FR_XX = 0
const FR_X = 1
const EL_X = 2
const AL_X = 3
const POL = 4
const FAILEK = 5
const BAND = 6
const CADRE = 7
const FRONT = 8

// Free deployment holding box
const DEPLOY = 1
const ELIMINATED = 2

var states = {}
var game = null
var view = null

const {
	areas, zones, locations, units
} = require("./data.js")

// === UNIT STATE ===

// location (8 bits), dispersed (1 bit), airmobile (1 bit), neutralized (1 bit)

function apply_select(u) {
	if (game.selected === u)
		game.selected = -1
	else
		game.selected = u
}

function pop_selected() {
	let u = game.selected
	game.selected = -1
	return u
}

const UNIT_NEUTRALIZED_SHIFT = 0
const UNIT_NEUTRALIZED_MASK = 1 << UNIT_NEUTRALIZED_SHIFT

const UNIT_AIRMOBILE_SHIFT = 1
const UNIT_AIRMOBILE_MASK = 1 << UNIT_AIRMOBILE_SHIFT

const UNIT_DISPERSED_SHIFT = 2
const UNIT_DISPERSED_MASK = 1 << UNIT_DISPERSED_SHIFT

const UNIT_LOC_SHIFT = 3
const UNIT_LOC_MASK = 255 << UNIT_LOC_SHIFT

// neutralized

function is_unit_neutralized(u) {
	return (game.units[u] & UNIT_NEUTRALIZED_MASK) === UNIT_NEUTRALIZED_MASK
}

function is_unit_not_neutralized(u) {
	return (game.units[u] & UNIT_NEUTRALIZED_MASK) !== UNIT_NEUTRALIZED_MASK
}

function set_unit_neutralized(u) {
	game.units[u] |= UNIT_NEUTRALIZED_MASK
}

function clear_unit_neutralized(u) {
	game.units[u] &= ~UNIT_NEUTRALIZED_MASK
}

// location

function unit_loc(u) {
	return (game.units[u] & UNIT_LOC_MASK) >> UNIT_LOC_SHIFT
}

function set_unit_loc(u, x) {
	game.units[u] = (game.units[u] & ~UNIT_LOC_MASK) | (x << UNIT_LOC_SHIFT)
}

// airmobile

function is_unit_airmobile(u) {
	return (game.units[u] & UNIT_AIRMOBILE_MASK) === UNIT_AIRMOBILE_MASK
}

function is_unit_not_airmobile(u) {
	return (game.units[u] & UNIT_AIRMOBILE_MASK) !== UNIT_AIRMOBILE_MASK
}

function set_unit_airmobile(u) {
	game.units[u] |= UNIT_AIRMOBILE_MASK
}

function clear_unit_airmobile(u) {
	game.units[u] &= ~UNIT_AIRMOBILE_MASK
}

// dispersed

function is_unit_dispersed(u) {
	return (game.units[u] & UNIT_DISPERSED_MASK) === UNIT_DISPERSED_MASK
}

function is_unit_not_dispersed(u) {
	return (game.units[u] & UNIT_DISPERSED_MASK) !== UNIT_DISPERSED_MASK
}

function set_unit_dispersed(u) {
	game.units[u] |= UNIT_DISPERSED_MASK
}

function clear_unit_dispersed(u) {
	game.units[u] &= ~UNIT_DISPERSED_MASK
}

// moved

function is_unit_moved(u) {
	return set_has(game.moved, u)
}

function set_unit_moved(u) {
	set_add(game.moved, u)
}

// fired

function is_unit_fired(u) {
	return set_has(game.fired, u)
}

function set_unit_fired(u) {
	set_add(game.fired, u)
}

function eliminate_unit(u) {
	game.units[u] = 0
	set_unit_loc(u, ELIMINATED)
}

function is_unit_eliminated(u) {
	return unit_loc(u) === ELIMINATED
}

// === UNIT DATA ===

function find_free_unit_by_type(type) {
	for (let u = 0; u < unit_count; ++u)
		if (!game.units[u] && units[u].type === type)
			return u
	throw new Error("cannot find free unit of type: " + type)
}

// function find_unit(name) {
// 	for (let u = 0; u < unit_count; ++u)
// 		if (unit_name[u] === name)
// 			return u
// 	throw new Error("cannot find named block: " + name + unit_name)
// }

// function is_axis_unit(u) {
// 	return u >= first_axis_unit && u <= last_axis_unit
// }

// function is_german_unit(u) {
// 	return (u >= 14 && u <= 33)
// }

// function is_elite_unit(u) {
// 	return unit_elite[u]
// }

// function is_artillery_unit(u) {
// 	return unit_class[u] === ARTILLERY
// }

// function unit_cv(u) {
// 	if (is_elite_unit(u))
// 		return unit_steps(u) * 2
// 	return unit_steps(u)
// }

// function unit_hp_per_step(u) {
// 	return is_elite_unit(u) ? 2 : 1
// }

// function unit_hp(u) {
// 	return unit_steps(u) * unit_hp_per_step(u)
// }

// === PUBLIC FUNCTIONS ===

exports.scenarios = [ "1954", "1958", "1960" ]

exports.roles = [ FLN, GOV ]

function gen_action(action, argument) {
	if (!(action in view.actions))
		view.actions[action] = []
	view.actions[action].push(argument)
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
		scenario: game.scenario,
		current: game.current,

		turn: game.turn,
		fln_ap: game.fln_ap,
		fln_psl: game.fln_psl,
		gov_psl: game.gov_psl,
		air_avail: game.air_avail,
		air_max: game.air_max,
		helo_avail: game.helo_avail,
		helo_max: game.helo_max,
		naval: game.naval,

		is_morocco_tunisia_independent: game.is_morocco_tunisia_independent,
		border_zone: game.border_zone,

		units: game.units,
	}

	if (game.state === "game_over") {
		view.prompt = game.victory
	} else if (player !== game.active && game.active !== BOTH) {
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
		if (player === FLN_NAME)
			goto_game_over(GOV, "FLN resigned.")
		if (player === GOV)
			goto_game_over(FLN_NAME, "Government resigned.")
	}
	return game
}

function goto_game_over(result, victory) {
	game.state = "game_over"
	game.current = -1
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

// === SETUP ===

exports.setup = function (seed, scenario, options) {
	game = {
		seed: seed,
		log: [],
		undo: [],
		active: null,
		selected: -1,

		current: 0,
		state: null,
		scenario: null,
		turn: 0,

		// game board state
		fln_ap: 0,
		fln_psl: 0,
		gov_psl: 0,
		air_avail: 0,
		air_max: 0,
		helo_avail: 0,
		helo_max: 0,
		naval: 0,

		units: new Array(unit_count).fill(0),
		moved: [],
		fired: [],

		is_morocco_tunisia_independent: false,
		border_zone: 0,

		// event related effects
		had_suez_crisis: false,
		is_amnesty: false,
		is_fln_move_restricted: false,

		// logging
		summary: null,
	}

	game.scenario = scenario
	setup_scenario(scenario)

	goto_scenario_setup()

	return game
}

const SCENARIOS = {
	"1954": {
		gov_psl: 65,
		air_max: 0,
		helo_max: 0,
		naval: 0,
		fln_psl: 50,
		is_morocco_tunisia_independent: false
	},
	"1958": {
		gov_psl: 50,
		air_avail: 6,
		helo_avail: 4,
		naval: 2,
		fln_psl: 60,
		is_morocco_tunisia_independent: true,
		border_zone: -2
	},
	"1960": {
		gov_psl: 45,
		air_avail: 7,
		helo_avail: 5,
		naval: 3,
		fln_psl: 45,
		is_morocco_tunisia_independent: true,
		border_zone: -3
	}
}

function setup_units(where, list) {
	let loc = locations[where]
	for (let u of list) {
		u = find_free_unit_by_type(u)
		set_unit_loc(u, loc)
	}
}

const SETUP = {
	"1954" () {
		setup_units("I", [FRONT, CADRE])
		setup_units("II", [FR_X, AL_X, POL])
		setup_units("II", [FRONT, CADRE, CADRE])
		setup_units("III", [FRONT, CADRE])
		setup_units("IV", [FR_X, AL_X, POL])
		setup_units("IV", [CADRE])
		setup_units("V", [FR_X, EL_X, AL_X, POL])
		setup_units("V", [FRONT, CADRE, CADRE])
	},
	"1958" () {
		setup_units("I", [FR_XX, FR_XX, FR_X])
		setup_units("I", [FRONT, CADRE, CADRE, BAND, BAND])
		setup_units("II", [FR_XX, FR_XX, FR_X, EL_X, EL_X, EL_X, AL_X, POL, POL])
		setup_units("II", [FRONT, CADRE, CADRE, BAND, BAND])
		setup_units("III", [FR_XX, FR_XX, AL_X, POL, POL])
		setup_units("III", [FRONT, CADRE, CADRE, BAND, BAND])
		setup_units("IV", [FR_XX, FR_XX, EL_X, EL_X, EL_X, AL_X, AL_X, POL, POL])
		setup_units("IV", [FRONT, FRONT, CADRE, CADRE, BAND, BAND])
		setup_units("V", [FR_XX, FR_XX, FR_XX, FR_X, EL_X, AL_X, POL, POL])
		setup_units("V", [FRONT, CADRE, BAND])
		setup_units("VI", [FRONT, CADRE, BAND])
		setup_units("Morocco", [BAND])
		setup_units("Tunisia", [BAND, BAND, BAND, BAND, FAILEK])
	},
	"1960" () {
		setup_units("I", [FR_XX, FR_XX, AL_X])
		setup_units("I", [CADRE, CADRE, BAND, BAND])
		setup_units("II", [FR_XX, FR_XX, EL_X, EL_X, EL_X, EL_X, AL_X, AL_X, POL, POL])
		setup_units("II", [FRONT, CADRE, CADRE, BAND, BAND])
		setup_units("III", [FR_XX, FR_XX, FR_X, AL_X])
		setup_units("III", [FRONT, FRONT, CADRE, CADRE, BAND, BAND])
		setup_units("IV", [FR_XX, FR_XX, EL_X, EL_X, EL_X, AL_X, AL_X, POL, POL])
		setup_units("IV", [FRONT, CADRE, BAND])
		setup_units("V", [FR_XX, FR_XX, FR_XX, FR_XX, FR_XX, AL_X, POL, POL])
		setup_units("V", [CADRE, BAND])
		setup_units("Morocco", [BAND, BAND, BAND, BAND])
		setup_units("Tunisia", [BAND, BAND, BAND, BAND, FAILEK, FAILEK, FAILEK])
	}
}

function setup_scenario(scenario_name) {
	log_h1("Scenario: " + scenario_name)

	let scenario = SCENARIOS[scenario_name]
	Object.assign(game, scenario)
	game.fln_ap = roll_2d6()

	log(`FLN PSL=${game.fln_psl} AP=${game.fln_ap}`)
	log(`Government PSL=${game.gov_psl}`)

	SETUP[scenario_name]()
}

function goto_scenario_setup() {
	game.active = GOV
	game.state = "scenario_setup"
	log_h1("Deployment")
}

states.scenario_setup = {
	inactive: "setup",
	prompt() {
		view.prompt = `Setup: ${game.active} Deployment.`
		gen_action("end_deployment")
	},
	end_deployment() {
		log(`Deployed`)
		// let keys = Object.keys(game.summary).map(Number).sort((a,b)=>a-b)
		// for (let x of keys)
		// 	log(`>${game.summary[x]} at #${x}`)
		// game.summary = null

		end_scenario_setup()
	}
}

function end_scenario_setup() {
	game.turn = 1
	goto_random_event()
}

// === FLOW OF PLAY ===

function goto_random_event() {
	game.active = BOTH
	game.state = "random_event"
}

states.random_event = {
	prompt() {
		view.prompt = "Roll for a random event."
		gen_action("roll")
		gen_action("restart")
	},
	roll() {
		clear_undo()
		let rnd = 10 * roll_d6() + roll_d6()
		log("Random event roll " + rnd)
		// goto_reinforcement_phase()

		if (rnd <= 26) {
			goto_no_event()
		} else if (rnd <= 33) {
			goto_fln_foreign_arms_shipment()
		} else if (rnd <= 36) {
			goto_jealousy_and_paranoia()
		} else if (rnd <= 42) {
			goto_elections_in_france()
		} else if (rnd <= 44) {
			goto_un_debate()
		} else if (rnd <= 46) {
			goto_fln_factional_purge()
		} else if (rnd <= 54) {
			goto_morocco_tunisia_independence()
		} else if (rnd <= 56) {
			goto_nato_pressure()
		} else if (rnd <= 62) {
			goto_suez_crisis()
		} else if (rnd <= 64) {
			goto_amnesty()
		} else if (rnd <= 66) {
			goto_jean_paul_sartre()
		} else {
			log("Invalid random value, out of range (11-66)")
		}
	},
	restart() {
		// XXX debug
		log("Restarting...")
		goto_restart()
	}
}

function goto_restart() {
	// XXX debug only
	exports.setup(game.seed, game.scenario)
}

function goto_no_event() {
	log(".h2 No Event. Lucky you.")
	end_random_event()
}

function goto_fln_foreign_arms_shipment() {
	log(".h2 FLN Foreign arms shipment.")
	// The FLN player adds 2d6 AP, minus the current number of Naval Points.
	let roll = roll_2d6()
	let delta_ap = Math.max(roll - game.gov_naval, 0)
	log(`FLN adds ${roll} AP, minus ${game.gov_naval} Naval Points = ${delta_ap} AP`)
	game.fln_ap += delta_ap
	end_random_event()
}

function goto_jealousy_and_paranoia() {
	log(".h2 Jealousy and Paranoia. TODO")
	// TODO FLN units may not Move across wilaya borders this turn only (they may move across international borders)
	game.is_fln_move_restricted = true
	end_random_event()
}

function goto_elections_in_france() {
	log(".h2 Elections in France. TODO")
	// Government player rolls on the Coup Table (no DRM) and adds or subtracts
	// the number of PSP indicated: no units are mobilized or removed.
	end_random_event()
}

function goto_un_debate() {
	log(".h2 UN debates Algerian Independence. TODO")
	// Player with higher PSL raises FLN or lowers Government PSL by 1d6.
	end_random_event()
}

function goto_fln_factional_purge() {
	log(".h2 FLN Factional Purge. TODO")
	// The Government player chooses one wilaya and rolls 1d6, neutralizing
	// that number of FLN units there (the FLN player's choice which ones).
	end_random_event()
}

function goto_morocco_tunisia_independence() {
	log(".h2 Morocco & Tunisia Gains Independence. TODO")

	if (game.is_morocco_tunisia_independent || game.scenario === "1958" || game.scenario === "1960") {
		// If this event is rolled again, or if playing the 1958 or 1960 scenarios,
		// FLN player instead rolls on the Mission Success Table (no DRM) and gets that number of AP
		// (represents infiltration of small numbers of weapons and troops through the borders).

		// TODO

		end_random_event()
	}

	// Raise both FLN and Government PSL by 2d6;
	let fln_roll = roll_2d6()
	log(`Raising FLN PSL by ${fln_roll}`)
	game.fln_psl += fln_roll

	let gov_roll = roll_2d6()
	log(`Raising Government PSL by ${gov_roll}`)
	game.gov_psl += gov_roll

	// FLN player may now Build/Convert units in these two countries as if a Front were there
	// and Government may begin to mobilize the Border Zone. See 11.22.
	game.is_morocco_tunisia_independent = true
	end_random_event()
}

function goto_nato_pressure() {
	log(".h2 NATO pressures France to boost European defense. TODO")
	// The Government player rolls 1d6 and must remove that number of French Army brigades
	// (a division counts as three brigades) from the map.
	// The units may be re-mobilized at least one turn later.
	end_random_event()
}

function goto_suez_crisis() {
	log(".h2 Suez Crisis. TODO")
	if (game.had_suez_crisis || game.scenario === "1958" || game.scenario === "1960") {
		// Treat as "No Event" if rolled again, or playing 1958 or 1960 scenarios.
		log("Re-roll. No Event.")
		end_random_event()
		return
	}
	// The Government player must remove 1d6 elite units from the map, up to the number actually available:
	// they will return in the Reinforcement Phase of the next turn automatically
	// - they do not need to be mobilized again but do need to be activated.

	game.had_suez_crisis = true
	end_random_event()
}

function goto_amnesty() {
	log(".h2 Amnesty. TODO")
	// The French government offers "the peace of the brave" to FLN rebels.
	// TODO All Government Civil Affairs or Suppression missions get a +1 DRM this turn.
	game.is_amnesty = true
	end_random_event()
}

function goto_jean_paul_sartre() {
	log(".h2 Jean-Paul Sartre writes article condemning the war.")
	// Reduce Government PSL by 1 PSP.
	game.gov_psl -= 1
	end_random_event()
}

function end_random_event() {
	goto_reinforcement_phase()
}

function goto_reinforcement_phase() {
	game.state = "reinforcement"
}

states.reinforcement = {
	inactive: "to do reinforcement",
	prompt() {
		view.prompt = "Do reinforcement."
		gen_action("done")
	},
	done() {
		// XXX debug
		log("End of turn...")
		goto_next_turn()
	}
}

function goto_next_turn() {
	game.turn += 1

	// make sure single-turn effects are disabled
	game.is_amnesty = false
	game.is_fln_move_restricted = false

	goto_random_event()
}

// === LOGGING ===

function log(msg) {
	game.log.push(msg)
}

function log_br() {
	if (game.log.length > 0 && game.log[game.log.length - 1] !== "")
		game.log.push("")
}

function logi(msg) {
	game.log.push(">" + msg)
}

function log_h1(msg) {
	log_br()
	log(".h1 " + msg)
	log_br()
}

function log_h2(msg) {
	log_br()
	log(".h2 " + msg)
	log_br()
}

function log_h3(msg) {
	log_br()
	log(".h3 " + msg)
}

function log_sep() {
	log(".hr")
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

function roll_2d6() {
	return roll_d6() + roll_d6()
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

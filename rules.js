"use strict"

const FLN_NAME = "FLN"
const GOV_NAME = "Government"
const BOTH = "Both"

const area_count = 31
const unit_count = 120
const first_gov_unit = 0
const last_gov_unit = 39
const first_fln_unit = 40
const last_fln_unit = 119

const UG = 0
const OPS = 1
const PTL = 2
const OC = 3

const FLN = 0
const GOV = 1

const RURAL = 1
const URBAN = 2
const REMOTE = 3
const COUNTRY = 4

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
const FREE = 0
const DEPLOY = 1
const ELIMINATED = 2

var states = {}
var game = null
var view = null

const {
	areas, zone_areas, locations, units
} = require("./data.js")

var first_friendly_unit, last_friendly_unit
var first_enemy_unit, last_enemy_unit

// #region PLAYER STATE

function set_next_player() {
	if (game.phasing === GOV_NAME)
		game.phasing = FLN_NAME
	else
		game.phasing = GOV_NAME
	set_active_player()
}


function set_active_player() {
	clear_undo()
	if (game.active !== game.phasing) {
		game.active = game.phasing
		update_aliases()
	}
}

function set_passive_player() {
	clear_undo()
	let nonphasing = (game.phasing === GOV_NAME ? FLN_NAME : GOV_NAME)
	if (game.active !== nonphasing) {
		game.active = nonphasing
		update_aliases()
	}
}

function set_enemy_player() {
	if (is_active_player())
		set_passive_player()
	else
		set_active_player()
}

function is_active_player() {
	return game.active === game.phasing
}

function is_passive_player() {
	return game.active !== game.phasing
}

function is_gov_player() {
	return game.active === GOV_NAME
}

function is_fln_player() {
	return game.active === FLN_NAME
}

function update_aliases() {
	if (game.active === GOV_NAME) {
		first_friendly_unit = first_gov_unit
		last_friendly_unit = last_gov_unit
		first_enemy_unit = first_fln_unit
		last_enemy_unit = last_fln_unit
	} else {
		first_friendly_unit = first_fln_unit
		last_friendly_unit = last_fln_unit
		first_enemy_unit = first_gov_unit
		last_enemy_unit = last_gov_unit
	}
}

function load_state(state) {
	if (game !== state) {
		game = state
		update_aliases()
	}
}

// If a player's PSL rises to above 99 during the game due to various events, any such "excess" PSP gained for that player are not lost: instead they are SUBTRACTED from the other player's PSL.

const MAX_PSL = 99
const MAX_AP = 99

function raise_fln_psl(amount) {
	game.fln_psl += amount
	if (game.fln_psl > MAX_PSL) {
		let excess_psl = game.fln_psl - MAX_PSL
		log(`FLN PSL exceeds ${MAX_PSL}; Goverment ${-excess_psl} PSL`)
		game.fln_psl = MAX_PSL
		game.gov_psl -= excess_psl
	}
}

function raise_gov_psl(amount) {
	game.gov_psl += amount
	if (game.gov_psl > MAX_PSL) {
		let excess_psl = game.gov_psl - MAX_PSL
		log(`Government PSL exceeds ${MAX_PSL}; FLN ${-excess_psl} PSL`)
		game.gov_psl = MAX_PSL
		game.fln_psl -= excess_psl
	}
}

function raise_fln_ap(amount) {
	game.fln_ap = Math.min(MAX_PSL, game.fln_ap + amount)
}

// #endregion

// #region AREA STATE

// propagandized (1 bit), struck (1 bit), raided (1 bit), civil affaired (1 bit), suppressed (1 bit),
// remote (1 bit), terrorized (1 bit), gov control (1 bit), fln control (1 bit)

const AREA_FLN_CONTROL_SHIFT = 0
const AREA_FLN_CONTROL_MASK = 1 << AREA_FLN_CONTROL_SHIFT

const AREA_GOV_CONTROL_SHIFT = 1
const AREA_GOV_CONTROL_MASK = 1 << AREA_GOV_CONTROL_SHIFT

const AREA_TERRORIZED_SHIFT = 2
const AREA_TERRORIZED_MASK = 1 << AREA_TERRORIZED_SHIFT

const AREA_REMOTE_SHIFT = 3
const AREA_REMOTE_MASK = 1 << AREA_REMOTE_SHIFT

// one mission / area / turn states

const AREA_SUPPRESSED_SHIFT = 4
const AREA_SUPPRESSED_MASK = 1 << AREA_SUPPRESSED_SHIFT

const AREA_CIVIL_AFFAIRED_SHIFT = 5
const AREA_CIVIL_AFFAIRED_MASK = 1 << AREA_CIVIL_AFFAIRED_SHIFT

const AREA_RAIDED_SHIFT = 6
const AREA_RAIDED_MASK = 1 << AREA_RAIDED_SHIFT

const AREA_STRUCK_SHIFT = 7
const AREA_STRUCK_MASK = 1 << AREA_STRUCK_SHIFT

const AREA_PROPAGANDIZED_SHIFT = 8
const AREA_PROPAGANDIZED_MASK = 1 << AREA_PROPAGANDIZED_SHIFT

// area control

function is_area_fln_control(l) {
	return (game.areas[l] & AREA_FLN_CONTROL_MASK) === AREA_FLN_CONTROL_MASK
}

function is_area_gov_control(l) {
	return (game.areas[l] & AREA_GOV_CONTROL_MASK) === AREA_GOV_CONTROL_MASK
}

function is_area_contested(l) {
	return !(is_area_fln_control(l) || is_area_gov_control(l))
}

function set_area_fln_control(l) {
	game.areas[l] |= AREA_FLN_CONTROL_MASK
	game.areas[l] &= ~AREA_GOV_CONTROL_MASK
}

function set_area_gov_control(l) {
	game.areas[l] |= AREA_GOV_CONTROL_MASK
	game.areas[l] &= ~AREA_FLN_CONTROL_MASK
}

function set_area_contested(l) {
	game.areas[l] &= ~AREA_FLN_CONTROL_MASK
	game.areas[l] &= ~AREA_GOV_CONTROL_MASK
}

// terrorized

function is_area_terrorized(l) {
	return (game.areas[l] & AREA_TERRORIZED_MASK) === AREA_TERRORIZED_MASK
}

function set_area_terrorized(l) {
	game.areas[l] |= AREA_TERRORIZED_MASK
}

function clear_area_terrorized(l) {
	game.areas[l] &= ~AREA_TERRORIZED_MASK
}

// remote

function is_area_remote(l) {
	return areas[l].type === REMOTE || (game.areas[l] & AREA_REMOTE_MASK) === AREA_REMOTE_MASK
}

function set_area_remote(l) {
	game.areas[l] |= AREA_REMOTE_MASK
}

// suppressed

function is_area_suppressed(l) {
	return (game.areas[l] & AREA_SUPPRESSED_MASK) === AREA_SUPPRESSED_MASK
}

function set_area_suppressed(l) {
	game.areas[l] |= AREA_SUPPRESSED_MASK
}

function clear_area_suppressed(l) {
	game.areas[l] &= ~AREA_SUPPRESSED_MASK
}

// civil affaired

function is_area_civil_affaired(l) {
	return (game.areas[l] & AREA_CIVIL_AFFAIRED_MASK) === AREA_CIVIL_AFFAIRED_MASK
}

function set_area_civil_affaired(l) {
	game.areas[l] |= AREA_CIVIL_AFFAIRED_MASK
}

function clear_area_civil_affaired(l) {
	game.areas[l] &= ~AREA_CIVIL_AFFAIRED_MASK
}

// raided

function is_area_raided(l) {
	return (game.areas[l] & AREA_RAIDED_MASK) === AREA_RAIDED_MASK
}

function set_area_raided(l) {
	game.areas[l] |= AREA_RAIDED_MASK
}

function clear_area_raided(l) {
	game.areas[l] &= ~AREA_RAIDED_MASK
}

// struck

function is_area_struck(l) {
	return (game.areas[l] & AREA_STRUCK_MASK) === AREA_STRUCK_MASK
}

function set_area_struck(l) {
	game.areas[l] |= AREA_STRUCK_MASK
}

function clear_area_struck(l) {
	game.areas[l] &= ~AREA_STRUCK_MASK
}

// propagandized

function is_area_propagandized(l) {
	return (game.areas[l] & AREA_PROPAGANDIZED_MASK) === AREA_PROPAGANDIZED_MASK
}

function set_area_propagandized(l) {
	game.areas[l] |= AREA_PROPAGANDIZED_MASK
}

function clear_area_propagandized(l) {
	game.areas[l] &= ~AREA_PROPAGANDIZED_MASK
}

// #endregion

// #region AREA DATA

function area_zone(l) {
	return areas[l].zone
}

function is_area_country(l) {
	return areas[l].type === COUNTRY
}

function is_area_algerian(l) {
	return areas[l].type !== COUNTRY
}

function is_area_urban(l) {
	return areas[l].type === URBAN
}

function is_area_rural(l) {
	return areas[l].type === RURAL
}

// #endregion

// #region UNIT STATE

function pop_selected() {
	let u = game.selected[0]
	game.selected = []
	return u
}

// location (8 bits), op box (2 bits), dispersed (1 bit), airmobile (1 bit), neutralized (1 bit)

const UNIT_NEUTRALIZED_SHIFT = 0
const UNIT_NEUTRALIZED_MASK = 1 << UNIT_NEUTRALIZED_SHIFT

const UNIT_AIRMOBILE_SHIFT = 1
const UNIT_AIRMOBILE_MASK = 1 << UNIT_AIRMOBILE_SHIFT

const UNIT_DISPERSED_SHIFT = 2
const UNIT_DISPERSED_MASK = 1 << UNIT_DISPERSED_SHIFT

const UNIT_BOX_SHIFT = 3
const UNIT_BOX_MASK = 3 << UNIT_BOX_SHIFT

const UNIT_LOC_SHIFT = 5
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

// box

function unit_box(u) {
	return (game.units[u] & UNIT_BOX_MASK) >> UNIT_BOX_SHIFT
}

function set_unit_box(u, x) {
	game.units[u] = (game.units[u] & ~UNIT_BOX_MASK) | (x << UNIT_BOX_SHIFT)
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

function eliminate_unit(u) {
	game.units[u] = 0
	set_unit_loc(u, ELIMINATED)
	set_unit_box(u, OC)
}

function is_unit_eliminated(u) {
	return unit_loc(u) === ELIMINATED
}

function free_unit(u) {
	game.units[u] = 0
}

// #endregion

// #region UNIT DATA

function find_free_unit_by_type(type) {
	for (let u = 0; u < unit_count; ++u)
		if (!game.units[u] && units[u].type === type)
			return u
	throw new Error("cannot find free unit of type: " + type)
}

function has_free_unit_by_type(type) {
	for (let u = 0; u < unit_count; ++u)
		if (!game.units[u] && units[u].type === type)
			return true
	return false
}

function is_gov_unit(u) {
	return units[u].side === GOV
}

function is_fln_unit(u) {
	return units[u].side === FLN
}

function is_algerian_unit(u) {
	return units[u].type === AL_X
}

function is_police_unit(u) {
	return units[u].type === POL
}

function unit_type(u) {
	return units[u].type
}

// #endregion

// #region ITERATORS

function for_each_friendly_unit(fn) {
	for (let u = first_friendly_unit; u <= last_friendly_unit; ++u)
		fn(u)
}

function for_each_friendly_unit_on_map(fn) {
	for (let u = first_friendly_unit; u <= last_friendly_unit; ++u)
		if (unit_loc(u) > 2)
			fn(u)
}

function for_each_friendly_unit_on_map_box(box, fn) {
	for (let u = first_friendly_unit; u <= last_friendly_unit; ++u)
		if (unit_loc(u) > 2 && unit_box(u) === box)
			fn(u)
}

function for_each_friendly_unit_on_map_of_type(type, fn) {
	for (let u = first_friendly_unit; u <= last_friendly_unit; ++u)
		if (unit_loc(u) > 2 && unit_type(u) === type)
			fn(u)
}

function for_each_friendly_unit_in_loc(x, fn) {
	for (let u = first_friendly_unit; u <= last_friendly_unit; ++u)
		if (unit_loc(u) === x)
			fn(u)
}

function for_each_friendly_unit_in_locs(xs, fn) {
	for (let u = first_friendly_unit; u <= last_friendly_unit; ++u)
		for (let x of xs)
			if (unit_loc(u) === x)
				fn(u)
}

function for_each_map_area(fn) {
	for (let i = 3; i < area_count; ++i)
		fn(i)
}

function for_each_algerian_map_area(fn) {
	for (let i = 3; i < area_count; ++i)
		if (is_area_algerian(i))
			fn(i)
}

function for_each_map_area_in_zone(z, fn) {
	for (let i = 3; i < area_count; ++i)
		if (area_zone(i) === z)
			fn(i)
}

function has_friendly_unit_in_loc(x) {
	for (let u = first_friendly_unit; u <= last_friendly_unit; ++u)
		if (unit_loc(u) === x)
			return true
	return false
}

function has_friendly_not_neutralized_unit_in_loc(x) {
	for (let u = first_friendly_unit; u <= last_friendly_unit; ++u)
		if (unit_loc(u) === x && is_unit_not_neutralized(u))
			return true
	return false
}

function has_friendly_unit_in_locs(xs) {
	for (let u = first_friendly_unit; u <= last_friendly_unit; ++u)
		for (let x of xs)
			if (unit_loc(u) === x)
				return true
	return false
}

function has_unit_type_in_loc(t, x) {
	for (let u = 0; u <= unit_count; ++u)
		if (unit_loc(u) === x && unit_type(u) === t)
			return true
	return false
}

// #endregion

// #region PUBLIC FUNCTIONS

exports.scenarios = [ "1954", "1958", "1960" ]

exports.roles = [ FLN_NAME, GOV_NAME ]

function gen_action(action, argument) {
	if (!(action in view.actions))
		view.actions[action] = []
	view.actions[action].push(argument)
}

function gen_action_unit(u) {
	gen_action('unit', u)
}

function gen_action_loc(x) {
	gen_action('loc', x)
}

exports.action = function (state, player, action, arg) {
	load_state(state)
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
	load_state(state)

	view = {
		log: game.log,
		prompt: null,
		scenario: game.scenario,
		active: game.active,
		phasing: game.phasing,

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
		border_zone_active: game.border_zone_active,
		border_zone_drm: game.border_zone_drm,

		units: game.units,
		areas: game.areas,
	}

	if (player === game.active)
		view.selected = game.selected

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
	load_state(state)
	if (game.state !== 'game_over') {
		if (player === FLN_NAME)
			goto_game_over(GOV_NAME, "FLN resigned.")
		if (player === GOV_NAME)
			goto_game_over(FLN_NAME, "Government resigned.")
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

// #endregion

// #region SETUP

exports.setup = function (seed, scenario, options) {
	load_state({
		seed: seed,
		log: [],
		undo: [],

		state: null,
		selected: -1,
		phasing: GOV_NAME,
		active: GOV_NAME,

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

		is_morocco_tunisia_independent: false,
		border_zone_active: false,
		border_zone_drm: null,

		units: new Array(unit_count).fill(0),
		areas: new Array(area_count).fill(0),
		events: {},

		// logging
		summary: null,
	})

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
		is_morocco_tunisia_independent: false,
		border_zone_drm: null
	},
	"1958": {
		gov_psl: 50,
		air_avail: 6,
		helo_avail: 4,
		naval: 2,
		fln_psl: 60,
		is_morocco_tunisia_independent: true,
		border_zone_drm: -2
	},
	"1960": {
		gov_psl: 45,
		air_avail: 7,
		helo_avail: 5,
		naval: 3,
		fln_psl: 45,
		is_morocco_tunisia_independent: true,
		border_zone_drm: -3
	}
}

const SCENARIO_DEPLOYMENT = {
	"1954": {
		fln: {
			"I": [FRONT, CADRE],
			"II": [FRONT, CADRE, CADRE],
			"III": [FRONT, CADRE],
			"IV": [CADRE],
			"V": [FRONT, CADRE, CADRE]
		},
		gov: {
			"II": [FR_X, AL_X, POL],
			"IV": [FR_X, AL_X, POL],
			"V": [FR_X, EL_X, AL_X, POL]
		}
	},
	"1958": {
		fln: {
			"I": [FRONT, CADRE, CADRE, BAND, BAND],
			"II": [FRONT, CADRE, CADRE, BAND, BAND],
			"III": [FRONT, CADRE, CADRE, BAND, BAND],
			"IV": [FRONT, FRONT, CADRE, CADRE, BAND, BAND],
			"V": [FRONT, CADRE, BAND],
			"VI": [FRONT, CADRE, BAND],
			"Morocco": [BAND],
			"Tunisia": [BAND, BAND, BAND, BAND, FAILEK]
		},
		gov: {
			"I": [FR_XX, FR_XX, FR_X],
			"II": [FR_XX, FR_XX, FR_X, EL_X, EL_X, EL_X, AL_X, POL, POL],
			"III": [FR_XX, FR_XX, AL_X, POL, POL],
			"IV": [FR_XX, FR_XX, EL_X, EL_X, EL_X, AL_X, AL_X, POL, POL],
			"V": [FR_XX, FR_XX, FR_XX, FR_X, EL_X, AL_X, POL, POL],
		}
	},
	"1960": {
		fln: {
			"I": [CADRE, CADRE, BAND, BAND],
			"II": [FRONT, CADRE, CADRE, BAND, BAND],
			"III": [FRONT, FRONT, CADRE, CADRE, BAND, BAND],
			"IV": [FRONT, CADRE, BAND],
			"V": [CADRE, BAND],
			"Morocco": [BAND, BAND, BAND, BAND],
			"Tunisia": [BAND, BAND, BAND, BAND, FAILEK, FAILEK, FAILEK]
		},
		gov: {
			"I": [FR_XX, FR_XX, AL_X],
			"II": [FR_XX, FR_XX, EL_X, EL_X, EL_X, EL_X, AL_X, AL_X, POL, POL],
			"III": [FR_XX, FR_XX, FR_X, AL_X],
			"IV": [FR_XX, FR_XX, EL_X, EL_X, EL_X, AL_X, AL_X, POL, POL],
			"V": [FR_XX, FR_XX, FR_XX, FR_XX, FR_XX, AL_X, POL, POL]
		}
	}
}

function setup_units(deployment) {
	for (const [zone, list] of Object.entries(deployment)) {
		for (let l of list) {
			let u = find_free_unit_by_type(l)
			set_unit_loc(u, DEPLOY)
			set_unit_box(u, OC)
		}
	}
}

function setup_scenario(scenario_name) {
	log_h1("Scenario: " + scenario_name)

	let scenario = SCENARIOS[scenario_name]
	Object.assign(game, scenario)
	game.fln_ap = roll_2d6()

	log(`FLN PSL=${game.fln_psl} AP=${game.fln_ap}`)
	log(`Government PSL=${game.gov_psl}`)

	let deployment = SCENARIO_DEPLOYMENT[scenario_name]
	setup_units(deployment.fln)
	setup_units(deployment.gov)

	game.phasing = GOV_NAME
}

function goto_scenario_setup() {
	set_active_player()
	game.state = "scenario_setup"
	log_h2(`${game.active} Deployment`)
	game.selected = []
	game.summary = {}
}

function current_player_deployment() {
	let deployment = SCENARIO_DEPLOYMENT[game.scenario]
	return is_fln_player() ? deployment.fln : deployment.gov
}

function can_all_deploy_to(us, to) {
	let zone = area_zone(to)
	let deployment = current_player_deployment()
	if (!(zone in deployment))
		return false

	let target_types = []
	for (let u of us) {
		let type = unit_type(u)
		target_types.push(type)

		if (!deployment[zone].includes(type))
			return false

		// - only 1 Front per area
		// - Front can't be created in Remote
		if (type === FRONT && (has_unit_type_in_loc(FRONT, to) || is_area_remote(to)))
			return false
	}

	// check target against deployment type counts
	for_each_friendly_unit_in_locs(zone_areas[zone], u => {
		target_types.push(unit_type(u))
	})

	return is_subset_with_multiplicity(deployment[zone], target_types)
}

function deploy_unit(who, to) {
	set_unit_loc(who, to)

	// deploy unit: all FLN in UG, GOV in OPS/OC, police in PTL
	if (is_fln_unit(who)) {
		set_unit_box(who, UG)
	} else if (is_police_unit(who)) {
		set_unit_box(who, PTL)
	} else if (is_algerian_unit(who)) {
		set_unit_box(who, OPS)
	} else {
		set_unit_box(who, OC)
	}
}

states.scenario_setup = {
	inactive: "setup",
	prompt() {
		view.prompt = `Setup: ${game.active} Deployment.`

		if (game.selected.length === 0) {
			// first unit can be any unit in DEPLOY or on map
			for_each_friendly_unit(u => {
				gen_action_unit(u)
			})
		} else {
			// subsequent units must be on the same map location (or also on DEPLOY)
			let first_unit = game.selected[0]
			let first_unit_loc = unit_loc(first_unit)
			let selected_front = 0
			for (let u of game.selected) {
				if (unit_type(u) === FRONT) selected_front = u
			}
			for_each_friendly_unit(u => {
				// but can only select a single FRONT
				if (unit_loc(u) === first_unit_loc && (unit_type(u) !== FRONT || u === selected_front || !selected_front)) {
					gen_action_unit(u)
				}
			})

			if (first_unit_loc === DEPLOY) {
				for_each_map_area(loc => {
					if (can_all_deploy_to(game.selected, loc)) {
						gen_action_loc(loc)
					}
				})
			} else {
				// once deployed, only allow shifting within zone
				let first_unit_zone = area_zone(first_unit_loc)

				for_each_map_area_in_zone(first_unit_zone, loc => {
					gen_action_loc(loc)
				})
			}
		}

		let done = true
		for_each_friendly_unit_in_loc(DEPLOY, u => {
			done = false
		})
		if (done)
			gen_action('end_deployment')

		// XXX
		gen_action("restart")
	},
	unit(u) {
		set_toggle(game.selected, u)
	},
	loc(to) {
		let list = game.selected
		game.selected = []
		push_undo()
		let from = unit_loc(list[0])
		if (from !== DEPLOY) {
			// make correction when shifting units within zone
			game.summary[from] = (game.summary[from] | 0) - list.length
		}
		game.summary[to] = (game.summary[to] | 0) + list.length
		for (let who of list) {
			deploy_unit(who, to)
		}
	},
	end_deployment() {
		log(`Deployed`)
		// TODO this can be more informative, mentioning unit types instead of summary
		let keys = Object.keys(game.summary).map(Number).sort((a,b)=>a-b)
		for (let x of keys) {
			if (game.summary[x] > 0)
				log(`>${game.summary[x]} at ${areas[x].name}`)
		}
		game.summary = null

		end_scenario_setup()
	},
	restart() {
		// XXX debug
		log("Restarting...")
		goto_restart()
	}
}

function end_scenario_setup() {
	set_next_player()

	if (has_friendly_unit_in_loc(DEPLOY)) {
		goto_scenario_setup()
	} else {
		game.selected = -1
		game.summary = null
		begin_game()
	}
}

// #endregion

// #region FLOW OF PLAY

function begin_game() {
	game.turn = 1
	goto_random_event()
}

function goto_random_event() {
	game.active = BOTH
	game.state = "random_event"
	log_h2("Random Event")
}

states.random_event = {
	prompt() {
		view.prompt = "Roll for a random event."
		gen_action("roll")
		gen_action("restart")
	},
	roll() {
		let rnd = 10 * roll_d6() + roll_d6()
		log("Rolled " + rnd)

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
			throw Error("Invalid random value, out of range (11-66)")
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
	log_h3("No Event. Lucky you.")
	end_random_event()
}

function goto_fln_foreign_arms_shipment() {
	log_h3("FLN Foreign arms shipment.")
	// The FLN player adds 2d6 AP, minus the current number of Naval Points.
	let roll = roll_2d6()
	let delta_ap = Math.max(roll - game.naval, 0)
	log(`FLN adds ${roll} AP, minus ${game.naval} Naval Points = ${delta_ap} AP`)
	raise_fln_ap(delta_ap)
	end_random_event()
}

function goto_jealousy_and_paranoia() {
	log_h3("Jealousy and Paranoia. TODO")
	// TODO FLN units may not Move across wilaya borders this turn only (they may move across international borders)
	game.events.jealousy_and_paranoia = true
	end_random_event()
}

function goto_elections_in_france() {
	log_h3("Elections in France. TODO")
	// Government player rolls on the Coup Table (no DRM) and adds or subtracts
	// the number of PSP indicated: no units are mobilized or removed.
	end_random_event()
}

function goto_un_debate() {
	log_h3("UN debates Algerian Independence. TODO")
	// Player with higher PSL raises FLN or lowers Government PSL by 1d6.
	end_random_event()
}

function goto_fln_factional_purge() {
	log_h3("FLN Factional Purge. TODO")
	// The Government player chooses one wilaya and rolls 1d6, neutralizing
	// that number of FLN units there (the FLN player's choice which ones).
	end_random_event()
}

function goto_morocco_tunisia_independence() {
	log_h3("Morocco & Tunisia Gains Independence. TODO")

	if (game.is_morocco_tunisia_independent || game.scenario === "1958" || game.scenario === "1960") {
		// If this event is rolled again, or if playing the 1958 or 1960 scenarios,
		// FLN player instead rolls on the Mission Success Table (no DRM) and gets that number of AP
		// (represents infiltration of small numbers of weapons and troops through the borders).

		// TODO

		end_random_event()
		return
	}

	// Raise both FLN and Government PSL by 2d6;
	let fln_roll = roll_2d6()
	log(`Raising FLN PSL by ${fln_roll}`)
	raise_fln_psl(fln_roll)

	let gov_roll = roll_2d6()
	log(`Raising Government PSL by ${gov_roll}`)
	raise_fln_psl(gov_roll)

	// FLN player may now Build/Convert units in these two countries as if a Front were there
	// and Government may begin to mobilize the Border Zone. See 11.22.
	game.is_morocco_tunisia_independent = true
	end_random_event()
}

function goto_nato_pressure() {
	log_h3("NATO pressures France to boost European defense. TODO")
	// The Government player rolls 1d6 and must remove that number of French Army brigades
	// (a division counts as three brigades) from the map.
	// The units may be re-mobilized at least one turn later.
	end_random_event()
}

function goto_suez_crisis() {
	log_h3("Suez Crisis. TODO")
	if (game.events.suez_crisis || game.scenario === "1958" || game.scenario === "1960") {
		// Treat as "No Event" if rolled again, or playing 1958 or 1960 scenarios.
		log("Re-roll. No Event.")
		end_random_event()
		return
	}
	// The Government player must remove 1d6 elite units from the map, up to the number actually available:
	// they will return in the Reinforcement Phase of the next turn automatically
	// - they do not need to be mobilized again but do need to be activated.

	game.events.suez_crisis = true
	end_random_event()
}

function goto_amnesty() {
	log_h3("Amnesty. TODO")
	// The French government offers "the peace of the brave" to FLN rebels.
	// TODO All Government Civil Affairs or Suppression missions get a +1 DRM this turn.
	game.events.amnesty = true
	end_random_event()
}

function goto_jean_paul_sartre() {
	log_h3("Jean-Paul Sartre writes article condemning the war.")
	// Reduce Government PSL by 1 PSP.
	game.gov_psl -= 1
	end_random_event()
}

function end_random_event() {
	goto_reinforcement_phase()
}

function goto_reinforcement_phase() {
	goto_gov_reinforcement_phase()
}

function goto_gov_reinforcement_phase() {
	game.phasing = GOV_NAME
	set_active_player()
	log_h2(`${game.active} Reinforcement`)
	game.state = "gov_reinforcement"
	game.selected = []

	// Make sure all available units can be deployed
	for_each_friendly_unit_in_loc(FREE, u => {
		set_unit_loc(u, DEPLOY)
		set_unit_box(u, OC)
	})

	// Algerian units activate for free
	for_each_friendly_unit_on_map_of_type(AL_X, u => {
		set_unit_box(u, OPS)
	})
}

const COST_AIR_POINT = 2
const COST_HELO_POINT = 3
const COST_NAVAL_POINT = 3
const COST_BORDER_ZONE = 6
const COST_ACTIVATE_BORDER_ZONE = 1
const MAX_AIR_POINT = 99
const MAX_HELO_POINT = 99
const MAX_NAVAL_POINT = 99
const MAX_BORDER_ZONE_DRM = -3

const GOV_UNIT_MOBILIZE_COST = {
	[FR_XX]: 5,
	[FR_X]: 2,
	[EL_X]: 3,
	[AL_X]: 2,
	[POL]: 1
}

function mobilization_cost(units) {
	let cost = 0
	for (let u of units) {
		cost += GOV_UNIT_MOBILIZE_COST[unit_type(u)]
	}
	return cost
}

const GOV_UNIT_ACTIVATION_COST = {
	[FR_XX]: 1,
	[FR_X]: .5,
	[EL_X]: .5,
	[AL_X]: 0
}

function activation_cost(units) {
	let cost = 0
	for (let u of units) {
		cost += GOV_UNIT_ACTIVATION_COST[unit_type(u)]
	}
	return cost
}

function mobilize_unit(who, to) {
	set_unit_loc(who, to)

	if (is_police_unit(who)) {
		set_unit_box(who, PTL)
	} else {
		set_unit_box(who, OPS)
	}

	log(`>${units[who].name} into ${areas[to].name}`)
}

states.gov_reinforcement = {
	inactive: "to do reinforcement",
	prompt() {
		if (game.selected.length === 0) {
			view.prompt = "Reinforcement: Mobilize & activate units, and acquire assets"
			// first unit can be any unit in DEPLOY or on map
			for_each_friendly_unit_in_loc(DEPLOY, u => {
				gen_action_unit(u)
			})

			// activate french mobile units
			for_each_friendly_unit_on_map_box(OC, u => {
				gen_action_unit(u)
			})

			// remove police units
			for_each_friendly_unit_on_map_of_type(POL, u => {
				gen_action_unit(u)
			})

			// activate border
			// TODO consider making marker selectable
			if (game.border_zone_drm && !game.border_zone_active && game.gov_psl > COST_ACTIVATE_BORDER_ZONE) {
				gen_action("activate_border_zone")
			}

			// asset acquisition
			if (game.gov_psl > COST_AIR_POINT && game.air_max < MAX_AIR_POINT)
				gen_action("acquire_air_point")
			if (game.gov_psl > COST_HELO_POINT && game.helo_max < MAX_HELO_POINT)
				gen_action("acquire_helo_point")
			if (game.gov_psl > COST_NAVAL_POINT && game.naval < MAX_NAVAL_POINT)
				gen_action("acquire_naval_point")
			if (game.gov_psl > COST_BORDER_ZONE) {
				// starts at no border zone instead of 0
				if (game.border_zone_drm === null) {
					gen_action("mobilize_border_zone")
				} else if (game.border_zone_drm > MAX_BORDER_ZONE_DRM && !game.events.border_zone_mobilized) {
					// improve not on the same turn as mobilized
					gen_action("improve_border_zone")
				}
			}
		} else {
			let first_unit = game.selected[0]
			let first_unit_loc = unit_loc(first_unit)
			let first_unit_type = unit_type(first_unit)
			if (first_unit_type === POL && first_unit_loc !== DEPLOY) {
				view.prompt = "Reinforcement: Remove Police units"

				for_each_friendly_unit_on_map_of_type(POL, u => {
					gen_action_unit(u)
				})

				gen_action("remove")
			} else if (first_unit_loc === DEPLOY) {
				let cost = mobilization_cost(game.selected)
				view.prompt = `Reinforcement: Mobilize units (cost ${cost} PSP)`

				for_each_friendly_unit_in_loc(DEPLOY, u => {
					gen_action_unit(u)
				})

				if (game.gov_psl > cost) {
					for_each_algerian_map_area(loc => {
						gen_action_loc(loc)
					})
				}
			} else {
				let cost = activation_cost(game.selected)
				view.prompt = `Reinforcement: Activate units (cost ${cost} PSP)`

				for_each_friendly_unit_on_map_box(OC, u => {
					gen_action_unit(u)
				})

				// Fractions rounded up
				if (game.gov_psl >  Math.ceil(cost)) {
					gen_action("activate")
				}
			}
		}

		// XXX debug
		// TODO confirmation when no units are activated?
		gen_action("end_reinforcement")
	},
	unit(u) {
		set_toggle(game.selected, u)
	},
	loc(to) {
		let list = game.selected
		game.selected = []
		push_undo()
		log("Mobilized:")
		for (let who of list) {
			mobilize_unit(who, to)
		}
		let cost = mobilization_cost(list)
		game.gov_psl -= cost
		log(`Paid ${cost} PSP`)
	},
	activate() {
		let list = game.selected
		game.selected = []
		push_undo()
		log("Activated:")
		for (let u of list) {
			let loc = unit_loc(u)
			log(`>${units[u].name} in ${areas[loc].name}`)
			set_unit_box(u, OPS)
		}
		let cost = Math.ceil(activation_cost(list))
		game.gov_psl -= cost
		log(`Paid ${cost} PSP`)
	},
	remove() {
		let list = game.selected
		game.selected = []
		push_undo()
		log("Removed:")
		for (let u of list) {
			let loc = unit_loc(u)
			log(`>${units[u].name} from ${areas[loc].name}`)
			set_unit_loc(u, DEPLOY)
			set_unit_box(u, OC)
		}
	},
	acquire_air_point() {
		push_undo()
		log("+1 Air Point")
		log(`>Paid ${COST_AIR_POINT} PSP`)
		game.gov_psl -= COST_AIR_POINT
		game.air_avail += 1
		game.air_max += 1
	},
	acquire_helo_point() {
		push_undo()
		log("+1 Helo Point")
		log(`>Paid ${COST_HELO_POINT} PSP`)
		game.gov_psl -= COST_HELO_POINT
		game.helo_avail += 1
		game.helo_max += 1
	},
	acquire_naval_point() {
		push_undo()
		log("+1 Naval Point")
		log(`Paid  ${COST_NAVAL_POINT} PSP`)
		game.gov_psl -= COST_NAVAL_POINT
		game.naval += 1
	},
	activate_border_zone() {
		push_undo()
		log("Border Zone Activated")
		log(`>Paid ${COST_ACTIVATE_BORDER_ZONE} PSP`)
		game.gov_psl -= COST_ACTIVATE_BORDER_ZONE
		game.border_zone_active = true
	},
	mobilize_border_zone() {
		push_undo()
		log("Border Zone Mobilized")
		log(`>Paid ${COST_BORDER_ZONE} PSP`)
		game.gov_psl -= COST_BORDER_ZONE
		game.border_zone_drm = 0
		game.events.border_zone_mobilized = true
	},
	improve_border_zone() {
		push_undo()
		log("Border Zone Improved")
		log(`>Paid ${COST_BORDER_ZONE} PSP`)
		game.gov_psl -= COST_BORDER_ZONE
		game.border_zone_drm -= 1
	},
	end_reinforcement() {
		goto_fln_reinforcement_phase()
	}
}

function give_fln_ap() {
	// Give AP
	log_h3("Areas under FLN control:")
	for_each_algerian_map_area(loc => {
		let control_ap = 0
		if(is_area_urban(loc)) {
			// He gets 5 AP for each Urban area he controls, or 2 AP if the area is contested but he has non-neutralized units there.
			if (is_area_fln_control(loc)) {
				control_ap += 5
			} else if (has_friendly_not_neutralized_unit_in_loc(loc)) {
				control_ap += 2
			}
		} else if (is_area_rural(loc)) {
			// He gets 2 AP for each Rural area he controls, and 1 if the area is contested but he has non-neutralized units there.
			if (is_area_fln_control(loc)) {
				control_ap += 2
			} else if (has_friendly_not_neutralized_unit_in_loc(loc)) {
				control_ap += 1
			}
		}
		// If an area is Terrorized, he gets 1 fewer AP than he normally would.
		if (is_area_terrorized(loc)) control_ap -= 1
		if (control_ap > 0) {
			raise_fln_ap(control_ap)
			log(`>${areas[loc].name} gave ${control_ap} AP`)
		}
	})

	// The FLN PSL
	// He gets AP equal to 10% (round fractions up) of his current PSL, minus the number of French Naval Points.
	let psl_percentage = Math.ceil(0.10 * game.fln_psl)
	let psl_ap = Math.max(psl_percentage - game.naval, 0)
	log(`PSL gave ${psl_ap} AP`)
	raise_fln_ap(psl_ap)
}

function goto_fln_reinforcement_phase() {
	game.phasing = FLN_NAME
	set_active_player()
	log_h2(`${game.active} Reinforcement`)
	game.state = "fln_reinforcement"
	game.selected = []

	// Make sure all available units can be build / converted
	for_each_friendly_unit_in_locs([FREE, DEPLOY], u => {
		free_unit(u)
	})

	// TODO If Morocco & Tunisia are independent, make sure we have a Front there

	give_fln_ap()
	log_br()
}

const BUILD_COST = 3
const FOREIGN_BUILD_COST = 2

const CONVERT_COST = {
	[FRONT]: 3,
	[BAND]: 1,
	[FAILEK]: 2,
	[CADRE]: 0
}

function build_cost(where) {
	if (is_area_algerian(where)) {
		return BUILD_COST
	} else {
		return FOREIGN_BUILD_COST
	}
}

function convert_cost(type) {
	return CONVERT_COST[type]
}

function build_fln_unit(type, where) {
	let u = find_free_unit_by_type(type)
	log(`Built ${units[u].name} in ${areas[where].name}`)
	set_unit_loc(u, where)
	set_unit_box(u, UG)
	let cost = build_cost(type, where)
	game.fln_ap -= cost
	log(`>Paid ${cost} AP`)
}

function convert_fln_unit(u, type) {
	let loc = unit_loc(u)
	let n = find_free_unit_by_type(type)
	log(`Converted ${units[u].name} to ${units[n].name} in ${areas[loc].name}`)
	set_unit_loc(n, loc)
	set_unit_box(n, UG)
	free_unit(u)
	let cost = convert_cost(type)
	game.fln_ap -= cost
	log(`>Paid ${cost} AP`)
}

states.fln_reinforcement = {
	inactive: "to do reinforcement",
	prompt() {
		if (game.selected.length === 0) {
			view.prompt = "Reinforcement: Build & Augment units"

			// Front can build Cadres and Bands, or be converted to Cadre
			for_each_friendly_unit_on_map_of_type(FRONT, u => {
				if (is_unit_not_neutralized(u))
					gen_action_unit(u)
			})

			// Cadre can be converted to Front or Band
			for_each_friendly_unit_on_map_of_type(CADRE, u => {
				if (is_unit_not_neutralized(u))
					gen_action_unit(u)
			})

			// Band can be converted to Failek in Morocco / Tunisia
			for_each_friendly_unit_on_map_of_type(BAND, u => {
				if (is_area_country(unit_loc(u)))
					gen_action_unit(u)
			})
		} else {
			let first_unit = game.selected[0]
			let first_unit_loc = unit_loc(first_unit)
			let first_unit_type = unit_type(first_unit)

			// Allow deselect
			gen_action_unit(first_unit)

			if (first_unit_type === FRONT) {
				view.prompt = "Reinforcement: Front can build Cadre or Band"
				// The FLN player may build new Cadres or Bands by spending the AP cost and placing them in the UG box of any area which contains a non-Neutralized Front
				// (note that this requires the presence of a Front)
				if (has_free_unit_by_type(CADRE) && game.fln_ap >= build_cost(first_unit_loc))
					gen_action("build_cadre")
				if (has_free_unit_by_type(BAND) && game.fln_ap >= build_cost(first_unit_loc))
					gen_action("build_band")
				if (has_free_unit_by_type(CADRE))
					gen_action("convert_front_to_cadre")

			} else if (first_unit_type === CADRE) {
				view.prompt = "Reinforcement: Convert Cadre"
				// Fronts may not be created in Remote areas (not enough people) and there may be only one Front per area.
				if (!(has_unit_type_in_loc(FRONT, first_unit_loc) || is_area_remote(first_unit_loc)) && has_free_unit_by_type(FRONT) && game.fln_ap >= convert_cost(FRONT)) {
					gen_action("convert_cadre_to_front")
				}
				if (has_free_unit_by_type(BAND) && game.fln_ap >= convert_cost(BAND))
					gen_action("convert_cadre_to_band")
			} else if (first_unit_type === BAND) {
				view.prompt = "Reinforcement: Convert Band"
				if (has_free_unit_by_type(FAILEK) && game.fln_ap >= convert_cost(FAILEK))
					gen_action("convert_band_to_failek")
			}
		}

		// XXX debug
		gen_action("reset")
		gen_action("end_reinforcement")
	},
	unit(u) {
		set_toggle(game.selected, u)
	},
	build_cadre() {
		let unit = pop_selected()
		let loc = unit_loc(unit)
		build_fln_unit(CADRE, loc)
	},
	build_band() {
		let unit = pop_selected()
		let loc = unit_loc(unit)
		build_fln_unit(BAND, loc)
	},
	convert_front_to_cadre() {
		let unit = pop_selected()
		convert_fln_unit(unit, CADRE)
	},
	convert_cadre_to_front() {
		let unit = pop_selected()
		convert_fln_unit(unit, FRONT)
	},
	convert_cadre_to_band() {
		let unit = pop_selected()
		convert_fln_unit(unit, BAND)
	},
	convert_band_to_failek() {
		let unit = pop_selected()
		convert_fln_unit(unit, FAILEK)
	},
	reset() {
		goto_fln_reinforcement_phase()
	},
	end_reinforcement() {
		// XXX debug
		goto_next_turn()
	}
}


function goto_next_turn() {
	game.turn += 1

	// make sure single-turn effects are disabled
	delete game.events.amnesty
	delete game.events.jealousy_and_paranoia
	delete game.events.border_zone_mobilized

	goto_random_event()
}

// #endregion

// #region LOGGING

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

// #endregion

// #region COMMON LIBRARY

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
	clear_undo()
	return random(6) + 1
}

function roll_2d6() {
	clear_undo()
	return roll_d6() + roll_d6()
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

// insert item at index (faster than splice)
function array_insert(array, index, item) {
	for (let i = array.length; i > index; --i)
		array[i] = array[i - 1]
	array[index] = item
	return array
}

function set_clear(set) {
	set.length = 0
}

function set_has(set, item) {
	let a = 0
	let b = set.length - 1
	while (a <= b) {
		let m = (a + b) >> 1
		let x = set[m]
		if (item < x)
			b = m - 1
		else if (item > x)
			a = m + 1
		else
			return true
	}
	return false
}

function set_add(set, item) {
	let a = 0
	let b = set.length - 1
	while (a <= b) {
		let m = (a + b) >> 1
		let x = set[m]
		if (item < x)
			b = m - 1
		else if (item > x)
			a = m + 1
		else
			return set
	}
	return array_insert(set, a, item)
}

function set_delete(set, item) {
	let a = 0
	let b = set.length - 1
	while (a <= b) {
		let m = (a + b) >> 1
		let x = set[m]
		if (item < x)
			b = m - 1
		else if (item > x)
			a = m + 1
		else
			return array_remove(set, m)
	}
	return set
}

function set_toggle(set, item) {
	let a = 0
	let b = set.length - 1
	while (a <= b) {
		let m = (a + b) >> 1
		let x = set[m]
		if (item < x)
			b = m - 1
		else if (item > x)
			a = m + 1
		else
			return array_remove(set, m)
	}
	return array_insert(set, a, item)
}

function is_subset_with_multiplicity(set, subset) {
	return subset.every(val => set.includes(val)
		&& subset.filter(el => el === val).length
		<=
		set.filter(el => el === val).length)
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

// #endregion

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
const FRANCE = 3

var states = {}
var game = null
var view = null

const {
	areas, zone_areas, locations, units, adjecents
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
		// TODO can trigger victory
		let excess_psl = game.fln_psl - MAX_PSL
		log(`FLN PSL exceeds ${MAX_PSL}; Goverment ${-excess_psl} PSL`)
		game.fln_psl = MAX_PSL
		game.gov_psl -= excess_psl
	}
}

function raise_gov_psl(amount) {
	game.gov_psl += amount
	if (game.gov_psl > MAX_PSL) {
		// TODO can trigger victory
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

function clear_area_all_mission_flags(l) {
	// XXX could be combined with &= ~(X_MASK | Y_MASK)
	clear_area_propagandized(l)
	clear_area_raided(l)
	clear_area_struck(l)
	clear_area_civil_affaired(l)
	clear_area_suppressed(l)
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

function is_area_france(l) {
	return l === FRANCE
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

function is_division_unit(u) {
	return units[u].type === FR_XX
}

function is_police_unit(u) {
	return units[u].type === POL
}

function is_mobile_unit(u) {
	return units[u].type !== POL && units[u].type !== FRONT
}

function is_elite_unit(u) {
	return units[u].type === EL_X
}

function unit_type(u) {
	return units[u].type
}

function is_propaganda_unit(u) {
	let type = unit_type(u)
	let loc = unit_loc(u)
	return (type === FRONT || type === CADRE) && !is_area_propagandized(loc) && !is_area_remote(loc)
}

function is_strike_unit(u) {
	let type = unit_type(u)
	let loc = unit_loc(u)
	return (type === FRONT) && !is_area_struck(loc) && is_area_urban(loc)
}

function is_movable_unit(u) {
	// TODO check if movable across border
	return !game.events.jealousy_and_paranoia || game.is_morocco_tunisia_independent
}

function is_raid_unit(u) {
	let type = unit_type(u)
	let loc = unit_loc(u)
	return (type === BAND || type === FAILEK) && !is_area_raided(loc) && !is_area_remote(loc)
}

function is_harass_unit(u) {
	let type = unit_type(u)
	let loc = unit_loc(u)
	return (type === BAND || type === FAILEK) && has_enemy_unit_in_loc(loc)
}

// #endregion

// #region ITERATORS

function for_each_neutralized_unit_in_algeria(fn) {
	for (let u = first_gov_unit; u <= last_fln_unit; ++u)
		if (is_unit_neutralized(u)) {
			let loc = unit_loc(u)
			if (loc > 2 && is_area_algerian(loc))
				fn(u)
		}
}

function for_each_non_neutralized_unit_in_algeria(fn) {
	for (let u = first_gov_unit; u <= last_fln_unit; ++u)
		if (is_unit_not_neutralized(u)) {
			let loc = unit_loc(u)
			if (loc > 2 && is_area_algerian(loc))
				fn(u)
		}
}

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

function for_each_enemy_unit_in_loc_box(loc, box, fn) {
	for (let u = first_enemy_unit; u <= last_enemy_unit; ++u)
		if (unit_loc(u) === loc && unit_box(u) === box)
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

function for_each_enemy_unit_in_loc(loc, fn) {
	for (let u = first_enemy_unit; u <= last_enemy_unit; ++u)
		if (unit_loc(u) === loc)
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

function for_each_adjecent_map_area(x, fn) {
	if (x in adjecents) {
		for (let i of adjecents[x])
			fn(i)
	}
}

function has_friendly_unit_in_loc(x) {
	for (let u = first_friendly_unit; u <= last_friendly_unit; ++u)
		if (unit_loc(u) === x)
			return true
	return false
}

function has_enemy_unit_in_loc(x) {
	for (let u = first_enemy_unit; u <= last_enemy_unit; ++u)
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

function has_fln_not_neutralized_unit_in_loc(x) {
	for (let u = first_fln_unit; u <= last_fln_unit; ++u)
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

function check_victory() {
	// TODO victory scale
	if (game.gov_psl <= 0) {
		goto_game_over(FLN_NAME, "FLN wins: Government PSL reduced to 0.")
		return true
	} else if (game.fln_psl <= 0) {
		goto_game_over(GOV_NAME, "Government wins: FLN PSL reduced to 0.")
		return true
	}
	return false
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

		// transient state
		passes: 0,
		distribute_mst: 0,

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
		// XXX RULE only 6 Algerian X counters provided, scenario requires 7.
		gov: {
			"I": [FR_XX, FR_XX, AL_X],
			"II": [FR_XX, FR_XX, EL_X, EL_X, EL_X, EL_X, AL_X, /*AL_X,*/ POL, POL],
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

function deploy_unit(u, to) {
	set_unit_loc(u, to)

	// deploy unit: all FLN in UG, GOV in OPS/OC, police in PTL
	if (is_fln_unit(u)) {
		set_unit_box(u, UG)
	} else if (is_police_unit(u)) {
		set_unit_box(u, PTL)
	} else if (is_algerian_unit(u)) {
		set_unit_box(u, OPS)
	} else {
		set_unit_box(u, OC)
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
		for (let u of list) {
			deploy_unit(u, to)
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
	log_h1("Turn: " + game.turn)
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
	log_br()

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
	log(`Raised FLN PSL by ${fln_roll}`)
	raise_fln_psl(fln_roll)

	let gov_roll = roll_2d6()
	log(`Raised Government PSL by ${gov_roll}`)
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
		log("No Event.")
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
	log(`Reduced Government PSL by 1`)
	game.gov_psl -= 1
	end_random_event()
}

function end_random_event() {
	if (check_victory())
		return

	// TODO see who controls OAS
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

function mobilize_unit(u, to) {
	set_unit_loc(u, to)

	if (is_police_unit(u)) {
		set_unit_box(u, PTL)
	} else {
		set_unit_box(u, OPS)
	}

	log(`>${units[u].name} into ${areas[to].name}`)
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
		for (let u of list) {
			mobilize_unit(u, to)
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
		end_reinforcement()
	}
}

function end_reinforcement() {
	goto_gov_deployment_phase()
}

function goto_gov_deployment_phase() {
	game.phasing = GOV_NAME
	set_active_player()
	log_h2(`${game.active} Deployment`)
	game.state = "gov_deployment"
	game.selected = []
}

states.gov_deployment = {
	inactive: "to do deployment",
	prompt() {
		view.prompt = "Deploy activated mobile units to PTL or into OPS of another area"
		if (game.selected.length === 0) {
			for_each_friendly_unit_on_map(u => {
				if (unit_box(u) === OPS || (!is_police_unit(u) && unit_box(u) === PTL) || is_division_unit(u))
					gen_action_unit(u)
			})
		} else {
			let first_unit = game.selected[0]
			let first_unit_type = unit_type(first_unit)

			if (first_unit_type == FR_XX) {
				if (is_unit_not_neutralized(first_unit)) {
					view.prompt = "Deploy activated mobile units to PTL or into OPS of another area, or change division mode"
				} else {
					// allow selection of neutralized divisions (to change mode only)
					view.prompt = "Deploy: change division mode"
				}
				gen_action("change_division_mode")
			}

			// Allow deselect
			gen_action_unit(first_unit)

			if (is_unit_not_neutralized(first_unit)) {
				for_each_algerian_map_area(loc => {
					gen_action_loc(loc)
				})
			}
		}

		// XXX debug
		// TODO confirmation when no units are activated?
		gen_action("end_deployment")
	},
	unit(u) {
		set_toggle(game.selected, u)
	},
	loc(to) {
		let list = game.selected
		game.selected = []
		push_undo()
		log("Deployed:")
		for (let u of list) {
			let loc = unit_loc(u)
			if (loc === to) {
				if (unit_box(u) === PTL) {
					log(`>${units[u].name} in ${areas[loc].name}`)
					set_unit_box(u, OPS)
				} else {
					log(`>${units[u].name} in ${areas[loc].name} on PTL`)
					set_unit_box(u, PTL)
				}
			} else {
				log(`>${units[u].name} in ${areas[loc].name}`)
				set_unit_loc(u, to)
				set_unit_box(u, OPS)
			}
		}
	},
	change_division_mode() {
		let u = pop_selected()
		let loc = unit_loc(u)
		push_undo()
		if (is_unit_dispersed(u)) {
			log(`${units[u].name} in ${areas[loc].name} switched to Concentrated mode`)
			clear_unit_dispersed(u)
		} else {
			log(`${units[u].name} in ${areas[loc].name} switched to Dispersed mode`)
			set_unit_dispersed(u)
		}
	},
	end_deployment() {
		goto_fln_deployment_phase()
	}
}

function goto_fln_deployment_phase() {
	game.phasing = FLN_NAME
	set_active_player()
	log_h2(`${game.active} Deployment`)
	game.state = "fln_deployment"
	game.selected = []
}

states.fln_deployment = {
	inactive: "to do deployment",
	prompt() {
		view.prompt = "Deploy units to OPS in same area"
		if (game.selected.length === 0) {
			for_each_friendly_unit_on_map(u => {
				// TODO handle units in Morocco and Tunisia
				if (unit_box(u) === OPS || unit_box(u) === UG)
					gen_action_unit(u)
			})
		} else {
			let first_unit = game.selected[0]
			let first_unit_loc = unit_loc(first_unit)
			let first_unit_box = unit_box(first_unit)
			let first_unit_type = unit_type(first_unit)

			// Allow deselect && more units in same box
			for_each_friendly_unit_in_loc(first_unit_loc, u => {
				if (unit_box(u) === first_unit_box) {
					gen_action_unit(u)
				}
			})

			if (is_area_algerian(first_unit_loc)) {
				gen_action_loc(first_unit_loc)
			} else if (is_area_france(first_unit_loc)) {
				// The Cadre unit in France may be deployed to any Area where there is a Front unit.
				// XXX RULE this allows free movement when deploying to France and then again in the same turn elsewhere
				let has_front = false
				for_each_friendly_unit_on_map_of_type(FRONT, u => {
					gen_action_loc(unit_loc(u))
					has_front = true
				})
				if (has_front) {
					view.prompt = "Deploy Cadre to Area with Front"
				}
			}

			if (first_unit_type == CADRE && game.selected.length === 1 && !has_friendly_unit_in_loc(FRANCE)) {
				view.prompt = "Deploy units to OPS in same area (or Cadre to France)"
				// deploy single Cadre to France
				gen_action_loc(FRANCE)
			}
		}

		// XXX debug
		// TODO confirmation when no units are activated?
		gen_action("end_deployment")
	},
	unit(u) {
		set_toggle(game.selected, u)
	},
	loc(to) {
		let list = game.selected
		game.selected = []
		push_undo()
		log("Deployed:")
		for (let u of list) {
			let loc = unit_loc(u)
			if (loc === to) {
				log(`>${units[u].name} in ${areas[loc].name}`)
				if (unit_box(u) === UG) {
					set_unit_box(u, OPS)
				} else {
					set_unit_box(u, UG)
				}
			} else {
				log(`>${units[u].name} to ${areas[to].name}`)
				set_unit_loc(u, to)
				set_unit_box(u, UG)
			}
		}
	},
	end_deployment() {
		end_deployment()
	}
}

function end_deployment() {
	goto_operations_phase()
}

function goto_operations_phase() {
	game.passes = 0
	goto_fln_operations_phase()
}

function goto_fln_operations_phase() {
	game.phasing = FLN_NAME
	set_active_player()
	log_h2(`${game.active} Operations`)
	game.state = "fln_operations"
}

const FLN_PROPAGANDA_COST = 1
const FLN_STRIKE_COST = 3
const FLN_RAID_COST = 1

states.fln_operations = {
	inactive: "to do operations",
	prompt() {
		view.prompt = "Operations: Perform a mission with OPS units, let Government perform a mission, or Pass"

		// check if any FLN missions can actually be performed
		view.actions.propaganda = 0
		view.actions.strike = 0
		view.actions.move = 0
		view.actions.raid = 0
		view.actions.harass = 0

		for_each_friendly_unit_on_map_box(OPS, u => {
			if (game.fln_ap >= FLN_PROPAGANDA_COST && is_propaganda_unit(u)) {
				view.actions.propaganda = 1
			}
			if (game.fln_ap >= FLN_STRIKE_COST && is_strike_unit(u)) {
				view.actions.strike = 1
			}
			if (is_movable_unit(u))
				view.actions.move = 1
			if (game.fln_ap >= FLN_RAID_COST && is_raid_unit(u))
				view.actions.raid = 1
			if (is_harass_unit(u))
				view.actions.harass = 1
		})

		gen_action("gov_mission")
		gen_action("pass")
	},
	propaganda() {
		goto_fln_propaganda_mission()
	},
	strike() {
		goto_fln_strike_mission()
	},
	move() {
		goto_fln_move_mission()
	},
	raid() {
		goto_fln_raid_mission()
	},
	harass() {
		goto_fln_harass_mission()
	},
	gov_mission() {
		game.passes = 0
		goto_gov_operations_phase()
	},
	pass() {
		log("FLN Passes")
		game.passes += 1
		if (game.passes >= 2) {
			end_operations_phase()
		} else {
			goto_gov_operations_phase()
		}
	}
}

function goto_fln_propaganda_mission() {
	push_undo()
	game.passes = 0
	log_h3(`Propaganda Mission`)
	game.state = "fln_propaganda"
	game.selected = []
}

function reduce_unit(u, type) {
	let loc = unit_loc(u)
	let n = find_free_unit_by_type(type)
	log(`Reduced ${units[u].name} to ${units[n].name} in ${areas[loc].name}`)
	set_unit_loc(n, loc)
	set_unit_box(n, OC)
	free_unit(u)
}

states.fln_propaganda = {
	inactive: "to do Propaganda mission",
	prompt() {

		if (game.selected.length === 0) {
			view.prompt = "Propaganda: Select Front or Cadre"
			for_each_friendly_unit_on_map_box(OPS, u => {
				if (is_propaganda_unit(u)) {
					gen_action_unit(u)
				}
			})
		} else {
			view.prompt = "Propaganda: Execute mission"
			let first_unit = game.selected[0]

			// Allow deselect
			gen_action_unit(first_unit)

			gen_action("roll")
		}

		gen_action("reset")
	},
	unit(u) {
		set_toggle(game.selected, u)
	},
	roll() {
		let unit = pop_selected()
		let loc = unit_loc(unit)

		log(`>by ${units[unit].name} in ${areas[loc].name}`)

		// pay cost & update flags
		log(`>Paid ${FLN_PROPAGANDA_COST} AP`)
		game.fln_ap -= FLN_PROPAGANDA_COST
		set_area_propagandized(loc)
		set_unit_box(unit, OC)

		let drm = 0
		for_each_enemy_unit_in_loc_box(loc, PTL, _u => {
			drm -= 1
		})
		if (is_area_terrorized(loc))
			drm -= 1
		let [result, effect] = roll_mst(drm)
		if (is_area_urban(loc)) {
			log('x2 in Urban area')
			result *= 2
		}

		if (effect === '+') {
			// bad effect: eliminate Cadre or reduce Front
			if (unit_type(unit) === CADRE) {
				log(`Eliminated ${units[unit].name} in ${areas[loc].name}`)
				eliminate_unit(unit)
			} else {
				reduce_unit(unit, CADRE)
			}
		}

		if (result !== 0) {
			goto_fln_distribute_psl(result)
		} else {
			end_fln_mission()
		}
	},
	reset() {
		// XXX debug
		game.state = "fln_operations"
	}
}

function goto_fln_distribute_psl(result) {
	log(`Distribute ${result} PSP`)
	game.distribute_mst = result
	game.state = "fln_distribute_mission_result"
}

states.fln_distribute_mission_result = {
	inactive: "to distribute mission result PSP",
	prompt() {
		view.prompt = `Mission Result: distribute ${game.distribute_mst} PSP`

		if (game.distribute_mst > 0) {
			gen_action("add_fln_psl")
			gen_action("remove_gov_psl")
		} else if (game.distribute_mst < 0) {
			gen_action("remove_fln_psl")
			gen_action("add_gov_psl")
		}
		gen_action("reset")
	},
	add_fln_psl() {
		push_undo()
		log(">FLN PSL +1")
		game.fln_psl += 1
		game.distribute_mst -= 1
		if (!game.distribute_mst)
			end_fln_mission()
	},
	remove_gov_psl() {
		push_undo()
		log(">Government PSL -1")
		game.gov_psl -= 1
		game.distribute_mst -= 1
		if (check_victory())
			return
		if (!game.distribute_mst)
			end_fln_mission()
	},
	remove_fln_psl() {
		push_undo()
		log(">FLN PSL -1")
		game.fln_psl -= 1
		game.distribute_mst += 1
		if (check_victory())
			return
		if (!game.distribute_mst)
			end_fln_mission()
	},
	add_gov_psl() {
		push_undo()
		log(">Government PSL +1")
		game.gov_psl += 1
		game.distribute_mst += 1
		if (!game.distribute_mst)
			end_fln_mission()
	},
	reset() {
		// XXX debug
		game.state = "fln_operations"
	}
}

function end_fln_mission() {
	game.distribute_mst = 0
	goto_fln_operations_phase()
}

function goto_fln_strike_mission() {
	push_undo()
	game.passes = 0
	log_h3(`Strike Mission`)
	game.state = "fln_strike"
}

states.fln_strike = {
	inactive: "to do Strike mission",
	prompt() {
		view.prompt = "Strike: Select Front, Cadres may assist"

		if (game.selected.length === 0) {
			for_each_friendly_unit_on_map_box(OPS, u => {
				// first unit should be Front
				if (is_strike_unit(u) && unit_type(u) === FRONT) {
					gen_action_unit(u)
				}
			})
		} else {
			view.prompt = "Strike: Execute mission"

			for_each_friendly_unit_on_map_box(OPS, u => {
				if (is_strike_unit(u)) {
					gen_action_unit(u)
				}
			})

			gen_action("roll")
		}

		gen_action("reset")
	},
	unit(u) {
		set_toggle(game.selected, u)
	},
	roll() {
		let list = game.selected
		game.selected = []
		let front_unit = list[0]
		let loc = unit_loc(front_unit)
		let assist = list.length - 1

		if (assist) {
			log(`>by ${units[front_unit].name} (with ${assist} Cadre) in ${areas[loc].name}`)
		} else {
			log(`>by ${units[front_unit].name} in ${areas[loc].name}`)
		}

		// pay cost & update flags
		log(`>Paid ${FLN_STRIKE_COST} AP`)
		game.fln_ap -= FLN_STRIKE_COST
		set_area_struck(loc)
		for (let u of list) {
			set_unit_box(u, OC)
		}

		let drm = assist
		for_each_enemy_unit_in_loc_box(loc, PTL, _u => {
			drm -= 1
		})
		if (is_area_terrorized(loc))
			drm -= 1
		let [result, effect] = roll_mst(drm)
		let strike_result = roll_nd6(result)
		log(`Rolled ${result}d6 = ${strike_result} PSP`)

		if (effect === '+') {
			// bad effect: all FLN units involved in the mission are removed: a Cadre is eliminated; a Front is reduced to a Cadre.
			for (let u of list) {
				if (unit_type(u) === CADRE) {
					log(`Eliminated ${units[u].name} in ${areas[loc].name}`)
					eliminate_unit(u)
				} else {
					reduce_unit(u, CADRE)
				}
			}
		} else if (effect === '@') {
			// good result: all Police units neutralized
			log(`all Police units in ${areas[loc].name} neutralized`)
			for_each_enemy_unit_in_loc(loc, u => {
				if (is_police_unit(u)) {
					set_unit_neutralized(u)
				}
			})
		}

		if (result !== 0) {
			goto_fln_distribute_psl(strike_result)
		} else {
			end_fln_mission()
		}

		// TODO Government must react with one unit, otherwise -1d6 PSP
	},
	reset() {
		// XXX debug
		game.state = "fln_operations"
	}
}

function goto_fln_move_mission() {
	push_undo()
	game.passes = 0
	log_h3(`Move Mission`)
	game.state = "fln_move"
}

states.fln_move = {
	inactive: "to do Move mission",
	prompt() {
		if (game.selected.length === 0) {
			if (game.events.jealousy_and_paranoia) {
				view.prompt = "Move: Select unit to move (Jealousy and Paranoia restricts movements)"
			} else {
				view.prompt = "Move: Select unit to move"
			}

			for_each_friendly_unit_on_map_box(OPS, u => {
				if (is_movable_unit(u)) {
					gen_action_unit(u)
				}
			})
		} else {
			view.prompt = "Move: Select area to move to"
			let first_unit = game.selected[0]
			let first_unit_loc = unit_loc(first_unit)
			let zone = area_zone(first_unit_loc)
			for_each_map_area_in_zone(zone, to => {
				// A unit may move from one area to any other area within its current wilaya.
				if (first_unit_loc !== to)
					gen_action_loc(to)
				// A unit may also move to an area in a wilaya adjacent to its current one (that is, the two share a land border),
				// but the area moved to must be adjacent to at least one area in its current wilaya.
				// Morocco and Tunisia are treated as single-area wilaya for this purpose.
				for_each_adjecent_map_area(to, adj => {
					gen_action_loc(adj)
				})
			})

			// Allow deselect
			gen_action_unit(first_unit)
		}

		gen_action("reset")
	},
	unit(u) {
		set_toggle(game.selected, u)
	},
	loc(to) {
		let unit = pop_selected()
		push_undo()

		// TODO check MST for success

		log(`>Moved ${units[unit].name} to ${areas[to].name}`)
		set_unit_loc(unit, to)
		set_unit_box(unit, OC)
	},
	reset() {
		// XXX debug
		game.state = "fln_operations"
	}
}

function goto_fln_raid_mission() {
	push_undo()
	game.passes = 0
	log_h3(`Raid Mission`)
	game.state = "fln_raid"
}

states.fln_raid = {
	inactive: "to do Raid mission",
	prompt() {
		view.prompt = "Raid: Select Band or Failek units"

		for_each_friendly_unit_on_map_box(OPS, u => {
			if (is_raid_unit(u)) {
				gen_action_unit(u)
			}
		})

		gen_action("reset")
	},
	reset() {
		// XXX debug
		game.state = "fln_operations"
	}
}

function goto_fln_harass_mission() {
	push_undo()
	game.passes = 0
	log_h3(`Harass Mission`)
	game.state = "fln_harass"
}

states.fln_harass = {
	inactive: "to do Harass mission",
	prompt() {
		view.prompt = "Harass: Select Band or Failek unit (may combine if Failek present)"
		// TODO combine if Failek present

		for_each_friendly_unit_on_map_box(OPS, u => {
			if (is_harass_unit(u)) {
				gen_action_unit(u)
			}
		})

		gen_action("reset")
	},
	reset() {
		// XXX debug
		game.state = "fln_operations"
	}
}

function goto_gov_operations_phase() {
	game.phasing = GOV_NAME
	set_active_player()
	log_h2(`${game.active} Operations`)
	game.state = "gov_operations"
}

states.gov_operations = {
	inactive: "to do operations",
	prompt() {
		view.prompt = "Operations: Perform a mission, or Pass."

		gen_action("flush")
		gen_action("intelligence")
		gen_action("civil_affairs")
		gen_action("suppression")
		gen_action("population_resettlement")
		gen_action("pass")
	},
	flush() {
		goto_gov_flush_mission()
	},
	intelligence() {
		goto_gov_intelligence_mission()
	},
	civil_affairs() {
		goto_gov_civil_affairs_mission()
	},
	suppression() {
		goto_gov_suppression_mission()
	},
	population_resettlement() {
		goto_gov_population_resettlement_mission()
	},
	pass() {
		log("Government Passes")
		game.passes += 1
		console.log("PASSES", game.passes)
		if (game.passes >= 2) {
			end_operations_phase()
		} else {
			goto_fln_operations_phase()
		}
	}
}

function goto_gov_flush_mission() {
	push_undo()
	game.passes = 0
	log_h3(`Flush Mission`)
	game.state = "gov_flush"
}

states.gov_flush = {
	inactive: "to do Flush mission",
	prompt() {
		view.prompt = "Flush: TODO"
		gen_action("reset")
	},
	reset() {
		// XXX debug
		game.state = "gov_operations"
	}
}

function goto_gov_intelligence_mission() {
	push_undo()
	game.passes = 0
	log_h3(`Intelligence Mission`)
	game.state = "gov_intelligence"
}

states.gov_intelligence = {
	inactive: "to do Intelligence mission",
	prompt() {
		view.prompt = "Intelligence: TODO"
		gen_action("reset")
	},
	reset() {
		// XXX debug
		game.state = "gov_operations"
	}
}

function goto_gov_civil_affairs_mission() {
	push_undo()
	game.passes = 0
	log_h3(`Civil Affairs Mission`)
	game.state = "gov_civil_affairs"
}

states.gov_civil_affairs = {
	inactive: "to do Civil Affairs mission",
	prompt() {
		view.prompt = "Civil Affairs: TODO"
		gen_action("reset")
	},
	reset() {
		// XXX debug
		game.state = "gov_operations"
	}
}

function goto_gov_suppression_mission() {
	push_undo()
	game.passes = 0
	log_h3(`Suppression Mission`)
	game.state = "gov_suppression"
}

states.gov_suppression = {
	inactive: "to do Suppression mission",
	prompt() {
		view.prompt = "Suppression: TODO"
		gen_action("reset")
	},
	reset() {
		// XXX debug
		game.state = "gov_operations"
	}
}

function goto_gov_population_resettlement_mission() {
	push_undo()
	game.passes = 0
	log_h3(`Population Resettlement Mission`)
	game.state = "gov_population_resettlement"
}

states.gov_population_resettlement = {
	inactive: "to do Population Resettlement mission",
	prompt() {
		view.prompt = "Population Resettlement: TODO"
		gen_action("reset")
	},
	reset() {
		// XXX debug
		game.state = "gov_operations"
	}
}

function end_operations_phase() {
	game.passes = 0
	// XXX
	log("End Operations Phase")
	goto_turn_interphase()
}

function determine_control() {
	log_h3("Determine Control")
	log_br()

	let fln_pts = new Array(area_count).fill(0)
	let gov_pts = new Array(area_count).fill(0)

	for_each_non_neutralized_unit_in_algeria(u => {
		let loc = unit_loc(u)
		if (unit_type(u) === FRONT) {
			fln_pts[loc] += 3
		} else if (is_division_unit(u) && is_unit_dispersed(u)) {
			gov_pts[loc] += 3
		} else if (is_fln_unit(u)) {
			fln_pts[loc] += 1
		} else {
			gov_pts[loc] += 1
		}
	})

	for_each_algerian_map_area(loc => {
		let difference = Math.abs(fln_pts[loc] - gov_pts[loc])

		// If one side has twice as many or more Control Points than the other, then it gets Control and an appropriate marker is placed in the area.
		if (!difference || (!fln_pts[loc] && !gov_pts[loc])) {
			// log(`>Contested`)
			set_area_contested(loc)
			return
		}

		log(`${areas[loc].name}`)
		log(`>FLN ${fln_pts[loc]} vs Gov ${gov_pts[loc]}`)

		if (fln_pts[loc] >= 2 * gov_pts[loc]) {
			log(`>FLN Control`)
			set_area_fln_control(loc)
			return
		} else if (gov_pts[loc] >= 2 * fln_pts[loc]) {
			log(`>Government Control`)
			set_area_gov_control(loc)
			return
		}

		// If one side has less than twice as many Points, take the difference of the two totals
		// Both sides then roll 1d6 trying to get equal to or less than that number.
		let fln_roll = roll_d6()
		log(`> FLN rolled ${fln_roll}`)
		let gov_roll = roll_d6()
		log(`> Government rolled ${gov_roll}`)

		let fln_claim = fln_roll <= difference
		let gov_claim = gov_roll <= difference
		// If one side succeeds, then he gets Control. If both or neither succeed, then the area remains Contested and no marker is placed.
		if (fln_claim && !gov_claim) {
			log(`>FLN Control`)
			set_area_fln_control(loc)
		} else if (gov_claim && !fln_claim) {
			log(`>Government Control`)
			set_area_gov_control(loc)
		} else {
			log(`>Contested`)
			set_area_contested(loc)
		}
	})
}

function depreciation_loss_number(pts) {
	if (pts <= 0) {
		throw new Error("cannot do depreciation for pts " + pts)
	} else if (pts <= 5) {
		return 1
	} else if (pts <= 10) {
		return 2
	} else if (pts <= 15) {
		return 3
	} else if (pts <= 20) {
		return 4
	} else if (pts <= 24) {
		return 5
	} else {
		return 6
	}
}

function gov_depreciation() {
	if (!game.air_max && !game.helo_max) {
		return;
	}

	log_h3("Government Asset Depreciation")
	let drm = 0
	if (game.gov_psl <= 30) drm -= 1
	if (game.gov_psl >= 70) drm += 1
	if (game.air_max) {
		log(`Air Max = ${game.air_max}`)
		let loss = depreciation_loss_number(game.air_max)
		let roll = roll_1d6(drm)
		log(`>${roll} <= ${loss} ?`)
		if (roll <= loss) {
			game.air_max = Math.max(game.air_max - loss, 0)
			log(`>Air Max -${loss}`)
		}
	}
	if (game.helo_max) {
		log(`Helo Max = ${game.helo_max}`)
		let loss = depreciation_loss_number(game.helo_max)
		let roll = roll_1d6(drm)
		log(`>${roll} <= ${loss} ?`)
		if (roll <= loss) {
			game.helo_max = Math.max(game.helo_max - loss, 0)
			log(`>Helo Max -${loss}`)
		}
	}
}

function fln_depreciation() {
	if (!game.fln_ap) {
		return;
	}

	log_h3("FLN unused AP Depreciation")
	let drm = 0
	if (game.fln_psl <= 30) drm -= 1
	if (game.fln_psl >= 70) drm += 1
	let loss = depreciation_loss_number(game.fln_ap)
	let roll = roll_1d6(drm)
	log(`>${roll} <= ${loss} ?`)
	if (roll <= loss) {
		game.fln_ap = Math.max(game.fln_ap - loss, 0)
		log(`>AP -${loss}`)
	}
}

function unit_and_area_recovery() {
	log_h3("Recovery of Neutralized Units")
	for_each_neutralized_unit_in_algeria(u => {
		log(`${units[u].name} in ${areas[loc].name}`)
		let drm = 0
		if (is_fln_unit(u) && game.fln_psl <= 30) drm -= 1
		if (is_fln_unit(u) && game.fln_psl >= 70) drm += 1
		if (is_gov_unit(u) && game.gov_psl <= 30) drm -= 1
		if (is_gov_unit(u) && (game.gov_psl >= 70 || is_elite_unit(u))) drm += 1

		let roll = roll_1d6(drm)
		if (roll >= 5) {
			log(">Recovered")
			clear_unit_neutralized(u)
		}
	})

	log_h3("Recovery of Terrorized Areas")
	for_each_algerian_map_area(loc => {
		if (is_area_terrorized(loc)) {
			log(`${areas[loc].name}`)
			let drm = 0
			if (!has_fln_not_neutralized_unit_in_loc(loc)) drm += 1
			let roll = roll_1d6(drm)
			if (roll >= 5) {
				log(">Recovered")
				clear_area_terrorized(loc)
			}
		}
	})
}

function unit_redeployment() {
	log_h3("Redeployment")
	for_each_non_neutralized_unit_in_algeria(u => {
		let loc = unit_loc(u)
		if (is_fln_unit(u)) {
			log(`>${units[u].name} in ${areas[loc].name} to UG`)
			set_unit_box(u, UG)
		} else if (is_gov_unit(u) && is_mobile_unit(u)) {
			log(`>${units[u].name} in ${areas[loc].name} to OPS`)
			set_unit_box(u, OPS)
			if (is_unit_airmobile(u)) {
				log(`>flipped airmobile back`)
				clear_unit_airmobile(u)
			}
		}
		// TODO check that Police works okay
	})

	game.air_avail = game.air_max
	game.helo_avail = game.helo_max
	log(`Air Avail = ${game.air_avail}, Helo Avail = ${game.helo_avail}`)
}

function final_psl_adjustment() {
	log_h3("Final PSL Adjustment. TODO")

	if (game.gov_psl < 30) {
		log("Check for Coup d'etat TODO")
	}
}

function goto_turn_interphase() {
	// clear_undo()
	game.active = BOTH
	game.state = "turn_interphase"

	// XXX debug
	push_undo()
	log_h2("Turn Interphase")

	determine_control()
	gov_depreciation()
	fln_depreciation()

	unit_and_area_recovery()
	unit_redeployment()
	final_psl_adjustment()
}

states.turn_interphase = {
	prompt() {
		view.prompt = "Turn Interphase: TODO"
		gen_action("done")
		gen_action("reset")
	},
	done() {
		goto_next_turn()
	},
	reset() {
		// XXX debug
		goto_turn_interphase()
	}
}

function goto_next_turn() {
	game.turn += 1

	// make sure single-turn effects are disabled
	delete game.events.amnesty
	delete game.events.jealousy_and_paranoia
	delete game.events.border_zone_mobilized

	// make sure all limited mission events are cleared
	for_each_map_area(l => {
		clear_area_all_mission_flags(l)
	})

	log_h1("Turn: " + game.turn)

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

function roll_1d6(drm) {
	let roll = roll_d6()
	let net_roll = roll + drm
	let drm_str = ''
	if (drm > 0) {
		drm_str = `+${drm}`
	} else if (drm < 0) {
		drm_str = `${drm}`
	}

	//	Rolled 1d6+2=6
	log(`Rolled 1d6${drm_str}=${net_roll}`)
	return net_roll
}

function roll_nd6(n) {
	clear_undo()
	let result = 0
	for (let i = 0; i < n; ++i) {
		result += roll_d6()
	}
	return result
}

const MST = [0, 0, 1, 1, 1, 2, 2, 3, 4, 5]
const MST_EFFECT = ['+', '+', '+', '', '', '', '', '@', '@', '@']

function roll_mst(drm) {
	let roll = roll_1d6(drm)
	if (roll < -1) roll = -1
	if (roll > 8) roll = 8

	let result = MST[roll + 1]
	let effect = MST_EFFECT[roll + 1]
	log(`MST ${result}${effect}`)

	return [result, effect]
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

function is_subset_with_multiplicity(multiset, subset) {
	const occurrences = (arr, val) =>
		arr.reduce((acc, el) => (el === val ? acc + 1 : acc), 0)

	return !subset.some(val => (occurrences(subset, val) > occurrences(multiset, val)))
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

"use strict"

const FLN_NAME = "FLN"
const GOV_NAME = "Government"

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

const unit_type_name = [
	"French division",
	"French brigade",
	"French elite brigade",
	"Algerian brigade",
	"Police",
	"Failek",
	"Band",
	"Cadre",
	"Front",
]

// Free deployment holding box
const FREE = 0
const DEPLOY = 1
const ELIMINATED = 2
const FRANCE = 3
const TUNISIA = 4
const MOROCCO = 5

// maximum values

const MAX_PSL = 99
const MAX_AP = 99

const MAX_AIR_POINT = 99
const MAX_HELO_POINT = 99
const MAX_NAVAL_POINT = 99
const MAX_BORDER_ZONE_DRM = -3

// costs

const COST_AIR_POINT = 2
const COST_HELO_POINT = 3
const COST_NAVAL_POINT = 3
const COST_BORDER_ZONE = 6
const COST_ACTIVATE_BORDER_ZONE = 1

const GOV_UNIT_MOBILIZE_COST = {
	[FR_XX]: 5,
	[FR_X]: 2,
	[EL_X]: 3,
	[AL_X]: 2,
	[POL]: 1
}

const GOV_UNIT_ACTIVATION_COST = {
	[FR_XX]: 1,
	[FR_X]: .5,
	[EL_X]: .5,
	[AL_X]: 0
}

const GOV_UNIT_AIRMOBILIZE_COST = {
	[EL_X]: 1,
	[FR_X]: 2,
	[AL_X]: 2
}

//

var states = {}
var game = null
var view = null

const {
	areas, zone_areas, locations, units, adjacents
} = require("./data.js")

var first_friendly_unit, last_friendly_unit
var first_enemy_unit, last_enemy_unit

// #region PLAYER STATE

function player_name(player) {
	if (player === FLN) {
		return FLN_NAME
	} else {
		return GOV_NAME
	}
}

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

function raise_fln_psl(amount) {
	if (amount <= 0)
		throw Error(`ASSERT: amount > 0, but was ${amount}`)
	logp(`+${amount} FLN PSL`)
	// can trigger victory
	game.fln_psl += amount
	if (game.fln_psl > MAX_PSL) {
		let excess_psl = game.fln_psl - MAX_PSL
		logp("(subtracted from Gov PSL)")
		game.fln_psl = MAX_PSL
		lower_gov_psl(excess_psl)
	}
}

function raise_gov_psl(amount) {
	if (amount <= 0)
		throw Error(`ASSERT: amount > 0, but was ${amount}`)
	// can trigger victory
	logp(`+${amount} Gov PSL`)
	game.gov_psl += amount
	if (game.gov_psl > MAX_PSL) {
		let excess_psl = game.gov_psl - MAX_PSL
		logp("(subtracted from FLN PSL)")
		game.gov_psl = MAX_PSL
		lower_fln_psl(excess_psl)
	}
}

function lower_fln_psl(amount) {
	if (amount <= 0)
		throw Error(`ASSERT: amount > 0, but was ${amount}`)
	logp(`-${amount} FLN PSL`)
	game.fln_psl = Math.max(0, game.fln_psl - amount)
}

function log_lower_gov_psl(amount) {
	if (amount)
		logp(`-${amount} Gov PSL`)
}

function lower_gov_psl(amount, verbose=true) {
	if (amount <= 0)
		throw Error(`ASSERT: amount > 0, but was ${amount}`)
	if (verbose)
		log_lower_gov_psl(amount)
	game.gov_psl = Math.max(0, game.gov_psl - amount)
	return amount
}

function raise_fln_ap(amount) {
	if (amount < 0)
		throw Error(`ASSERT: amount >= 0, but was ${amount}`)
	logp(`+${amount} FLN AP`)
	game.fln_ap = Math.min(MAX_AP, game.fln_ap + amount)
}

function log_pay_ap(amount) {
	if (amount)
		logp(`-${amount} FLN AP`)
}

function pay_ap(amount, verbose=true) {
	if (verbose)
		log_pay_ap(amount)
	game.fln_ap = Math.max(0, game.fln_ap - amount)
	return amount
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

function is_area_resettled(l) {
	return (game.areas[l] & AREA_REMOTE_MASK) === AREA_REMOTE_MASK
}

function is_area_remote(l) {
	return areas[l].type === REMOTE || is_area_resettled(l)
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
	return l > 2 && areas[l].type !== COUNTRY
}

function is_area_france(l) {
	return l === FRANCE
}

function is_area_morocco_or_tunisia(l) {
	return l === MOROCCO || l === TUNISIA
}

function is_area_urban(l) {
	return areas[l].type === URBAN
}

function is_area_rural(l) {
	return areas[l].type === RURAL && !is_area_resettled(l)
}

function is_border_crossing(from, to) {
	return from !== to && (is_area_country(from) || is_area_country(to))
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

function set_unit_dispersed(u) {
	game.units[u] |= UNIT_DISPERSED_MASK
}

function clear_unit_dispersed(u) {
	game.units[u] &= ~UNIT_DISPERSED_MASK
}

function move_unit(u, to) {
	set_unit_loc(u, to)
	set_unit_box(u, OC)
}

function eliminate_unit(u) {
	let loc = unit_loc(u)
	log(`Eliminated U${u}.`)
	if (is_fln_unit(u)) {
		game.distribute_gov_psl += 1
		set_delete(game.contacted, u)
	}
	game.units[u] = 0
	set_unit_loc(u, ELIMINATED)
	set_unit_box(u, OC)
	clear_unit_neutralized(u)
}

function neutralize_unit(u) {
	log(`Neutralized U${u}.`)
	set_unit_neutralized(u)
	if (!is_police_unit(u))
		set_unit_box(u, OC)
}

function remove_unit(u, to) {
	let loc = unit_loc(u)
	set_unit_loc(u, to)
	set_unit_box(u, OC)
	clear_unit_neutralized(u)
}

function evade_unit(u) {
	set_unit_box(u, UG)
	set_delete(game.contacted, u)
}

function free_unit(u) {
	game.units[u] = 0
}

function activate_oas() {
	log("Gov PSL ≤ 30:")
	logi("OAS Activated")
	game.oas = DEPLOY
	game.oas_control = -1
}

function roll_oas_control() {
	let roll = roll_d6()
	log(`OAS Control B${roll}`)
	if (roll <= 3) {
		logi("FLN")
		game.oas_control = FLN
	} else {
		logi("Government")
		game.oas_control = GOV
	}
}

function remove_oas() {
	log("Gov PSL ≥ 70:")
	logi("OAS Removed")
	game.oas = 0
	game.oas_control = -1
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

function has_loc_as_airmobile_target(u, loc) {
	return has_enemy_unit_in_loc_boxes(loc, [OPS, OC]) && (unit_loc(u) === loc || is_elite_unit(u) || has_unit_type_in_loc(FR_XX, loc))
}

function has_any_airmobile_target(u) {
	let has_target = false
	for_each_algerian_map_area(loc => {
		if (has_loc_as_airmobile_target(u, loc))
			has_target = true
	})
	return has_target
}

function can_airmobilize_unit(u) {
	return !is_unit_airmobile(u) && ([FR_X, EL_X, AL_X].includes(unit_type(u))) && [OPS, PTL].includes(unit_box(u))
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
	return (type === FRONT || type === CADRE) && is_unit_not_neutralized(u) && !is_area_morocco_or_tunisia(loc) && !is_area_propagandized(loc) && !is_area_remote(loc)
}

function is_strike_unit(u) {
	let type = unit_type(u)
	let loc = unit_loc(u)
	return (type === FRONT) && is_unit_not_neutralized(u) && is_area_algerian(loc) && !is_area_struck(loc) && is_area_urban(loc)
}

function can_cross_border(u) {
	if (!game.is_morocco_tunisia_independent)
		return false
	let result = false
	let loc = unit_loc(u)
	for_each_adjacent_map_area(loc, adj => {
		if (is_border_crossing(loc, adj))
			result = true
	})
	return result
}

function is_movable_unit(u) {
	if (!is_mobile_unit(u) || is_unit_neutralized(u))
		return false
	if (!game.events.jealousy_and_paranoia)
		return true
	return can_cross_border(u)
}

function is_raid_unit(u) {
	let type = unit_type(u)
	let loc = unit_loc(u)
	return (type === BAND || type === FAILEK) && is_unit_not_neutralized(u) && is_area_algerian(loc) && !is_area_raided(loc) && !is_area_remote(loc)
}

function is_harass_unit(u) {
	let type = unit_type(u)
	let loc = unit_loc(u)
	return (type === BAND || type === FAILEK) && is_unit_not_neutralized(u) && is_area_algerian(loc) && has_enemy_unit_in_loc(loc)
}

function is_potential_airmobile_flush_unit(u) {
	return can_airmobilize_unit(u) && airmobilize_cost([u]) <= game.helo_avail && is_unit_not_neutralized(u)
}

function is_airmobile_flush_unit(u) {
	return is_unit_airmobile(u) && is_unit_not_neutralized(u) && has_enemy_unit_in_boxes([OPS, OC])
}

function is_flush_unit(u) {
	let loc = unit_loc(u)
	return is_mobile_unit(u) && is_unit_not_neutralized(u) && has_enemy_unit_in_loc_boxes(loc, [OPS, OC])
}

// An airmobilized unit may travel any distance to participate in a Flush or React Mission if it is an Elite unit,
// or if a Division in either mode is present in the area where the mission is occurring.

function is_react_unit(u) {
	return is_mobile_unit(u) && is_unit_not_neutralized(u)
}

function is_intelligence_loc(loc) {
	return has_enemy_unit_in_loc_boxes(loc, [UG]) && count_not_neutralized_unit_type_in_loc(POL, loc)
}

function is_intelligence_unit(u) {
	let loc = unit_loc(u)
	return is_police_unit(u) && is_unit_not_neutralized(u) && has_enemy_unit_in_loc_boxes(loc, [UG])
}

function is_civil_affairs_loc(loc) {
	return !is_area_civil_affaired(loc) && !is_area_remote(loc) && count_not_neutralized_unit_type_in_loc(POL, loc)
}

function is_civil_affairs_unit(u) {
	let loc = unit_loc(u)
	return is_police_unit(u) && is_unit_not_neutralized(u) && !is_area_civil_affaired(loc) && !is_area_remote(loc)
}

function is_suppression_loc(loc) {
	return !is_area_suppressed(loc) && has_enemy_unit_in_loc(loc) && count_not_neutralized_unit_type_in_loc(POL, loc)
}

function is_suppression_unit(u) {
	let loc = unit_loc(u)
	return is_police_unit(u) && is_unit_not_neutralized(u) && !is_area_suppressed(loc) && has_enemy_unit_in_loc(loc)
}

function is_population_resettlement_loc(loc) {
	return is_area_rural(loc) && count_not_neutralized_unit_type_in_loc(POL, loc)
}

function is_population_resettlement_unit(u) {
	let loc = unit_loc(u)
	return is_police_unit(u) && is_unit_not_neutralized(u) && is_area_rural(loc)
}

const DISPERSED_FIREPOWER = 12

function unit_firepower(u) {
	if (is_unit_dispersed(u)) {
		return DISPERSED_FIREPOWER
	} else {
		return units[u].firepower
	}
}

function unit_contact(u) {
	// only for Government
	let contact = units[u].evasion_contact
	if (is_unit_airmobile(u)) {
		contact += 1
	}
	return contact
}

function unit_evasion(u) {
	// only for FLN
	return units[u].evasion_contact
}

// #endregion

// #region ITERATORS

function for_each_neutralized_unit_in_algeria(fn) {
	for (let u = first_gov_unit; u <= last_fln_unit; ++u)
		if (is_unit_neutralized(u)) {
			let loc = unit_loc(u)
			if (is_area_algerian(loc))
				fn(u)
		}
}

function for_each_non_neutralized_unit_in_algeria(fn) {
	for (let u = first_gov_unit; u <= last_fln_unit; ++u)
		if (is_unit_not_neutralized(u)) {
			let loc = unit_loc(u)
			if (is_area_algerian(loc))
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

function for_each_friendly_unit_on_map_boxes(boxes, fn) {
	for (let u = first_friendly_unit; u <= last_friendly_unit; ++u)
		if (unit_loc(u) > 2 && boxes.includes(unit_box(u)))
			fn(u)
}

function for_each_friendly_unit_in_loc_box(loc, box, fn) {
	for (let u = first_friendly_unit; u <= last_friendly_unit; ++u)
		if (unit_loc(u) === loc && unit_box(u) === box)
			fn(u)
}

function for_each_enemy_unit_in_loc_boxes(loc, boxes, fn) {
	for (let u = first_enemy_unit; u <= last_enemy_unit; ++u)
		if (unit_loc(u) === loc && boxes.includes(unit_box(u)))
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

function count_friendly_units_on_map_of_type(type) {
	let count = 0
	for (let u = first_friendly_unit; u <= last_friendly_unit; ++u)
	if (unit_loc(u) > 2 && unit_type(u) === type)
			count++

	return count
}

function count_friendly_unit_in_loc(x) {
	let count = 0
	for (let u = first_friendly_unit; u <= last_friendly_unit; ++u)
		if (unit_loc(u) === x)
			count++

	return count
}

function count_friendly_units_in_zone(z) {
	let count = 0
	for (let u = first_friendly_unit; u <= last_friendly_unit; ++u)
		if (is_unit_not_neutralized(u) && area_zone(unit_loc(u)) === z)
			count++

	return count
}

function for_each_friendly_unit_in_zone(z, fn) {
	for (let u = first_friendly_unit; u <= last_friendly_unit; ++u)
		if (is_unit_not_neutralized(u) && area_zone(unit_loc(u)) === z)
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

function for_each_adjacent_map_area(x, fn) {
	if (x in adjacents) {
		for (let i of adjacents[x])
			fn(i)
	}
}

function for_each_fln_mobile_unit_in_morocco_tunisia(fn) {
	for (let u = first_fln_unit; u <= last_fln_unit; ++u) {
		let loc = unit_loc(u)
		if (is_mobile_unit(u) && (loc === MOROCCO || loc === TUNISIA))
			fn(u)
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

function has_enemy_unit_in_boxes(boxes) {
	for (let u = first_enemy_unit; u <= last_enemy_unit; ++u)
		if (unit_loc(u) > 2 && boxes.includes(unit_box(u)))
			return true
	return false
}

function has_enemy_unit_in_loc_boxes(x, boxes) {
	for (let u = first_enemy_unit; u <= last_enemy_unit; ++u)
		if (unit_loc(u) === x && boxes.includes(unit_box(u)))
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

function has_fln_not_neutralized_mobile_unit_in_algeria() {
	for (let u = first_fln_unit; u <= last_fln_unit; ++u)
		if (is_unit_not_neutralized(u) && is_mobile_unit(u)) {
			let loc = unit_loc(u)
			if (is_area_algerian(loc))
				return true
		}
	return false
}

function has_unit_type_in_loc(t, x) {
	for (let u = 0; u <= unit_count; ++u)
		if (unit_loc(u) === x && unit_type(u) === t)
			return true
	return false
}

function count_not_neutralized_unit_type_in_loc(t, x) {
	let result = 0
	for (let u = 0; u <= unit_count; ++u)
		if (unit_loc(u) === x && unit_type(u) === t && is_unit_not_neutralized(u))
			result += 1
	return result
}

function for_each_not_neutralized_unit_type_in_loc(t, x, f) {
	for (let u = 0; u <= unit_count; ++u)
		if (unit_loc(u) === x && unit_type(u) === t && is_unit_not_neutralized(u))
			f(u)
}

function count_patrol_units_in_loc(loc) {
	let result = 0
	for (let u = first_gov_unit; u <= last_gov_unit; ++u)
		if (unit_loc(u) === loc && unit_box(u) === PTL && is_unit_not_neutralized(u))
			result += 1
	return result
}

function for_each_patrol_unit_in_loc(loc, f) {
	for (let u = first_gov_unit; u <= last_gov_unit; ++u)
		if (unit_loc(u) === loc && unit_box(u) === PTL && is_unit_not_neutralized(u))
			f(u)
}

function has_gov_react_units_for_loc(loc) {
	let has_division = has_unit_type_in_loc(FR_XX, loc)
	for (let u = first_gov_unit; u <= last_gov_unit; ++u)
		if (is_react_unit(u) && (unit_box(u) === PTL || unit_box(u) === OPS)) {
			if (unit_loc(u) === loc || ((is_unit_airmobile(u) || is_potential_airmobile_flush_unit(u)) && (has_division || is_elite_unit(u))))
				return true
		}
	return false
}

// #endregion

// #region PUBLIC FUNCTIONS

exports.scenarios = [ "1954", "1958", "1960" ]

exports.roles = [ FLN_NAME, GOV_NAME ]

function gen_action(action, argument) {
	if (argument === undefined) {
		view.actions[action] = 1
	} else {
		if (!(action in view.actions))
			view.actions[action] = []
		view.actions[action].push(argument)
	}
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

// JSON Schema for view data
exports.VIEW_SCHEMA = {
	type: "object",
    properties: {
		log: {type: "array", items: {type: "string"}},
		prompt: {type: "string"},
		scenario: {type: "string"},
		active: {type: "string"},
		phasing: {type: "string"},

		turn: {type: "integer", minimum: 0},
		fln_ap: {type: "integer", minimum: 0, maximum: MAX_AP},
		fln_psl: {type: "integer", minimum: 0, maximum: MAX_PSL},
		gov_psl: {type: "integer", minimum: 0, maximum: MAX_PSL},
		air_avail: {type: "integer", minimum: 0, maximum: MAX_AIR_POINT},
		air_max: {type: "integer", minimum: 0, maximum: MAX_AIR_POINT},
		helo_avail: {type: "integer", minimum: 0, maximum: MAX_HELO_POINT},
		helo_max: {type: "integer", minimum: 0, maximum: MAX_HELO_POINT},
		naval: {type: "integer", minimum: 0, maximum: MAX_NAVAL_POINT},
		oas: {type: "integer", minimum: 0, maximum: area_count},

		is_morocco_tunisia_independent: {type: "boolean"},
		border_zone_active: {type: "boolean"},
		border_zone_drm: {type: "integer", "nullable": true, minimum: MAX_BORDER_ZONE_DRM, maximum: 0},

		units: {type: "array", minItems: unit_count, maxItems: unit_count, items: {type: "integer"}},
		areas: {type: "array", minItems: area_count, maxItems: area_count, items: {type: "integer"}},
		contacted: {type: "array", items: {type: "integer", maximum: unit_count}},

		actions: {type: "object"},
		selected: {type: ["array", "integer"]},
		selected_loc: {type: ["array", "integer"]}
    },
    required: [
		"log", "prompt", "scenario", "active", "phasing",
		"turn", "fln_ap", "fln_psl", "gov_psl", "air_avail", "air_max", "helo_avail", "helo_max", "naval", "oas",
		"is_morocco_tunisia_independent", "border_zone_active", "border_zone_drm",
		"units", "areas", "contacted"
	],
    additionalProperties: false
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
		gov_psl: Math.floor(game.gov_psl), // activation cost can be fraction
		air_avail: game.air_avail,
		air_max: game.air_max,
		helo_avail: game.helo_avail,
		helo_max: game.helo_max,
		naval: game.naval,
		oas: game.oas,

		is_morocco_tunisia_independent: game.is_morocco_tunisia_independent,
		border_zone_active: game.border_zone_active,
		border_zone_drm: game.border_zone_drm,

		units: game.units,
		areas: game.areas,
		contacted: game.contacted,
	}

	if (player === game.active)
		view.selected = game.selected
		view.selected_loc = game.selected_loc

	if (game.state === "game_over") {
		view.prompt = game.victory
	} else if (player !== game.active) {
		let inactive = states[game.state].inactive || game.state
		view.prompt = `Waiting for ${game.active} ${inactive}.`
	} else {
		view.actions = {}
		if (game.undo && game.undo.length > 0)
			view.actions.undo = 1
		else
			view.actions.undo = 0
		states[game.state].prompt()
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

function victory_scale() {
	let psl_diff = Math.abs(game.gov_psl - game.fln_psl)
	if (psl_diff <= 25) {
		return "Marginal"
	} else if (psl_diff <= 50) {
		return "Substantial"
	} else {
		return "Decisive"
	}
}

function check_victory() {
	if (game.state === "game_over") return
	if (game.gov_psl <= 0) {
		let scale = victory_scale()
		goto_game_over(FLN_NAME, `${scale} FLN victory.`)
		return true
	} else if (game.fln_psl <= 0) {
		let scale = victory_scale()
		goto_game_over(GOV_NAME, `${scale} Government victory.`)
		return true
	}
	return false
}

function check_shorter_victory() {
	if (game.state === "game_over") return
	// If one player would "win" with at least a Substantial Victory (that is, his PSL is 26 or more points ahead of the other player's) two checks running,
	// the game ends at that point and he wins the game with the level of victory he enjoyed at that moment.
	let psl_diff = Math.abs(game.gov_psl - game.fln_psl)
	if (psl_diff >= 26) {
		let leader = game.gov_psl > game.fln_psl ? GOV : FLN
		if (game.shorter_victory_leader === GOV && leader === GOV) {
			let scale = victory_scale()
			goto_game_over(GOV_NAME, `${scale} Government Shorter Game victory.`)
			return true
		} else if (game.shorter_victory_leader === FLN && leader === FLN) {
			let scale = victory_scale()
			goto_game_over(FLN_NAME, `${scale} FLN Shorter Game victory.`)
			return true
		}
		game.shorter_victory_leader = leader
		log(`${player_name(leader)} leads with ${psl_diff} PSL.`)
	} else {
		game.shorter_victory_leader = -1
	}
	return false
}

function goto_game_over(result, victory) {
	game.state = "game_over"
	game.active = "None"
	game.result = result
	game.victory = victory
	log_h1("Game Over")
	log(`FLN PSL ${game.fln_psl}`)
	log(`Gov PSL ${game.gov_psl}`)
	log_br()
	log(victory)
	return true
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
		selected_loc: -1,
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
		oas: 0,
		oas_control: -1,

		is_morocco_tunisia_independent: false,
		border_zone_active: false,
		border_zone_drm: null,

		units: new Array(unit_count).fill(0),
		areas: new Array(area_count).fill(0),
		events: {},

		// transient state
		passes: 0,
		combat: {},
		deployed: [],
		contacted: [],
		distribute: {},
		distribute_gov_psl: 0,
		mission_air_pts: 0,

		// logging
		summary: null,
	})

	game.scenario = scenario
	setup_scenario(scenario)

	if (scenario === "1954") {
		if (options.slow_french_reaction) {
			log("Slow French Reaction.")
			game.events.slow_french_reaction = true
		}
		if (options.more_deterministic_independence) {
			log("More Deterministic Independence.")
			game.events.more_deterministic_independence = true
		}
	}
	if (options.shorter_game) {
		log("Shorter Game.")
		game.shorter_game = true
	}

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
		air_max: 6,
		helo_max: 4,
		naval: 2,
		fln_psl: 60,
		is_morocco_tunisia_independent: true,
		border_zone_drm: -2
	},
	"1960": {
		gov_psl: 45,
		air_max: 7,
		helo_max: 5,
		naval: 3,
		fln_psl: 45,
		is_morocco_tunisia_independent: true,
		border_zone_drm: -3
	}
}

// quick setup from Colonial Twilight Scenario Guide
const SCENARIO_DEPLOYMENT = {
	"1954": {
		fln: {
			"I": [FRONT, CADRE],
			"II": [FRONT, CADRE, CADRE],
			"III": [FRONT, CADRE],
			"IV": [CADRE],
			"V": [FRONT, CADRE, CADRE]
		},
		fln_quick: {
			"I-4": [FRONT, CADRE],
			"CONSTANTINE": [CADRE],
			"II-2": [FRONT, CADRE],
			"III-1": [FRONT, CADRE],
			"IV-1": [CADRE],
			"V-2": [FRONT, CADRE],
			"V-4": [CADRE],
		},
		gov: {
			"II": [FR_X, AL_X, POL],
			"IV": [FR_X, AL_X, POL],
			"V": [FR_X, EL_X, AL_X, POL]
		},
		gov_quick: {
			"CONSTANTINE": [POL, FR_X],
			"II-2": [AL_X],
			"ALGIERS": [POL, FR_X],
			"IV-1": [AL_X],
			"ORAN": [POL, AL_X],
			"V-3": [EL_X, FR_X],
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
			"MOROCCO": [BAND],
			"TUNISIA": [BAND, BAND, BAND, BAND, FAILEK]
		},
		gov: {
			"I": [FR_XX, FR_XX, FR_X],
			"II": [FR_XX, FR_XX, FR_X, EL_X, EL_X, EL_X, AL_X, POL, POL],
			"III": [FR_XX, FR_XX, AL_X, POL, POL],
			"IV": [FR_XX, FR_XX, EL_X, EL_X, EL_X, AL_X, AL_X, POL, POL],
			"V": [FR_XX, FR_XX, FR_XX, FR_X, EL_X, AL_X, POL, POL],
		},
		gov_quick: {
			"I-1": [FR_XX],
			"I-3": [FR_X],
			"I-4": [FR_XX],
			"CONSTANTINE": [EL_X, POL, POL],
			"II-1": [FR_X, AL_X],
			"II-2": [FR_XX, EL_X],
			"II-3": [FR_XX, EL_X],
			"III-1": [FR_XX, POL],
			"III-3": [FR_XX, AL_X, POL],
			"ALGIERS": [FR_XX, EL_X, EL_X, EL_X, POL],
			"IV-1": [FR_XX, AL_X, POL],
			"IV-2": [AL_X],
			"ORAN": [FR_XX, EL_X, POL],
			"V-1": [AL_X],
			"V-2": [FR_X],
			"V-3": [FR_XX],
			"V-4": [FR_XX, POL],
			"V-5": [],
		},
		fln_quick: {
			"I-1": [FRONT, CADRE, BAND, BAND],
			"I-2": [CADRE],
			"II-1": [CADRE],
			"II-2": [FRONT, BAND, BAND],
			"II-3": [CADRE],
			"III-1": [FRONT, CADRE, BAND],
			"III-3": [CADRE, BAND],
			"IV-1": [FRONT, CADRE],
			"IV-2": [FRONT, CADRE, BAND, BAND],
			"V-3": [FRONT, BAND],
			"V-5": [CADRE],
			"VI-2": [FRONT, CADRE, BAND],
			"MOROCCO": [BAND],
			"TUNISIA": [BAND, BAND, BAND, BAND, FAILEK]
		},
	},
	"1960": {
		fln: {
			"I": [CADRE, CADRE, BAND, BAND],
			"II": [FRONT, CADRE, CADRE, BAND, BAND],
			"III": [FRONT, FRONT, CADRE, CADRE, BAND, BAND],
			"IV": [FRONT, CADRE, BAND],
			"V": [CADRE, BAND],
			"MOROCCO": [BAND, BAND, BAND, BAND],
			"TUNISIA": [BAND, BAND, BAND, BAND, FAILEK, FAILEK, FAILEK]
		},
		gov: {
			"I": [FR_XX, FR_XX, AL_X],
			"II": [FR_XX, FR_XX, EL_X, EL_X, EL_X, EL_X, AL_X, POL, POL],
			"III": [FR_XX, FR_XX, FR_X, AL_X],
			"IV": [FR_XX, FR_XX, EL_X, EL_X, EL_X, AL_X, AL_X, POL, POL],
			"V": [FR_XX, FR_XX, FR_XX, FR_XX, FR_XX, AL_X, POL, POL]
		},
		gov_quick: {
			// "I": [FR_XX, FR_XX, AL_X],
			"I-1": [FR_XX],
			"I-3": [AL_X],
			"I-4": [FR_XX],
			// "II": [FR_XX, FR_XX, EL_X, EL_X, EL_X, EL_X, AL_X, POL, POL],
			"CONSTANTINE": [EL_X, EL_X, POL, POL],
			"II-1": [AL_X],
			"II-2": [FR_XX, EL_X],
			"II-3": [FR_XX, EL_X],
			// "III": [FR_XX, FR_XX, FR_X, AL_X],
			"III-1": [FR_XX, FR_X],
			"III-3": [FR_XX, AL_X],
			// "IV": [FR_XX, FR_XX, EL_X, EL_X, EL_X, AL_X, AL_X, POL, POL],
			"ALGIERS": [FR_XX, EL_X, EL_X, EL_X, POL],
			"IV-1": [FR_XX, AL_X, POL],
			"IV-2": [AL_X],
			// "V": [FR_XX, FR_XX, FR_XX, FR_XX, FR_XX, AL_X, POL, POL]
			"ORAN": [FR_XX, FR_XX, POL],
			"V-1": [AL_X],
			"V-2": [FR_X],
			"V-3": [FR_XX],
			"V-4": [FR_XX, FR_XX, POL],
			"V-5": [],
		},
		fln_quick: {
			// "I": [CADRE, CADRE, BAND, BAND],
			"I-1": [CADRE, BAND, BAND],
			"I-4": [CADRE],
			// "II": [FRONT, CADRE, CADRE, BAND, BAND],
			"II-1": [CADRE],
			"II-2": [FRONT, BAND, BAND],
			"II-3": [CADRE],
			// "III": [FRONT, FRONT, CADRE, CADRE, BAND, BAND],
			"III-1": [FRONT, CADRE, BAND],
			"III-3": [FRONT, CADRE, BAND],
			// "IV": [FRONT, CADRE, BAND],
			"IV-2": [FRONT, CADRE, BAND],
			// "V": [CADRE, BAND],
			"V-2": [BAND],
			"V-3": [CADRE],
			"VI-2": [FRONT, CADRE, BAND],
			"MOROCCO": [BAND, BAND, BAND, BAND],
			"TUNISIA": [BAND, BAND, BAND, BAND, FAILEK, FAILEK, FAILEK]
		},
	}
}

function setup_units(deployment) {
	for (const [target, list] of Object.entries(deployment)) {
		for (let l of list) {
			let u = find_free_unit_by_type(l)
			let loc = DEPLOY
			if (target in locations) {
				loc = locations[target]
			}
			deploy_unit(u, loc)
		}
	}
}

function setup_scenario(scenario_name) {
	log_h1("Scenario: " + scenario_name)

	let scenario = SCENARIOS[scenario_name]
	Object.assign(game, scenario)
	restore_air_helo_avail()

	log(`Gov PSL = ${game.gov_psl}`)
	log(`FLN PSL = ${game.fln_psl}`)

	let d1 = roll_d6()
	let d2 = roll_d6()
	game.fln_ap = d1 + d2

	log(`FLN AP = F${d1} F${d2} = ${d1+d2}`)

	log_br()

	let deployment = SCENARIO_DEPLOYMENT[scenario_name]
	setup_units(deployment.fln)
	setup_units(deployment.gov)

	game.phasing = GOV_NAME
}

function goto_scenario_setup() {
	set_active_player()
	game.state = "scenario_setup"
	log_h2(`${game.active} Setup`)
	game.selected = []
}

function current_player_deployment() {
	let deployment = SCENARIO_DEPLOYMENT[game.scenario]
	return is_fln_player() ? deployment.fln : deployment.gov
}

function current_player_quick_setup() {
	let deployment = SCENARIO_DEPLOYMENT[game.scenario]
	return is_fln_player() ? deployment.fln_quick : deployment.gov_quick
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
	if (to === DEPLOY) {
		set_unit_box(u, OC)
	} else if (is_fln_unit(u)) {
		set_unit_box(u, UG)
	} else if (is_police_unit(u)) {
		set_unit_box(u, PTL)
	} else if (is_algerian_unit(u)) {
		set_unit_box(u, OPS)
	} else {
		// in OC because it needs to be activated
		set_unit_box(u, OC)
	}
}

states.scenario_setup = {
	inactive: "setup",
	prompt() {
		let count = count_friendly_unit_in_loc(DEPLOY)
		view.prompt = `Setup: ${game.active} Deployment. ${count} unit(s) remain.`

		if (!game.selected.length) {
			// first unit can be any unit in DEPLOY or on map
			for_each_friendly_unit(u => {
				gen_action_unit(u)
			})

			if (current_player_quick_setup()) {
				// only allow quick-setup as the very first action
				if (game.undo && game.undo.length === 0)
					view.actions.quick_setup = 1
			}
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
					if (loc !== first_unit_loc)
						gen_action_loc(loc)
				})
			}

			view.actions.undo = 1
		}

		view.actions.end_deployment = !count
	},
	quick_setup() {
		push_undo()
		for_each_friendly_unit(u => {
			free_unit(u)
		})
		let deployment = current_player_quick_setup()
		setup_units(deployment)
	},
	undo() {
		if (game.selected.length > 0)
			set_clear(game.selected)
		else
			pop_undo()
	},
	unit(u) {
		set_toggle(game.selected, u)
	},
	loc(to) {
		let list = game.selected
		game.selected = []
		push_undo()
		// game.summary[to] = (game.summary[to] | 0) + list.length
		for (let u of list) {
			deploy_unit(u, to)
		}
	},
	end_deployment() {
		clear_undo()

		for_each_map_area(loc => {
			let n = [ 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
			for_each_friendly_unit_in_loc(loc, u => {
				n[units[u].type] += 1
			})
			let i
			for (i = 0; i < n.length; ++i)
				if (n[i] > 0)
					break
			if (i < n.length) {
				log("A" + loc)
				for (i = 0; i < n.length; ++i)
					if (n[i] > 0)
						logi(`${n[i]} ${unit_type_name[i]}`)
			}
		})

		end_scenario_setup()
	}
}

function end_scenario_setup() {
	if (has_enemy_unit_in_loc(DEPLOY)) {
		set_next_player()
		goto_scenario_setup()
	} else {
		ensure_front_in_independent_morocco_tunisia()

		begin_game()
	}
}

// #endregion

// #region FLOW OF PLAY

function begin_game() {
	game.selected = []
	game.summary = null
	game.turn = 1
	log_h1("Turn: " + game.turn)
	goto_random_event()
}

function goto_random_event() {
	// current player gets to do the random event roll
	game.state = "random_event"

	// log_h2("Random Events Phase")

	if (game.events.gov_remobilize) {
		log("Units may remobilize this turn:")
		for (let u of game.events.gov_remobilize) {
			// TODO: summarize by type
			logi(`U${u}`)
			set_unit_loc(u, DEPLOY)
		}
		delete game.events.gov_remobilize
		log_br()
	}

	if (game.events.gov_return) {
		let summary = []
		map_for_each(game.events.gov_return, (u, loc) => {
			deploy_unit(u, loc)
			summary.push(u)
		})
		delete game.events.gov_return

		log_area_unit_list("Units returned", summary)
		log_br()
	}

	// Instead of waiting for a random event to make Morocco and Tunisia independent,
	// assume that this will happen some time in the first 6 turns of the 1954 scenario.
	// Each Random Events Phase, roll 1d6; if the number rolled is less than or equal to the number of the current turn,
	//the two countries immediately become independent.
	if (game.events.more_deterministic_independence && !game.is_morocco_tunisia_independent) {
		let roll = roll_d6()
		if (roll <= game.turn) {
			delete game.events.more_deterministic_independence
			log("More Deterministic Independence B" + roll)
			log("Morocco and Tunisia Gain Independence.")
			grant_morocco_tunisia_independence()
		} else {
			log("More Deterministic Independence W" + roll)
		}
		log_br()
	}
}

states.random_event = {
	inactive: "to do random event",
	prompt() {
		view.prompt = "Roll for a random event."
		gen_action("roll")
	},
	roll() {
		let a = roll_d6()
		let b = roll_d6()
		let rnd = 10 * a + b

		log(`Random Event G${a} F${b}`)
		log_br()

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
	}
}

function goto_no_event() {
	log_event("No Event.")
	end_random_event()
}

function goto_fln_foreign_arms_shipment() {
	log_event("FLN Foreign arms shipment.")

	// The FLN player adds 2d6 AP, minus the current number of Naval Points.
	let roll = roll_nd6(2, "F", "Shipment")
	if (game.naval)
		logi(`-${game.naval} Naval PTS`)
	let delta_ap = Math.max(roll - game.naval, 0)
	raise_fln_ap(delta_ap)
	end_random_event()
}

function goto_jealousy_and_paranoia() {
	log_event("Jealousy and Paranoia.")
	log("FLN units may not Move across wilaya borders this turn only (they may move across international borders).")
	game.events.jealousy_and_paranoia = true
	end_random_event()
}

function goto_elections_in_france() {
	log_event("Elections in France.")
	// Government player rolls on the Coup Table (no DRM) and adds or subtracts
	// the number of PSP indicated: no units are mobilized or removed.
	roll_coup_table()
	end_random_event()
}

function goto_un_debate() {
	log_event("UN debates Algerian Independence.")

	// Player with higher PSL raises FLN or lowers Government PSL by 1d6.
	if (game.gov_psl <= game.fln_psl) {
		game.phasing = FLN_NAME
	} else {
		game.phasing = GOV_NAME
	}
	set_active_player()
	game.state = "random_event_un_debate"
}

states.random_event_un_debate = {
	inactive: "to do UN debate",
	prompt() {
		view.prompt = "Random Event: UN Debate."
		gen_action("raise_fln_psl_1d6")
		gen_action("lower_gov_psl_1d6")
	},
	raise_fln_psl_1d6() {
		let roll = roll_d6()
		log("Raised FLN PSL by F" + roll)
		raise_fln_psl(roll)
		end_random_event()
	},
	lower_gov_psl_1d6() {
		let roll = roll_d6()
		log("Lowered Gov PSL by G" + roll)
		lower_gov_psl(roll)
		end_random_event()
	}
}

function goto_fln_factional_purge() {
	log_event("FLN Factional Purge.")
	// The Government player chooses one wilaya and rolls 1d6, neutralizing
	// that number of FLN units there (the FLN player's choice which ones).
	game.phasing = GOV_NAME
	set_active_player()
	game.state = "event_fln_factional_purge_select_zone"
}

states.event_fln_factional_purge_select_zone = {
	inactive: "to do FLN Factional Purge",
	prompt() {
		view.prompt = "FLN Factional Purge: Choose one wilaya (zone) where to neutralize 1d6 FLN units."
		gen_action("zone_I")
		gen_action("zone_II")
		gen_action("zone_III")
		gen_action("zone_IV")
		gen_action("zone_V")
		gen_action("zone_VI")
	},
	zone_I() {
		game.events.fln_purge_zone = "I"
		continue_fln_factional_purge()
	},
	zone_II() {
		game.events.fln_purge_zone = "II"
		continue_fln_factional_purge()
	},
	zone_III() {
		game.events.fln_purge_zone = "III"
		continue_fln_factional_purge()
	},
	zone_IV() {
		game.events.fln_purge_zone = "IV"
		continue_fln_factional_purge()
	},
	zone_V() {
		game.events.fln_purge_zone = "V"
		continue_fln_factional_purge()
	},
	zone_VI() {
		game.events.fln_purge_zone = "VI"
		continue_fln_factional_purge()
	}
}

function continue_fln_factional_purge() {
	game.phasing = FLN_NAME
	set_active_player()

	let roll = roll_d6()

	log(`Purge in wilaya ${game.events.fln_purge_zone} G${roll}`)

	game.selected = []
	game.events.fln_purge_num = Math.min(roll, count_friendly_units_in_zone(game.events.fln_purge_zone))
	game.state = "event_fln_factional_purge_select_units"
}

states.event_fln_factional_purge_select_units = {
	inactive: "to do FLN Factional Purge",
	prompt() {
		view.prompt = `FLN Factional Purge: Select ${game.events.fln_purge_num} unit(s) in wilaya (zone) ${game.events.fln_purge_zone} to neutralize.`

		for_each_friendly_unit_in_zone(game.events.fln_purge_zone, u => {
			gen_action_unit(u)
		})

		if (game.selected.length === game.events.fln_purge_num) {
			gen_action("done")
		}
	},
	unit(u) {
		set_toggle(game.selected, u)
	},
	done() {
		for (let u of game.selected) {
			neutralize_unit(u)
		}

		delete game.events.fln_purge_zone
		delete game.events.fln_purge_num
		end_random_event()
	}
}

function grant_morocco_tunisia_independence() {
	log_br()

	// Raise both FLN and Government PSL by 2d6;
	let fln_roll = roll_nd6(2, "F")
	raise_fln_psl(fln_roll)

	let gov_roll = roll_nd6(2, "G")
	raise_gov_psl(gov_roll)

	// FLN player may now Build/Convert units in these two countries as if a Front were there
	// and Government may begin to mobilize the Border Zone. See 11.22.
	game.is_morocco_tunisia_independent = true
	ensure_front_in_independent_morocco_tunisia()
}

function goto_morocco_tunisia_independence() {
	log_event("Morocco and Tunisia Gain Independence.")

	if (game.is_morocco_tunisia_independent || game.scenario === "1958" || game.scenario === "1960") {
		// If this event is rolled again, or if playing the 1958 or 1960 scenarios,
		// FLN player instead rolls on the Mission Success Table (no DRM) and gets that number of AP
		// (represents infiltration of small numbers of weapons and troops through the borders).
		let roll = roll_d6()
		log("Infiltration F" + roll)
		let [result, _effect] = roll_mst(roll)
		if (result)
			raise_fln_ap(result)

		end_random_event()
		return
	}

	grant_morocco_tunisia_independence()
	end_random_event()
}

function goto_nato_pressure() {
	log_event("NATO pressures France to boost European defense.")

	// The Government player rolls 1d6 and must remove that number of French Army brigades
	// (a division counts as three brigades) from the map.
	game.phasing = GOV_NAME
	set_active_player()

	let roll = roll_d6()
	log("Remove French brigades G" + roll)

	game.selected = []
	let num_fr_x = count_friendly_units_on_map_of_type(FR_X)
	let num_fr_xx = count_friendly_units_on_map_of_type(FR_XX)
	let to_remove = Math.min(roll, num_fr_x + 3 * num_fr_xx)
	if (to_remove) {
		game.events.gov_remove_num = to_remove
		game.state = "event_gov_nato_pressure_select_units"
	} else {
		log("No French Army brigades to remove")
		end_random_event()
	}
}

states.event_gov_nato_pressure_select_units = {
	inactive: "to do NATO Pressure",
	prompt() {
		view.prompt = `NATO Pressure: Select ${game.events.gov_remove_num} French Army brigade(s) (division counts as 3) to remove from the map.`

		let target = 0
		for (let u of game.selected) {
			if (unit_type(u) === FR_X) {
				target += 1
			} else if (unit_type(u) === FR_XX) {
				target += 3
			}
		}

		for_each_friendly_unit_on_map(u => {
			if ((unit_type(u) === FR_X || unit_type(u) === FR_XX) && (target < game.events.gov_remove_num || set_has(game.selected, u)))
				gen_action_unit(u)
		})

		if (target >= game.events.gov_remove_num) {
			gen_action("done")
		}
	},
	unit(u) {
		set_toggle(game.selected, u)
	},
	done() {
		let list = game.selected
		game.selected = []

		// The units may be re-mobilized at least one turn later.
		if (!game.events.gov_remobilize)
			game.events.gov_remobilize = []

		log_area_unit_list("Removed (can re-mobilize)", list)
		for (let u of list) {
			remove_unit(u, ELIMINATED)
			game.events.gov_remobilize.push(u)
		}
		delete game.events.gov_remove_num
		end_random_event()
	}
}

function goto_suez_crisis() {
	log_event("Suez Crisis.")

	if (game.events.suez_crisis || game.scenario === "1958" || game.scenario === "1960") {
		// Treat as "No Event" if rolled again, or playing 1958 or 1960 scenarios.
		log("No effect.")
		end_random_event()
		return
	}

	game.phasing = GOV_NAME
	set_active_player()
	game.events.suez_crisis = true

	// The Government player must remove 1d6 elite units from the map, up to the number actually available
	let roll = roll_d6()

	log("Crisis G" + roll)

	game.selected = []

	let num_el_x = count_friendly_units_on_map_of_type(EL_X)
	let to_remove = Math.min(roll, num_el_x)
	if (to_remove) {
		game.events.gov_remove_num = to_remove
		game.state = "event_gov_suez_crisis_select_units"
	} else {
		log("No French elite units to remove.")
		end_random_event()
	}
}

states.event_gov_suez_crisis_select_units = {
	inactive: "to do Suez Crisis",
	prompt() {
		view.prompt = `Suez Crisis: Select ${game.events.gov_remove_num} French elite unit(s) to remove from the map.`

		let target = 0
		for (let u of game.selected) {
			if (unit_type(u) === EL_X) target += 1
		}

		for_each_friendly_unit_on_map(u => {
			if (unit_type(u) === EL_X && (target < game.events.gov_remove_num || set_has(game.selected, u)))
				gen_action_unit(u)
		})

		if (target >= game.events.gov_remove_num) {
			gen_action("done")
		}
	},
	unit(u) {
		set_toggle(game.selected, u)
	},
	done() {
		let list = game.selected
		game.selected = []

		// they will return in the Random Event Phase of the next turn automatically
		// - they do not need to be mobilized again but do need to be activated.
		// The units may be re-mobilized at least one turn later.
		if (!game.events.gov_return)
			game.events.gov_return = []
		log_area_unit_list("Removed (will return)", list)
		for (let u of list) {
			let loc = unit_loc(u)
			remove_unit(u, ELIMINATED)
			map_set(game.events.gov_return, u, loc)
		}
		delete game.events.gov_remove_num
		end_random_event()
	}
}

function goto_amnesty() {
	log_event("Amnesty.")
	log("All Government Civil Affairs and Suppression missions get a +1 DRM this turn.")
	game.events.amnesty = true
	end_random_event()
}

function goto_jean_paul_sartre() {
	log_event("Jean-Paul Sartre writes article condemning the war.")
	// Reduce Government PSL by 1 PSP.
	lower_gov_psl(1)
	end_random_event()
}

function end_random_event() {
	if (check_victory())
		return

	// See who controls OAS
	if (game.oas) {
		log_br()
		log_h3("OAS Active")
		roll_oas_control()
	}
	goto_gov_reinforcement_phase()
}

function goto_gov_reinforcement_phase() {
	game.phasing = GOV_NAME
	set_active_player()
	log_h2(`${game.active} Reinforcement`)
	game.selected = []

	game.summary = {
		mobilize: [],
		mobilize_cost: 0,
		activate: [],
		activate_cost: 0,
		air_pts: 0,
		helo_pts: 0,
		naval_pts: 0,
	}

	if (!game.oas && game.gov_psl <= 30) {
		activate_oas()
		roll_oas_control()
	} else if (game.oas && game.gov_psl >= 70) {
		remove_oas()
	}

	// Make sure all available units can be deployed
	for_each_friendly_unit_in_loc(FREE, u => {
		set_unit_loc(u, DEPLOY)
		set_unit_box(u, OC)
	})

	// Algerian units activate for free
	for_each_friendly_unit_on_map_of_type(AL_X, u => {
		if (is_unit_not_neutralized(u))
			set_unit_box(u, OPS)
	})

	if (is_slow_french_reaction() && game.fln_psl > game.gov_psl) {
		log("French Reaction:")
		logi("FLN PSL > Gov PSL")
		log_br()
		delete game.events.slow_french_reaction
	}

	//  In the Reinforcement Phase, the controlling player places the OAS marker in any urban area of Algeria or in France.
	if (game.oas && game.oas_control === GOV) {
		game.state = "place_oas"
	} else {
		game.state = "gov_reinforcement"
	}
}

states.place_oas = {
	inactive: "to place OAS",
	prompt() {
		view.prompt = "Reinforcement: Place OAS in Urban area or France."

		for_each_map_area(loc => {
			if (is_area_urban(loc))
				gen_action_loc(loc)
		})
		gen_action_loc(FRANCE)
	},
	loc(to) {
		push_undo()
		game.oas = to
		log(`OAS placed in A${to}.`)
		log_br()

		if (is_gov_player()) {
			game.state = "gov_reinforcement"
		} else {
			game.state = "fln_reinforcement"
		}
	}
}

function mobilization_cost(units) {
	let cost = 0
	for (let u of units) {
		cost += GOV_UNIT_MOBILIZE_COST[unit_type(u)]
	}
	return cost
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
}

function is_slow_french_reaction() {
	return game.events.slow_french_reaction
}

states.gov_reinforcement = {
	inactive: "to do Reinforcement",
	prompt() {
		// when slow french reaction
		// he may not mobilize more than 1 mobile unit or Point of any type (Air, Helo, or Naval) per turn;
		let limited = is_slow_french_reaction() && game.events.gov_has_mobilized

		if (!game.selected.length) {
			if (!is_slow_french_reaction()) {
				view.prompt = "Reinforcement: Mobilize & activate units, and acquire assets."
			} else {
				view.prompt = "Reinforcement: Mobilize & activate units, and acquire assets (Slow French Reaction)."
			}
			// first unit can be any unit in DEPLOY or on map
			for_each_friendly_unit_in_loc(DEPLOY, u => {
				if (!limited || !is_mobile_unit(u))
					gen_action_unit(u)
			})

			// activate french mobile units
			let has_inactive = false
			for_each_friendly_unit_on_map_box(OC, u => {
				has_inactive = true
				gen_action_unit(u)
			})

			// remove police units
			for_each_friendly_unit_on_map_of_type(POL, u => {
				gen_action_unit(u)
			})

			if (has_inactive)
				gen_action("select_all_inactive")

			// activate border
			if (game.border_zone_drm && !game.border_zone_active && game.gov_psl > COST_ACTIVATE_BORDER_ZONE) {
				gen_action("activate_border_zone")
			}

			// asset acquisition
			if (game.gov_psl > COST_AIR_POINT && game.air_max < MAX_AIR_POINT && !limited)
				gen_action("acquire_air_point")
			if (game.gov_psl > COST_HELO_POINT && game.helo_max < MAX_HELO_POINT && !limited)
				gen_action("acquire_helo_point")
			if (game.gov_psl > COST_NAVAL_POINT && game.naval < MAX_NAVAL_POINT && !limited)
				gen_action("acquire_naval_point")
			if (game.gov_psl > COST_BORDER_ZONE && game.is_morocco_tunisia_independent) {
				// starts at no border zone instead of 0
				if (game.border_zone_drm === null) {
					gen_action("mobilize_border_zone")
				} else if (game.border_zone_drm > MAX_BORDER_ZONE_DRM && !game.events.border_zone_mobilized) {
					// improve not on the same turn as mobilized
					gen_action("improve_border_zone")
				}
			}

			// XXX confirmation when no units are activated?
			gen_action("end_reinforcement")
		} else {
			let first_unit = game.selected[0]
			let first_unit_loc = unit_loc(first_unit)
			let first_unit_type = unit_type(first_unit)

			view.actions.undo = 1

			if (first_unit_type === POL && first_unit_loc !== DEPLOY) {
				view.prompt = "Reinforcement: Remove Police units."

				for_each_friendly_unit_on_map_of_type(POL, u => {
					gen_action_unit(u)
				})

				gen_action("remove")
			} else if (first_unit_loc === DEPLOY) {
				let cost = mobilization_cost(game.selected)
				view.prompt = `Reinforcement: Mobilize units (cost ${cost} PSP).`

				if (!is_slow_french_reaction()) {
					for_each_friendly_unit_in_loc(DEPLOY, u => {
						gen_action_unit(u)
					})
				} else {
					for_each_friendly_unit_in_loc(DEPLOY, u => {
						if (!is_mobile_unit(u) || u === first_unit)
							gen_action_unit(u)
					})
				}

				// don't allow PSL to go <= 0
				if (Math.floor(game.gov_psl - cost) > 0) {
					for_each_algerian_map_area(loc => {
						gen_action_loc(loc)
					})
				}
			} else {
				let cost = activation_cost(game.selected)
				view.prompt = `Reinforcement: Activate units (cost ${cost} PSP).`

				for_each_friendly_unit_on_map_box(OC, u => {
					gen_action_unit(u)
				})

				// don't allow PSL to go <= 0
				if (Math.floor(game.gov_psl - cost) > 0) {
					gen_action("activate")
				}
			}
		}
	},
	undo() {
		if (game.selected.length > 0)
			set_clear(game.selected)
		else
			pop_undo()
	},
	unit(u) {
		set_toggle(game.selected, u)
	},
	loc(to) {
		let list = game.selected
		game.selected = []
		push_undo()
		for (let u of list) {
			set_add(game.summary.mobilize, u)
			mobilize_unit(u, to)
		}
		let cost = mobilization_cost(list)
		game.summary.mobilize_cost += cost
		lower_gov_psl(cost, false)
		if (is_slow_french_reaction())
			game.events.gov_has_mobilized = true
	},
	select_all_inactive() {
		push_undo()
		for_each_friendly_unit_on_map_box(OC, u => {
			set_toggle(game.selected, u)
		})
	},
	activate() {
		let list = game.selected
		game.selected = []
		push_undo()
		for (let u of list) {
			set_add(game.summary.activate, u)
			set_unit_box(u, OPS)
		}
		// cost can be fraction
		let cost = activation_cost(list)
		if (cost) {
			game.summary.activate_cost += cost
			lower_gov_psl(cost, false)
		}
	},
	remove() {
		let list = game.selected
		game.selected = []
		push_undo()
		// TODO: delay to summary?
		log_area_unit_list("Removed", list)
		for (let u of list) {
			remove_unit(u, DEPLOY)
		}
	},
	acquire_air_point() {
		push_undo()
		game.summary.air_pts += 1
		lower_gov_psl(COST_AIR_POINT, false)
		game.air_avail += 1
		game.air_max += 1
		if (is_slow_french_reaction())
			game.events.gov_has_mobilized = true
	},
	acquire_helo_point() {
		push_undo()
		game.summary.helo_pts += 1
		lower_gov_psl(COST_HELO_POINT, false)
		game.helo_avail += 1
		game.helo_max += 1
		if (is_slow_french_reaction())
			game.events.gov_has_mobilized = true
	},
	acquire_naval_point() {
		push_undo()
		game.summary.naval_pts += 1
		lower_gov_psl(COST_NAVAL_POINT, false)
		game.naval += 1
		if (is_slow_french_reaction())
			game.events.gov_has_mobilized = true
	},
	activate_border_zone() {
		push_undo()
		log("Activated Border Zone.")
		lower_gov_psl(COST_ACTIVATE_BORDER_ZONE)
		game.border_zone_active = true
	},
	mobilize_border_zone() {
		push_undo()
		log("Mobilized Border Zone.")
		lower_gov_psl(COST_BORDER_ZONE)
		game.border_zone_drm = 0
		game.events.border_zone_mobilized = true
	},
	improve_border_zone() {
		push_undo()
		log("Improved Border Zone.")
		lower_gov_psl(COST_BORDER_ZONE)
		game.border_zone_drm -= 1
	},
	end_reinforcement() {
		// PSL rounded down as cost can be fractions
		game.gov_psl = Math.floor(game.gov_psl)
		delete game.events.gov_has_mobilized

		log_area_unit_list("Mobilized", game.summary.mobilize)
		log_lower_gov_psl(game.summary.mobilize_cost)

		log_area_unit_list("Activated", game.summary.activate)
		log_lower_gov_psl(game.summary.activate_cost)

		if (game.summary.air_pts) {
			log_br()
			log("Air PTS +" + game.summary.air_pts)
			log_lower_gov_psl(game.summary.air_pts * COST_AIR_POINT)
		}

		if (game.summary.helo_pts) {
			log_br()
			log("Helo PTS +" + game.summary.helo_pts)
			log_lower_gov_psl(game.summary.helo_pts * COST_HELO_POINT)
		}

		if (game.summary.naval_pts) {
			log_br()
			log("Naval PTS +" + game.summary.naval_pts)
			log_lower_gov_psl(game.summary.naval_pts * COST_NAVAL_POINT)
		}

		goto_fln_reinforcement_phase()
	}
}

function give_fln_ap() {
	// Give AP
	// log("Areas under FLN control:")
	// log_br()

	log_br()

	let total_ap = 0
	for_each_algerian_map_area(loc => {
		let control_ap = 0
		let summary = null
		if (is_area_urban(loc)) {
			// He gets 5 AP for each Urban area he controls, or 2 AP if the area is contested but he has non-neutralized units there.
			if (is_area_fln_control(loc)) {
				log("A" + loc)
				logi("+5 Urban, control")
				control_ap += 5
			} else if (has_friendly_not_neutralized_unit_in_loc(loc)) {
				log("A" + loc)
				logi("+2 Urban, units")
				control_ap += 2
			}
		} else if (is_area_rural(loc)) {
			// He gets 2 AP for each Rural area he controls, and 1 if the area is contested but he has non-neutralized units there.
			if (is_area_fln_control(loc)) {
				log("A" + loc)
				logi("+2 Rural, control")
				control_ap += 2
			} else if (has_friendly_not_neutralized_unit_in_loc(loc)) {
				log("A" + loc)
				logi("+1 Rural, units")
				control_ap += 1
			}
		}
		// If an area is Terrorized, he gets 1 fewer AP than he normally would.
		if (is_area_terrorized(loc)) {
			if (control_ap > 0) {
				logi("-1 Terrorized")
				control_ap -= 1
			}
		}

		total_ap += control_ap
	})

	raise_fln_ap(total_ap)

	log_br()

	// The FLN PSL
	// He gets AP equal to 10% (round fractions up) of his current PSL, minus the number of French Naval Points.
	let psl_percentage = Math.ceil(0.10 * game.fln_psl)
	let psl_ap = Math.max(psl_percentage - game.naval, 0)
	log_br()
	if (game.naval)
		log(`10% of ${game.fln_psl} PSL (- ${game.naval} Naval PTS)`)
	else
		log(`10% of ${game.fln_psl} PSL`)
	if (psl_ap) {
		raise_fln_ap(psl_ap)
	}

	log_br()
}

function ensure_front_in_independent_morocco_tunisia() {
	// If Morocco & Tunisia are independent, make sure we have a Front there
	if (game.is_morocco_tunisia_independent) {
		if (!has_unit_type_in_loc(FRONT, MOROCCO)) {
			let u = find_free_unit_by_type(FRONT)
			log(`Deployed U${u} to A${MOROCCO}.`)
			deploy_unit(u, MOROCCO)
		}
		if (!has_unit_type_in_loc(FRONT, TUNISIA)) {
			let u = find_free_unit_by_type(FRONT)
			deploy_unit(u, TUNISIA)
			log(`Deployed U${u} to A${TUNISIA}.`)
		}
	}
}

function goto_fln_reinforcement_phase() {
	game.phasing = FLN_NAME
	set_active_player()
	log_h2(`${game.active} Reinforcement`)
	game.selected = []

	// Make sure all available units can be build / converted
	for_each_friendly_unit_in_locs([FREE, DEPLOY], u => {
		free_unit(u)
	})

	// If Morocco & Tunisia are independent, make sure we have a Front there
	ensure_front_in_independent_morocco_tunisia()

	give_fln_ap()

	game.summary = {
		build: [],
		build_cost: 0,
		convert: [],
		convert_cost: 0,
	}

	// In the Reinforcement Phase, the controlling player places the OAS marker in any urban area of Algeria or in France.
	if (game.oas && game.oas_control === FLN) {
		game.state = "place_oas"
	} else {
		game.state = "fln_reinforcement"
	}
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
	set_add(game.summary.build, u)
	set_unit_loc(u, where)
	set_unit_box(u, UG)
	let cost = build_cost(where)
	game.summary.build_cost += pay_ap(cost, false)
}

function convert_fln_unit(u, type) {
	let loc = unit_loc(u)
	let n = find_free_unit_by_type(type)
	set_add(game.summary.convert, n)
	set_unit_loc(n, loc)
	set_unit_box(n, UG)
	free_unit(u)
	let cost = convert_cost(type)
	game.summary.convert_cost += pay_ap(cost, false)
	return n
}

states.fln_reinforcement = {
	inactive: "to do Reinforcement",
	prompt() {
		view.prompt = "Reinforcement: Build & Augment units."

		// Front can build Cadres and Bands, or be converted to Cadre
		for_each_friendly_unit_on_map_of_type(FRONT, u => {
			if (is_unit_not_neutralized(u))
				gen_action_unit(u)
		})

		// Cadre can be converted to Front or Band
		for_each_friendly_unit_on_map_of_type(CADRE, u => {
			if (is_unit_not_neutralized(u) && !is_area_france(unit_loc(u)))
				gen_action_unit(u)
		})

		// Band can be converted to Failek in Morocco / Tunisia
		for_each_friendly_unit_on_map_of_type(BAND, u => {
			if (is_area_country(unit_loc(u)))
				gen_action_unit(u)
		})

		gen_action("end_reinforcement")

		if (game.selected.length > 0) {
			let first_unit = game.selected[0]
			let first_unit_loc = unit_loc(first_unit)
			let first_unit_type = unit_type(first_unit)

			// Allow deselect
			gen_action_unit(first_unit)
			// view.actions.undo = 1

			if (first_unit_type === FRONT) {
				view.prompt = "Reinforcement: Front can build Cadre or Band."
				// The FLN player may build new Cadres or Bands by spending the AP cost and placing them in the UG box of any area which contains a non-Neutralized Front
				// (note that this requires the presence of a Front)
				if (has_free_unit_by_type(CADRE) && game.fln_ap >= build_cost(first_unit_loc))
					view.actions.build_cadre = 1
				else
					view.actions.build_cadre = 0
				if (has_free_unit_by_type(BAND) && game.fln_ap >= build_cost(first_unit_loc))
					view.actions.build_band = 1
				else
					view.actions.build_band = 0
				if (has_free_unit_by_type(CADRE) && !is_area_morocco_or_tunisia(first_unit_loc))
					view.actions.convert_front_to_cadre = 1
				else
					view.actions.convert_front_to_cadre = 0

			} else if (first_unit_type === CADRE) {
				view.prompt = "Reinforcement: Convert Cadre."
				// Fronts may not be created in Remote areas (not enough people) and there may be only one Front per area.
				if (!(has_unit_type_in_loc(FRONT, first_unit_loc) || is_area_remote(first_unit_loc)) && has_free_unit_by_type(FRONT) && game.fln_ap >= convert_cost(FRONT))
					view.actions.convert_cadre_to_front = 1
				else
					view.actions.convert_cadre_to_front = 0
				if (has_free_unit_by_type(BAND) && game.fln_ap >= convert_cost(BAND))
					view.actions.convert_cadre_to_band = 1
				else
					view.actions.convert_cadre_to_band = 0
			} else if (first_unit_type === BAND) {
				view.prompt = "Reinforcement: Convert Band."
				if (has_free_unit_by_type(FAILEK) && game.fln_ap >= convert_cost(FAILEK))
					view.actions.convert_band_to_failek = 1
				else
					view.actions.convert_band_to_failek = 0
			}
		}
	},
	Xundo() {
		if (game.selected.length > 0)
			set_clear(game.selected)
		else
			pop_undo()
	},
	unit(u) {
		if (game.selected.length > 0) {
			if (game.selected[0] === u)
				game.selected.length = 0
			else
				game.selected[0] = u
		} else {
			game.selected[0] = u
		}
	},
	build_cadre() {
		let unit = game.selected[0]
		let loc = unit_loc(unit)
		push_undo()
		build_fln_unit(CADRE, loc)
	},
	build_band() {
		let unit = game.selected[0]
		let loc = unit_loc(unit)
		push_undo()
		build_fln_unit(BAND, loc)
	},
	convert_front_to_cadre() {
		push_undo()
		let unit = pop_selected()
		game.selected[0] = convert_fln_unit(unit, CADRE)
	},
	convert_cadre_to_front() {
		push_undo()
		let unit = pop_selected()
		game.selected[0] = convert_fln_unit(unit, FRONT)
	},
	convert_cadre_to_band() {
		push_undo()
		let unit = pop_selected()
		convert_fln_unit(unit, BAND)
	},
	convert_band_to_failek() {
		push_undo()
		let unit = pop_selected()
		convert_fln_unit(unit, FAILEK)
	},
	end_reinforcement() {
		log_area_unit_list("Converted", game.summary.convert)
		log_pay_ap(game.summary.convert_cost)

		log_area_unit_list("Built", game.summary.build)
		log_pay_ap(game.summary.build_cost)

		game.summary = null

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
	game.summary = {
		operations: [],
		patrol: [],
		dispersed: [],
		concentrated: [],
	}
	game.state = "gov_deployment"
	game.selected = []
	game.deployed = []
	game.mode_changed = []
}

function can_airmobilize_any_unit() {
	let result = false
	for_each_friendly_unit_on_map(u => {
		if (can_airmobilize_unit(u) && has_any_airmobile_target(u) && airmobilize_cost([u]) <= game.helo_avail)
			result = true
	})
	return result
}

states.gov_deployment = {
	inactive: "to do Deployment",
	prompt() {
		view.prompt = "Deploy activated mobile units to PTL or into OPS of another area."
		if (!game.selected.length) {
			for_each_friendly_unit_on_map(u => {
				if ((!set_has(game.deployed, u) && unit_box(u) === OPS) || (is_division_unit(u) && !set_has(game.mode_changed, u) && !is_slow_french_reaction()))
					gen_action_unit(u)
			})

			if (game.helo_avail && can_airmobilize_any_unit())
				gen_action("airmobilize")

			gen_action("end_deployment")
		} else {
			let first_unit = game.selected[0]
			let first_unit_type = unit_type(first_unit)
			let first_unit_loc = unit_loc(first_unit)
			let first_unit_box = unit_box(first_unit)

			view.actions.undo = 1

			if (first_unit_type == FR_XX && game.selected.length === 1 && !is_slow_french_reaction() && !set_has(game.mode_changed, first_unit)) {
				if (is_unit_not_neutralized(first_unit) && unit_box(first_unit) === OPS) {
					view.prompt = "Deploy activated mobile units to PTL or into OPS of another area, or change division mode."
				} else {
					// allow selection of neutralized divisions (to change mode only)
					view.prompt = "Deploy: change division mode."
				}
				gen_action("change_division_mode")
			}

			for_each_friendly_unit_in_loc(first_unit_loc, u => {
				if ((unit_box(u) === OPS && unit_box(u) === first_unit_box && is_mobile_unit(u) && !set_has(game.deployed, u)) || u === first_unit) {
					gen_action_unit(u)
				}
			})

			if (is_unit_not_neutralized(first_unit) && unit_box(first_unit) === OPS && !set_has(game.deployed, first_unit)) {
				for_each_algerian_map_area(loc => {
					gen_action_loc(loc)
				})
			}
		}
	},
	airmobilize() {
		push_undo()
		goto_gov_airmobilize()
	},
	undo() {
		if (game.selected.length > 0)
			set_clear(game.selected)
		else
			pop_undo()
	},
	unit(u) {
		set_toggle(game.selected, u)
	},
	loc(to) {
		let list = game.selected
		game.selected = []
		push_undo()
		for (let u of list) {
			let loc = unit_loc(u)
			if (loc === to) {
				set_add(game.summary.patrol, u)
				set_unit_box(u, PTL)
			} else {
				set_add(game.summary.operations, u)
				set_unit_loc(u, to)
				set_unit_box(u, OPS)
			}
			set_add(game.deployed, u)
		}
	},
	change_division_mode() {
		let u = pop_selected()
		let loc = unit_loc(u)
		push_undo()
		if (is_unit_dispersed(u)) {
			set_add(game.summary.concentrated, u)
			clear_unit_dispersed(u)
		} else {
			set_add(game.summary.dispersed, u)
			set_unit_dispersed(u)
		}
		set_add(game.mode_changed, u)
	},
	end_deployment() {
		delete game.deployed
		delete game.mode_changed

		log_area_unit_list("Patrol", game.summary.patrol)
		log_area_unit_list("Operations", game.summary.operations)
		log_area_unit_list("Concentrated", game.summary.concentrated)
		log_area_unit_list("Dispersed", game.summary.dispersed)

		game.summary = null

		goto_fln_deployment_phase()
	}
}

function goto_fln_deployment_phase() {
	game.phasing = FLN_NAME
	set_active_player()
	log_h2(`${game.active} Deployment`)
	game.summary = {
		underground: [],
		operations: []
	}
	game.state = "fln_deployment"
	game.selected = []

	// Reset Cadre in France automatically.
	for_each_friendly_unit_in_loc(FRANCE, u => {
		set_unit_box(u, UG)
	})
}

function has_cadre_and_front_in_any_loc_in_algeria() {
	// each algerian area
	for (let loc = 3; loc < area_count; ++loc)
		// TODO: not neutralized? must be UG?
		if (has_unit_type_in_loc(CADRE, loc) && has_unit_type_in_loc(FRONT, loc))
			return true
	return false
}

function can_deploy_cadre_to_france() {
	return (
		!game.deploy_cadre_france &&
		!has_friendly_unit_in_loc(FRANCE) &&
		has_cadre_and_front_in_any_loc_in_algeria()
	)
}

states.fln_deployment = {
	inactive: "to do Deployment",
	prompt() {
		view.prompt = "Deploy units to OPS."

		if (can_deploy_cadre_to_france())
			view.actions.deploy_cadre_to_france = 1

		for_each_friendly_unit_on_map_box(UG, u => {
			let loc = unit_loc(u)
			if (is_unit_not_neutralized(u) && !is_area_morocco_or_tunisia(loc) && !(is_area_france(loc) && game.deploy_cadre_france))
				gen_action_unit(u)
		})

		view.actions.end_deployment = 1
	},
	deploy_cadre_to_france() {
		push_undo()
		game.state = "fln_deploy_cadre_to_france"
	},
	unit(u) {
		push_undo()
		let loc = unit_loc(u)
		if (is_area_france(loc)) {
			game.state = "fln_deploy_cadre_from_france"
			game.selected = u
			return
		}
		set_add(game.summary.operations, u)
		set_unit_box(u, OPS)
	},
	end_deployment() {
		log_area_unit_list("Underground", game.summary.underground)
		log_area_unit_list("Operations", game.summary.operations)

		game.summary = null

		end_deployment()
	},
}

states.fln_deploy_cadre_to_france = {
	inactive: "to do Deployment",
	prompt() {
		view.prompt = "Deploy Cadre to France."
		for_each_friendly_unit_on_map_box(UG, u => {
			let loc = unit_loc(u)
			if (unit_type(u) === CADRE)
				if (is_unit_not_neutralized(u) && !is_area_morocco_or_tunisia(loc) && !is_area_france(loc))
					if (has_unit_type_in_loc(FRONT, loc))
						gen_action_unit(u)
		})
	},
	unit(u) {
		log(`Deployed U${u} to A${FRANCE}.`)

		game.deploy_cadre_france = true
		set_unit_loc(u, FRANCE)
		set_unit_box(u, UG) // TODO: UG in france?
		set_add(game.summary.operations, u) // WHICH?

		game.state = "fln_deployment"
	},
}

states.fln_deploy_cadre_from_france = {
	inactive: "to do Deployment",
	prompt() {
		view.prompt = "Deploy Cadre to Area with Front."
		for_each_friendly_unit_on_map_of_type(FRONT, u => {
			gen_action_loc(unit_loc(u))
		})
	},
	loc(to) {
		let u = game.selected
		game.selected = null

		game.deploy_cadre_france = true
		set_unit_loc(u, to)
		set_unit_box(u, OPS) // to UG or OPS?
		set_add(game.summary.operations, u) // WHICH?

		game.state = "fln_deployment"
	},
}

function end_deployment() {
	// automatically deploy mobile units in Morocco & Tunisia
	for_each_friendly_unit_in_locs([MOROCCO, TUNISIA], u => {
		if (is_mobile_unit(u))
			set_unit_box(u, OPS)
	})

	delete game.deploy_cadre_france

	goto_operations_phase()
}

function goto_operations_phase() {
	game.passes = 0
	delete game.fln_auto_pass
	delete game.gov_auto_pass

	// In Algeria, the OAS marker will automatically conduct one Suppression mission in the Operations Phase, at no cost in PSP and no requirement for a Police unit.
	if (is_area_algerian(game.oas)) {
		let loc = game.oas

		log_br()
		log(".h3.oas OAS Suppression")
		log_br()
		log("A" + loc)
		log_br() // no cost

		do_suppression(loc)

		// Whatever the result of the mission, it will automatically cause a Terror marker to be placed in the Area (if there isn't one there already).
		if (!is_area_terrorized(loc)) {
			log("Terrorized.")
			set_area_terrorized(loc)
		}

		if (check_victory())
			return
	}

	goto_fln_operations_phase()
}

function goto_fln_operations_phase() {
	game.phasing = FLN_NAME
	set_active_player()

	clear_combat()

	if (game.fln_auto_pass) {
		fln_pass()
	} else {
		game.state = "fln_operations"
	}
}

const FLN_PROPAGANDA_COST = 1
const FLN_STRIKE_COST = 3
const FLN_RAID_COST = 1

states.fln_operations = {
	inactive: "to do Operations",
	prompt() {
		view.prompt = "Operations: Perform a mission with OPS units, let Government perform a mission, or Pass."
		view.prompt = "Operations."
		view.prompt = "Perform a Mission."

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
		if (game.fln_ap >= FLN_PROPAGANDA_COST) {
			for_each_friendly_unit_in_loc(FRANCE, u => {
				if (is_propaganda_unit(u))
					view.actions.propaganda = 1
			})
		}
		for_each_friendly_unit_in_locs([MOROCCO, TUNISIA], u => {
			if (is_mobile_unit(u) && unit_box(u) === OPS)
				view.actions.move = 1
		})

		// Only allow to Government to take a mission if they didn't just pass.
		view.actions.gov_mission = !game.passes
		view.actions.pass = 1
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
		log_mission("Government Mission")
		goto_gov_operations_phase()
	},
	pass() {
		game.fln_auto_pass = true
		fln_pass()
	}
}

function fln_pass() {
	log_mission("Pass")
	game.passes += 1
	if (game.passes >= 2) {
		end_operations_phase()
	} else {
		goto_gov_operations_phase()
	}
}

function goto_fln_propaganda_mission() {
	push_undo()
	log_mission("Propaganda")
	game.passes = 0
	game.state = "fln_propaganda"
	game.selected = []
}

function reduce_unit(u, type) {
	let loc = unit_loc(u)
	let box = unit_box(u)
	let n = find_free_unit_by_type(type)

	log(`Reduced U${u} to U${n}.`)

	raise_gov_psl(2)
	lower_fln_psl(1)
	set_delete(game.contacted, u)
	set_add(game.contacted, n)

	set_unit_loc(n, loc)
	set_unit_box(n, box)
	if (is_unit_neutralized(u))
		set_unit_neutralized(n)
	free_unit(u)
	return n
}

states.fln_propaganda = {
	inactive: "to do Propaganda mission",
	prompt() {
		if (!game.selected.length) {
			view.prompt = "Propaganda: Select Front or Cadre."
			for_each_friendly_unit_on_map_box(OPS, u => {
				if (is_propaganda_unit(u)) {
					gen_action_unit(u)
				}
			})
			for_each_friendly_unit_in_loc(FRANCE, u => {
				if (is_propaganda_unit(u)) {
					gen_action_unit(u)
				}
			})
		} else {
			view.prompt = `Propaganda: Execute mission (cost ${FLN_PROPAGANDA_COST} AP).`
			let first_unit = game.selected[0]

			// Allow deselect
			gen_action_unit(first_unit)

			gen_action("roll")
		}
	},
	unit(u) {
		set_toggle(game.selected, u)
	},
	roll() {
		let unit = pop_selected()
		let loc = unit_loc(unit)
		clear_undo()

		log("A" + loc)
		logi("U" + unit)

		// pay cost & update flags
		pay_ap(FLN_PROPAGANDA_COST)
		set_area_propagandized(loc)
		set_unit_box(unit, OC)

		let roll = roll_d6()
		//log(`U${unit} F${roll}`)
		log("Mission F" + roll)

		if (is_area_terrorized(loc)) {
			logi(`-1 Terrorized`)
			roll -= 1
		}

		for_each_patrol_unit_in_loc(loc, u => {
			logi(`-1 U${u} PTL`)
			roll -= 1
		})

		let [result, effect] = roll_mst(roll)

		if (is_area_urban(loc)) {
			logi('x2 Urban')
			result *= 2
		}

		set_add(game.contacted, unit)

		if (effect === '+') {
			// bad effect: eliminate Cadre or reduce Front
			if (unit_type(unit) === CADRE) {
				eliminate_unit(unit)
			} else {
				unit = reduce_unit(unit, CADRE)
			}
		}

		if (result) {
			goto_distribute_psp(FLN, result, 'propaganda_result')
		} else {
			continue_fln_propaganda()
		}
	}
}

function continue_fln_propaganda() {
	// step 2
	if (game.distribute_gov_psl) {
		goto_distribute_psp(GOV, game.distribute_gov_psl, 'propaganda_distribute_gov_psl')
	} else {
		end_fln_mission()
	}
}

function end_fln_mission() {
	if (check_victory())
		return
	// Gov can React
	if (can_gov_react()) {
		goto_gov_react_mission()
	} else {
		check_mandatory_react()
		if (check_victory())
			return
		goto_fln_operations_phase()
	}
}

function goto_distribute_psp(who, psp, reason) {
	// XXX ensure no remaining PSL to distribute
	if (who === GOV && game.distribute_gov_psl)
		game.distribute_gov_psl = 0
	game.distribute = {
		who, psp, reason
	}
	if (who == GOV) {
		game.phasing = GOV_NAME
	} else {
		game.phasing = FLN_NAME
	}
	set_active_player()
	log_br()
	if (game.active === FLN_NAME)
		log(`FLN to distribute ${psp} PSP.`)
	else
		log(`Gov to distribute ${psp} PSP.`)
	game.state = "distribute_psp"
}

function distribute_psl(where, delta) {
	push_undo()

	if (where === FLN) {
		if (delta > 0) {
			raise_fln_psl(delta)
		} else {
			lower_fln_psl(-delta)
		}
	} else {
		if (delta > 0) {
			raise_gov_psl(delta)
		} else {
			lower_gov_psl(-delta)
		}
	}
	game.distribute.psp -= Math.abs(delta)
	if (check_victory())
		return
	if (!game.distribute.psp)
		end_distribute_psp()
}

states.distribute_psp = {
	inactive: "to distribute PSP",
	prompt() {
		view.prompt = `Distribute ${game.distribute.psp} PSP.`

		if (game.distribute.who === FLN) {
			gen_action("add_fln_psl")
			gen_action("remove_gov_psl")
			if (game.distribute.psp >= 5) {
				if (game.fln_psl < 95) gen_action("add_5_fln_psl")
				if (game.gov_psl >= 5) gen_action("remove_5_gov_psl")
			}
		} else {
			gen_action("add_gov_psl")
			gen_action("remove_fln_psl")
			if (game.distribute.psp >= 5) {
				if (game.gov_psl < 95) gen_action("add_5_gov_psl")
				if (game.fln_psl >= 5) gen_action("remove_5_fln_psl")
			}
		}
	},
	add_fln_psl() {
		distribute_psl(FLN, 1)
	},
	add_5_fln_psl() {
		distribute_psl(FLN, 5)
	},
	remove_fln_psl() {
		distribute_psl(FLN, -1)
	},
	remove_5_fln_psl() {
		distribute_psl(FLN, -5)
	},
	add_gov_psl() {
		distribute_psl(GOV, 1)
	},
	add_5_gov_psl() {
		distribute_psl(GOV, 5)
	},
	remove_gov_psl() {
		distribute_psl(GOV, -1)
	},
	remove_5_gov_psl() {
		distribute_psl(GOV, -5)
	}
}

function end_distribute_psp() {
	game.distribute_mst = 0
	let reason = game.distribute.reason
	game.distribute = {}
	switch (reason) {
	case 'propaganda_result':
		continue_fln_propaganda()
		break
	case 'propaganda_distribute_gov_psl':
		end_fln_mission()
		break
	case 'strike_result':
		continue_fln_strike()
		break
	case 'strike_distribute_gov_psl':
		end_fln_mission()
		break
	case 'move_distribute_gov_psl':
		end_fln_mission()
		break
	case 'combat_hits_on_gov':
		continue_combat_after_hits_on_gov()
		break
	case 'combat_distribute_gov_psl':
		end_combat()
		break
	default:
		throw Error("Unknown reason: " + reason)
	}
}

function goto_fln_strike_mission() {
	push_undo()
	log_mission("Strike")
	game.passes = 0
	game.state = "fln_strike"
}

states.fln_strike = {
	inactive: "to do Strike mission",
	prompt() {
		view.prompt = "Strike: Select Front in Urban area, Cadres may assist."

		if (!game.selected.length) {
			for_each_friendly_unit_on_map_box(OPS, u => {
				// first unit should be Front
				if (is_strike_unit(u) && unit_type(u) === FRONT) {
					gen_action_unit(u)
				}
			})
		} else {
			view.prompt = `Strike: Execute mission (cost ${FLN_STRIKE_COST} AP).`

			let first_unit = game.selected[0]
			let first_unit_loc = unit_loc(first_unit)
			let can_assist = false

			for_each_friendly_unit_in_loc_box(first_unit_loc, OPS, u => {
				if (unit_type(u) === CADRE) {
					gen_action_unit(u)
					can_assist = true
				}
			})

			if (can_assist) {
				view.prompt = `Strike: Execute mission (or select Cadres to assist) (cost ${FLN_STRIKE_COST} AP).`
			}

			// Allow deselect
			gen_action_unit(first_unit)

			gen_action("roll")
		}
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
		clear_undo()

		log("A" + loc)
		for (let u of list)
			if (unit_type(u) === FRONT)
				logi("U" + u)
		for (let u of list)
			if (unit_type(u) === CADRE)
				logi("U" + u)

		// pay cost & update flags
		pay_ap(FLN_STRIKE_COST)
		set_area_struck(loc)
		for (let u of list) {
			set_unit_box(u, OC)
			set_add(game.contacted, u)
		}

		let roll = roll_d6()
		log("Mission F" + roll)

		if (assist) {
			logi(`+${assist} Assist`)
			roll += assist
		}

		if (is_area_terrorized(loc)) {
			logi(`-1 Terrorized`)
			roll -= 1
		}

		for_each_patrol_unit_in_loc(loc, u => {
			logi(`-1 U${u} PTL`)
			roll -= 1
		})

		let [result, effect] = roll_mst(roll)

		if (effect === '+') {
			// bad effect: all FLN units involved in the mission are removed: a Cadre is eliminated; a Front is reduced to a Cadre.
			for (let u of list) {
				if (unit_type(u) === CADRE) {
					eliminate_unit(u)
				} else {
					reduce_unit(u, CADRE)
				}
			}
		} else if (effect === '@') {
			// good result: all Police units neutralized
			for_each_enemy_unit_in_loc(loc, u => {
				if (is_police_unit(u)) {
					neutralize_unit(u)
				}
			})
		}

		// Government must react with atleast one unit, otherwise -1d6 PSP
		// XXX move to mission?
		game.events.must_react = 1

		if (result) {
			let strike_result = roll_nd6(result)
			goto_distribute_psp(FLN, strike_result, 'strike_result')
		} else {
			continue_fln_strike()
		}
	}
}

function continue_fln_strike() {
	// step 2
	if (game.distribute_gov_psl) {
		goto_distribute_psp(GOV, game.distribute_gov_psl, 'strike_distribute_gov_psl')
	} else {
		end_fln_mission()
	}
}

function goto_fln_move_mission() {
	push_undo()
	log_mission("Move")
	game.passes = 0
	game.state = "fln_move"
}

states.fln_move = {
	inactive: "to do Move mission",
	prompt() {
		if (!game.selected.length) {
			if (game.events.jealousy_and_paranoia) {
				view.prompt = "Move: Select unit to move (Jealousy and Paranoia restricts movements)."
			} else {
				view.prompt = "Move: Select unit to move."
			}

			for_each_friendly_unit_on_map_box(OPS, u => {
				if (is_movable_unit(u)) {
					gen_action_unit(u)
				}
			})
			for_each_friendly_unit_in_locs([MOROCCO, TUNISIA], u => {
				if (is_mobile_unit(u) && unit_box(u) === OPS)
					gen_action_unit(u)
			})
		} else {
			view.prompt = "Move: Select area to move to."
			let first_unit = game.selected[0]
			let first_unit_loc = unit_loc(first_unit)
			let zone = area_zone(first_unit_loc)
			for_each_map_area_in_zone(zone, to => {
				// A unit may move from one area to any other area within its current wilaya.
				if (!game.events.jealousy_and_paranoia && first_unit_loc !== to)
					gen_action_loc(to)
				// A unit may also move to an area in a wilaya adjacent to its current one (that is, the two share a land border),
				// but the area moved to must be adjacent to at least one area in its current wilaya.
				// Morocco and Tunisia are treated as single-area wilaya for this purpose.
				for_each_adjacent_map_area(to, adj => {
					if (is_border_crossing(to, adj)) {
						if (game.is_morocco_tunisia_independent)
							gen_action_loc(adj)
					} else if (!game.events.jealousy_and_paranoia) {
						gen_action_loc(adj)
					}
				})
			})

			// Allow deselect
			gen_action_unit(first_unit)
			view.actions.undo = 1
		}
	},
	undo() {
		if (game.selected.length > 0)
			set_clear(game.selected)
		else
			pop_undo()
	},
	unit(u) {
		set_toggle(game.selected, u)
	},
	loc(to) {
		let unit = pop_selected()
		let loc = unit_loc(unit)
		push_undo()

		log("U" + unit)
		logi("from A" + loc)
		logi("to A" + to)
		log_br() // no cost

		let roll = roll_d6()
		log("Mission F" + roll)

		// Note that the die roll is modified by the number of Government units on Patrol in the area moved to, not from.

		if (is_border_crossing(loc, to) && game.border_zone_active) {
			logi(`${game.border_zone_drm} Border Zone`)
			roll += game.border_zone_drm
		}

		for_each_patrol_unit_in_loc(to, u => {
			logi(`-1 U${u} PTL`)
			roll -= 1
		})

		let [_result, effect] = roll_mst(roll)

		if (effect === '+') {
			eliminate_unit(unit)
		} else {
			log("Moved.")
			move_unit(unit, to)
		}

		if (game.distribute_gov_psl) {
			goto_distribute_psp(GOV, game.distribute_gov_psl, 'move_distribute_gov_psl')
		} else {
			end_fln_mission()
		}
	}
}

function goto_fln_raid_mission() {
	push_undo()
	log_mission("Raid")
	game.passes = 0
	game.state = "fln_raid"
}

states.fln_raid = {
	inactive: "to do Raid mission",
	prompt() {
		view.prompt = "Raid: Select Band or Failek units."

		if (!game.selected.length) {
			for_each_friendly_unit_on_map_box(OPS, u => {
				if (is_raid_unit(u)) {
					gen_action_unit(u)
				}
			})
		} else {
			view.prompt = `Raid: Execute mission (cost ${FLN_RAID_COST} AP).`

			let first_unit = game.selected[0]
			let first_unit_loc = unit_loc(first_unit)

			for_each_friendly_unit_in_loc_box(first_unit_loc, OPS, u => {
				if (is_raid_unit(u)) {
					gen_action_unit(u)
				}
			})

			view.actions.undo = 1

			gen_action("roll")
		}
	},
	undo() {
		if (game.selected.length > 0)
			set_clear(game.selected)
		else
			pop_undo()
	},
	unit(u) {
		set_toggle(game.selected, u)
	},
	roll() {
		let list = game.selected
		game.selected = []
		let first_unit = list[0]
		let loc = unit_loc(first_unit)
		let assist = list.length - 1
		clear_undo()

		log("A" + loc)
		for (let u of list)
			logi("U" + u)

		// pay cost & update flags
		pay_ap(FLN_RAID_COST)
		set_area_raided(loc)
		for (let u of list) {
			set_unit_box(u, OC)
			set_add(game.contacted, u)
		}

		let roll = roll_d6()

		log("Mission F" + roll)

		if (assist) {
			logi(`+${assist} Assist`)
			roll += assist
		}

		for_each_patrol_unit_in_loc(loc, u => {
			logi(`-1 U${u} PTL`)
			roll -= 1
		})

		let [result, effect] = roll_mst(roll)

		if (result > 0) {
			if (is_area_urban(loc)) {
				logi('x2 Urban')
				result *= 2
			}
			raise_fln_ap(result)
		}

		if (effect === '+') {
			// bad effect: 1 Band/Failek neutralized, area is Terrorized
			neutralize_unit(first_unit)
			if (!is_area_terrorized(loc)) {
				log("Terrorized.")
				set_area_terrorized(loc)
			}
		} else if (effect === '@') {
			// good result: 1 Police unit neutralized, area is Terrorized
			let done = false
			for_each_enemy_unit_in_loc(loc, u => {
				if (!done && is_police_unit(u)) {
					neutralize_unit(u)
					done = true
				}
			})
			if (!is_area_terrorized(loc)) {
				log("Terrorized.")
				set_area_terrorized(loc)
			}
		}

		end_fln_mission()
	}
}

function goto_fln_harass_mission() {
	push_undo()
	log_mission("Harass")
	game.passes = 0
	game.state = "fln_harass"
}

states.fln_harass = {
	inactive: "to do Harass mission",
	prompt() {
		view.prompt = "Harass: Select Band or Failek unit (may combine if Failek present)."
		if (!game.selected.length) {
			for_each_friendly_unit_on_map_box(OPS, u => {
				if (is_harass_unit(u)) {
					gen_action_unit(u)
				}
			})
		} else {
			let first_unit = game.selected[0]
			let first_unit_loc = unit_loc(first_unit)

			let has_failek = false
			let has_target = false
			for (let u of game.selected) {
				if (unit_type(u) === FAILEK) has_failek = true
				if (is_gov_unit(u)) has_target = true
			}

			if (!has_target) {
				view.prompt = "Harass: Select enemy unit in area."
			} else if (game.selected.length > 1) {
				view.prompt = "Harass: Execute mission."
				gen_action("roll")
			}

			for_each_friendly_unit_in_loc_box(first_unit_loc, OPS, u => {
				if (is_harass_unit(u)) {
					if (set_has(game.selected, u)) {
						gen_action_unit(u)
					} else if (has_failek || (game.selected.length === 1 && has_target)) {
						gen_action_unit(u)
					}
				}
			})

			for_each_enemy_unit_in_loc(first_unit_loc, u => {
				if (!has_target || set_has(game.selected, u))
					gen_action_unit(u)
			})

			view.actions.undo = 1
		}
	},
	undo() {
		if (game.selected.length > 0)
			set_clear(game.selected)
		else
			pop_undo()
	},
	unit(u) {
		set_toggle(game.selected, u)
	},
	roll() {
		let list = game.selected
		game.selected = []
		clear_undo()

		let loc = unit_loc(list[0])
		log("A" + loc)
		log_br() // no cost

		game.combat = {
			fln_units: [],
			gov_units: [],
			harass: 1
		}
		for (let u of list) {
			if (is_gov_unit(u)) {
				set_add(game.combat.gov_units, u)
			} else {
				set_add(game.contacted, u)
				set_add(game.combat.fln_units, u)
			}
		}

		goto_combat()
	}
}

function goto_combat() {
	// TODO merge contacted / fln_units
	// game.combat = {fln_units: [], gov_units: [], harass: false}
	// game.combat = {hits_on_fln: 0, hits_on_gov: 0, distribute_gov_psl: 0}

	let loc = unit_loc(game.combat.fln_units[0])

	// Result is the number of 'hits' on enemy units.

	log_br()

	let fln_roll = roll_d6()
	let fln_firepower = 0
	log("FLN Firepower F" + fln_roll)
	//logi("F" + fln_roll + " Combat")
	for (let u of game.combat.fln_units) {
		logi(`${unit_firepower(u)} U${u}`)
		fln_firepower += unit_firepower(u)
	}
	game.combat.hits_on_gov = combat_result(fln_firepower, fln_roll)
	log(`${game.combat.hits_on_gov} hits on Gov.`)
	log_br()

	let gov_roll = roll_d6()
	let gov_firepower = 0
	log("Gov Firepower G" + gov_roll)
	//logi("G" + gov_roll + " Combat")
	for (let u of game.combat.gov_units) {
		if (game.combat.harass) {
			// When units fire at half Firepower Rating, round fractions up.
			let fp = Math.ceil(unit_firepower(u)/2)
			logi(`${fp} U${u} (half)`)
			gov_firepower += fp
		} else {
			logi(`${unit_firepower(u)} U${u}`)
			gov_firepower += unit_firepower(u)
		}
		// move airmobile units to combat
		if (is_unit_airmobile(u) && unit_loc(u) !== loc)
			set_unit_loc(u, loc)
	}

	for (let i = 0; i < game.mission_air_pts; ++i) {
		let roll = roll_d6()
		logi("G" + roll + " Air PTS")
		gov_firepower += roll
	}

	game.combat.hits_on_fln = combat_result(gov_firepower, gov_roll)
	log(`${game.combat.hits_on_fln} hits on FLN.`)
	log_br()

	// Step 2: FLN to distribute hits on government
	if (game.combat.hits_on_gov) {
		goto_distribute_psp(FLN, game.combat.hits_on_gov, 'combat_hits_on_gov')
	} else {
		continue_combat_after_hits_on_gov()
	}
}

function continue_combat_after_hits_on_gov() {
	// Step 3: FLN to distribute losses
	if (game.combat.hits_on_fln) {
		game.combat.distribute_fln_hits = game.combat.hits_on_fln
		goto_combat_fln_losses()
	} else {
		continue_combat_after_fln_losses()
	}
}

function continue_combat_after_fln_losses() {
	// Step 4: Gov to distribute PSL from losses
	if (game.distribute_gov_psl) {
		goto_distribute_psp(GOV, game.distribute_gov_psl, 'combat_distribute_gov_psl')
	} else {
		end_combat()
	}
}

function end_combat() {
	// Step 5: Neutralize remaining units with biggest hits

	// Remaining involved units of the side that received the largest number of 'hits'
	// (according to the table, whether implemented or not) are Neutralized (no one is neutralized if equal results).

	log_br()

	if (game.combat.hits_on_gov > game.combat.hits_on_fln) {
		for (let u of game.combat.gov_units) {
			neutralize_unit(u)
		}
	} else if (game.combat.hits_on_gov < game.combat.hits_on_fln && game.combat.fln_units.length) {
		for (let u of game.combat.fln_units) {
			neutralize_unit(u)
		}
	}

	// After taking any combat results, all remaining involved units are placed in the OC box.
	for (let u of game.combat.fln_units) {
		set_unit_box(u, OC)
	}
	for (let u of game.combat.gov_units) {
		if (is_mobile_unit(u))
			set_unit_box(u, OC)
	}

	// allow React on Harass mission
	if (game.combat.harass) {
		if (check_victory())
			return
		// Gov can React
		delete game.combat.harass
		if (can_gov_react()) {
			goto_gov_react_mission()
			return
		}
	}
	end_gov_mission()
}

function goto_combat_fln_losses() {
	game.phasing = FLN_NAME
	set_active_player()
	game.state = "fln_combat_fln_losses"
}

function has_fln_combat_unit(type) {
	for (let u of game.combat.fln_units) {
		if (unit_type(u) === type) return true
	}
	return false
}

function for_first_fln_combat_unit(type, fn) {
	for (let u of game.combat.fln_units) {
		if (unit_type(u) === type) {
			fn(u)
			return
		}
	}
}

function eliminate_fln_unit(type) {
	push_undo()
	for_first_fln_combat_unit(type, u =>{
		eliminate_unit(u)
		set_delete(game.combat.fln_units, u)
		game.combat.distribute_fln_hits -= 1
	})
	if (!game.combat.distribute_fln_hits || !game.combat.fln_units.length)
		continue_combat_after_fln_losses()
}

function reduce_fln_unit(from_type, to_type) {
	push_undo()
	for_first_fln_combat_unit(from_type, u =>{
		let n = reduce_unit(u, to_type)
		set_add(game.combat.fln_units, n)
		set_delete(game.combat.fln_units, u)
		game.combat.distribute_fln_hits -= 1
	})
	if (!game.combat.distribute_fln_hits || !game.combat.fln_units.length)
		continue_combat_after_fln_losses()
}

function eliminate_fln_unit_2(u) {
	push_undo()
	eliminate_unit(u)
	set_delete(game.combat.fln_units, u)
	game.combat.distribute_fln_hits -= 1
	if (!game.combat.distribute_fln_hits || !game.combat.fln_units.length)
		continue_combat_after_fln_losses()
}

function reduce_fln_unit_2(u, to_type) {
	push_undo()
	let n = reduce_unit(u, to_type)
	set_add(game.combat.fln_units, n)
	set_delete(game.combat.fln_units, u)
	game.combat.distribute_fln_hits -= 1
	if (!game.combat.distribute_fln_hits || !game.combat.fln_units.length)
		continue_combat_after_fln_losses()
}

states.fln_combat_fln_losses = {
	inactive: "to distribute combat losses",
	prompt() {
		view.prompt = `Distribute ${game.combat.distribute_fln_hits} hit(s) as losses.`

		// each 'hit' on FLN units eliminates one Cadre or Band, or reduces a Front to a Cadre, or reduces a Failek to a Band (FLN player chooses how to distribute his losses).
		if (0) {
			if (has_fln_combat_unit(CADRE))
				gen_action("eliminate_cadre")
			if (has_fln_combat_unit(BAND))
				gen_action("eliminate_band")
			if (has_fln_combat_unit(FRONT))
				gen_action("reduce_front")
			if (has_fln_combat_unit(FAILEK))
				gen_action("reduce_failek")
		} else {
			for (let u of game.combat.fln_units)
				gen_action_unit(u)
		}
	},
	unit(u) {
		switch (unit_type(u)) {
			case FRONT:
				reduce_fln_unit_2(u, CADRE)
				break
			case FAILEK:
				reduce_fln_unit_2(u, BAND)
				break
			case BAND:
			case CADRE:
				eliminate_fln_unit_2(u)
				break
		}
	},
	eliminate_cadre() {
		eliminate_fln_unit(CADRE)
	},
	eliminate_band() {
		eliminate_fln_unit(BAND)
	},
	reduce_front() {
		reduce_fln_unit(FRONT, CADRE)
	},
	reduce_failek() {
		reduce_fln_unit(FAILEK, BAND)
	}
}

function goto_gov_operations_phase() {
	game.phasing = GOV_NAME
	set_active_player()
	clear_combat()

	if (game.gov_auto_pass) {
		gov_pass()
	} else {
		game.state = "gov_operations"
	}
}

const GOV_INTELLIGENCE_COST = 1
const GOV_CIVIL_AFFAIRS_COST = 1
const GOV_SUPPRESSION_COST = 1
const GOV_POPULATION_RESETTLEMENT_COST = 1

states.gov_operations = {
	inactive: "to do Operations",
	prompt() {
		view.prompt = "Operations: Perform a mission, or Pass."
		view.prompt = "Perform a Mission."

		// check if any GOV missions can actually be performed
		view.actions.flush = 0
		view.actions.intelligence = 0
		view.actions.civil_affairs = 0
		view.actions.suppression = 0
		view.actions.population_resettlement = 0

		for_each_friendly_unit_on_map_boxes([OPS, PTL], u => {
			if (is_flush_unit(u) || is_airmobile_flush_unit(u) || is_potential_airmobile_flush_unit(u)) {
				view.actions.flush = 1
			}
			if (game.gov_psl > GOV_INTELLIGENCE_COST && is_intelligence_unit(u)) {
				view.actions.intelligence = 1
			}
			if (game.gov_psl > GOV_CIVIL_AFFAIRS_COST && is_civil_affairs_unit(u) && !is_slow_french_reaction()) {
				view.actions.civil_affairs = 1
			}
			if (game.gov_psl > GOV_SUPPRESSION_COST && is_suppression_unit(u) && !is_slow_french_reaction()) {
				view.actions.suppression = 1
			}
			if (game.gov_psl > GOV_POPULATION_RESETTLEMENT_COST && is_population_resettlement_unit(u) && !is_slow_french_reaction()) {
				view.actions.population_resettlement = 1
			}
		})

		gen_action("auto_pass")
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
	auto_pass() {
		game.gov_auto_pass = true
		gov_pass()
	},
	pass() {
		gov_pass()
	}
}

function gov_pass() {
	log_mission("Pass")
	game.passes += 1
	if (game.passes >= 2) {
		end_operations_phase()
	} else {
		goto_fln_operations_phase()
	}
}

function goto_gov_flush_mission() {
	push_undo()
	log_mission("Flush")
	game.passes = 0
	game.state = "gov_flush"
	game.selected_loc = -1
}

function can_gov_react() {
	if (!game.contacted.length)
		return false
	let loc = unit_loc(game.contacted[0])
	if (is_area_france(loc))
		return false
	return has_gov_react_units_for_loc(loc)
}

states.gov_flush = {
	inactive: "to do Flush mission",
	prompt() {
		view.prompt = "Flush: Select location."
		let has_loc = false
		for_each_algerian_map_area(loc => {
			if (has_enemy_unit_in_loc_boxes(loc, [OPS, OC]) && has_gov_react_units_for_loc(loc)) {
				gen_action_loc(loc)
				has_loc = true
			}
		})

		if (game.helo_avail && can_airmobilize_any_unit()) {
			if (!has_loc)
				view.prompt = "Flush: Select location (you need to Airmobilize first)."
			gen_action("airmobilize")
		}
	},
	airmobilize() {
		push_undo()
		goto_gov_airmobilize()
	},
	loc(l) {
		game.selected_loc = l
		game.state = "gov_flush_select_units"
	}
}

states.gov_flush_select_units = {
	inactive: "to do Flush mission",
	prompt() {
		if (!game.selected.length) {
			view.prompt = "Flush: Select (air)mobile unit(s)."
			for_each_friendly_unit_on_map_boxes([OPS, PTL], u => {
				if ((unit_loc(u) === game.selected_loc && is_flush_unit(u)) || is_airmobile_flush_unit(u)) {
					gen_action_unit(u)
				}
			})

			if (game.helo_avail && can_airmobilize_any_unit())
				gen_action("airmobilize")
		} else {
			let first_unit = game.selected[0]

			if (is_area_urban(game.selected_loc) || !game.air_max) {
				view.prompt = "Flush: Execute mission."
			} else {
				view.prompt = `Flush: Execute mission (using ${game.mission_air_pts} Air PTS).`
				view.actions.use_air_point = game.air_avail > 0
			}

			// airmobile
			if (has_unit_type_in_loc(FR_XX, game.selected_loc)) {
				// any combination when division present
				for_each_friendly_unit_on_map_boxes([OPS, PTL], u => {
					if (is_mobile_unit(u) && (unit_loc(u) === game.selected_loc || is_unit_airmobile(u))) {
						gen_action_unit(u)
					}
				})
			} else if (is_elite_unit(first_unit)) {
				// all elite
				for_each_friendly_unit_on_map_boxes([OPS, PTL], u => {
					if (is_elite_unit(u) && (unit_loc(u) === game.selected_loc || is_unit_airmobile(u))) {
						gen_action_unit(u)
					}
				})
			} else {
				// Allow deselect
				gen_action_unit(first_unit)
			}

			view.actions.undo = 1

			gen_action("roll")
		}
	},
	airmobilize() {
		push_undo()
		goto_gov_airmobilize()
	},
	use_air_point() {
		push_undo()
		game.air_avail -= 1
		game.mission_air_pts += 1
	},
	undo() {
		if (game.selected.length > 0)
			set_clear(game.selected)
		else
			pop_undo()
	},
	unit(u) {
		set_toggle(game.selected, u)
	},
	roll() {
		let list = game.selected
		game.selected = []
		let loc = game.selected_loc
		game.selected_loc = -1
		clear_undo()

		log("A" + loc)
		log_br() // no cost

		// Total the Contact Ratings of Government units participating in the mission.
		log("Contact Ratings")
		let contact_ratings = 0
		for (let u of list) {
			logi(`${unit_contact(u)} U${u}`)
			contact_ratings += unit_contact(u)
			// move airmobile units to combat
			if (is_unit_airmobile(u) && unit_loc(u) !== loc)
				set_unit_loc(u, loc)
		}
		// logi(`Total ${contact_ratings}`)
		log_br()

		// (DRM: +1 if target unit has an Evasion rating higher than the total Contact ratings involved,
		// or Flush is in a Remote area, or if a Terror marker is present; -1 if Flush is in an Urban area).

		for_each_enemy_unit_in_loc_boxes(loc, [OPS, OC], u => {
			let roll = roll_d6()
			log(`U${u} G${roll}`)
			if (is_area_remote(loc)) {
				logi("+1 Remote")
				roll += 1
			}
			if (is_area_terrorized(loc)) {
				logi("+1 Terrorized")
				roll += 1
			}
			if (is_area_urban(loc)) {
				logi("-1 Urban")
				roll -= 1
			}
			if (unit_evasion(u) > contact_ratings) {
				logi("+1 Evasion")
				roll += 1
			}

			// The Government player rolls to contact each FLN unit that is currently in the OPS or OC boxes
			// by rolling equal to or less than this number, moving contacted units to one side.
			if (roll <= contact_ratings) {
				logi("Contact")
				set_add(game.contacted, u)
			} else {
				logi("No contact")
			}
			log_br()
		})

		if (game.contacted.length) {
			// Contacted FLN units then fire on the Combat Results Table, and the Government units return fire.
			game.combat = {
				fln_units: game.contacted,
				gov_units: list
			}
			goto_combat()
		} else {
			for (let u of list) {
				if (is_mobile_unit(u))
					set_unit_box(u, OC)
			}
			end_gov_mission()
		}
	}
}

function goto_gov_airmobilize() {
	game.selected = []
	push_undo()

	game.from_state = game.state
	game.state = "gov_airmobilize_select_units"
}

function airmobilize_cost(units) {
	let cost = 0
	for (let u of units) {
		cost += GOV_UNIT_AIRMOBILIZE_COST[unit_type(u)]
	}
	return cost
}

states.gov_airmobilize_select_units = {
	inactive: "to Airmobilize",
	prompt() {
		let cost = airmobilize_cost(game.selected)

		if (game.contacted.length) {
			// React
			let loc = unit_loc(game.contacted[0])

			for_each_friendly_unit_on_map(u => {
				if ((can_airmobilize_unit(u) && has_loc_as_airmobile_target(u, loc) && (cost + airmobilize_cost([u]) <= game.helo_avail)) || set_has(game.selected, u))
					gen_action_unit(u)
			})
		} else {
			// Flush
			for_each_friendly_unit_on_map(u => {
				if ((can_airmobilize_unit(u) && has_any_airmobile_target(u) && (cost + airmobilize_cost([u]) <= game.helo_avail)) || set_has(game.selected, u))
					gen_action_unit(u)
			})
		}

		if (!game.selected.length) {
			view.prompt = `Airmobilize: Select mobile brigade unit(s) to airmobilize.`
		} else {
			view.prompt = `Airmobilize: Select mobile brigade unit(s) to airmobilize (cost ${cost} Helo PTS).`
		}

		gen_action("done")
	},
	unit(u) {
		set_toggle(game.selected, u)
		// preview selection to see backside of counter
		if (set_has(game.selected, u)) {
			set_unit_airmobile(u)
		} else {
			clear_unit_airmobile(u)
		}
	},
	done() {
		let list = game.selected
		game.selected = []

		let cost = airmobilize_cost(list)
		game.helo_avail -= cost

		log_area_unit_list("Airmobilized", list)
		for (let u of list)
			set_unit_airmobile(u)
		logi(`-${cost} Helo PTS`)
		log_br()

		game.state = game.from_state
		delete game.from_state
	}
}

function goto_gov_react_mission() {
	game.phasing = GOV_NAME
	set_active_player()
	game.state = "gov_react"
}

states.gov_react = {
	inactive: "to do React mission",
	prompt() {
		if (!game.selected.length) {
			view.prompt = "React: Select mobile unit(s) or No React."

			let loc = unit_loc(game.contacted[0])

			for_each_friendly_unit_on_map_boxes([OPS, PTL], u => {
				if (is_mobile_unit(u) && (unit_loc(u) === loc || is_unit_airmobile(u))) {
					gen_action_unit(u)
				}
			})

			if (game.helo_avail && can_airmobilize_any_unit())
				gen_action("airmobilize")

			gen_action("no_react")
		} else {
			let first_unit = game.selected[0]
			let contact_loc = unit_loc(game.contacted[0])

			if (is_area_urban(contact_loc) || !game.air_max) {
				view.prompt = "React: Execute mission."
			} else {
				view.prompt = `React: Execute mission (using ${game.mission_air_pts} Air PTS).`
				view.actions.use_air_point = game.air_avail > 0
			}

			// airmobile
			if (has_unit_type_in_loc(FR_XX, contact_loc)) {
				// any combination when division present
				for_each_friendly_unit_on_map_boxes([OPS, PTL], u => {
					if (is_mobile_unit(u) && (unit_loc(u) === contact_loc || is_unit_airmobile(u))) {
						gen_action_unit(u)
					}
				})
			} else if (is_elite_unit(first_unit)) {
				// all elite
				for_each_friendly_unit_on_map_boxes([OPS, PTL], u => {
					if (is_elite_unit(u) && (unit_loc(u) === contact_loc || is_unit_airmobile(u))) {
						gen_action_unit(u)
					}
				})
			} else {
				// Allow deselect
				gen_action_unit(first_unit)
			}

			view.actions.undo = 1

			gen_action("roll")
		}
	},
	undo() {
		if (game.selected.length > 0)
			set_clear(game.selected)
		else
			pop_undo()
	},
	airmobilize() {
		push_undo()
		goto_gov_airmobilize()
	},
	use_air_point() {
		push_undo()
		game.air_avail -= 1
		game.mission_air_pts += 1
	},
	unit(u) {
		set_toggle(game.selected, u)
	},
	no_react() {
		clear_undo()
		log_br()
		log("No React.")
		end_gov_mission()
	},
	roll() {
		let list = game.selected
		game.selected = []
		let loc = unit_loc(game.contacted[0])
		clear_undo()

		log_mission("React")
		log("A" + loc)
		for (let u of list)
			// TODO: log where from?
			logi("U" + u)
		log_br()

		delete game.events.must_react

		// FLN player has a chance to evade to the UG box.
		// Units roll 1d6 individually, and move to the UG box if they roll equal to or less than their Evasion Rating.
		log("Evade")
		for (let u of game.contacted) {
			let roll = roll_d6()
			if (roll <= unit_evasion(u)) {
				logi(`U${u} F${roll} to UG`)
				evade_unit(u)
			} else {
				logi(`U${u} W${roll}`)
			}
		}

		if (game.contacted.length) {
			// Contacted FLN units then fire on the Combat Results Table, and the Government units return fire.
			game.combat = {
				fln_units: game.contacted,
				gov_units: list
			}
			goto_combat()
		} else {
			// React Gov units go to OC if all FLN units evade and there isn't actually any combat
			for (let u of list) {
				if (is_mobile_unit(u))
					set_unit_box(u, OC)
				// move airmobile units to combat zone anyway
				if (is_unit_airmobile(u) && unit_loc(u) !== loc)
					set_unit_loc(u, loc)
			}
			end_gov_mission()
		}
	}
}

function goto_gov_intelligence_mission() {
	push_undo()
	log_mission("Intelligence")
	game.passes = 0
	game.state = "gov_intelligence"
	game.selected_loc = -1
}

states.gov_intelligence = {
	inactive: "to do Intelligence mission",
	prompt() {
		if (game.selected_loc === -1) {
			view.prompt = "Intelligence: Select location."
			for_each_algerian_map_area(loc => {
				if (is_intelligence_loc(loc))
					gen_action_loc(loc)
			})
		} else {
			view.prompt = `Intelligence: Execute mission (cost ${GOV_INTELLIGENCE_COST} PSP).`
			gen_action("roll")
		}
	},
	loc(l) {
		push_undo()
		game.selected_loc = l
	},
	roll() {
		let loc = game.selected_loc
		game.selected_loc = -1
		clear_undo()

		// The Government player pays 1 PSP,
		// indicates the area,
		// totals the Contact Ratings of the non-neutralized Police units there

		//log("Intelligence")
		//logi("A" + loc)
		log("A" + loc)
		lower_gov_psl(GOV_INTELLIGENCE_COST)

		log("Contact Ratings")

		let contact_ratings = 0
		for_each_friendly_unit_in_loc(loc, u => {
			if (is_intelligence_unit(u)) {
				logi(`${unit_contact(u)} U${u}`)
				contact_ratings += unit_contact(u)
			}
		})

		log_br()

		// (DRM: +1 if target unit has an Evasion rating higher than the total Contact ratings involved,
		// or mission is in a Remote area, or if a Terror marker is present; -1 if mission is in an Urban area).

		for_each_enemy_unit_in_loc_boxes(loc, [UG], u => {
			let roll = roll_d6()

			log(`U${u} G${roll}`)
			if (is_area_remote(loc)) {
				logi("+1 Remote")
				roll += 1
			}
			if (is_area_terrorized(loc)) {
				logi("+1 Terrorized")
				roll += 1
			}
			if (is_area_urban(loc)) {
				logi("-1 Urban")
				roll -= 1
			}
			if (unit_evasion(u) > contact_ratings) {
				logi("+1 Evasion")
				roll += 1
			}

			// and rolls to contact each FLN unit in the UG box of that area by rolling equal to or less than this number
			if (roll <= contact_ratings) {
				logi("Contact")
				set_unit_box(u, OC)
			} else {
				logi("No contact")
			}
			log_br()
		})

		end_gov_mission()
	}
}

function goto_gov_civil_affairs_mission() {
	push_undo()
	log_mission("Civil Affairs")
	game.passes = 0
	game.state = "gov_civil_affairs"
	game.selected_loc = -1
}

states.gov_civil_affairs = {
	inactive: "to do Civil Affairs mission",
	prompt() {
		if (game.selected_loc === -1) {
			view.prompt = "Civil Affairs: Select location."
			for_each_algerian_map_area(loc => {
				if (is_civil_affairs_loc(loc))
					gen_action_loc(loc)
			})
		} else {
			view.prompt = `Civil Affairs: Execute mission (cost ${GOV_CIVIL_AFFAIRS_COST} PSP).`
			gen_action("roll")
		}
	},
	loc(l) {
		push_undo()
		game.selected_loc = l
	},
	roll() {
		let loc = game.selected_loc
		game.selected_loc = -1
		clear_undo()

		//log("Civil Affairs")
		//logi("A" + loc)
		log("A" + loc)
		lower_gov_psl(GOV_CIVIL_AFFAIRS_COST)
		set_area_civil_affaired(loc)

		// rolls 1d6, applies any DRM and reads the result off the Mission Success Table.
		// A DRM of +1 is applied if the "Amnesty" random event is in effect.
		let roll = roll_d6()
		log("Mission G" + roll)
		if (game.events.amnesty) {
			logi("+1 Amnesty")
			roll += 1
		}
		let [result, effect] = roll_mst(roll)

		// PSP from successful Civil Affairs missions are subtracted from the FLN PSL (note this is different from the FLN Propaganda mission).
		lower_fln_psl(result)

		// remove Terror marker on a @ or +.
		if (is_area_terrorized(loc) && (effect === '+' || effect === '@')) {
			logi("Terror marker removed")
			clear_area_terrorized(loc)
		}
		end_gov_mission()
	}
}

function goto_gov_suppression_mission() {
	push_undo()
	log_mission("Suppression")
	game.passes = 0
	game.state = "gov_suppression"
	game.selected_loc = -1
}

function do_suppression(loc, add_elite=false) {
	// can also be initiated by OAS
	set_area_suppressed(loc)

	// rolls 1d6, applies any DRM and reads the result off the Mission Success Table.
	// Elite units may assist in this mission, each one yielding a +1 DRM.
	// A DRM of +1 is applied if the "Amnesty" random event is in effect.

	let roll = roll_d6()
	log("Mission G" + roll)

	if (game.events.amnesty) {
		logi("+1 Amnesty")
		roll += 1
	}

	if (add_elite) {
		for_each_not_neutralized_unit_type_in_loc(EL_X, loc, u => {
			logi(`+1 U${u}`)
			roll += 1
		})
	}

	let [result, effect] = roll_mst(roll)

	// rolls the die and a number of FLN Bands/Faileks in the area equal to the result on the Mission Success Table are neutralized,
	// no matter what box they are in (FLN player chooses which exact units are neutralized).

	let targets = []
	for_each_enemy_unit_in_loc(loc, u => {
		let type = unit_type(u)
		if (type === BAND || type === FAILEK) {
			targets.push(u)
		}
	})

	if (!targets.length) {
		log("No Bands/Faileks.")
	}

	// TODO FLN player chooses which exact units are neutralized)
	shuffle(targets)
	for(let u of targets.slice(0, result)) {
		neutralize_unit(u)
	}

	// On a '@' result, all Cadre and Front units in the area are neutralized as well
	// and the area is Terrorized (place a Terror marker).
	// On a '+' result, the mission backfired somehow and the Government player loses 1d6 PSP,
	// as well as having to place a Terror marker.

	if (effect === '@') {
		for_each_enemy_unit_in_loc(loc, u => {
			let type = unit_type(u)
			if (type === FRONT || type === CADRE) {
				neutralize_unit(u)
			}
		})
		if (!is_area_terrorized(loc)) {
			log("Terrorized.")
			set_area_terrorized(loc)
		}
	} else if (effect === '+') {
		let roll = roll_d6()
		log("Backfired G" + roll)
		lower_gov_psl(roll)
		if (!is_area_terrorized(loc)) {
			log("Terrorized.")
			set_area_terrorized(loc)
		}
	}
}

states.gov_suppression = {
	inactive: "to do Suppression mission",
	prompt() {
		if (game.selected_loc === -1) {
			view.prompt = "Suppression: Select location."
			for_each_algerian_map_area(loc => {
				if (is_suppression_loc(loc))
					gen_action_loc(loc)
			})
		} else {
			view.prompt = `Suppression: Execute mission (cost ${GOV_SUPPRESSION_COST} PSP).`
			gen_action("roll")
		}
	},
	loc(l) {
		push_undo()
		game.selected_loc = l
	},
	roll() {
		let loc = game.selected_loc
		game.selected_loc = -1
		clear_undo()

		//log("Suppression")
		//logi("A" + loc)
		log("A" + loc)
		lower_gov_psl(GOV_SUPPRESSION_COST)

		do_suppression(loc, true)
		end_gov_mission()
	}
}

function goto_gov_population_resettlement_mission() {
	push_undo()
	log_mission("Population Resettlement")
	game.passes = 0
	game.state = "gov_population_resettlement"
	game.selected_loc = -1
}

states.gov_population_resettlement = {
	inactive: "to do Population Resettlement mission",
	prompt() {
		if (game.selected_loc === -1) {
			view.prompt = "Population Resettlement: Select location."
			for_each_algerian_map_area(loc => {
				if (is_population_resettlement_loc(loc))
					gen_action_loc(loc)
			})
		} else {
			view.prompt = `Population Resettlement: Execute mission (cost ${GOV_POPULATION_RESETTLEMENT_COST} PSP).`
			gen_action("roll")
		}
	},
	loc(l) {
		push_undo()
		game.selected_loc = l
	},
	roll() {
		let loc = game.selected_loc
		game.selected_loc = -1
		clear_undo()

		//log("Population Resettlement")
		//logi("A" + loc)
		log("A" + loc)
		lower_gov_psl(GOV_POPULATION_RESETTLEMENT_COST)

		set_area_remote(loc)
		log("Remote.")

		if (!is_area_terrorized(loc)) {
			set_area_terrorized(loc)
			log("Terrorized.")
		}

		let d1 = roll_d6()
		let d2 = roll_d6()
		let d3 = roll_d6()
		log(`Penalty W${d1} W${d2} W${d3}`)
		raise_fln_psl(d1+d2+d3)

		for_each_enemy_unit_in_loc(loc, u => {
			if (unit_type(u) === FRONT) {
				reduce_unit(u, CADRE)
			}
		})

		end_gov_mission()
	}
}

function check_mandatory_react() {
	if (game.events.must_react) {
		// Government must react with at least 1 unit, otherwise -1d6 PSP
		let roll = roll_d6()
		log("Penalty for No React W" + roll)
		lower_gov_psl(roll)
	}
}

function end_gov_mission() {
	check_mandatory_react()
	if (check_victory())
		return
	goto_fln_operations_phase()
}

function clear_combat() {
	game.selected = []
	game.combat = {}
	set_clear(game.contacted)
	game.distribute_gov_psl = 0
	game.mission_air_pts = 0
	delete game.events.must_react
}

function end_operations_phase() {
	game.passes = 0
	delete game.fln_auto_pass
	delete game.gov_auto_pass
	clear_combat()
	goto_turn_interphase()
}

function determine_control() {
	log_h3("Control")

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

	// log("Contested")
	for_each_algerian_map_area(loc => {
		let diff = Math.abs(fln_pts[loc] - gov_pts[loc])
		if (!diff || (!fln_pts[loc] && !gov_pts[loc])) {
			// logi("A" + loc)
			set_area_contested(loc)
		}
	})
	// log_br()

	log("Gov Control")
	for_each_algerian_map_area(loc => {
		let diff = Math.abs(fln_pts[loc] - gov_pts[loc])
		if (!diff || (!fln_pts[loc] && !gov_pts[loc]))
			return
		if (fln_pts[loc] >= 2 * gov_pts[loc]) {
			logi("A" + loc)
			set_area_fln_control(loc)
		}
	})
	log_br()

	log("FLN Control")
	for_each_algerian_map_area(loc => {
		let diff = Math.abs(fln_pts[loc] - gov_pts[loc])
		if (!diff || (!fln_pts[loc] && !gov_pts[loc]))
			return
		if (gov_pts[loc] >= 2 * fln_pts[loc]) {
			logi("A" + loc)
			set_area_gov_control(loc)
		}
	})
	log_br()

	for_each_algerian_map_area(loc => {
		let diff = Math.abs(fln_pts[loc] - gov_pts[loc])
		if (!diff || (!fln_pts[loc] && !gov_pts[loc]))
			return
		if (gov_pts[loc] >= 2 * fln_pts[loc])
			return
		if (fln_pts[loc] >= 2 * gov_pts[loc])
			return

		// If one side has less than twice as many Points, take the difference of the two totals
		// Both sides then roll 1d6 trying to get equal to or less than that number.
		log(`A${loc} (${diff})`)

		let fln_roll = roll_d6()
		let gov_roll = roll_d6()

		let fln_claim = fln_roll <= diff
		if (fln_claim)
			logi(`F${fln_roll} FLN`)
		else
			logi(`W${fln_roll} FLN`)

		let gov_claim = gov_roll <= diff
		if (gov_claim)
			logi(`G${gov_roll} Gov`)
		else
			logi(`W${gov_roll} Gov`)

		// If one side succeeds, then he gets Control.
		// If both or neither succeed, then the area remains Contested and no marker is placed.
		if (fln_claim && !gov_claim) {
			log(`FLN Control.`)
			set_area_fln_control(loc)
		} else if (gov_claim && !fln_claim) {
			log(`Gov Control.`)
			set_area_gov_control(loc)
		} else {
			log(`Contested.`)
			set_area_contested(loc)
		}

		log_br()
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

function gov_depreciate_asset(title, num_max) {
	let loss = depreciation_loss_number(num_max)
	let roll = roll_d6()

	log(`${title} G${roll}`)
	logi(`Points ${num_max}`)
	logi(`Loss Number ${loss}`)

	if (game.gov_psl <= 30) {
		logi("-1 Gov PSL ≤ 30")
		roll -= 1
	}
	if (game.gov_psl >= 70) {
		logi("+1 Gov PSL ≥ 70")
		roll += 1
	}

	if (roll <= loss) {
		num_max = Math.max(num_max - loss, 0)
		log(`Lost ${loss}.`)
	} else {
		log(`No change.`)
	}
	log_br()

	return num_max
}

function gov_depreciation() {
	if (!game.air_max && !game.helo_max) {
		return;
	}

	if (game.air_max) {
		game.air_max = gov_depreciate_asset('Air Max', game.air_max)
	}
	if (game.helo_max) {
		game.helo_max = gov_depreciate_asset('Helo Max', game.helo_max)
	}
}

function fln_depreciation() {
	if (!game.fln_ap) {
		return;
	}

	let roll = roll_d6()
	let loss = depreciation_loss_number(game.fln_ap)

	log("Unused FLN AP F" + roll)
	logi(`Points ${game.fln_ap}`)
	logi(`Loss Number ${loss}`)

	if (game.fln_psl <= 30) {
		logi("-1 FLN PSL ≤ 30")
		roll -= 1
	}
	if (game.fln_psl >= 70) {
		logi("+1 FLN PSL ≥ 70")
		roll += 1
	}

	if (roll <= loss) {
		game.fln_ap = Math.max(game.fln_ap - loss, 0)
		log(`Lost ${loss}.`)
	} else {
		log(`No change.`)
	}
}

function unit_and_area_recovery() {
	log_h3("Recovery of Neutralized Units")

	for (let loc = 0; loc < area_count; ++loc) {
		let first = true
		for_each_neutralized_unit_in_algeria(u => {
			if (unit_loc(u) !== loc)
				return
			if (first) {
				log("A" + loc)
				first = false
			}
			let roll = roll_d6()

			let drm = 0
			if (is_gov_unit(u)) {
				logi(`U${u} G${roll}`)
				if (game.gov_psl <= 30) {
					logii("-1 Gov PSL ≤ 30")
					drm += 1
				}
				if (game.gov_psl >= 70) {
					logii("+1 Gov PSL ≥ 70")
					drm += 1
				}
				else if (is_elite_unit(u)) {
					logii("+1 Elite")
					drm += 1
				}
			} else {
				logi(`U${u} F${roll}`)
				if (game.fln_psl <= 30) {
					logii("-1 FLN PSL ≤ 30")
					drm += 1
				}
				else if (game.fln_psl >= 70) {
					logii("+1 FLN PSL ≥ 70")
					drm += 1
				}
			}

			if (roll + drm >= 5) {
				logii("Recovered")
				clear_unit_neutralized(u)
			} else {
				logii("Not recovered")
			}
		})
	}

	log_h3("Recovery of Terrorized Areas")

	for_each_algerian_map_area(loc => {
		if (is_area_terrorized(loc)) {
			let roll = roll_d6()
			log(`A${loc} B${roll}`)
			if (!has_fln_not_neutralized_unit_in_loc(loc)) {
				logi("+1 No active FLN")
				roll += 1
			}
			if (roll >= 5) {
				logi("Recovered")
				clear_area_terrorized(loc)
			} else {
				logi("Not recovered")
			}
		}
	})
}

function restore_air_helo_avail() {
	game.air_avail = game.air_max
	game.helo_avail = game.helo_max
	// log(`Air Avail=${game.air_avail} Helo Avail=${game.helo_avail}`)
}

function unit_redeployment() {
	// log_h3("Redeployment")
	for_each_non_neutralized_unit_in_algeria(u => {
		// let loc = unit_loc(u)
		let box = unit_box(u)
		if (is_fln_unit(u) && box !== UG) {
			// logi(`U${u} in A${loc} to UG`)
			set_unit_box(u, UG)
		} else if (is_gov_unit(u) && is_mobile_unit(u)) {
			if (box !== OC) {
				// logi(`U${u} in A${loc} to OC`)
				set_unit_box(u, OC)
			}
			if (is_unit_airmobile(u)) {
				// logi(`flipped airmobile back`)
				clear_unit_airmobile(u)
			}
		}
	})

	restore_air_helo_avail()
	game.border_zone_active = false
}

function roll_coup_table(oas_drm=false) {
	let d1 = roll_d6()
	let d2 = roll_d6()

	log_br()
	log(`Coup attempt G${d1} G${d2}`)

	let coup = d1 + d2
	if (oas_drm) {
		logi("+1 OAS deployed in France")
		coup += 1
	}

	let delta_psp = 0

	if (coup === 2) {
		logi(`Wild success`) //: +3d6 PSP, mobilize 2d6 PSP of units for free
		delta_psp = roll_nd6(3, "G", "Gained")
		raise_gov_psl(delta_psp)
		return 'wild_success'
	} else if (coup <= 4) {
		logi(`Big success`) //: +2d6 PSP, mobilize 1d6 PSP of units for free
		delta_psp = roll_nd6(2, "G", "Gained")
		raise_gov_psl(delta_psp)
		return 'big_success'
	} else if (coup <= 6) {
		logi(`Success`) //: +1d6 PSP
		delta_psp = roll_nd6(1, "G", "Gained")
		raise_gov_psl(delta_psp)
		return 'success'
	} else if (coup === 7) {
		logi(`Fizzle`) //: -1d6 PSP
		delta_psp = roll_nd6(1, "W", "Lost")
		lower_gov_psl(delta_psp)
		return 'fizzle'
	} else if (coup <= 9) {
		logi(`Failure`) //: -2d6 PSP, remove 1 elite unit from the game
		delta_psp = roll_nd6(2, "W", "Lost")
		lower_gov_psl(delta_psp)
		return 'failure'
	} else {
		logi(`Abject failure`) //: -3d6 PSP, remove 1d6 elite units from the game
		delta_psp = roll_nd6(3, "W", "Lost")
		lower_gov_psl(delta_psp)
		return 'abject_failure'
	}
}

function coup_attempt() {
	let d1, d2, roll

	let result = roll_coup_table(is_area_france(game.oas))
	if (check_victory())
		return

	// mobilize / remove units
	switch (result) {
	case 'wild_success':
		d1 = roll_d6()
		d2 = roll_d6()
		log(`Mobilize G${d1} G${d2} PSP of units for free.`)
		goto_coup_attempt_free_mobilize(d1 + d2)
		break
	case 'big_success':
		d1 = roll_d6()
		log(`Mobilize G${d1} PSP of units for free.`)
		goto_coup_attempt_free_mobilize(d1)
		break
	case 'success':
	case 'fizzle':
		continue_final_psl_adjustment()
		break
	case 'failure':
		log("Remove 1 elite unit from the game.")
		goto_coup_attempt_remove_elite(1)
		break
	case 'abject_failure':
		d1 = roll_d6()
		log("Remove G${d1} elite units from the game.")
		goto_coup_attempt_remove_elite(d1)
		break
	default:
		throw Error("Unknown coup result: " + result)
	}
}

function goto_coup_attempt_free_mobilize(value) {
	game.phasing = GOV_NAME
	set_active_player()

	game.selected = []
	game.summary = []
	game.events.gov_free_mobilize = value
	game.state = "gov_coup_attempt_free_mobilize"
}

states.gov_coup_attempt_free_mobilize = {
	inactive: "to do Coup Attempt",
	prompt() {
		view.prompt = `Coup Attempt: Mobilize ${game.events.gov_free_mobilize} PSP of units for free.`

		if (!game.selected.length) {
			// first unit can be any unit in DEPLOY or on map
			for_each_friendly_unit_in_loc(DEPLOY, u => {
				if (mobilization_cost([u]) <= game.events.gov_free_mobilize)
					gen_action_unit(u)
			})
		} else {
			let first_unit = game.selected[0]
			let first_unit_loc = unit_loc(first_unit)
			if (first_unit_loc === DEPLOY) {
				let cost = mobilization_cost(game.selected)
				view.prompt = `Coup Attempt: Mobilize ${game.events.gov_free_mobilize} PSP of units for free (selected ${cost} PSP).`

				for_each_friendly_unit_in_loc(DEPLOY, u => {
					if (set_has(game.selected, u) || (cost + mobilization_cost([u]) <= game.events.gov_free_mobilize))
						gen_action_unit(u)
				})

				// don't allow free PSP to go <= 0
				if (Math.floor(game.events.gov_free_mobilize - cost) >= 0) {
					for_each_algerian_map_area(loc => {
						gen_action_loc(loc)
					})
				}
			}

			view.actions.undo = 1
		}

		gen_action("done")
	},
	undo() {
		if (game.selected.length > 0)
			set_clear(game.selected)
		else
			pop_undo()
	},
	unit(u) {
		set_toggle(game.selected, u)
	},
	loc(to) {
		let list = game.selected
		game.selected = []
		push_undo()
		for (let u of list) {
			mobilize_unit(u, to)
			set_add(game.summary, u)
		}
		let cost = mobilization_cost(list)
		game.events.gov_free_mobilize -= cost
	},
	done() {
		log_area_unit_list("Mobilized", game.summary)

		game.summary = null

		delete game.events.gov_free_mobilize
		continue_final_psl_adjustment()
	}
}

function goto_coup_attempt_remove_elite(num) {
	game.phasing = GOV_NAME
	set_active_player()

	let num_el_x = count_friendly_units_on_map_of_type(EL_X)
	let to_remove = Math.min(num, num_el_x)

	if (to_remove) {
		game.selected = []
		game.events.gov_remove_num = to_remove
		game.state = "gov_coup_attempt_select_units"
	} else {
		log("No French elite units.")
		log_br()
		continue_final_psl_adjustment()
	}
}

states.gov_coup_attempt_select_units = {
	inactive: "to do Coup Attempt",
	prompt() {
		view.prompt = `Coup Attempt: Select ${game.events.gov_remove_num} French elite unit(s) to remove from the map.`

		let target = 0
		for (let u of game.selected) {
			if (unit_type(u) === EL_X) target += 1
		}

		for_each_friendly_unit_on_map(u => {
			if (unit_type(u) === EL_X && (target < game.events.gov_remove_num || set_has(game.selected, u)))
				gen_action_unit(u)
		})

		if (target >= game.events.gov_remove_num) {
			gen_action("done")
		}

		if (game.selected.length > 0)
			view.actions.undo = 1
	},
	undo() {
		if (game.selected.length > 0)
			set_clear(game.selected)
		else
			pop_undo()
	},
	unit(u) {
		set_toggle(game.selected, u)
	},
	done() {
		let list = game.selected
		game.selected = []

		log_area_unit_list("Removed", list)
		for (let u of list) {
			remove_unit(u, ELIMINATED)
		}

		delete game.events.gov_remove_num
		continue_final_psl_adjustment()
	}
}

function final_psl_adjustment() {
	log_h3("Political Support Adjustment")

	if (game.gov_psl <= 30) {
		//log("Gov PSL ≤ 30")
		let roll = roll_d6()
		log(`Coup d'etat G${roll}`)
		if (is_area_france(game.oas)) {
			logi("+1 OAS deployed in France")
			roll += 1
		}
		if (roll >= 6) {
			logi("Coup attempt!")
			coup_attempt()
			return
		} else {
			logi("No coup")
		}
	}
	continue_final_psl_adjustment()
}

function continue_final_psl_adjustment() {
	game.state = "turn_interphase"

	log_br()

	if (game.oas) {
		log_br()
		if (is_area_algerian(game.oas)) {
			log("OAS deployed in Algeria.")
			lower_gov_psl(1)
		} else if (is_area_france(game.oas)) {
			log("OAS deployed in France.")
			lower_gov_psl(2)
		}
	}

	// for each area currently Terrorized or ever Resettled
	let gov_area_adjust = 0
	for_each_algerian_map_area(loc => {
		if (is_area_terrorized(loc) || is_area_resettled(loc)) {
			gov_area_adjust += 1
		}
	})

	if (gov_area_adjust > 0) {
		log_br()
		log("Terrorized or Resettled areas.")
		for_each_algerian_map_area(loc => {
			if (is_area_terrorized(loc) || is_area_resettled(loc)) {
				logi("A" + loc)
			}
		})
		lower_gov_psl(gov_area_adjust)
		if (check_victory())
			return
	}

	if (!has_fln_not_neutralized_mobile_unit_in_algeria()) {
		log_br()
		log("No non-neutralized FLN mobile units present in Algeria.")
		let roll = roll_nd6(3, "F", "Lost")
		lower_fln_psl(roll)
		if (check_victory())
			return
	}

	if (game.is_morocco_tunisia_independent) {
		// Total Firepower of FLN mobile units in Morocco and/or Tunisia x 10% (round fractions down)
		let firepower = 0
		for_each_fln_mobile_unit_in_morocco_tunisia(u => {
			firepower += unit_firepower(u)
		})
		let fln_firepower_adjust = Math.floor(firepower * 0.1)
		if (fln_firepower_adjust) {
			log_br()
			log("Total Firepower of FLN mobile units in Morocco and/or Tunisia x 10%.")
			raise_fln_psl(fln_firepower_adjust)
		}
		if (check_victory())
			return
	}

	// Side that Controls more areas gets PSP equal to HALF the difference between them (round fractions down)
	log_br()
	// log("Side that Controls more areas gets PSP equal to HALF the difference")
	let fln_control = 0
	let gov_control = 0
	for_each_algerian_map_area(loc => {
		if (is_area_fln_control(loc)) {
			fln_control += 1
		} else if (is_area_gov_control(loc)) {
			gov_control += 1
		}
	})
	log(`Side that controls more areas.`)
	logi(`${gov_control} Gov`)
	logi(`${fln_control} FLN`)
	let control_adjust = Math.floor(Math.abs(fln_control - gov_control) / 2)
	if (control_adjust > 0) {
		if (fln_control > gov_control) {
			raise_fln_psl(control_adjust)
		} else if (gov_control > fln_control) {
			raise_gov_psl(control_adjust)
		}
		if (check_victory())
			return
	}
}

function goto_turn_interphase() {
	// current player gets to do the interphrase
	// clear_undo()
	game.state = "turn_interphase"

	// XXX debug
	push_undo()
	log_h2("Turn Interphase")

	determine_control()

	log_h3("Depreciation")
	gov_depreciation()
	fln_depreciation()

	unit_and_area_recovery()
	unit_redeployment()
	final_psl_adjustment()

	if (check_victory())
		return

	if (game.shorter_game && !(game.turn % 6)) {
		// Players can agree to an open-ended game, checking their respective PSLs every 6 turns, at the end of the Turn Interphase.
		log_br()
		log("Checking for Shorter Game Victory every 6 turns")
		if (check_shorter_victory())
			return
	}
}

states.turn_interphase = {
	inactive: "to do Turn Interphase",
	prompt() {
		view.prompt = "Turn Interphase."
		gen_action("end_turn")
	},
	end_turn() {
		goto_next_turn()
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

function log_area_unit_list(verb, list) {
	if (list.length === 0)
		return
	log_br()
	log(verb)
	for (let loc = 0; loc < area_count; ++loc) {
		let first = true
		for (let u of list) {
			if (unit_loc(u) === loc) {
				if (first) {
					logi("A" + loc)
					first = false
				}
				logii("U" + u)
			}
		}
	}
}

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

function logii(msg) {
	game.log.push(">>" + msg)
}

function logp(msg) {
	game.log.push("$" + msg)
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
	log_br()
}

function log_event(msg) {
	log(".evt " + msg)
	log_br()
}

function log_mission(msg) {
	log_br()
	if (game.active === GOV_NAME)
		log(".h3.gov " + msg)
	else
		log(".h3.fln " + msg)
	log_br()
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

function roll_1d6() {
	let roll = roll_d6()
	log("Rolled B" + roll)
	return roll
}

function roll_nd6(n, color="B", prefix="Rolled") {
	clear_undo()
	let result = 0
	let summary = []
	for (let i = 0; i < n; ++i) {
		let roll = roll_d6()
		result += roll
		summary.push(color + roll)
	}
	log(prefix + " " + summary.join(" "))
	return result
}

const MST = [0, 0, 1, 1, 1, 2, 2, 3, 4, 5]
const MST_EFFECT = ['+', '+', '+', '', '', '', '', '@', '@', '@']

function roll_mst(roll) {
	let num = clamp(roll, -1, 8)
	let result = MST[num + 1]
	let effect = MST_EFFECT[num + 1]
	/*
	let effect_str = ''
	if (effect === '+') effect_str = ' (bad)'
	if (effect === '@') effect_str = ' (good)'
	*/
	//logi(`Result ${result}${effect}${effect_str}`)
	//logi(`Result ${result}${effect}`)
	logi(`Result ${result}${effect}`)

	return [result, effect]
}

const COMBAT_RESULT_TABLE = [
	// FP      1  2  3  4  5  6
	[  1,    [ 0, 0, 0, 0, 0, 1]],
	[  4,    [ 0, 0, 0, 1, 1, 2]],
	[  8,    [ 1, 1, 2, 2, 2, 3]],
	[  15,   [ 1, 2, 3, 3, 4, 5]],
	[  24,   [ 2, 4, 5, 5, 6, 8]],
	[  9999, [ 3, 5, 7, 8, 10, 12]],
]

function combat_result(firepower, die) {
	let k = 0
	for (k = 0; k < COMBAT_RESULT_TABLE.length; ++k) {
		if (firepower <= COMBAT_RESULT_TABLE[k][0])
			break
	}
	return COMBAT_RESULT_TABLE[k][1][die - 1]
}

function clamp(x, min, max) {
	return Math.min(Math.max(x, min), max)
}

// Array remove and insert (faster than splice)

function array_remove(array, index) {
	let n = array.length
	for (let i = index + 1; i < n; ++i)
		array[i - 1] = array[i]
	array.length = n - 1
}

function array_remove_item(array, item) { // eslint-disable-line no-unused-vars
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

function array_remove_pair(array, index) {
	let n = array.length
	for (let i = index + 2; i < n; ++i)
		array[i - 2] = array[i]
	array.length = n - 2
}

function array_insert_pair(array, index, key, value) {
	for (let i = array.length; i > index; i -= 2) {
		array[i] = array[i-2]
		array[i+1] = array[i-1]
	}
	array[index] = key
	array[index+1] = value
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

function map_clear(map) {
	map.length = 0
}

function map_has(map, key) {
	let a = 0
	let b = (map.length >> 1) - 1
	while (a <= b) {
		let m = (a + b) >> 1
		let x = map[m<<1]
		if (key < x)
			b = m - 1
		else if (key > x)
			a = m + 1
		else
			return true
	}
	return false
}

function map_get(map, key, missing) {
	let a = 0
	let b = (map.length >> 1) - 1
	while (a <= b) {
		let m = (a + b) >> 1
		let x = map[m<<1]
		if (key < x)
			b = m - 1
		else if (key > x)
			a = m + 1
		else
			return map[(m<<1)+1]
	}
	return missing
}

function map_set(map, key, value) {
	let a = 0
	let b = (map.length >> 1) - 1
	while (a <= b) {
		let m = (a + b) >> 1
		let x = map[m<<1]
		if (key < x)
			b = m - 1
		else if (key > x)
			a = m + 1
		else {
			map[(m<<1)+1] = value
			return
		}
	}
	array_insert_pair(map, a<<1, key, value)
}

function map_delete(map, item) {
	let a = 0
	let b = (map.length >> 1) - 1
	while (a <= b) {
		let m = (a + b) >> 1
		let x = map[m<<1]
		if (item < x)
			b = m - 1
		else if (item > x)
			a = m + 1
		else {
			array_remove_pair(map, m<<1)
			return
		}
	}
}

function map_for_each(map, f) {
	for (let i = 0; i < map.length; i += 2)
		f(map[i], map[i+1])
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

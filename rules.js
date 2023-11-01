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
	"French Division",
	"French Brigade",
	"French Elite Brigade",
	"Algerian Brigade",
	"Algerian Police",
	"FLN Failek",
	"FLN Band",
	"FLN Cadre",
	"FLN Front",
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
	// can trigger victory
	game.fln_psl += amount
	if (game.fln_psl > MAX_PSL) {
		let excess_psl = game.fln_psl - MAX_PSL
		logi(`FLN PSL +${amount} (subtracted from Gov PSL)`)
		game.fln_psl = MAX_PSL
		lower_gov_psl(excess_psl)
	} else {
		logi(`FLN PSL +${amount}`)
	}
}

function raise_gov_psl(amount) {
	if (amount <= 0)
		throw Error(`ASSERT: amount > 0, but was ${amount}`)
	// can trigger victory
	game.gov_psl += amount
	if (game.gov_psl > MAX_PSL) {
		let excess_psl = game.gov_psl - MAX_PSL
		logi(`Gov PSL +${amount} (subtracted from FLN PSL)`)
		game.gov_psl = MAX_PSL
		lower_fln_psl(excess_psl)
	} else {
		logi(`Gov PSL +${amount}`)
	}
}

function lower_fln_psl(amount) {
	if (amount <= 0)
		throw Error(`ASSERT: amount > 0, but was ${amount}`)
	logi(`FLN PSL -${amount}`)
	game.fln_psl = Math.max(0, game.fln_psl - amount)
}

function lower_gov_psl(amount, indent=true) {
	if (amount <= 0)
		throw Error(`ASSERT: amount > 0, but was ${amount}`)
	let log_msg = `Gov PSL -${amount}`
	if (indent) {
		logi(log_msg)
	} else {
		log(log_msg)
	}
	game.gov_psl = Math.max(0, game.gov_psl - amount)
}

function raise_fln_ap(amount, reason) {
	if (amount <= 0)
		throw Error(`ASSERT: amount > 0, but was ${amount}`)
	if (reason)
		logi(`FLN AP +${amount} (${reason})`)
	else
		logi(`FLN AP +${amount}`)
	game.fln_ap = Math.min(MAX_AP, game.fln_ap + amount)
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
	log(`Eliminated U${u} in A${loc}`)
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
	logi(`U${u} neutralized`)
	set_unit_neutralized(u)
	if (!is_police_unit(u))
		set_unit_box(u, OC)
}

function remove_unit(u, to=DEPLOY) {
	let loc = unit_loc(u)
	logi(`U${u} from A${loc}`)
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
	log("Gov. PSL ≤ 30: OAS Activated")
	game.oas = DEPLOY
	game.oas_control = -1
}

function roll_oas_control() {
	let roll = roll_1d6()
	if (roll <= 3) {
		game.oas_control = FLN
	} else {
		game.oas_control = GOV
	}
	logi(`Controlled by ${player_name(game.oas_control)}`)
}

function remove_oas() {
	log("Gov. PSL ≥ 70: OAS Removed")
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
	return can_airmobilize_unit(u) && airmobilize_cost([u]) <= game.helo_avail && is_unit_not_neutralized(u) && has_enemy_unit_in_boxes([OPS, OC])
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

function count_patrol_units_in_loc(loc) {
	let result = 0
	for (let u = first_gov_unit; u <= last_gov_unit; ++u)
		if (unit_loc(u) === loc && unit_box(u) === PTL && is_unit_not_neutralized(u))
			result += 1
	return result
}

function has_gov_react_units_in_loc(loc) {
	let has_division = has_unit_type_in_loc(FR_XX, loc)
	for (let u = first_gov_unit; u <= last_gov_unit; ++u)
		if (is_react_unit(u) && (unit_box(u) === PTL || unit_box(u) === OPS)) {
			if (unit_loc(u) === loc || (is_unit_airmobile(u) && (has_division || is_elite_unit(u))))
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
		goto_game_over(FLN_NAME, `FLN won: ${scale} victory.`)
		return true
	} else if (game.fln_psl <= 0) {
		let scale = victory_scale()
		goto_game_over(GOV_NAME, `Government won: ${scale} victory.`)
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
			goto_game_over(GOV_NAME, `Government won: ${scale} Shorter Game victory.`)
			return true
		} else if (game.shorter_victory_leader === FLN && leader === FLN) {
			let scale = victory_scale()
			goto_game_over(FLN_NAME, `FLN won: ${scale} Shorter Game victory.`)
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
	log(`Gov. PSL ${game.gov_psl}`)
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
			game.slow_french_reaction = true
		}
		if (options.more_deterministic_independence) {
			log("More Deterministic Independence.")
			game.more_deterministic_independence = true
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

	log(`FLN PSL ${game.fln_psl}`)
	game.fln_ap = roll_nd6(2)
	log(`FLN AP ${game.fln_ap}`)
	log(`Gov. PSL ${game.gov_psl}`)
	log_br()

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

		// verbose deployment
		if (true) {
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
		} else {
			for_each_map_area(loc => {
				let n = 0
				for_each_friendly_unit_in_loc(loc, u => {
					n += 1
				})
				if (n > 0)
					log(`${n} at A${loc}`)
			})
		}

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
	log_h2("Random Event")

	if (game.events.gov_remobilize) {
		log("Units may remobilize this turn:")
		for (let u of game.events.gov_remobilize) {
			logi(`U${u}`)
			set_unit_loc(u, DEPLOY)
		}
		delete game.events.gov_remobilize
		log_br()
	}

	if (game.events.gov_return) {
		log("Units returned:")
		for (const [u, loc] of Object.entries(game.events.gov_return)) {
			logi(`U${u} to A${loc}`)
			deploy_unit(u, loc)
		}
		delete game.events.gov_return
		log_br()
	}

	// Instead of waiting for a random event to make Morocco and Tunisia independent,
	// assume that this will happen some time in the first 6 turns of the 1954 scenario.
	// Each Random Events Phase, roll 1d6; if the number rolled is less than or equal to the number of the current turn,
	//the two countries immediately become independent.
	if (game.more_deterministic_independence && !game.is_morocco_tunisia_independent) {
		log("More Deterministic Independence?")
		let roll = roll_1d6()
		if (roll <= game.turn)
			grant_morocco_tunisia_independence()
		log_sep()
	}
}

states.random_event = {
	inactive: "to do random event",
	prompt() {
		view.prompt = "Roll for a random event."
		gen_action("roll")
	},
	roll() {
		let rnd1 = roll_d6()
		let rnd2 = roll_d6()
		let rnd = 10 * rnd1 + rnd2
		log(`Rolled B${rnd1} B${rnd2}`)

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
	log_h3("No Event. Lucky you.")
	end_random_event()
}

function goto_fln_foreign_arms_shipment() {
	log_h3("FLN Foreign arms shipment.")
	// The FLN player adds 2d6 AP, minus the current number of Naval Points.
	let roll = roll_nd6(2)
	logi(`-${game.naval} Naval PTS`)
	let delta_ap = Math.max(roll - game.naval, 0)
	if (delta_ap)
		raise_fln_ap(delta_ap)
	end_random_event()
}

function goto_jealousy_and_paranoia() {
	log_h3("Jealousy and Paranoia.")
	log("FLN units may not Move domestically this turn only")
	// FLN units may not Move across wilaya borders this turn only (they may move across international borders)
	game.events.jealousy_and_paranoia = true
	end_random_event()
}

function goto_elections_in_france() {
	log_h3("Elections in France")
	// Government player rolls on the Coup Table (no DRM) and adds or subtracts
	// the number of PSP indicated: no units are mobilized or removed.
	roll_coup_table()
	end_random_event()
}

function goto_un_debate() {
	log_h3("UN debates Algerian Independence.")
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
		let roll = roll_1d6()
		raise_fln_psl(roll)
		end_random_event()
	},
	lower_gov_psl_1d6() {
		let roll = roll_1d6()
		lower_gov_psl(roll)
		end_random_event()
	}
}

function goto_fln_factional_purge() {
	log_h3("FLN Factional Purge")
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
	log(`in wilaya (zone) ${game.events.fln_purge_zone}`)

	game.phasing = FLN_NAME
	set_active_player()

	let roll = roll_1d6()
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
	log_h3("Morocco & Tunisia Gains Independence.")
	log_br()
	// Raise both FLN and Government PSL by 2d6;
	let fln_roll = roll_nd6(2)
	raise_fln_psl(fln_roll)

	let gov_roll = roll_nd6(2)
	raise_gov_psl(gov_roll)

	// FLN player may now Build/Convert units in these two countries as if a Front were there
	// and Government may begin to mobilize the Border Zone. See 11.22.
	game.is_morocco_tunisia_independent = true
	ensure_front_in_independent_morocco_tunisia()
}

function goto_morocco_tunisia_independence() {
	if (game.is_morocco_tunisia_independent || game.scenario === "1958" || game.scenario === "1960") {
		// If this event is rolled again, or if playing the 1958 or 1960 scenarios,
		// FLN player instead rolls on the Mission Success Table (no DRM) and gets that number of AP
		// (represents infiltration of small numbers of weapons and troops through the borders).
		log_h3("Infiltration through borders.")
		let roll = roll_1d6()
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
	log_h3("NATO pressures France to boost European defense.")
	// The Government player rolls 1d6 and must remove that number of French Army brigades
	// (a division counts as three brigades) from the map.
	game.phasing = GOV_NAME
	set_active_player()

	let roll = roll_1d6()
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
		log("Removed from map (can re-mobilize next turn):")
		for (let u of list) {
			remove_unit(u, ELIMINATED)
			game.events.gov_remobilize.push(u)
		}
		delete game.events.gov_remove_num
		end_random_event()
	}
}

function goto_suez_crisis() {
	log_h3("Suez Crisis.")
	if (game.events.suez_crisis || game.scenario === "1958" || game.scenario === "1960") {
		// Treat as "No Event" if rolled again, or playing 1958 or 1960 scenarios.
		log("No Event.")
		end_random_event()
		return
	}
	game.phasing = GOV_NAME
	set_active_player()
	game.events.suez_crisis = true

	// The Government player must remove 1d6 elite units from the map, up to the number actually available
	let roll = roll_1d6()
	game.selected = []
	let num_el_x = count_friendly_units_on_map_of_type(EL_X)
	let to_remove = Math.min(roll, num_el_x)
	if (to_remove) {
		game.events.gov_remove_num = to_remove
		game.state = "event_gov_suez_crisis_select_units"
	} else {
		log("No French elite units to remove")
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
			game.events.gov_return = {}
		log("Removed from map (will return):")
		for (let u of list) {
			let loc = unit_loc(u)
			remove_unit(u, ELIMINATED)
			game.events.gov_return[u] = loc
		}
		delete game.events.gov_remove_num
		end_random_event()
	}
}

function goto_amnesty() {
	log_h3("Amnesty")
	log("Gov. Civil Affairs & Suppression +1 DRM this turn.")
	game.events.amnesty = true
	end_random_event()
}

function goto_jean_paul_sartre() {
	log_h3("Jean-Paul Sartre writes article condemning the war.")
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
		log_h3("French Reaction: FLN PSL > Gov. PSL")
		log_br()
		game.events.french_reaction = true
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
		log(`OAS placed in A${to}`)

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

	logi(`U${u} into A${to}`)
}

function is_slow_french_reaction() {
	return game.slow_french_reaction && !game.events.french_reaction
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
		log("Mobilized:")
		for (let u of list) {
			mobilize_unit(u, to)
		}
		let cost = mobilization_cost(list)
		lower_gov_psl(cost)
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
		log("Activated:")
		for (let u of list) {
			let loc = unit_loc(u)
			logi(`U${u} in A${loc}`)
			set_unit_box(u, OPS)
		}
		// cost can be fraction
		let cost = activation_cost(list)
		if (cost)
			lower_gov_psl(cost)
	},
	remove() {
		let list = game.selected
		game.selected = []
		push_undo()
		log("Removed:")
		for (let u of list) {
			remove_unit(u)
		}
	},
	acquire_air_point() {
		push_undo()
		log("+1 Air PTS")
		// logi(`Paid ${COST_AIR_POINT} PSP`)
		lower_gov_psl(COST_AIR_POINT)
		game.air_avail += 1
		game.air_max += 1
		if (is_slow_french_reaction())
			game.events.gov_has_mobilized = true
	},
	acquire_helo_point() {
		push_undo()
		log("+1 Helo PTS")
		// logi(`Paid ${COST_HELO_POINT} PSP`)
		lower_gov_psl(COST_HELO_POINT)
		game.helo_avail += 1
		game.helo_max += 1
		if (is_slow_french_reaction())
			game.events.gov_has_mobilized = true
	},
	acquire_naval_point() {
		push_undo()
		log("+1 Naval PTS")
		// log(`Paid  ${COST_NAVAL_POINT} PSP`)
		lower_gov_psl(COST_NAVAL_POINT)
		game.naval += 1
		if (is_slow_french_reaction())
			game.events.gov_has_mobilized = true
	},
	activate_border_zone() {
		push_undo()
		log("Border Zone Activated")
		// logi(`Paid ${COST_ACTIVATE_BORDER_ZONE} PSP`)
		lower_gov_psl(COST_ACTIVATE_BORDER_ZONE)
		game.border_zone_active = true
	},
	mobilize_border_zone() {
		push_undo()
		log("Border Zone Mobilized")
		// logi(`Paid ${COST_BORDER_ZONE} PSP`)
		lower_gov_psl(COST_BORDER_ZONE)
		game.border_zone_drm = 0
		game.events.border_zone_mobilized = true
	},
	improve_border_zone() {
		push_undo()
		log("Border Zone Improved")
		// logi(`Paid ${COST_BORDER_ZONE} PSP`)
		lower_gov_psl(COST_BORDER_ZONE)
		game.border_zone_drm -= 1
	},
	end_reinforcement() {
		// PSL rounded down as cost can be fractions
		game.gov_psl = Math.floor(game.gov_psl)
		delete game.events.gov_has_mobilized

		goto_fln_reinforcement_phase()
	}
}

function give_fln_ap() {
	// Give AP
	log_h3("Areas under FLN control")
	for_each_algerian_map_area(loc => {
		let control_ap = 0
		let summary = []
		if (is_area_urban(loc)) {
			// He gets 5 AP for each Urban area he controls, or 2 AP if the area is contested but he has non-neutralized units there.
			summary.push('Urban')
			if (is_area_fln_control(loc)) {
				summary.push('Control')
				control_ap += 5
			} else if (has_friendly_not_neutralized_unit_in_loc(loc)) {
				summary.push('Units')
				control_ap += 2
			}
		} else if (is_area_rural(loc)) {
			// He gets 2 AP for each Rural area he controls, and 1 if the area is contested but he has non-neutralized units there.
			summary.push('Rural')
			if (is_area_fln_control(loc)) {
				summary.push('Control')
				control_ap += 2
			} else if (has_friendly_not_neutralized_unit_in_loc(loc)) {
				summary.push('Units')
				control_ap += 1
			}
		}
		// If an area is Terrorized, he gets 1 fewer AP than he normally would.
		if (is_area_terrorized(loc)) {
			summary.push("Terrorized")
			control_ap -= 1
		}
		if (control_ap > 0) {
			log(`A${loc} (` + summary.join(", ") + ")")
			raise_fln_ap(control_ap)
		}
	})

	// The FLN PSL
	// He gets AP equal to 10% (round fractions up) of his current PSL, minus the number of French Naval Points.
	let psl_percentage = Math.ceil(0.10 * game.fln_psl)
	let psl_ap = Math.max(psl_percentage - game.naval, 0)
	log(`10% of PSL (- ${game.naval} Naval PTS)`)
	if (psl_ap) {
		raise_fln_ap(psl_ap)
	}
}

function ensure_front_in_independent_morocco_tunisia() {
	// If Morocco & Tunisia are independent, make sure we have a Front there
	if (game.is_morocco_tunisia_independent) {
		if (!has_unit_type_in_loc(FRONT, MOROCCO)) {
			let u = find_free_unit_by_type(FRONT)
			deploy_unit(u, MOROCCO)
		}
		if (!has_unit_type_in_loc(FRONT, TUNISIA)) {
			let u = find_free_unit_by_type(FRONT)
			deploy_unit(u, TUNISIA)
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
	log_br()

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
	log(`Built U${u} in A${where}`)
	set_unit_loc(u, where)
	set_unit_box(u, UG)
	let cost = build_cost(where)
	game.fln_ap -= cost
	logi(`Paid ${cost} AP`)
}

function convert_fln_unit(u, type) {
	let loc = unit_loc(u)
	let n = find_free_unit_by_type(type)
	log(`Converted U${u} to U${n} in A${loc}`)
	set_unit_loc(n, loc)
	set_unit_box(n, UG)
	free_unit(u)
	let cost = convert_cost(type)
	game.fln_ap -= cost
	logi(`Paid ${cost} AP`)
}

states.fln_reinforcement = {
	inactive: "to do Reinforcement",
	prompt() {
		if (!game.selected.length) {
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
		} else {
			let first_unit = game.selected[0]
			let first_unit_loc = unit_loc(first_unit)
			let first_unit_type = unit_type(first_unit)

			// Allow deselect
			gen_action_unit(first_unit)
			view.actions.undo = 1

			if (first_unit_type === FRONT) {
				view.prompt = "Reinforcement: Front can build Cadre or Band."
				// The FLN player may build new Cadres or Bands by spending the AP cost and placing them in the UG box of any area which contains a non-Neutralized Front
				// (note that this requires the presence of a Front)
				if (has_free_unit_by_type(CADRE) && game.fln_ap >= build_cost(first_unit_loc))
					gen_action("build_cadre")
				if (has_free_unit_by_type(BAND) && game.fln_ap >= build_cost(first_unit_loc))
					gen_action("build_band")
				if (has_free_unit_by_type(CADRE) && !is_area_morocco_or_tunisia(first_unit_loc))
					gen_action("convert_front_to_cadre")

			} else if (first_unit_type === CADRE) {
				view.prompt = "Reinforcement: Convert Cadre."
				// Fronts may not be created in Remote areas (not enough people) and there may be only one Front per area.
				if (!(has_unit_type_in_loc(FRONT, first_unit_loc) || is_area_remote(first_unit_loc)) && has_free_unit_by_type(FRONT) && game.fln_ap >= convert_cost(FRONT)) {
					gen_action("convert_cadre_to_front")
				}
				if (has_free_unit_by_type(BAND) && game.fln_ap >= convert_cost(BAND))
					gen_action("convert_cadre_to_band")
			} else if (first_unit_type === BAND) {
				view.prompt = "Reinforcement: Convert Band."
				if (has_free_unit_by_type(FAILEK) && game.fln_ap >= convert_cost(FAILEK))
					gen_action("convert_band_to_failek")
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
	build_cadre() {
		let unit = pop_selected()
		let loc = unit_loc(unit)
		push_undo()
		build_fln_unit(CADRE, loc)
	},
	build_band() {
		let unit = pop_selected()
		let loc = unit_loc(unit)
		push_undo()
		build_fln_unit(BAND, loc)
	},
	convert_front_to_cadre() {
		let unit = pop_selected()
		push_undo()
		convert_fln_unit(unit, CADRE)
	},
	convert_cadre_to_front() {
		let unit = pop_selected()
		push_undo()
		convert_fln_unit(unit, FRONT)
	},
	convert_cadre_to_band() {
		let unit = pop_selected()
		push_undo()
		convert_fln_unit(unit, BAND)
	},
	convert_band_to_failek() {
		let unit = pop_selected()
		push_undo()
		convert_fln_unit(unit, FAILEK)
	},
	end_reinforcement() {
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
	game.deployed = []
	game.mode_changed = []
}

function can_airmobilize_any_unit() {
	let result = false
	for_each_friendly_unit_on_map(u => {
		if (can_airmobilize_unit(u) && airmobilize_cost([u]) <= game.helo_avail)
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
				log(`U${u} in A${loc} on PTL`)
				set_unit_box(u, PTL)
			} else {
				log(`U${u} in A${loc}`)
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
			log(`U${u} in A${loc} set to Concentrated`)
			clear_unit_dispersed(u)
		} else {
			log(`U${u} in A${loc} set to Dispersed`)
			set_unit_dispersed(u)
		}
		set_add(game.mode_changed, u)
	},
	end_deployment() {
		delete game.deployed
		delete game.mode_changed
		goto_fln_deployment_phase()
	}
}

function goto_fln_deployment_phase() {
	game.phasing = FLN_NAME
	set_active_player()
	log_h2(`${game.active} Deployment`)
	game.state = "fln_deployment"
	game.selected = []

	// Reset Cadre in France automatically.
	for_each_friendly_unit_in_loc(FRANCE, u => {
		set_unit_box(u, UG)
	})
}

states.fln_deployment = {
	inactive: "to do Deployment",
	prompt() {
		view.prompt = "Deploy units to OPS in same area."
		if (!game.selected.length) {
			for_each_friendly_unit_on_map_box(UG, u => {
				let loc = unit_loc(u)
				if (is_unit_not_neutralized(u) && !is_area_morocco_or_tunisia(loc) && !(is_area_france(loc) && game.deploy_cadre_france))
					gen_action_unit(u)
			})

			gen_action("end_deployment")
		} else {
			let first_unit = game.selected[0]
			let first_unit_loc = unit_loc(first_unit)
			let first_unit_type = unit_type(first_unit)

			view.actions.undo = 1

			// Allow deselect && more units in same box
			for_each_friendly_unit_in_loc_box(first_unit_loc, UG, u => {
				if (is_unit_not_neutralized(u)) {
					gen_action_unit(u)
				}
			})

			if (is_area_algerian(first_unit_loc)) {
				gen_action_loc(first_unit_loc)
			} else if (is_area_france(first_unit_loc) && !game.deploy_cadre_france) {
				// The Cadre unit in France may be deployed to any Area where there is a Front unit.
				// you either send 1 Cadre there, in the Deployment Phase, or remove it. Not Both
				let has_front = false
				for_each_friendly_unit_on_map_of_type(FRONT, u => {
					gen_action_loc(unit_loc(u))
					has_front = true
				})
				if (has_front) {
					view.prompt = "Deploy Cadre to Area with Front."
				}
			}

			if (!game.deploy_cadre_france && first_unit_type == CADRE && game.selected.length === 1 && !has_friendly_unit_in_loc(FRANCE) && !is_area_urban(first_unit_loc)) {
				view.prompt = "Deploy units to OPS in same area (or Cadre to France)."
				// deploy single Cadre to France
				gen_action_loc(FRANCE)
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
		if (is_area_france(to))
			game.deploy_cadre_france = true
		for (let u of list) {
			let loc = unit_loc(u)
			if (loc === to) {
				log(`U${u} in A${loc}`)
				if (unit_box(u) === UG) {
					set_unit_box(u, OPS)
				} else {
					set_unit_box(u, UG)
				}
			} else {
				log(`U${u} to A${to}`)
				set_unit_loc(u, to)
				set_unit_box(u, UG)
			}
			if (is_area_france(loc))
				game.deploy_cadre_france = true
		}
	},
	end_deployment() {
		end_deployment()
	}
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
	game.fln_ops = 0
	game.gov_ops = 0

	// In Algeria, the OAS marker will automatically conduct one Suppression mission in the Operations Phase, at no cost in PSP and no requirement for a Police unit.
	if (is_area_algerian(game.oas)) {
		log_h2("OAS Operation")
		let loc = game.oas
		log_h3(`Suppression in A${loc}`)
		do_suppression(loc)

		// Whatever the result of the mission, it will automatically cause a Terror marker to be placed in the Area (if there isn't one there already).
		if (!is_area_terrorized(loc)) {
			logi("Area terrorized")
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

	// XXX backwards compatiblity for ongoing games; replace with game.fln_ops += 1
	game.fln_ops = (game.fln_ops ?? 0) + 1
	log_h2(`${game.active} Operation ${game.fln_ops}`)
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
		gen_action("auto_pass")
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
		log("Lets Government do a Mission")
		goto_gov_operations_phase()
	},
	pass() {
		fln_pass()
	},
	auto_pass() {
		game.fln_auto_pass = true
		fln_pass()
	}
}

function fln_pass() {
	if (game.fln_auto_pass) {
		log("FLN Auto Passes")
	} else {
		log("FLN Passes")
	}
	game.passes += 1
	if (game.passes >= 2) {
		end_operations_phase()
	} else {
		goto_gov_operations_phase()
	}
}

function goto_fln_propaganda_mission() {
	push_undo()
	game.passes = 0
	game.state = "fln_propaganda"
	game.selected = []
}

function reduce_unit(u, type) {
	let loc = unit_loc(u)
	let box = unit_box(u)
	let n = find_free_unit_by_type(type)
	log(`Reduced U${u} to U${n} in A${loc}`)
	if (is_fln_unit) {
		raise_gov_psl(2)
		lower_fln_psl(1)
		set_delete(game.contacted, u)
		set_add(game.contacted, n)
	}
	set_unit_loc(n, loc)
	set_unit_box(n, box)
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

		log_h3(`Propaganda in A${loc}`)
		log(`by U${unit}`)

		// pay cost & update flags
		logi(`Paid ${FLN_PROPAGANDA_COST} AP`)
		game.fln_ap -= FLN_PROPAGANDA_COST
		set_area_propagandized(loc)
		set_unit_box(unit, OC)

		let roll = roll_1d6()
		let patrol = count_patrol_units_in_loc(loc)
		if (patrol) {
			logi(`-${patrol} Patrol`)
			roll -= patrol
		}
		if (is_area_terrorized(loc)) {
			logi(`-1 Terrorized`)
			roll -= 1
		}
		let [result, effect] = roll_mst(roll)
		if (is_area_urban(loc)) {
			logi('x2 Urban')
			result *= 2
		}
		log_br()

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
	log(`${game.active} to Distribute ${psp} PSP`)
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

		log_h3(`Strike in A${loc}`)
		if (assist) {
			log(`by U${front_unit} (with ${assist} Cadre)`)
		} else {
			log(`by U${front_unit}`)
		}

		// pay cost & update flags
		logi(`Paid ${FLN_STRIKE_COST} AP`)
		game.fln_ap -= FLN_STRIKE_COST
		set_area_struck(loc)
		for (let u of list) {
			set_unit_box(u, OC)
			set_add(game.contacted, u)
		}

		let roll = roll_1d6()
		if (assist) {
			logi(`+${assist} Assist`)
			roll += assist
		}
		let patrol = count_patrol_units_in_loc(loc)
		if (patrol) {
			logi(`-${patrol} Patrol`)
			roll -= patrol
		}
		if (is_area_terrorized(loc)) {
			logi(`-1 Terrorized`)
			roll -= 1
		}
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
			log(`all Police units in A${loc} neutralized`)
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

		log_h3(`Move from A${loc} to A${to}`)
		log(`by U${unit}`)

		let roll = roll_1d6()
		// Note that the die roll is modified by the number of Government units on Patrol in the area moved to, not from.
		let patrol = count_patrol_units_in_loc(to)
		if (patrol) {
			logi(`-${patrol} Patrol`)
			roll -= patrol
		}
		if (is_border_crossing(loc, to) && game.border_zone_active) {
			logi(`${game.border_zone_drm} Border Zone`)
			roll += game.border_zone_drm
		}
		let [_result, effect] = roll_mst(roll)
		log_br()

		if (effect === '+') {
			eliminate_unit(unit)
		} else {
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

		log_h3(`Raid in A${loc}`)
		if (assist) {
			log(`(with ${assist} assist)`)
		}

		// pay cost & update flags
		logi(`Paid ${FLN_RAID_COST} AP`)
		game.fln_ap -= FLN_RAID_COST
		set_area_raided(loc)
		for (let u of list) {
			set_unit_box(u, OC)
			set_add(game.contacted, u)
		}

		let roll = roll_1d6()
		if (assist) {
			logi(`+${assist} Assist`)
			roll += assist
		}
		let patrol = count_patrol_units_in_loc(loc)
		if (patrol) {
			logi(`-${patrol} Patrol`)
			roll -= patrol
		}
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
			logi("Area terrorized")
			set_area_terrorized(loc)
		} else if (effect === '@') {
			// good result: 1 Police unit neutralized, area is Terrorized
			let done = false
			for_each_enemy_unit_in_loc(loc, u => {
				if (!done && is_police_unit(u)) {
					neutralize_unit(u)
					done = true
				}
			})
			logi("Area terrorized")
			set_area_terrorized(loc)
		}

		end_fln_mission()
	}
}

function goto_fln_harass_mission() {
	push_undo()
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

	if (game.combat.harass) {
		log_h3(`Harass in A${loc}`)
	} else {
		log_h3(`Combat in A${loc}`)
	}

	// Result is the number of 'hits' on enemy units.

	let fln_firepower = 0
	for (let u of game.combat.fln_units) {
		fln_firepower += unit_firepower(u)
	}
	log(`FLN firepower ${fln_firepower}`)
	game.combat.hits_on_gov = roll_crt(fln_firepower)
	logi(`Hits on Gov. ${game.combat.hits_on_gov}`)
	log_br()

	let gov_firepower = 0
	for (let u of game.combat.gov_units) {
		gov_firepower += unit_firepower(u)
		// move airmobile units to combat
		if (is_unit_airmobile(u) && unit_loc(u) !== loc)
			set_unit_loc(u, loc)
	}
	let half_str = ''
	if (game.combat.harass) {
		// When units fire at half Firepower Rating, round fractions up.
		gov_firepower = Math.ceil(gov_firepower / 2)
		half_str = " (half)"
	}
	if (game.mission_air_pts) {
		logi(`Using ${game.mission_air_pts} Air PTS`)
		let roll = roll_nd6(game.mission_air_pts)
		gov_firepower += roll
	}
	log(`Gov. firepower ${gov_firepower}${half_str}`)
	game.combat.hits_on_fln = roll_crt(gov_firepower)
	logi(`Hits on FLN ${game.combat.hits_on_fln}`)
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

	if (game.combat.hits_on_gov > game.combat.hits_on_fln) {
		logi(`Gov. units neutralized`)
		for (let u of game.combat.gov_units) {
			neutralize_unit(u)
		}
	} else if (game.combat.hits_on_gov < game.combat.hits_on_fln && game.combat.fln_units.length) {
		logi(`FLN units neutralized`)
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
	log(`FLN to Distribute losses`)
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

states.fln_combat_fln_losses = {
	inactive: "to distribute combat losses",
	prompt() {
		view.prompt = `Distribute ${game.combat.distribute_fln_hits} hit(s) as losses.`

		// each 'hit' on FLN units eliminates one Cadre or Band, or reduces a Front to a Cadre, or reduces a Failek to a Band (FLN player chooses how to distribute his losses).
		if (has_fln_combat_unit(CADRE))
			gen_action("eliminate_cadre")
		if (has_fln_combat_unit(BAND))
			gen_action("eliminate_band")
		if (has_fln_combat_unit(FRONT))
			gen_action("reduce_front")
		if (has_fln_combat_unit(FAILEK))
			gen_action("reduce_failek")
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
	// XXX backwards compatiblity for ongoing games; replace with game.gov_ops += 1
	game.gov_ops = (game.gov_ops ?? 0) + 1
	log_h2(`${game.active} Operation ${game.gov_ops}`)
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
	if (game.gov_auto_pass) {
		log("Government Auto Passes")
	} else {
		log("Government Passes")
	}
	game.passes += 1
	if (game.passes >= 2) {
		end_operations_phase()
	} else {
		goto_fln_operations_phase()
	}
}

function goto_gov_flush_mission() {
	push_undo()
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
	return has_gov_react_units_in_loc(loc)
}

states.gov_flush = {
	inactive: "to do Flush mission",
	prompt() {
		view.prompt = "Flush: Select location."
		let has_loc = false
		for_each_algerian_map_area(loc => {
			if (has_enemy_unit_in_loc_boxes(loc, [OPS, OC]) && has_gov_react_units_in_loc(loc)) {
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

		log_h3(`Flush in A${loc}`)
		// Total the Contact Ratings of Government units participating in the mission.
		let contact_ratings = 0
		for (let u of list) {
			contact_ratings += unit_contact(u)
			// move airmobile units to combat
			if (is_unit_airmobile(u) && unit_loc(u) !== loc)
				set_unit_loc(u, loc)
		}
		log(`Combined Gov. contact ${contact_ratings}`)

		// (DRM: +1 if target unit has an Evasion rating higher than the total Contact ratings involved,
		// or Flush is in a Remote area, or if a Terror marker is present; -1 if Flush is in an Urban area).

		for_each_enemy_unit_in_loc_boxes(loc, [OPS, OC], u => {
			log(`U${u}`)

			let roll = roll_1d6()
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

		for_each_friendly_unit_on_map(u => {
			if ((can_airmobilize_unit(u) && (cost + airmobilize_cost([u]) <= game.helo_avail)) || set_has(game.selected, u))
				gen_action_unit(u)
		})

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
		log(`Airmobilized (using ${cost} Helo PTS):`)
		for (let u of list) {
			let loc = unit_loc(u)
			logi(`U${u} in A${loc}`)
			set_unit_airmobile(u)
		}
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
		log("Gov. doesn't React")
		end_gov_mission()
	},
	roll() {
		let list = game.selected
		game.selected = []
		let loc = unit_loc(game.contacted[0])
		clear_undo()

		log_h3(`React in A${loc}`)
		delete game.events.must_react

		// FLN player has a chance to evade to the UG box.
		// Units roll 1d6 individually, and move to the UG box if they roll equal to or less than their Evasion Rating.
		log("Evasion:")
		for (let u of game.contacted) {
			log(`U${u}`)
			let roll = roll_1d6()
			if (roll <= unit_evasion(u)) {
				logi("Evades to UG")
				evade_unit(u)
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

		log_h3(`Intelligence in A${loc}`)
		//  The Government player pays 1 PSP, indicates the area, totals the Contact Ratings of the non-neutralized Police units there
		lower_gov_psl(GOV_INTELLIGENCE_COST, false)
		let contact_ratings = 0
		for_each_friendly_unit_in_loc(loc, u => {
			if (is_intelligence_unit(u))
				contact_ratings += unit_contact(u)

		})
		log(`Combined Gov. contact ${contact_ratings}`)

		// (DRM: +1 if target unit has an Evasion rating higher than the total Contact ratings involved,
		// or mission is in a Remote area, or if a Terror marker is present; -1 if mission is in an Urban area).

		for_each_enemy_unit_in_loc_boxes(loc, [UG], u => {
			log(`U${u}`)

			let roll = roll_1d6()
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
				logi(`Contact`)
				set_unit_box(u, OC)
			} else {
				logi(`No contact`)
			}
		})

		end_gov_mission()
	}
}

function goto_gov_civil_affairs_mission() {
	push_undo()
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

		log_h3(`Civil Affairs in A${loc}`)
		lower_gov_psl(GOV_CIVIL_AFFAIRS_COST, false)
		set_area_civil_affaired(loc)

		// rolls 1d6, applies any DRM and reads the result off the Mission Success Table.
		// A DRM of +1 is applied if the "Amnesty" random event is in effect.
		let roll = roll_1d6()
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
	game.passes = 0
	game.state = "gov_suppression"
	game.selected_loc = -1
}

function do_suppression(loc, assist=0) {
	// can also be initiated by OAS
	set_area_suppressed(loc)

	// rolls 1d6, applies any DRM and reads the result off the Mission Success Table.
	// Elite units may assist in this mission, each one yielding a +1 DRM.
	// A DRM of +1 is applied if the "Amnesty" random event is in effect.
	let roll = roll_1d6()
	if (assist) {
		logi(`+${assist} Assist`)
		roll += assist
	}
	if (game.events.amnesty) {
		logi("+1 Amnesty")
		roll += 1
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
		logi("No Bands/Faileks to neutralize")
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
			logi("Area terrorized")
			set_area_terrorized(loc)
		}
	} else if (effect === '+') {
		logi("Backfired")
		let roll = roll_1d6()
		lower_gov_psl(roll)
		if (!is_area_terrorized(loc)) {
			logi("Area terrorized")
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

		log_h3(`Suppression in A${loc}`)
		let assist = count_not_neutralized_unit_type_in_loc(EL_X, loc)
		if (assist) {
			log(`(with ${assist} Elite)`)
		}

		lower_gov_psl(GOV_SUPPRESSION_COST, false)
		do_suppression(loc, assist)
		end_gov_mission()
	}
}

function goto_gov_population_resettlement_mission() {
	push_undo()
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

		log_h3(`Population Resettlement in A${loc}`)
		lower_gov_psl(GOV_POPULATION_RESETTLEMENT_COST, false)
		set_area_remote(loc)
		set_area_terrorized(loc)
		logi("Area terrorized & now Remote")

		let fln_award = roll_nd6(3)
		raise_fln_psl(fln_award)

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
		log("Penality for not Reacting")
		// Government must react with at least 1 unit, otherwise -1d6 PSP
		let roll = roll_1d6()
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
	delete game.fln_ops
	delete game.gov_ops
	clear_combat()
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
			// logi(`Contested`)
			set_area_contested(loc)
			return
		}

		log(`A${loc} (FLN ${fln_pts[loc]} - Gov. ${gov_pts[loc]})`)

		if (fln_pts[loc] >= 2 * gov_pts[loc]) {
			logi(`FLN Control`)
			set_area_fln_control(loc)
			return
		} else if (gov_pts[loc] >= 2 * fln_pts[loc]) {
			logi(`Gov. Control`)
			set_area_gov_control(loc)
			return
		}

		// If one side has less than twice as many Points, take the difference of the two totals
		// Both sides then roll 1d6 trying to get equal to or less than that number.
		let fln_roll = roll_d6()
		logi(`FLN rolled B${fln_roll}`)
		let gov_roll = roll_d6()
		logi(`Gov. rolled B${gov_roll}`)

		let fln_claim = fln_roll <= difference
		let gov_claim = gov_roll <= difference
		// If one side succeeds, then he gets Control. If both or neither succeed, then the area remains Contested and no marker is placed.
		if (fln_claim && !gov_claim) {
			logi(`FLN Control`)
			set_area_fln_control(loc)
		} else if (gov_claim && !fln_claim) {
			logi(`Gov. Control`)
			set_area_gov_control(loc)
		} else {
			logi(`Contested`)
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

function gov_depreciate_asset(title, num_max) {
	log(`${title} ${num_max}`)
	let loss = depreciation_loss_number(num_max)
	let roll = roll_1d6()
	if (game.gov_psl <= 30) {
		logi("-1 Gov. PSL ≤ 30")
		roll -= 1
	}
	if (game.gov_psl >= 70) {
		logi("+1 Gov. PSL ≥ 70")
		roll += 1
	}
	if (roll <= loss) {
		num_max = Math.max(num_max - loss, 0)
		logi(`${title} -${loss}`)
	} else {
		logi(`No change`)
	}
	return num_max
}

function gov_depreciation() {
	if (!game.air_max && !game.helo_max) {
		return;
	}

	log_h3("Government Asset Depreciation")
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

	log_h3("FLN unused AP Depreciation")
	let roll = roll_1d6()
	if (game.fln_psl <= 30) {
		logi("-1 FLN PSL ≤ 30")
		roll -= 1
	}
	if (game.fln_psl >= 70) {
		logi("+1 FLN PSL ≥ 70")
		roll += 1
	}
	let loss = depreciation_loss_number(game.fln_ap)
	if (roll <= loss) {
		game.fln_ap = Math.max(game.fln_ap - loss, 0)
		logi(`AP -${loss}`)
	} else {
		logi(`No change`)
	}
}

function unit_and_area_recovery() {
	log_h3("Recovery of Neutralized Units")
	for_each_neutralized_unit_in_algeria(u => {
		let loc = unit_loc(u)
		log(`U${u} in A${loc}`)

		let roll = roll_1d6()
		if (is_fln_unit(u) && game.fln_psl <= 30) {
			logi("-1 FLN PSL ≤ 30")
			roll -= 1
		}
		if (is_fln_unit(u) && game.fln_psl >= 70) {
			logi("+1 FLN PSL ≥ 70")
			roll += 1
		}
		if (is_gov_unit(u) && game.gov_psl <= 30) {
			logi("-1 Gov. PSL ≤ 30")
			roll -= 1
		}
		if (is_gov_unit(u)) {
			if (game.gov_psl >= 70) {
				logi("+1 Gov. PSL ≥ 70")
				roll += 1
			} else if (is_elite_unit(u)) {
				logi("+1 Elite")
				roll += 1
			}
		}

		if (roll >= 5) {
			logi("Recovered")
			clear_unit_neutralized(u)
		} else {
			logi("Not recovered")
		}
	})

	log_h3("Recovery of Terrorized Areas")
	for_each_algerian_map_area(loc => {
		if (is_area_terrorized(loc)) {
			log(`A${loc}`)
			let roll = roll_1d6()
			if (!has_fln_not_neutralized_unit_in_loc(loc)) {
				logi("+1 no active FLN")
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
	log_h3("Redeployment")
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
	let coup = roll_nd6(2)
	if (oas_drm) {
		logi("+1 OAS deployed in France")
		coup += 1
	}
	let delta_psp = 0

	const prefix="Outcome: "
	if (coup === 2) {
		log(`${prefix}Wild success`) //: +3d6 PSP, mobilize 2d6 PSP of units for free
		delta_psp = roll_nd6(3)
		if (oas_drm) {
			logi("+1 OAS deployed in France")
			delta_psp += 1
		}
		raise_gov_psl(delta_psp)
		return 'wild_success'
	} else if (coup <= 4) {
		log(`${prefix}Big success`) //: +2d6 PSP, mobilize 1d6 PSP of units for free
		delta_psp = roll_nd6(2)
		if (oas_drm) {
			logi("+1 OAS deployed in France")
			delta_psp += 1
		}
		raise_gov_psl(delta_psp)
		return 'big_success'
	} else if (coup <= 6) {
		log(`${prefix}Success`) //: +1d6 PSP
		delta_psp = roll_1d6()
		if (oas_drm) {
			logi("+1 OAS deployed in France")
			delta_psp += 1
		}
		raise_gov_psl(delta_psp)
		return 'success'
	} else if (coup === 7) {
		log(`${prefix}Fizzle`) //: -1d6 PSP
		delta_psp = roll_1d6()
		if (oas_drm) {
			logi("+1 OAS deployed in France")
			delta_psp += 1
		}
		lower_gov_psl(delta_psp)
		return 'fizzle'
	} else if (coup <= 9) {
		log(`${prefix}Failure`) //: -2d6 PSP, remove 1 elite unit from the game
		delta_psp = roll_nd6(2)
		if (oas_drm) {
			logi("+1 OAS deployed in France")
			delta_psp += 1
		}
		lower_gov_psl(delta_psp)
		return 'failure'
	} else {
		log(`${prefix}Abject failure`) //: -3d6 PSP, remove 1d6 elite units from the game
		delta_psp = roll_nd6(3)
		if (oas_drm) {
			logi("+1 OAS deployed in France")
			delta_psp += 1
		}
		lower_gov_psl(delta_psp)
		return 'abject_failure'
	}
}

function coup_attempt() {
	log_h3("Coup attempt")
	let result = roll_coup_table(is_area_france(game.oas))
	if (check_victory())
		return

	// mobilize / remove units
	switch (result) {
	case 'wild_success':
		log("mobilize 2d6 PSP of units for free")
		goto_coup_attempt_free_mobilize(roll_nd6(2))
		break
	case 'big_success':
		log("mobilize 1d6 PSP of units for free")
		goto_coup_attempt_free_mobilize(roll_1d6())
		break
	case 'success':
	case 'fizzle':
		continue_final_psl_adjustment()
		break
	case 'failure':
		log("remove 1 elite unit from the game")
		goto_coup_attempt_remove_elite(1)
		break
	case 'abject_failure':
		log("remove 1d6 elite units from the game")
		goto_coup_attempt_remove_elite(roll_1d6())
		break
	default:
		throw Error("Unknown coup result: " + result)
	}
}

function goto_coup_attempt_free_mobilize(value) {
	game.phasing = GOV_NAME
	set_active_player()

	game.selected = []
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
		log("Mobilized for free:")
		for (let u of list) {
			mobilize_unit(u, to)
		}
		let cost = mobilization_cost(list)
		game.events.gov_free_mobilize -= cost
	},
	done() {
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
		log("No French elite units to remove")
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

		log("Removed:")
		for (let u of list) {
			remove_unit(u, ELIMINATED)
		}
		log_sep()
		delete game.events.gov_remove_num
		continue_final_psl_adjustment()
	}
}

function final_psl_adjustment() {
	log_h3("Final PSL Adjustment")

	if (game.gov_psl <= 30) {
		log_br()
		log("Gov. PSL ≤ 30: Coup d'etat?")
		let roll = roll_1d6()
		if (is_area_france(game.oas)) {
			logi("+1 OAS deployed in France")
			roll += 1
		}
		if (roll >= 6) {
			coup_attempt()
			return
		} else {
			logi("No Coup attempt.")
		}
	}
	continue_final_psl_adjustment()
}

function continue_final_psl_adjustment() {
	game.state = "turn_interphase"

	if (game.oas) {
		log_br()
		if (is_area_algerian(game.oas)) {
			log("OAS deployed in Algeria")
			lower_gov_psl(1)
		} else if (is_area_france(game.oas)) {
			log("OAS deployed in France")
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
		log("Areas Terrorized or Resettled")
		lower_gov_psl(gov_area_adjust)
		if (check_victory())
			return
	}

	if (!has_fln_not_neutralized_mobile_unit_in_algeria()) {
		log_br()
		log("No non-neutralized FLN mobile units present in Algeria")
		let roll = roll_nd6(3)
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
			log("Total Firepower of FLN mobile units in Morocco and/or Tunisia x 10%")
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
	log(`Area control FLN ${fln_control} - Gov. ${gov_control}`)
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

function roll_1d6() {
	let roll = roll_d6()
	log("Rolled B" + roll)
	return roll
}

function roll_nd6(n) {
	clear_undo()
	let result = 0
	let summary = []
	for (let i = 0; i < n; ++i) {
		let roll = roll_d6()
		result += roll
		summary.push("B" + roll)
	}
	log("Rolled " + summary.join(" "))
	return result
}

const MST = [0, 0, 1, 1, 1, 2, 2, 3, 4, 5]
const MST_EFFECT = ['+', '+', '+', '', '', '', '', '@', '@', '@']

function roll_mst(roll) {
	let num = clamp(roll, -1, 8)
	let result = MST[num + 1]
	let effect = MST_EFFECT[num + 1]
	let effect_str = ''
	if (effect === '+') effect_str = ' (bad)'
	if (effect === '@') effect_str = ' (good)'
	log(`Mission Result ${result}${effect}${effect_str}`)

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

function roll_crt(firepower) {
	let roll = roll_1d6()
	let result = combat_result(firepower, roll)
	log(`Combat Result ${result}`)
	return result
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

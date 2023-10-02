"use strict"

/* global view, player, data, send_action, action_button, scroll_with_middle_mouse */

const SCALE = 1.8033333333333332

const DEPLOY = 1
const ELIMINATED = 2

// const UG = 0
// const OPS = 1
// const PTL = 2
// const OC = 3
// const BOXES = [UG, OPS, PTL, OC]

const area_count = 31
const unit_count = 120

function is_gov_unit(u) { return (u >= 0 && u <= 39) }
function is_fln_unit(u) { return (u >= 40 && u <= 119) }

function set_has(set, item) {
	if (!set)
		return false
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

let ui = {
	board: document.getElementById("map"),
	map: document.getElementById("map"),
	favicon: document.getElementById("favicon"),
	header: document.querySelector("header"),
	status: document.getElementById("status"),
	player: [
		document.getElementById("role_FLN"),
		document.getElementById("role_Government"),
	],
	markers: {
		turn: document.getElementById("turn_now"),
		fln_psl: document.getElementById("fln_psl"),
		fln_ap: document.getElementById("fln_ap"),
		gov_psl: document.getElementById("gov_psl"),
		air_avail: document.getElementById("air_avail"),
		air_max: document.getElementById("air_max"),
		helo_avail: document.getElementById("helo_avail"),
		helo_max: document.getElementById("helo_max"),
		naval: document.getElementById("naval"),
		border_zone: document.getElementById("border_zone"),

	},
	tracker: [],
	drm: [],
	areas: [],
	boxes: [],
	locations: [],
	zones: [],
	units: [],
	units_holder: document.getElementById("units"),
	fln_supply: document.getElementById("fln_supply"),
	gov_supply: document.getElementById("gov_supply"),
	eliminated: document.getElementById("eliminated"),
}

// remote (1 bit), terrorized (1 bit), gov control (1 bit), fln control (1 bit)

const AREA_FLN_CONTROL_SHIFT = 0
const AREA_FLN_CONTROL_MASK = 1 << AREA_FLN_CONTROL_SHIFT

const AREA_GOV_CONTROL_SHIFT = 1
const AREA_GOV_CONTROL_MASK = 1 << AREA_GOV_CONTROL_SHIFT

const AREA_TERRORIZED_SHIFT = 2
const AREA_TERRORIZED_MASK = 1 << AREA_TERRORIZED_SHIFT

const AREA_REMOTE_SHIFT = 3
const AREA_REMOTE_MASK = 1 << AREA_REMOTE_SHIFT

// area control

function is_area_fln_control(l) {
	return (view.areas[l] & AREA_FLN_CONTROL_MASK) === AREA_FLN_CONTROL_MASK
}

function is_area_gov_control(l) {
	return (view.areas[l] & AREA_GOV_CONTROL_MASK) === AREA_GOV_CONTROL_MASK
}

function is_area_contested(l) {
	return !(is_area_fln_control(l) || is_area_gov_control(l))
}

// terrorized

function is_area_terrorized(l) {
	return (view.areas[l] & AREA_TERRORIZED_MASK) === AREA_TERRORIZED_MASK
}

// remote

function is_area_remote(l) {
	return (view.areas[l] & AREA_REMOTE_MASK) === AREA_REMOTE_MASK
}

// === UNIT STATE ===

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

function is_unit_neutralized(u) {
	return (view.units[u] & UNIT_NEUTRALIZED_MASK) === UNIT_NEUTRALIZED_MASK
}

function unit_loc(u) {
	return (view.units[u] & UNIT_LOC_MASK) >> UNIT_LOC_SHIFT
}

function unit_box(u) {
	return (view.units[u] & UNIT_BOX_MASK) >> UNIT_BOX_SHIFT
}

function is_unit_airmobile(u) {
	return (view.units[u] & UNIT_AIRMOBILE_MASK) === UNIT_AIRMOBILE_MASK
}

function is_unit_dispersed(u) {
	return (view.units[u] & UNIT_DISPERSED_MASK) === UNIT_DISPERSED_MASK
}

function is_unit_moved(u) {
	return set_has(view.moved, u)
}

function is_unit_action(unit) {
	return !!(view.actions && view.actions.unit && view.actions.unit.includes(unit))
}

function is_unit_selected(unit) {
	if (Array.isArray(view.selected))
		return view.selected.includes(unit)
	return view.selected === unit
}

function is_loc_action(x) {
	return !!(view.actions && view.actions.loc && view.actions.loc.includes(x))
}

let action_register = []

function register_action(e, action, id) {
	e.my_action = action
	e.my_id = id
	e.onmousedown = on_click_action
	action_register.push(e)
}

function on_click_action(evt) {
	if (evt.button === 0)
		if (send_action(evt.target.my_action, evt.target.my_id))
			evt.stopPropagation()
}

function is_action(action, arg) {
	if (arg === undefined)
		return !!(view.actions && view.actions[action] === 1)
	return !!(view.actions && view.actions[action] && view.actions[action].includes(arg))
}

let on_init_once = false

function build_units() {
	function build_unit(u) {
		let side = is_gov_unit(u) ? "gov" : "fln"
		let elt = ui.units[u] = document.createElement("div")
		let klass = data.units[u].class
		elt.className = `counter unit ${side} u${u} ${klass}`
		elt.addEventListener("mousedown", on_click_unit)
		// elt.addEventListener("mouseenter", on_focus_unit)
		// elt.addEventListener("mouseleave", on_blur)
		elt.unit = u
	}
	for (let u = 0; u < unit_count; ++u) {
		build_unit(u)
	}
}

function on_click_loc(evt) {
	if (evt.button === 0) {
		let loc = parseInt(evt.target.dataset.loc)
		console.log('loc', loc)
		if (send_action('loc', loc))
			evt.stopPropagation()
	}
}

function on_click_unit(evt) {
	if (evt.button === 0) {
		console.log('unit', evt.target.unit, data.units[evt.target.unit])
		send_action('unit', evt.target.unit)
	}
}

function create_tracker(i, x, y) {
	let e = ui.tracker[i] = document.createElement("div")
	e.dataset.id = i
	e.className = "space stack"
	e.style.left = x / SCALE + "px"
	e.style.top = y / SCALE + "px"
	e.style.width = 85 / SCALE + "px"
	e.style.height = 85 / SCALE + "px"
	document.getElementById("tracker").appendChild(e)
}

function create_border_zone(i) {
	let e = ui.drm[i] = document.createElement("div")
	e.dataset.id = i
	e.className = "space"
	e.style.left = (288.2 + (i * 99)) / SCALE + "px"
	e.style.top = 396 / SCALE + "px"
	e.style.width = 94 / SCALE + "px"
	e.style.height = 94 / SCALE + "px"
	document.getElementById("drm").appendChild(e)
}

const COUNTRY = 4

function create_area(i, area_id, type) {
	let e = ui.areas[i] = document.createElement("div")
	e.id = `area-${area_id}`
	e.dataset.loc = data.areas[i].loc
	e.className = "space"
	e.addEventListener("mousedown", on_click_loc)
	e.style.left = data.areas[i].x / SCALE + "px"
	e.style.top = data.areas[i].y / SCALE + "px"
	if (type !== COUNTRY) {
		e.style.width = 193 / SCALE + "px"
		e.style.height = 193 / SCALE + "px"
	} else {
		e.style.width = data.areas[i].w / SCALE + "px"
		e.style.height = data.areas[i].h / SCALE + "px"
	}
	document.getElementById("areas").appendChild(e)
}

function create_box(i, area_id, box_id) {
	let e = ui.boxes[i * 4 + box_id] = document.createElement("div")
	e.id = `ops-${area_id}-${box_id}`
	e.dataset.loc = data.areas[i].loc
	e.className = "space stack"
	e.addEventListener("mousedown", on_click_loc)
	e.style.left = (data.areas[i].x + (box_id % 2) * 99) / SCALE + "px"
	e.style.top = (data.areas[i].y + Math.floor(box_id / 2) * 99) / SCALE + "px"
	e.style.width = 94 / SCALE + "px"
	e.style.height = 94 / SCALE + "px"
	document.getElementById("boxes").appendChild(e)
}

function on_init() {
	if (on_init_once)
		return
	on_init_once = true

	// Tracker
	let x = 5
	let y = 5
	for (let i = 0; i < 100; ++i) {
		create_tracker(i, x, y)

		if (i < 29) {
			x += 90
		} else if (i < 50) {
			y += 90
		} else if (i < 79) {
			x -= 90
		} else {
			y -= 90
		}
	}

	// Border Zone DRM
	for (let i = 0; i < 4; ++i) {
		create_border_zone(i)
	}

	// Areas
	for (let i = 0; i < data.areas.length; ++i) {
		let area_id = data.areas[i].id
		let type = data.areas[i].type
		if (type) {
			create_area(i, area_id, type)

			// Unit Boxes
			if (type !== COUNTRY) {				
				for (let box_id = 0; box_id < 4; ++box_id) {
					create_box(i, area_id, box_id)
				}
			} else {
				create_box(i, area_id, 0)
			}
		}
	}

	build_units()
}

function update_unit(e, u) {
	e.classList.toggle("disrupted", is_unit_neutralized(u))
	e.classList.toggle("airmobile", is_unit_airmobile(u))
	e.classList.toggle("dispersed", is_unit_dispersed(u))
	e.classList.toggle("action", !view.battle && is_unit_action(u))
	e.classList.toggle("selected", !view.battle && is_unit_selected(u))
	e.classList.toggle("moved", is_unit_moved(u))
	e.classList.toggle("eliminated", unit_loc(u) === ELIMINATED)
}

function update_map() {
	console.log("VIEW", view)
	ui.tracker[view.turn].appendChild(ui.markers.turn)
	ui.tracker[view.fln_ap].appendChild(ui.markers.fln_ap)
	ui.tracker[view.fln_psl].appendChild(ui.markers.fln_psl)
	ui.tracker[view.gov_psl].appendChild(ui.markers.gov_psl)
	ui.tracker[view.air_avail].appendChild(ui.markers.air_avail)
	ui.tracker[view.air_max].appendChild(ui.markers.air_max)
	ui.tracker[view.helo_avail].appendChild(ui.markers.helo_avail)
	ui.tracker[view.helo_max].appendChild(ui.markers.helo_max)
	ui.tracker[view.naval].appendChild(ui.markers.naval)

	ui.drm[-view.border_zone_drm].appendChild(ui.markers.border_zone)
	ui.markers.border_zone.classList.toggle("hide", view.border_zone_drm === null)
	ui.markers.border_zone.classList.toggle("neutralized", !view.border_zone_active)

	for (let u = 0; u < unit_count; ++u) {
		let e = ui.units[u]
		let loc = unit_loc(u)
		e.dataset.loc = loc

		if (loc) {
			if (loc === DEPLOY) {
				if (is_gov_unit(u) && !ui.gov_supply.contains(e))
					ui.gov_supply.appendChild(e)
				if (is_fln_unit(u) && !ui.fln_supply.contains(e))
					ui.fln_supply.appendChild(e)

			} else if (loc === ELIMINATED) {
				if (!ui.eliminated.contains(e))
					ui.eliminated.appendChild(e)
			} else {
				let box_id = unit_box(u)
				if (!ui.boxes[loc * 4 + box_id].contains(e))
					ui.boxes[loc * 4 + box_id].appendChild(e)
			}
			update_unit(e, u)
		} else {
			e.remove()
		}
	}

	for (let i = 0; i < ui.areas.length; ++i) {
		let e = ui.areas[i]
		if (e) {
			let loc = parseInt(e.dataset.loc)
			e.classList.toggle("action", is_loc_action(loc))
		}
	}
}

function on_update() { // eslint-disable-line no-unused-vars
	on_init()

	update_map()

	for (let e of action_register)
		e.classList.toggle("action", is_action(e.my_action, e.my_id))

	action_button("end_deployment", "End deployment")
	action_button("roll", "Roll")

	// gov reinfircement
	action_button("mobilization", "Mobilization")
	action_button("activation", "Activation")
	action_button("acquire_assets", "Acquire assets")

	action_button("acquire_air_point", "+1 Air Point")
	action_button("acquire_helo_point", "+1 Helo Point")
	action_button("acquire_naval_point", "+1 Naval Point")
	action_button("mobilize_border_zone", "Mobilize Border Zone")
	action_button("improve_border_zone", "Improve Border Zone")

	action_button("end_reinforcement", "End reinforcement")


	action_button("done", "Done")
	action_button("undo", "Undo")
    action_button("restart", "Restart")
}


function on_log(text) { // eslint-disable-line no-unused-vars
	let p = document.createElement("div")

	if (text.match(/^>/)) {
		text = text.substring(1)
		p.className = "i"
	}

	if (text.match(/^\.h1/)) {
		text = text.substring(4)
		p.className = 'h1'
	}
	else if (text.match(/^\.h2/)) {
		text = text.substring(4)
		p.className = 'h2'
	}
	else if (text.match(/^\.h3/)) {
		text = text.substring(4)
		p.className = 'h3'
	}

	p.innerHTML = text
	return p
}

scroll_with_middle_mouse("main")

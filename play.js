"use strict"

/* global action_button, data, scroll_into_view, send_action, view */

const SCALE = 1.8033333333333332

const FLN = 0
const GOV = 1

const DEPLOY = 1
const ELIMINATED = 2

// const UG = 0
// const OPS = 1
// const PTL = 2
// const OC = 3
// const BOXES = [UG, OPS, PTL, OC]
const BOX_NAMES = ["UG", "OPS", "PTL", "OC"]

// const area_count = 31
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

// :r !python3 tools/genlayout.py
// BEGIN LAYOUT DATA
const LAYOUT = {
	"Laghouat-OC": [846, 972],
	"Laghouat-PTL": [648, 999],
	"Laghouat-OPS": [806, 882],
	"Laghouat-UG": [631, 896],
	"Laghouat-MK": [727, 906],
	"Ain Sefra-OC": [465, 1008],
	"Ain Sefra-PTL": [365, 1009],
	"Ain Sefra-OPS": [485, 927],
	"Ain Sefra-UG": [263, 999],
	"Ain Sefra-MK": [323, 961],
	"Mascara-OC": [523, 815],
	"Mascara-PTL": [453, 838],
	"Mascara-OPS": [523, 751],
	"Mascara-UG": [454, 766],
	"Mascara-MK": [440, 714],
	"Saida-OC": [379, 883],
	"Saida-PTL": [303, 896],
	"Saida-OPS": [363, 782],
	"Saida-UG": [295, 782],
	"Saida-MK": [301, 839],
	"Mecheria-OC": [218, 919],
	"Mecheria-PTL": [156, 928],
	"Mecheria-OPS": [213, 817],
	"Mecheria-UG": [153, 828],
	"Mecheria-MK": [228, 866],
	"Mostaganem-OC": [494, 618],
	"Mostaganem-PTL": [436, 567],
	"Mostaganem-OPS": [473, 435],
	"Mostaganem-UG": [418, 468],
	"Mostaganem-MK": [500, 556],
	"Sidi Bel Abbes-OC": [368, 639],
	"Sidi Bel Abbes-PTL": [301, 680],
	"Sidi Bel Abbes-OPS": [338, 545],
	"Sidi Bel Abbes-UG": [251, 552],
	"Sidi Bel Abbes-MK": [256, 631],
	"Tlemcen-OC": [183, 738],
	"Tlemcen-PTL": [122, 703],
	"Tlemcen-OPS": [183, 661],
	"Tlemcen-UG": [112, 629],
	"Tlemcen-MK": [130, 556],
	"Orleansville-OC": [620, 574],
	"Orleansville-PTL": [571, 526],
	"Orleansville-OPS": [631, 496],
	"Orleansville-UG": [572, 450],
	"Orleansville-MK": [631, 436],
	"Medea-OC": [751, 491],
	"Medea-PTL": [701, 538],
	"Medea-OPS": [768, 426],
	"Medea-UG": [701, 432],
	"Medea-MK": [771, 368],
	"Ain Qussera-OC": [696, 794],
	"Ain Qussera-PTL": [613, 749],
	"Ain Qussera-OPS": [699, 642],
	"Ain Qussera-UG": [601, 661],
	"Ain Qussera-MK": [655, 689],
	"Sidi Aissa-OC": [860, 744],
	"Sidi Aissa-PTL": [791, 781],
	"Sidi Aissa-OPS": [870, 641],
	"Sidi Aissa-UG": [786, 613],
	"Sidi Aissa-MK": [769, 731],
	"Bougie-OC": [1029, 424],
	"Bougie-PTL": [972, 424],
	"Bougie-OPS": [1030, 365],
	"Bougie-UG": [973, 365],
	"Bougie-MK": [1047, 303],
	"Bordj Bou Arreridj-OC": [893, 543],
	"Bordj Bou Arreridj-PTL": [836, 544],
	"Bordj Bou Arreridj-OPS": [893, 485],
	"Bordj Bou Arreridj-UG": [837, 485],
	"Bordj Bou Arreridj-MK": [945, 539],
	"Tizi Ouzou-OC": [903, 411],
	"Tizi Ouzou-PTL": [845, 411],
	"Tizi Ouzou-OPS": [902, 353],
	"Tizi Ouzou-UG": [845, 353],
	"Tizi Ouzou-MK": [845, 262],
	"Biskra-OC": [1146, 993],
	"Biskra-PTL": [1004, 968],
	"Biskra-OPS": [1216, 926],
	"Biskra-UG": [988, 858],
	"Biskra-MK": [1083, 889],
	"Batna-OC": [1284, 859],
	"Batna-PTL": [1143, 812],
	"Batna-OPS": [1303, 781],
	"Batna-UG": [1113, 737],
	"Batna-MK": [1182, 749],
	"Tebessa-OC": [1330, 704],
	"Tebessa-PTL": [1249, 688],
	"Tebessa-OPS": [1366, 642],
	"Tebessa-UG": [1175, 639],
	"Tebessa-MK": [1231, 619],
	"Barika-OC": [1027, 714],
	"Barika-PTL": [954, 737],
	"Barika-OPS": [1082, 621],
	"Barika-UG": [962, 595],
	"Barika-MK": [957, 662],
	"Souk Ahras-OC": [1386, 551],
	"Souk Ahras-PTL": [1329, 550],
	"Souk Ahras-OPS": [1391, 490],
	"Souk Ahras-UG": [1327, 488],
	"Souk Ahras-MK": [1381, 400],
	"Constantine-OC": [1227, 263],
	"Constantine-PTL": [1170, 263],
	"Constantine-OPS": [1227, 204],
	"Constantine-UG": [1170, 204],
	"Constantine-MK": [1280, 151],
	"Philippeville-OC": [1244, 540],
	"Philippeville-PTL": [1251, 456],
	"Philippeville-OPS": [1306, 402],
	"Philippeville-UG": [1249, 344],
	"Philippeville-MK": [1306, 307],
	"Setif-OC": [1139, 541],
	"Setif-PTL": [1043, 523],
	"Setif-OPS": [1164, 376],
	"Setif-UG": [1104, 408],
	"Setif-MK": [1157, 467],
	"Algiers-OC": [742, 282],
	"Algiers-PTL": [685, 282],
	"Algiers-OPS": [742, 223],
	"Algiers-UG": [685, 223],
	"Algiers-MK": [771, 168],
	"Oran-OC": [319, 415],
	"Oran-PTL": [263, 415],
	"Oran-OPS": [319, 356],
	"Oran-UG": [263, 356],
	"Oran-MK": [343, 300],
	"Morocco-UG": [87, 1005],
	"Tunisia-UG": [1412, 951],
	"France-UG": [963, 162],
	"France-MK": [1013, 128],
}
// END LAYOUT DATA

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
	ap: document.querySelector("#role_FLN .role_ap"),
	psl: [
		document.querySelector("#role_FLN .role_psl"),
		document.querySelector("#role_Government .role_psl"),
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
	area_markers: [],
	boxes: [],
	locations: [],
	zones: [],
	units: [],
	units_holder: document.getElementById("units"),
	fln_supply_panel: document.getElementById("fln_supply_panel"),
	gov_supply_panel: document.getElementById("gov_supply_panel"),
	eliminated_panel: document.getElementById("eliminated_panel"),
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

// terrorized

function is_area_terrorized(l) {
	return (view.areas[l] & AREA_TERRORIZED_MASK) === AREA_TERRORIZED_MASK
}

// remote

function is_area_remote(l) {
	return (view.areas[l] & AREA_REMOTE_MASK) === AREA_REMOTE_MASK
}

function is_area_country(l) {
	return data.areas[l].type === COUNTRY
}

function is_area_oas_active(l) {
	return view.oas === l
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

function is_unit_contacted(u) {
	return set_has(view.contacted, u)
}

function is_unit_eliminated(u) {
	return unit_loc(u) === ELIMINATED
}

function is_unit_action(unit) {
	return !!(view.actions && view.actions.unit && view.actions.unit.includes(unit))
}

function is_unit_selected(unit) {
	if (Array.isArray(view.selected))
		return view.selected.includes(unit)
	return view.selected === unit
}

function is_loc_selected(loc) {
	if (Array.isArray(view.selected_loc))
		return view.selected_loc.includes(loc)
	return view.selected_loc === loc
}

function is_loc_action(x) {
	return !!(view.actions && view.actions.loc && view.actions.loc.includes(x))
}

let on_init_once = false

function on_focus_unit(evt) {
	document.getElementById("status").textContent = data.units[evt.target.unit].name
}

function on_blur(_evt) {
	document.getElementById("status").textContent = ""
}

function build_units() {
	function build_unit(u) {
		let side = is_gov_unit(u) ? "gov" : "fln"
		let elt = ui.units[u] = document.createElement("div")
		let klass = data.units[u].class
		elt.className = `counter unit ${side} u${u} ${klass}`
		elt.addEventListener("mousedown", on_click_unit)
		elt.addEventListener("mouseenter", on_focus_unit)
		elt.addEventListener("mouseleave", on_blur)
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
	e.className = "space stack m"
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

function create_area(i, _area_id, area_name, _type) {
	let area_name_css = area_name.replaceAll(' ', '-')
	let e = ui.areas[i] = document.querySelector(`#svgmap #areas #${area_name_css}`)
	e.dataset.loc = data.areas[i].loc
	e.addEventListener("mousedown", on_click_loc)
}

function create_area_markers(i, area_id, area_name) {
	const box_size = 95 / SCALE
	console.log(i, area_id, area_name)
	let [x, y] = LAYOUT[area_name + '-MK']

	let e = document.createElement("div")
	e.id = `area-marker-${area_id}`
	e.dataset.loc = data.areas[i].loc
	e.className = "space stack"
	e.style.left = x - (box_size / 2) + "px"
	e.style.top = y - (box_size / 2) + "px"
	e.style.width = box_size + "px"
	e.style.height = box_size + "px"
	document.getElementById("area_markers").appendChild(e)

	ui.area_markers[i] = {}

	for (let marker of ['remote', 'fln_control', 'gov_control', 'terror', 'oas_active']) {
		let em = ui.area_markers[i][marker] = document.createElement("div")
		em.id = `area-marker-${i}-${marker}`
		em.className = `counter ${marker}`
		e.appendChild(em)
	}
}

function create_box(i, area_id, area_name, box_id) {
	const box_size = 90 / SCALE
	let [x, y] = LAYOUT[area_name + '-' + BOX_NAMES[box_id]]

	let e = ui.boxes[i * 4 + box_id] = document.createElement("div")
	e.id = `ops-${area_id}-${box_id}`
	e.dataset.loc = data.areas[i].loc
	e.className = "space stack"
	e.addEventListener("mousedown", on_click_loc)
	e.style.left = x - (box_size / 2) + "px"
	e.style.top = y - (box_size / 2) + "px"
	e.style.width = box_size + "px"
	e.style.height = box_size + "px"
	document.getElementById("boxes").appendChild(e)
	return e
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
		let area_name = data.areas[i].name
		let type = data.areas[i].type
		if (type) {
			create_area(i, area_id, area_name, type)

			if (type !== COUNTRY) {
				// Area markers
				create_area_markers(i, area_id, area_name)

				// Unit Boxes
				for (let box_id = 0; box_id < 4; ++box_id) {
					create_box(i, area_id, area_name, box_id)
				}
			} else {
				let e = create_box(i, area_id, area_name, 0)

				if (area_id === "FRANCE") {
					ui.area_markers[i] = {}
					let marker = 'oas_active'
					let em = ui.area_markers[i][marker] = document.createElement("div")
					em.id = `area-marker-${i}-${marker}`
					em.className = `counter ${marker}`
					e.appendChild(em)
				}
			}
		}
	}

	build_units()
}

function update_unit(e, u) {
	e.classList.toggle("neutralized", is_unit_neutralized(u))
	e.classList.toggle("airmobile", is_unit_airmobile(u))
	e.classList.toggle("fr_xx_dispersed", is_unit_dispersed(u))
	e.classList.toggle("action", is_unit_action(u))
	e.classList.toggle("selected", is_unit_selected(u))
	e.classList.toggle("contacted", is_unit_contacted(u))
	e.classList.toggle("eliminated", is_unit_eliminated(u))
}

Node.prototype.appendChildAnimated = function(e) {
	const { left: x0, top: y0 } = e.getBoundingClientRect()
	this.appendChild(e)
	if (!x0)
		return
	const { left: x1, top: y1 } = e.getBoundingClientRect()
	const dx = x0 - x1
	const dy = y0 - y1
	if (!dx && !dy)
		return

	const transformFrom = `translate3d(${dx}px, ${dy}px, 0)`
	const transformTo = `translate3d(0, 0, 0)`
	e.animate([
		{ transform: transformFrom },
		{ transform: transformTo },
	], {
		duration: 1000,
		easing: 'ease',
	})
}

function update_map() {
	console.log("VIEW", view)

	ui.player[FLN].classList.toggle("active", view.active === "FLN")
	ui.player[GOV].classList.toggle("active", view.active === "Government")

	ui.ap.textContent = view.fln_ap
	ui.psl[FLN].textContent = view.fln_psl
	ui.psl[GOV].textContent = view.gov_psl

	ui.tracker[view.turn % 100].appendChildAnimated(ui.markers.turn)
	ui.tracker[view.fln_ap].appendChildAnimated(ui.markers.fln_ap)
	ui.tracker[view.fln_psl].appendChildAnimated(ui.markers.fln_psl)
	ui.tracker[view.gov_psl].appendChildAnimated(ui.markers.gov_psl)
	ui.tracker[view.air_avail].appendChildAnimated(ui.markers.air_avail)
	ui.tracker[view.air_max].appendChildAnimated(ui.markers.air_max)
	ui.tracker[view.helo_avail].appendChildAnimated(ui.markers.helo_avail)
	ui.tracker[view.helo_max].appendChildAnimated(ui.markers.helo_max)
	ui.tracker[view.naval].appendChildAnimated(ui.markers.naval)

	// Hide avail markers when no Air / Helo at all
	ui.markers.air_avail.classList.toggle("hide", !view.air_max)
	ui.markers.helo_avail.classList.toggle("hide", !view.helo_max)

	ui.drm[-view.border_zone_drm].appendChildAnimated(ui.markers.border_zone)
	ui.markers.border_zone.classList.toggle("hide", view.border_zone_drm === null)
	ui.markers.border_zone.classList.toggle("neutralized", !view.border_zone_active)

	for (let u = 0; u < unit_count; ++u) {
		let e = ui.units[u]
		let loc = unit_loc(u)
		e.dataset.loc = loc

		if (loc) {
			if (loc === DEPLOY) {
				if (is_gov_unit(u) && !ui.gov_supply.contains(e))
					ui.gov_supply.appendChildAnimated(e)
				if (is_fln_unit(u) && !ui.fln_supply.contains(e))
					ui.fln_supply.appendChildAnimated(e)

			} else if (loc === ELIMINATED) {
				if (!ui.eliminated.contains(e))
					ui.eliminated.appendChildAnimated(e)
			} else {
				let box_id = unit_box(u)
				if (is_area_country(loc)) {
					// only single box in France, Morocco and Tunisia
					box_id = 0
				}
				if (!ui.boxes[loc * 4 + box_id].contains(e)) {
					ui.boxes[loc * 4 + box_id].appendChildAnimated(e)
				}
			}
			update_unit(e, u)
		} else {
			e.remove()
		}
	}

	// Hide supply panels when empty
	ui.fln_supply_panel.classList.toggle("hide", !(ui.fln_supply.childNodes.length - 1))
	ui.gov_supply_panel.classList.toggle("hide", !(ui.gov_supply.childNodes.length - 1))
	ui.eliminated_panel.classList.toggle("hide", !(ui.eliminated.childNodes.length - 1))

	for (let i = 0; i < ui.areas.length; ++i) {
		let e = ui.areas[i]
		if (e) {
			let loc = parseInt(e.dataset.loc)
			e.classList.toggle("action", is_loc_action(loc))
			e.classList.toggle("target", is_loc_selected(loc))

			let em = ui.area_markers[i]
			if (em) {
				if (!is_area_country(loc)) {
					em.fln_control.classList.toggle("hide", !is_area_fln_control(loc))
					em.gov_control.classList.toggle("hide", !is_area_gov_control(loc))
					em.remote.classList.toggle("hide", !is_area_remote(loc))
					em.terror.classList.toggle("hide", !is_area_terrorized(loc))
				}
				em.oas_active.classList.toggle("hide", !is_area_oas_active(loc))
			}
		}
	}
}

function on_update() { // eslint-disable-line no-unused-vars
	on_init()

	update_map()

	action_button("quick_setup", "Quick Setup")
	action_button("end_deployment", "End deployment")
	action_button("roll", "Roll")
	action_button("raise_fln_psl_1d6", "+1d6 FLN PSL")
	action_button("lower_gov_psl_1d6", "-1d6 Government PSL")
	action_button("zone_I", "I")
	action_button("zone_II", "II")
	action_button("zone_III", "III")
	action_button("zone_IV", "IV")
	action_button("zone_V", "V")
	action_button("zone_VI", "VI")

	// gov reinforcement
	action_button("mobilization", "Mobilization")
	action_button("activation", "Activation")
	action_button("acquire_assets", "Acquire assets")

	action_button("select_all_inactive", "Select All")
	action_button("acquire_air_point", "+1 Air")
	action_button("acquire_helo_point", "+1 Helo")
	action_button("acquire_naval_point", "+1 Naval")
	action_button("mobilize_border_zone", "Mobilize Border")
	action_button("improve_border_zone", "Improve Border")
	action_button("activate_border_zone", "Activate Border")
	action_button("remove", "Remove")
	action_button("activate", "Activate")


	action_button("build_cadre", "Build Cadre")
	action_button("build_band", "Build Band")
	action_button("convert_cadre_to_front", "Convert to Front")
	action_button("convert_cadre_to_band", "Convert to Band")
	action_button("convert_band_to_failek", "Convert to Failek")
	action_button("convert_front_to_cadre", "Convert to Cadre")

	action_button("end_reinforcement", "End reinforcement")

	action_button("change_division_mode", "Change Division Mode")
	action_button("end_deployment", "End deployment")

	action_button("propaganda", "Propaganda")
	action_button("strike", "Strike")
	action_button("move", "Move")
	action_button("raid", "Raid")
	action_button("harass", "Harass")

	action_button("flush", "Flush")
	action_button("intelligence", "Intelligence")
	action_button("civil_affairs", "Civil Affairs")
	action_button("suppression", "Suppression")
	action_button("population_resettlement", "Population Resettlement")

	action_button("gov_mission", "Government Mission")
	action_button("use_air_point", "Air Point")
	action_button("airmobilize", "Airmobilize")
	action_button("no_react", "No React")
	action_button("auto_pass", "Auto-Pass")
	action_button("pass", "Pass")

	action_button("add_fln_psl", "+1 FLN PSL")
	action_button("add_5_fln_psl", "+5 FLN PSL")
	action_button("remove_fln_psl", "-1 FLN PSL")
	action_button("remove_5_fln_psl", "-5 FLN PSL")
	action_button("add_gov_psl", "+1 Government PSL")
	action_button("add_5_gov_psl", "+5 Government PSL")
	action_button("remove_gov_psl", "-1 Government PSL")
	action_button("remove_5_gov_psl", "-5 Government PSL")

	action_button("eliminate_cadre", "Eliminate Cadre")
	action_button("eliminate_band", "Eliminate Band")
	action_button("reduce_front", "Reduce Front")
	action_button("reduce_failek", "Reduce Failek")

	action_button("end_turn", "End Turn")
	action_button("done", "Done")
	action_button("undo", "Undo")

	// XXX debug
	action_button("restart", "Restart")
	action_button("reset", "Reset")
}

const ICONS = {
	B0: '<span class="black d0"></span>',
	B1: '<span class="black d1"></span>',
	B2: '<span class="black d2"></span>',
	B3: '<span class="black d3"></span>',
	B4: '<span class="black d4"></span>',
	B5: '<span class="black d5"></span>',
	B6: '<span class="black d6"></span>',
	W0: '<span class="white d0"></span>',
	W1: '<span class="white d1"></span>',
	W2: '<span class="white d2"></span>',
	W3: '<span class="white d3"></span>',
	W4: '<span class="white d4"></span>',
	W5: '<span class="white d5"></span>',
	W6: '<span class="white d6"></span>',
}

function sub_icon(match) {
	return ICONS[match]
}

function on_focus_area_tip(x) { // eslint-disable-line no-unused-vars
	ui.areas[x].classList.add("tip")
}

function on_blur_area_tip(x) { // eslint-disable-line no-unused-vars
	ui.areas[x].classList.remove("tip")
}

function on_click_area_tip(x) { // eslint-disable-line no-unused-vars
	scroll_into_view(ui.areas[x])
}

function sub_area_name(_match, p1, _offset, _string) {
	let x = p1 | 0
	let n = data.areas[x].name
	return `<span class="tip" onmouseenter="on_focus_area_tip(${x})" onmouseleave="on_blur_area_tip(${x})" onclick="on_click_area_tip(${x})">${n}</span>`
}

function on_focus_unit_tip(x) { // eslint-disable-line no-unused-vars
	ui.units[x].classList.add("tip")
}

function on_blur_unit_tip(x) { // eslint-disable-line no-unused-vars
	ui.units[x].classList.remove("tip")
}

function on_click_unit_tip(x) { // eslint-disable-line no-unused-vars
	scroll_into_view(ui.units[x])
}

function sub_unit_name(_match, p1, _offset, _string) {
	let x = p1 | 0
	let n = data.units[x].name
	return `<span class="tip" onmouseenter="on_focus_unit_tip(${x})" onmouseleave="on_blur_unit_tip(${x})" onclick="on_click_unit_tip(${x})">${n}</span>`
}

function on_log(text) { // eslint-disable-line no-unused-vars
	let p = document.createElement("div")

	if (text.match(/^>/)) {
		text = text.substring(1)
		p.className = "i"
	}

	text = text.replace(/&/g, "&amp;")
	text = text.replace(/</g, "&lt;")
	text = text.replace(/>/g, "&gt;")
	text = text.replace(/U(\d+)/g, sub_unit_name)
	text = text.replace(/A(\d+)/g, sub_area_name)

	text = text.replace(/\b[BW]\d\b/g, sub_icon)

	if (text.match(/^\.h1/)) {
		text = text.substring(4)
		p.className = 'h1'
	}
	else if (text.match(/^\.h2/)) {
		text = text.substring(4)
		p.className = 'h2'
		if (text.match(/^FLN /)) {
			p.classList.add("fln")
		} else if (text.match(/^Government /)) {
			p.classList.add("gov")
		} else if (text.match(/^OAS /)) {
			p.classList.add("oas")
		} else {
			p.classList.add("both")
		}
	}
	else if (text.match(/^\.h3/)) {
		text = text.substring(4)
		p.className = 'h3'
	}

	p.innerHTML = text
	return p
}

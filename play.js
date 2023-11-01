"use strict"

/* global action_button, data, scroll_into_view, send_action, view */

function toggle_pieces() {
	document.getElementById("pieces").classList.toggle("hide")
}

const SCALE = 1.8

const FLN = 0
const GOV = 1

const FR_XX = 0
const FR_X = 1
const EL_X = 2
const AL_X = 3
const POL = 4
const FAILEK = 5
const BAND = 6
const CADRE = 7
const FRONT = 8

var FRANCE = data.locations["FRANCE"]
var MOROCCO = data.locations["MOROCCO"]
var TUNISIA = data.locations["TUNISIA"]

var ORAN = data.locations["ORAN"]
var ALGIERS = data.locations["ALGIERS"]
var CONSTANTINE = data.locations["CONSTANTINE"]

const OUT_OF_PLAY = 0
const DEPLOY = 1
const ELIMINATED = 2

const UG = 0
const OPS = 1
const PTL = 2
const OC = 3
const BOX_NAMES = ["UG", "OPS", "PTL", "OC"]

const area_type_names = [ "none", "rural", "urban", "remote", "country" ]

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
	"Laghouat-OC": [848, 974],
	"Laghouat-PTL": [650, 1000],
	"Laghouat-OPS": [807, 884],
	"Laghouat-UG": [632, 898],
	"Laghouat-MK": [734, 932],
	"Ain Sefra-OC": [466, 1010],
	"Ain Sefra-PTL": [366, 1011],
	"Ain Sefra-OPS": [486, 929],
	"Ain Sefra-UG": [263, 1001],
	"Ain Sefra-MK": [403, 952],
	"Mascara-OC": [524, 814],
	"Mascara-PTL": [454, 840],
	"Mascara-OPS": [524, 750],
	"Mascara-UG": [455, 767],
	"Mascara-MK": [510, 700],
	"Saida-OC": [379, 879],
	"Saida-PTL": [304, 898],
	"Saida-OPS": [364, 763],
	"Saida-UG": [296, 784],
	"Saida-MK": [360, 822],
	"Mecheria-OC": [221, 912],
	"Mecheria-PTL": [157, 930],
	"Mecheria-OPS": [213, 818],
	"Mecheria-UG": [153, 829],
	"Mecheria-MK": [205, 867],
	"Mostaganem-OC": [495, 619],
	"Mostaganem-PTL": [437, 568],
	"Mostaganem-OPS": [474, 436],
	"Mostaganem-UG": [419, 469],
	"Mostaganem-MK": [485, 513],
	"Sidi Bel Abbes-OC": [369, 640],
	"Sidi Bel Abbes-PTL": [301, 681],
	"Sidi Bel Abbes-OPS": [339, 526],
	"Sidi Bel Abbes-UG": [252, 533],
	"Sidi Bel Abbes-MK": [285, 625],
	"Tlemcen-OC": [193, 724],
	"Tlemcen-PTL": [122, 704],
	"Tlemcen-OPS": [183, 652],
	"Tlemcen-UG": [112, 630],
	"Tlemcen-MK": [164, 577],
	"Orleansville-OC": [630, 495],
	"Orleansville-PTL": [565, 460],
	"Orleansville-OPS": [622, 420],
	"Orleansville-UG": [557, 381],
	"Orleansville-MK": [570, 530],
	"Medea-OC": [752, 492],
	"Medea-PTL": [702, 539],
	"Medea-OPS": [769, 427],
	"Medea-UG": [702, 432],
	"Medea-MK": [700, 485],
	"Ain Qussera-OC": [698, 795],
	"Ain Qussera-PTL": [614, 750],
	"Ain Qussera-OPS": [700, 643],
	"Ain Qussera-UG": [602, 662],
	"Ain Qussera-MK": [685, 695],
	"Sidi Aissa-OC": [862, 745],
	"Sidi Aissa-PTL": [793, 783],
	"Sidi Aissa-OPS": [872, 643],
	"Sidi Aissa-UG": [788, 614],
	"Sidi Aissa-MK": [800, 680],
	"Bougie-OC": [1031, 405],
	"Bougie-PTL": [972, 402],
	"Bougie-OPS": [1035, 345],
	"Bougie-UG": [975, 343],
	"Bougie-MK": [1005, 450],
	"Bordj Bou Arreridj-OC": [894, 548],
	"Bordj Bou Arreridj-PTL": [838, 549],
	"Bordj Bou Arreridj-OPS": [895, 490],
	"Bordj Bou Arreridj-UG": [838, 490],
	"Bordj Bou Arreridj-MK": [952, 505],
	"Tizi Ouzou-OC": [900, 412],
	"Tizi Ouzou-PTL": [842, 412],
	"Tizi Ouzou-OPS": [905, 354],
	"Tizi Ouzou-UG": [840, 354],
	"Tizi Ouzou-MK": [905, 302],
	"Biskra-OC": [1148, 995],
	"Biskra-PTL": [1006, 970],
	"Biskra-OPS": [1218, 928],
	"Biskra-UG": [989, 859],
	"Biskra-MK": [1090, 904],
	"Batna-OC": [1287, 861],
	"Batna-PTL": [1145, 813],
	"Batna-OPS": [1306, 783],
	"Batna-UG": [1115, 739],
	"Batna-MK": [1218, 777],
	"Tebessa-OC": [1333, 706],
	"Tebessa-PTL": [1251, 690],
	"Tebessa-OPS": [1369, 643],
	"Tebessa-UG": [1178, 640],
	"Tebessa-MK": [1271, 628],
	"Barika-OC": [1029, 716],
	"Barika-PTL": [955, 739],
	"Barika-OPS": [1084, 622],
	"Barika-UG": [964, 596],
	"Barika-MK": [1001, 657],
	"Souk Ahras-OC": [1388, 552],
	"Souk Ahras-PTL": [1331, 551],
	"Souk Ahras-OPS": [1393, 491],
	"Souk Ahras-UG": [1329, 489],
	"Souk Ahras-MK": [1383, 401],
	"Constantine-OC": [1229, 224],
	"Constantine-PTL": [1172, 224],
	"Constantine-OPS": [1229, 165],
	"Constantine-UG": [1172, 165],
	"Constantine-MK": [1200, 280],
	"Philippeville-OC": [1246, 541],
	"Philippeville-PTL": [1253, 457],
	"Philippeville-OPS": [1308, 403],
	"Philippeville-UG": [1252, 345],
	"Philippeville-MK": [1322, 316],
	"Setif-OC": [1141, 542],
	"Setif-PTL": [1045, 524],
	"Setif-OPS": [1166, 377],
	"Setif-UG": [1106, 409],
	"Setif-MK": [1119, 473],
	"Algiers-OC": [743, 239],
	"Algiers-PTL": [686, 239],
	"Algiers-OPS": [743, 180],
	"Algiers-UG": [686, 180],
	"Algiers-MK": [715, 295],
	"Oran-OC": [317, 370],
	"Oran-PTL": [260, 370],
	"Oran-OPS": [317, 311],
	"Oran-UG": [260, 311],
	"Oran-MK": [290, 425],
	"Morocco-UG": [87, 1007],
	"Tunisia-UG": [1415, 953],
	"France-UG": [985, 175],
	"France-MK": [940, 110],
}
// END LAYOUT DATA

let ui = {
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
	container: document.getElementById("pieces"),
	tracker: [],
	drm: [],
	areas: [],
	areas_u: [],
	area_markers: [],
	boxes: [],
	locations: [],
	zones: [],
	units: [],
	fln_supply: document.getElementById("fln_supply"),
	gov_supply: document.getElementById("gov_supply"),
	eliminated: document.getElementById("eliminated"),
}

const LAYOUT_BOX = []

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

function unit_type(u) {
	return data.units[u].type
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

// === STACK LAYOUT ===

var stack_cache = []
var focus = null

document.querySelector("#map").addEventListener("mousedown", evt => {
	if (evt.button === 0)
		blur_stack()
})

function focus_stack(stack) {
	if (focus !== stack) {
		focus = stack
		update_map()
		return stack.length <= 1
	}
	return true
}

function blur_stack() {
	if (focus !== null) {
		focus = null
	}
	update_map()
}

function on_click_unit(evt) {
	if (evt.button === 0) {
		event.stopPropagation()
		if (focus_stack(evt.target.my_stack))
			send_action('unit', evt.target.my_id)
	}
}

function on_click_loc(evt) {
	if (evt.button === 0) {
		if (send_action('loc', evt.target.my_id))
			evt.stopPropagation()
	}
}

function on_focus_loc(evt) {
	document.getElementById("status").textContent = data.areas[evt.target.my_id].full_name
}

function on_focus_unit(evt) {
	document.getElementById("status").textContent = data.units[evt.target.my_id].name
}

function on_blur(_evt) {
	document.getElementById("status").textContent = ""
}

let LAYOUT_TRACK = []
let track_count = Array(100).fill(0)


function layout_track(track, e) {
	let n = track_count[track]
	let x = LAYOUT_TRACK[track][0] - 20
	let y = LAYOUT_TRACK[track][1] - 20

	let dx = 0
	let dy = 41

	const DIAG = 24

	if (track === 0)
		dx = DIAG, dy = DIAG
	else if (track === 29)
		dx = -DIAG, dy = DIAG
	else if (track === 50)
		dx = -DIAG, dy = -DIAG
	else if (track === 79)
		dx = DIAG, dy = -DIAG

	else if (track >= 30 && track <= 49)
		dx = -41, dy = 0
	else if (track >= 51 && track <= 78)
		dx = 0, dy = -41
	else if (track >= 80 && track <= 99)
		dx = 41, dy = 0

	e.style.left = x + (dx * n) + "px"
	e.style.top = y + (dy * n) + "px"
	e.style.zIndex = track * 4 + n

	track_count[track] = n + 1
}

function layout_stack(loc_id, box_id) {
	let stack_id = loc_id * 4 + box_id
	let stack = stack_cache[stack_id]
	if (!stack)
		stack = stack_cache[stack_id] = []

	stack.length = 0
	for (let u = 0; u < unit_count; ++u) {
		let loc = unit_loc(u)
		let box = loc < 6 ? 0 : unit_box(u)
		if (loc == loc_id && box === box_id)
			stack.push(ui.units[u])
	}

	let z = 1
	let x = LAYOUT_BOX[loc_id * 4 + box_id][0] - 22
	let y = LAYOUT_BOX[loc_id * 4 + box_id][1] - 22

	let dx = 4
	let dy = -4

	if (stack === focus) {
		if (loc_id === MOROCCO) {
			dx = 0
			dy = -45
		} else if (loc_id === TUNISIA) {
			dx = 0
			dy = -45
		} else {
			switch (box_id) {
			case UG: dx = 0, dy = -45; break
			case PTL: dx = -45, dy = 0; break
			case OPS: dx = 45, dy = 0; break
			case OC: dx = 0, dy = 45; break
			}
		}
	} else {
		if (loc_id === MOROCCO) {
			dx = 4
			dy = -14
		} else if (loc_id === TUNISIA) {
			dx = -4
			dy = -14
		}
		else if (stack.length < 4) {
			dx = 13
			dy = -13
		}
		else if (stack.length < 8) {
			dx = 8
			dy = -8
		}
	}

	// TODO: clamp x,y to fit on map

	for (let e of stack) {
		e.my_stack = stack
		e.style.left = x + "px"
		e.style.top = y + "px"
		e.style.zIndex = z++
		x += dx
		y += dy
	}
}

// === BUILD UI ===

let on_init_once = false

function build_units() {
	function build_unit(u) {
		let side = is_gov_unit(u) ? "gov" : "fln"
		let elt = ui.units[u] = document.createElement("div")
		let klass = data.units[u].class
		elt.className = `counter unit ${side} u${u} ${klass}`
		elt.addEventListener("mousedown", on_click_unit)
		elt.addEventListener("mouseenter", on_focus_unit)
		elt.addEventListener("mouseleave", on_blur)
		elt.my_id = u
	}
	for (let u = 0; u < unit_count; ++u) {
		build_unit(u)
	}
}

function create_tracker(i, x, y) {
	let e = ui.tracker[i] = document.createElement("div")
	if (i % 5 === 0)
		e.className = "box track5"
	else
		e.className = "box track1"
	e.style.left = x + "px"
	e.style.top = y + "px"
	e.textContent = i
	document.getElementById("decor").appendChild(e)
}

const DRM_X = 370
const DRM_Y = 140
const DRM_DX = 55
const DRM_DY = 0

function create_border_zone(i, label) {
	let e = document.createElement("div")
	e.className = "box drm_track"
	e.style.left = (DRM_X + i * DRM_DX) + "px"
	e.style.top = (DRM_Y + i * DRM_DY) + "px"
	e.textContent = label
	document.getElementById("boxes").appendChild(e)
}

const COUNTRY = 4

function create_area(i, _area_id, area_name, _type) {
	let area_name_css = area_name.replaceAll(' ', '-')
	let e = ui.areas[i] = document.querySelector(`#svgmap #${area_name_css}`)
	e.my_id = i
	e.addEventListener("mousedown", on_click_loc)
	e.addEventListener("mouseenter", on_focus_loc)
	e.addEventListener("mouseleave", on_blur)
}

function create_area_u(i, sel) {
	let e = document.querySelector(sel)
	e.my_id = i
	e.addEventListener("mousedown", on_click_loc)
	e.addEventListener("mouseenter", on_focus_loc)
	e.addEventListener("mouseleave", on_blur)
	return e
}

function create_area_markers(i, area_id, area_name) {
	const box_w = 150
	const box_h = 50

	let layout = LAYOUT[area_name + '-MK']
	if (!layout)
		return

	let [x, y] = layout

	let e = document.createElement("div")
	e.id = `area-marker-${area_id}`
	e.className = "area_markers"
	e.style.left = x - (box_w / 2) + "px"
	e.style.top = y - (box_h / 2) + "px"
	e.style.width = box_w + "px"
	e.style.height = box_h + "px"
	document.getElementById("boxes").appendChild(e)

	ui.area_markers[i] = {}

	for (let marker of ['remote', 'fln_control', 'gov_control', 'terror', 'oas_active']) {
		let em = ui.area_markers[i][marker] = document.createElement("div")
		em.id = `area-marker-${i}-${marker}`
		em.className = `counter ${marker} hide`
		e.appendChild(em)
	}
}

const box_type_w = [ 38*2+6, 30*2+6, 27*2, 27*2 ]
const box_type_h = [ 30*2+6, 30*2+6, 27*2, 27*2 ]

function create_box(i, area_id, area_name, box_id, show) {
	const box_w = box_type_w[box_id]
	const box_h = box_type_h[box_id]

	let [x, y] = LAYOUT[area_name + '-' + BOX_NAMES[box_id]]

	LAYOUT_BOX[i * 4 + box_id] = [x, y]

	if (show) {
		let sh = document.createElement("div")
		sh.className = "box " + BOX_NAMES[box_id].toLowerCase() + " " + area_type_names[data.areas[i].type]
		sh.addEventListener("mousedown", on_click_loc)
		sh.style.left = x - (box_w / 2) + "px"
		sh.style.top = y - (box_h / 2) + "px"
		sh.style.width = box_w + "px"
		sh.style.height = box_h + "px"
		document.getElementById("decor").appendChild(sh)

		let tx = document.createElement("div")
		tx.textContent = BOX_NAMES[box_id]
		tx.className = "box text"
		tx.style.left = x - (box_w/2) + "px"
		if (box_id === 0)
			tx.style.top = y - 5 + "px"
		else
			tx.style.top = y - 9 + "px"
		tx.style.width = (box_w) + "px"
		tx.style.height = 20 + "px"
		document.getElementById("decor").appendChild(tx)
	}
}

function on_init() {
	if (on_init_once)
		return
	on_init_once = true

	// Tracker
	let x = 3
	let y = 3
	for (let i = 0; i < 100; ++i) {
		LAYOUT_TRACK[i] = [x + 22, y + 22]
		create_tracker(i, x, y)
		if (i < 29) {
			x += 50
		} else if (i < 50) {
			y += 50
		} else if (i < 79) {
			x -= 50
		} else {
			y -= 50
		}
	}

	// Border Zone DRM
	create_border_zone(0, "0")
	create_border_zone(1, "-1")
	create_border_zone(2, "-2")
	create_border_zone(3, "-3")

	ui.areas_u[ORAN] = create_area_u(ORAN, "#svgmap #Oran-2")
	ui.areas_u[ALGIERS] = create_area_u(ALGIERS, "#svgmap #Algiers-2")
	ui.areas_u[CONSTANTINE] = create_area_u(CONSTANTINE, "#svgmap #Constantine-2")

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
				for (let box_id = 0; box_id < 4; ++box_id)
					create_box(i, area_id, area_name, box_id, true)
			} else {
				create_area_markers(i, area_id, area_name)
				create_box(i, area_id, area_name, 0, false)
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

function animate(e, x0, y0, x1, y1) {
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
		duration: 750,
		easing: 'ease',
	})
}

function update_map() {
	ui.player[FLN].classList.toggle("active", view.active === "FLN")
	ui.player[GOV].classList.toggle("active", view.active === "Government")

	ui.ap.textContent = view.fln_ap
	ui.psl[FLN].textContent = view.fln_psl
	ui.psl[GOV].textContent = view.gov_psl
	
	track_count.fill(0)
	layout_track(view.turn % 100, ui.markers.turn)
	layout_track(view.fln_ap, ui.markers.fln_ap)
	layout_track(view.fln_psl, ui.markers.fln_psl)
	layout_track(view.gov_psl, ui.markers.gov_psl)
	if (view.air_max)
		layout_track(view.air_avail, ui.markers.air_avail)
	layout_track(view.air_max, ui.markers.air_max)
	if (view.helo_max)
		layout_track(view.helo_avail, ui.markers.helo_avail)
	layout_track(view.helo_max, ui.markers.helo_max)
	layout_track(view.naval, ui.markers.naval)

	// Hide avail markers when no Air / Helo at all
	ui.markers.air_avail.classList.toggle("hide", !view.air_max)
	ui.markers.helo_avail.classList.toggle("hide", !view.helo_max)

	ui.markers.border_zone.style.left = 4 + DRM_X + DRM_DX * (-view.border_zone_drm) + "px"
	ui.markers.border_zone.style.top = 4 + DRM_Y + DRM_DY * (-view.border_zone_drm) + "px"

	ui.markers.border_zone.classList.toggle("hide", view.border_zone_drm === null)
	ui.markers.border_zone.classList.toggle("neutralized", !view.border_zone_active)

	for (let u = 0; u < unit_count; ++u) {
		let e = ui.units[u]
		let loc = unit_loc(u)
		switch (loc) {
			case OUT_OF_PLAY:
				e.remove()
				break
			case DEPLOY:
				if (is_gov_unit(u))
					ui.gov_supply.appendChild(e)
				if (is_fln_unit(u))
					ui.fln_supply.appendChild(e)
				break
			case ELIMINATED:
				ui.eliminated.appendChild(e)
				break
			default:
				if (e.parentElement !== ui.container)
					ui.container.appendChild(e)
				break
		}
		update_unit(e, u)
	}

	layout_stack(FRANCE, 0)
	layout_stack(MOROCCO, 0)
	layout_stack(TUNISIA, 0)

	for (let loc = 6; loc < data.areas.length; ++loc) {
		layout_stack(loc, 0)
		layout_stack(loc, 1)
		layout_stack(loc, 2)
		layout_stack(loc, 3)
	}

	for (let loc of [ ORAN, ALGIERS, CONSTANTINE ]) {
		ui.areas_u[loc].classList.toggle("action", is_loc_action(loc))
		ui.areas_u[loc].classList.toggle("target", is_loc_selected(loc))
	}

	for (let loc = 0; loc < data.areas.length; ++loc) {
		let e = ui.areas[loc]
		if (e) {
			e.classList.toggle("action", is_loc_action(loc))
			e.classList.toggle("target", is_loc_selected(loc))

			let em = ui.area_markers[loc]
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
	action_button("roll", "Roll")
	action_button("raise_fln_psl_1d6", "+1d6 FLN PSL")
	action_button("lower_gov_psl_1d6", "-1d6 Gov PSL")
	action_button("zone_I", "I")
	action_button("zone_II", "II")
	action_button("zone_III", "III")
	action_button("zone_IV", "IV")
	action_button("zone_V", "V")
	action_button("zone_VI", "VI")

	// gov reinforcement
	action_button("mobilization", "Mobilization")
	action_button("activation", "Activation")
	action_button("acquire_assets", "Acquire Assets")

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


	action_button("change_division_mode", "Change Division Mode")

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
	action_button("add_gov_psl", "+1 Gov PSL")
	action_button("add_5_gov_psl", "+5 Gov PSL")
	action_button("remove_gov_psl", "-1 Gov PSL")
	action_button("remove_5_gov_psl", "-5 Gov PSL")

	action_button("eliminate_cadre", "Eliminate Cadre")
	action_button("eliminate_band", "Eliminate Band")
	action_button("reduce_front", "Reduce Front")
	action_button("reduce_failek", "Reduce Failek")

	action_button("end_reinforcement", "End Reinforcement")
	action_button("end_deployment", "End Deployment")
	action_button("end_turn", "End Turn")
	action_button("done", "Done")
	action_button("undo", "Undo")
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
	let n = data.areas[x].full_name
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
	} else if (text.match(/^.hr$/)) {
		p.className = "hr";
		text = "";
	}

	p.innerHTML = text
	return p
}

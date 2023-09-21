"use strict"

/* global view, player, send_action, action_button, scroll_with_middle_mouse */

const SCALE = 1.80333333333333333333 

const RURAL = 0
const URBAN = 1
const REMOTE = 2
const COUNTRY = 3

const UG = 0
const OPS = 1
const PTL = 2
const OC = 3
// const BOXES = [UG, OPS, PTL, OC]
const BOX_NAMES = ["UG", "OPS", "PTL", "OC"]

let ui = {
	board: document.getElementById("map"),
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

function create(t, p, ...c) {
	let e = document.createElement(t)
	Object.assign(e, p)
	e.append(c)
	if (p.my_action)
		register_action(e, p.my_action, p.my_id)
	return e
}

function create_item(p) {
	let e = create("div", p)
	ui.board.appendChild(e)
	return e
}

let on_init_once = false

function on_init() {
	if (on_init_once)
		return
	on_init_once = true

	// Tracker
	let x = 5
	let y = 5
	for (let i = 0; i < 100; ++i) {
		let e = document.createElement("div")
		e.id = `tracker-${i}`
		e.className = "box"
		e.style.left = x / SCALE + "px"
		e.style.top = y / SCALE + "px"
		e.style.width = 85 / SCALE + "px"
		e.style.height = 85 / SCALE + "px"
		document.getElementById("boxes").appendChild(e)

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

	// DRM
	for (let i = 0; i < 4; ++i) {
		let e = document.createElement("div")
		e.id = `drm-${i}`
		e.className = "box"
		e.style.left = (288.2 + (i * 99)) / SCALE + "px"
		e.style.top = 396 / SCALE + "px"
		e.style.width = 94 / SCALE + "px"
		e.style.height = 94 / SCALE + "px"
		document.getElementById("boxes").appendChild(e)
	}


	// Areas
	for (let i = 0; i < data.areas.length; ++i) {
		let name = data.areas[i].name
		let type = data.areas[i].type
		let e = document.createElement("div")
		e.id = `area-${name}`
		e.className = "box"
		e.style.left = data.areas[i].x / SCALE + "px"
		e.style.top = data.areas[i].y / SCALE + "px"
		if (type !== COUNTRY) {
			e.style.width = 193 / SCALE + "px"
			e.style.height = 193 / SCALE + "px"
		} else {
			e.style.width = data.areas[i].w / SCALE + "px"
			e.style.height = data.areas[i].h / SCALE + "px"
		}
		document.getElementById("boxes").appendChild(e)

		if (type !== COUNTRY) {
			for (let j = 0; j < 4; ++j) {
				let e = document.createElement("div")
				let box_name = BOX_NAMES[j]
				e.id = `ops-${name}-${box_name}`
				e.className = "box"
				e.style.left = (data.areas[i].x + (j % 2) * 99) / SCALE + "px"
				e.style.top = (data.areas[i].y + Math.floor(j / 2) * 99) / SCALE + "px"
				e.style.width = 94 / SCALE + "px"
				e.style.height = 94 / SCALE + "px"
				document.getElementById("boxes").appendChild(e)
			}
		}
	}
}

function on_update() {
	on_init()

	for (let e of action_register)
		e.classList.toggle("action", is_action(e.my_action, e.my_id))

	action_button("roll", "Roll")
	action_button("done", "Done")
	action_button("undo", "Undo")
    action_button("restart", "Restart")
}


function on_log(text) {
	let p = document.createElement("div")
	if (text.match(/^\.r /)) {
		text = text.substring(3)
		p.className = 'h1 r'
	}
	else if (text.match(/^\.b /)) {
		text = text.substring(3)
		p.className = 'h1 b'
	}
	else if (text.match(/^\.x /)) {
		text = text.substring(3)
		p.className = 'h1 x'
	}

	p.innerHTML = text
	return p
}

scroll_with_middle_mouse("main")

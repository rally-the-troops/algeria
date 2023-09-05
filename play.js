"use strict"

/* global view, player, send_action, action_button, scroll_with_middle_mouse */

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
}

function on_update() {
	on_init()

	for (let e of action_register)
		e.classList.toggle("action", is_action(e.my_action, e.my_id))

	action_button("roll", "Roll")
	action_button("done", "Done")
	action_button("undo", "Undo")
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

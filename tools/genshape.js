var fs = require("fs")

function polygon(radius, sides, angle) {
	let w = radius * 2 + 6
	let b = 3 + radius
	let out = []
	out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${w}">`)
	let d = [ "M" ]
	for (let i = 0; i < sides; ++i) {
		let a = (angle + (360 / sides) * i) * (Math.PI / 180)
		let x = b + Math.round(Math.sin(a) * radius)
		let y = b + Math.round(Math.cos(a) * radius)
		d.push(x)
		d.push(y)
	}
	d.push("z")
	out.push(`<path d="${d.join(" ")}" stroke-width="2" fill="white" stroke="none" />`)
	out.push(`</svg>`)
	return out.join("\n")
}

// circle diameter: 54 => 27
// square width: 54 => 27
// hex diameter = 60 => 30
// triangle base = 70, r = 70 / sqrt(3) => 40

fs.writeFileSync("ops.svg", polygon(30, 6, 30))
//fs.writeFileSync("ptl.svg", polygon(27, 100, 0))
//fs.writeFileSync("oc.svg", polygon(27, 4, 45))
fs.writeFileSync("ug.svg", polygon(38, 3, 180))

"use strict"

const fs = require("fs")

let data = {}

const RURAL = 1
const URBAN = 2
const REMOTE = 3
const COUNTRY = 4

let locations = {}
let areas = []
let zone_areas = {}
let next_location_id = 0

function def_area(id, name, type, zone) {
    let loc = next_location_id++
    locations[id] = loc
    areas.push({loc, id, name, type, zone})
    if (zone) {
        if (!(zone in zone_areas)) {
            zone_areas[zone] = []
        }
        zone_areas[zone].push(loc)
    }
}

// special locations
def_area("NONE", "None")
def_area("DEPLOY", "Deployment")
def_area("ELIMINATED", "Eliminated")

// countries
def_area("FRANCE", "France", COUNTRY, null)
def_area("TUNISIA", "Tunisia", COUNTRY, "TUNISIA")
def_area("MOROCCO", "Morocco", COUNTRY, "MOROCCO")

def_area("I-1", "Barika", RURAL, "I")
def_area("I-2", "Batna", REMOTE, "I")
def_area("I-3", "Biskra", REMOTE, "I")
def_area("I-4", "Tebessa", RURAL, "I")

def_area("CONSTANTINE", "Constantine", URBAN, "II")
def_area("II-1", "Setif", RURAL, "II")
def_area("II-2", "Philippeville", RURAL, "II")
def_area("II-3", "Souk Ahras", RURAL, "II")

def_area("III-1", "Tizi Ouzou", RURAL, "III")
def_area("III-2", "Bordj Bou Arreridj", RURAL, "III")
def_area("III-3", "Bougie", RURAL, "III")

def_area("ALGIERS", "Algiers", URBAN, "IV")
def_area("IV-1", "Medea", RURAL, "IV")
def_area("IV-2", "Orleansville", RURAL, "IV")

def_area("ORAN", "Oran", URBAN, "V")
def_area("V-1", "Mecheria", REMOTE, "V")
def_area("V-2", "Tlemcen", RURAL, "V")
def_area("V-3", "Sidi Bel Abbes", RURAL, "V")
def_area("V-4", "Mostaganem", RURAL, "V")
def_area("V-5", "Saida", REMOTE, "V")
def_area("V-6", "Mascara", REMOTE, "V")
def_area("V-7", "Ain Sefra", REMOTE, "V")
def_area("V-8", "Laghouat", REMOTE, "V")

def_area("VI-1", "Sidi Aissa", REMOTE, "VI")
def_area("VI-2", "Ain Qussera", RURAL, "VI")

let adjacents = {}

function def_adjacent(id, neighbours) {
    function add_adjacent(from, to) {
        const from_id = locations[from]
        if (!(from_id in adjacents)) {
            adjacents[from_id] = []
        }
        adjacents[from_id].push(locations[to])
    }
    for (const n of neighbours) {
        add_adjacent(id, n)
        add_adjacent(n, id)
    }
}

// only adjacent with neighbour zones are tracked, defined one way but they are bidirectional
def_adjacent("TUNISIA", ["I-2", "I-3", "I-4", "II-3"])
def_adjacent("MOROCCO", ["V-1", "V-2", "V-7"])

def_adjacent("I-1", ["II-1", "III-2", "VI-1"])
def_adjacent("I-3", ["V-8", "VI-1"])
def_adjacent("I-4", ["II-1", "II-2", "II-3"])

def_adjacent("II-1", ["III-2", "III-3"])

def_adjacent("III-1", ["IV-1"])
def_adjacent("III-2", ["IV-1", "VI-1"])

def_adjacent("IV-1", ["VI-1", "VI-2"])
def_adjacent("IV-2", ["V-4", "VI-2"])

def_adjacent("V-4", ["VI-2"])
def_adjacent("V-6", ["VI-2"])
def_adjacent("V-8", ["VI-1", "VI-2"])

data.locations = locations
data.areas = areas
data.zone_areas = zone_areas
data.adjacents = adjacents

let units = []

const FLN = 0
const GOV = 1

// unit types

const FR_XX = 0
const FR_X = 1
const EL_X = 2
const AL_X = 3
const POL = 4
const FAILEK = 5
const BAND = 6
const CADRE = 7
const FRONT = 8

function def_unit(side, type, name, klass, evasion_contact, firepower, count = 1) {
    for (let i = 0; i < count; ++i) {
        units.push({side, type, name, class: klass, evasion_contact, firepower})
    }
}

def_unit(GOV, FR_XX, "French 2nd division", "fr_xx_2", 1, 25)
def_unit(GOV, FR_XX, "French 4th division", "fr_xx_4", 1, 25)
def_unit(GOV, FR_XX, "French 9th division", "fr_xx_9", 1, 25)
def_unit(GOV, FR_XX, "French 12th division", "fr_xx_12", 1, 25)
def_unit(GOV, FR_XX, "French 13th division", "fr_xx_13", 1, 25)
def_unit(GOV, FR_XX, "French 14th division", "fr_xx_14", 1, 25)
def_unit(GOV, FR_XX, "French 19th division", "fr_xx_19", 1, 25)
def_unit(GOV, FR_XX, "French 20th division", "fr_xx_20", 1, 25)
def_unit(GOV, FR_XX, "French 21th division", "fr_xx_21", 1, 25)
def_unit(GOV, FR_XX, "French 29th division", "fr_xx_29", 1, 25)

def_unit(GOV, FR_XX, "French 27th division", "fr_xx_27", 1, 25)
def_unit(GOV, FR_XX, "French 5th division", "fr_xx_5", 1, 25)
def_unit(GOV, FR_XX, "French 7th division", "fr_xx_7", 1, 25) // rules errata: - The French light mechanized division (circle with slash through it) should be numbered "7", not "2"

def_unit(GOV, FR_X, "French brigade", "fr_x", 1, 6, 4)
def_unit(GOV, EL_X, "French elite brigade", "fr_elite_x_para", 2, 9, 3)
def_unit(GOV, EL_X, "French elite brigade", "fr_elite_x_inf", 2, 9)
def_unit(GOV, EL_X, "French elite brigade", "fr_elite_x_marine", 2, 9, 3)

def_unit(GOV, AL_X, "Algerian brigade", "alg_x", 1, 5, 6)
def_unit(GOV, POL, "Algerian Police", "alg_police", 2, 2, 10)

def_unit(FLN, FAILEK, "FLN Failek", "fln_failek", 2, 4, 10)
def_unit(FLN, BAND, "FLN Band", "fln_band", 3, 2, 24)
def_unit(FLN, CADRE, "FLN Cadre", "fln_cadre", 4, 1, 30)
def_unit(FLN, FRONT, "FLN Front", "fln_front", 3, 3, 16)

console.log("const area_count =", areas.length)
console.log("const unit_count =", units.length)
console.log("const first_gov_unit =", units.findIndex((u) => u.side === GOV))
console.log("const last_gov_unit =", units.findLastIndex((u) => u.side === GOV))
console.log("const first_fln_unit =", units.findIndex((u) => u.side === FLN))
console.log("const last_fln_unit =", units.findLastIndex((u) => u.side === FLN))

data.units = units

fs.writeFileSync("data.js", "const data = " + JSON.stringify(data, 0, 0) + "\nif (typeof module !== 'undefined') module.exports = data\n")

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

function def_area(id, name, type, zone, x, y, w, h) {
    let loc = next_location_id++
    areas.push({loc, id, name, type, zone, x, y, w, h})
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
def_area("FRANCE", "France", COUNTRY, null, 1690.3, 244.8, 94, 94)
def_area("TUNISIA", "Tunisia", COUNTRY, "TUNISIA", 2499.9, 1667.6, 94, 94)
def_area("MOROCCO", "Morocco", COUNTRY, "MOROCCO", 109, 1765, 94, 94)

def_area("I-1", "Barika", RURAL, "I", 1708.1, 1117.9)
def_area("I-2", "Batna", REMOTE, "I", 2185.6, 1390.9)
def_area("I-3", "Biskra", REMOTE, "I", 1853.6, 1620.9)
def_area("I-4", "Tebessa", RURAL, "I", 2299.6, 1120.9)

def_area("CONSTANTINE", "Constantine", URBAN, "II", 2066.6, 315.8)
def_area("II-1", "Setif", RURAL, "II", 1917.6, 800.8)
def_area("II-2", "Phillippeville", RURAL, "II", 2200.6, 584.9)
def_area("II-3", "Souk Ahras", RURAL, "II", 2347.6, 848.9)

def_area("III-1", "Tizi Ouzou", RURAL, "III", 1473.6, 578.9)
def_area("III-2", "Bordj Bou Arreridj", RURAL, "III", 1465.6, 832.9)
def_area("III-3", "Bougie", RURAL, "III", 1703.6, 616.9)

def_area("ALGIERS", "Algiers", URBAN, "IV", 1185.6, 346.8)
def_area("IV-1", "Medea", RURAL, "IV", 1212, 727)
def_area("IV-2", "Orleansville", RURAL, "IV", 982, 780.2)

def_area("ORAN", "Oran", URBAN, "V", 430.6, 588.8)
def_area("V-1", "Mecheria", REMOTE, "V", 234, 1485.7)
def_area("V-2", "Tlemcen", RURAL, "V", 173, 1140.9)
def_area("V-3", "Sidi Bel Abbes", RURAL, "V", 476, 1038)
def_area("V-4", "Mostaganem", RURAL, "V", 741, 863.9)
def_area("V-5", "Saida", REMOTE, "V", 501, 1419.1)
def_area("V-6", "Mascara", REMOTE, "V", 785, 1302.9)
def_area("V-7", "Ain Sefra", REMOTE, "V", 752, 1670.9)
def_area("V-8", "Laghouat", REMOTE, "V", 1191, 1615.6)

def_area("VI-1", "Sidi Aissa", REMOTE, "VI", 1385, 1186)
def_area("VI-2", "Ain Qussera", RURAL, "VI", 1070.6, 1235.6)

let adjecents = {}

function def_adjecent(id, neighbours) {
    function add_adjecent(from, to) {
        const from_id = locations[from]
        if (!(from_id in adjecents)) {
            adjecents[from_id] = []
        }
        adjecents[from_id].push(locations[to])
    }
    for (const n of neighbours) {
        add_adjecent(id, n)
        add_adjecent(n, id)
    }
}

// only adjecent with neighbour zones are tracked, defined one way but they are bidirectional
def_adjecent("TUNISIA", ["I-2", "I-3", "I-4", "II-3"])
def_adjecent("MOROCCO", ["V-1", "V-2", "V-7"])

def_adjecent("I-1", ["II-1", "III-2", "VI-1"])
def_adjecent("I-3", ["V-8", "VI-1"])
def_adjecent("I-4", ["II-1", "II-2", "II-3"])

def_adjecent("II-1", ["III-2", "III-3"])

def_adjecent("III-1", ["IV-1"])
def_adjecent("III-2", ["IV-1", "VI-1"])

def_adjecent("IV-1", ["VI-1", "VI-2"])
def_adjecent("IV-2", ["V-4", "VI-2"])

def_adjecent("V-4", ["VI-2"])
def_adjecent("V-6", ["VI-2"])
def_adjecent("V-8", ["VI-1", "VI-2"])

data.locations = locations
data.areas = areas
data.zone_areas = zone_areas
data.adjecents = adjecents

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

function def_unit(side, type, klass, count = 1) {
    for (let i = 0; i < count; ++i) {
        units.push({side, type, class: klass})
    }
}

def_unit(GOV, FR_XX, "fr_xx_2")
def_unit(GOV, FR_XX, "fr_xx_4")
def_unit(GOV, FR_XX, "fr_xx_9")
def_unit(GOV, FR_XX, "fr_xx_12")
def_unit(GOV, FR_XX, "fr_xx_13")
def_unit(GOV, FR_XX, "fr_xx_14")
def_unit(GOV, FR_XX, "fr_xx_19")
def_unit(GOV, FR_XX, "fr_xx_20")
def_unit(GOV, FR_XX, "fr_xx_21")
def_unit(GOV, FR_XX, "fr_xx_29")

def_unit(GOV, FR_XX, "fr_xx_27")
def_unit(GOV, FR_XX, "fr_xx_25")
def_unit(GOV, FR_XX, "fr_xx_7")

def_unit(GOV, FR_X, "fr_x", 4)
def_unit(GOV, EL_X, "fr_elite_x_para", 3)
def_unit(GOV, EL_X, "fr_elite_x_inf")
def_unit(GOV, EL_X, "fr_elite_x_marine", 3)

def_unit(GOV, AL_X, "alg_x", 6)
def_unit(GOV, POL, "alg_police", 10)

def_unit(FLN, FAILEK, "fln_failek", 10)
def_unit(FLN, BAND, "fln_band", 24)
def_unit(FLN, CADRE, "fln_cadre", 30)
def_unit(FLN, FRONT, "fln_front", 16)

console.log("const unit_count =", units.length)
console.log("const first_gov_unit =", units.findIndex((u) => u.side === GOV))
console.log("const last_gov_unit =", units.findLastIndex((u) => u.side === GOV))
console.log("const first_fln_unit =", units.findIndex((u) => u.side === FLN))
console.log("const last_fln_unit =", units.findLastIndex((u) => u.side === FLN))

data.units = units

fs.writeFileSync("data.js", "const data = " + JSON.stringify(data, 0, 0) + "\nif (typeof module !== 'undefined') module.exports = data\n")

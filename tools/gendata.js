"use strict"

const fs = require("fs")

let data = {}

const RURAL = 0
const URBAN = 1
const REMOTE = 2
const COUNTRY = 3

let areas = []
let zones = {}
let locations = {}
let location_id = 0

function def_location(name) {
    locations[name] = ++location_id
    return location_id
}

def_location("DEPLOY")
def_location("ELIMINATED")
def_location("I")
def_location("II")
def_location("III")
def_location("IV")
def_location("V")
def_location("VI")
def_location("France")
def_location("Morocco")
def_location("Tunisia")

function def_area(name, type, zone, x, y, w, h) {
    let id = 0
    if (name in locations) {
        id = locations[name]
    } else {
        id = def_location(name)
    }
    areas.push({id, name, type, zone, x, y, w, h})
    if (zone) {
        if (!(zone in zones)) {
            zones[zone] = []
        }
        zones[zone].push(name)
    }
}

def_area("Oran", URBAN, "V", 430.6, 588.8)
def_area("Algiers", URBAN, "IV", 1185.6, 346.8)
def_area("Constantine", URBAN, "II", 2066.6, 315.8)

def_area("France", COUNTRY, null, 1605, 185.3, 266, 212.4)
def_area("Morocco", COUNTRY, null, 109, 1765, 94, 94)
def_area("Tunisia", COUNTRY, null, 2499.9, 1667.6, 94, 94)

def_area("Barika", RURAL, "I", 1708.1, 1117.9)
def_area("Batna", REMOTE, "I", 2185.6, 1390.9)
def_area("Biskra", REMOTE, "I", 1853.6, 1620.9)
def_area("Tebessa", RURAL, "I", 2299.6, 1120.9)

def_area("Setif", RURAL, "II", 1917.6, 800.8)
def_area("Souk Ahras", RURAL, "II", 2347.6, 848.9)
def_area("Phillippeville", RURAL, "II", 2200.6, 584.9)

def_area("Tizi Ouzou", RURAL, "III", 1473.6, 578.9)
def_area("Bordj Bou Arreridj", RURAL, "III", 1465.6, 832.9)
def_area("Bougie", RURAL, "III", 1703.6, 616.9)

def_area("Medea", RURAL, "IV", 1212, 727)
def_area("Orleansville", RURAL, "IV", 982, 780.2)

def_area("Mecheria", REMOTE, "V", 234, 1485.7)
def_area("Tlemcen", RURAL, "V", 173, 1140.9)
def_area("Sidi Bel Abbes", RURAL, "V", 476, 1038)
def_area("Mostaganem", RURAL, "V", 741, 863.9)
def_area("Saida", REMOTE, "V", 501, 1419.1)
def_area("Mascara", REMOTE, "V", 785, 1302.9)
def_area("Ain Sefra", REMOTE, "V", 752, 1670.9)
def_area("Laghouat", REMOTE, "V", 1191, 1615.6)

def_area("Sidi Aissa", REMOTE, "VI", 1385, 1186)
def_area("Ain Qussera", RURAL, "VI", 1070.6, 1235.6)

data.areas = areas
data.zones = zones
data.locations = locations

let units = []

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

console.log("unit_count =", units.length)
data.units = units

fs.writeFileSync("data.js", "const data = " + JSON.stringify(data, 0, 0) + "\nif (typeof module !== 'undefined') module.exports = data\n")

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidVocation = exports.vocationMap = exports.defaultCharacterData = exports.Vocation = exports.GAME_CONSTANTS = void 0;
exports.getVocationName = getVocationName;
exports.GAME_CONSTANTS = {
    INITIAL_LEVEL: 8,
    INITIAL_EXPERIENCE: 4200,
    INITIAL_HEALTH: 185,
    INITIAL_MANA: 35,
    DEFAULT_TOWN: 1,
    DEFAULT_WORLD: 1
};
var Vocation;
(function (Vocation) {
    Vocation[Vocation["Rookie"] = 0] = "Rookie";
    Vocation[Vocation["Druid"] = 1] = "Druid";
    Vocation[Vocation["Sorcerer"] = 2] = "Sorcerer";
    Vocation[Vocation["Paladin"] = 3] = "Paladin";
    Vocation[Vocation["Knight"] = 4] = "Knight";
})(Vocation || (exports.Vocation = Vocation = {}));
function getVocationName(vocationId) {
    switch (vocationId) {
        case Vocation.Rookie:
            return 'Rookie';
        case Vocation.Druid:
            return 'Druid';
        case Vocation.Sorcerer:
            return 'Sorcerer';
        case Vocation.Paladin:
            return 'Paladin';
        case Vocation.Knight:
            return 'Knight';
        default:
            return 'Unknown';
    }
}
exports.defaultCharacterData = {
    level: exports.GAME_CONSTANTS.INITIAL_LEVEL,
    experience: exports.GAME_CONSTANTS.INITIAL_EXPERIENCE,
    health: exports.GAME_CONSTANTS.INITIAL_HEALTH,
    healthmax: exports.GAME_CONSTANTS.INITIAL_HEALTH,
    mana: exports.GAME_CONSTANTS.INITIAL_MANA,
    manamax: exports.GAME_CONSTANTS.INITIAL_MANA,
    town_id: exports.GAME_CONSTANTS.DEFAULT_TOWN,
    world: exports.GAME_CONSTANTS.DEFAULT_WORLD,
    vocation: Vocation.Rookie,
    updatedAt: new Date()
};
exports.vocationMap = {
    Rookie: Vocation.Rookie,
    Druid: Vocation.Druid,
    Sorcerer: Vocation.Sorcerer,
    Paladin: Vocation.Paladin,
    Knight: Vocation.Knight
};
const isValidVocation = (vocation) => {
    return Object.values(Vocation).includes(vocation);
};
exports.isValidVocation = isValidVocation;

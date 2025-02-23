// Configuration file for default character settings in the game

// Game constants for better maintainability
export const GAME_CONSTANTS = {
    INITIAL_LEVEL: 8,
    INITIAL_EXPERIENCE: 4200,
    INITIAL_HEALTH: 185,
    INITIAL_MANA: 35,
    DEFAULT_TOWN: 1,
    DEFAULT_WORLD: 1
} as const;

// Define types for better type-safety
export interface CharacterData {
    level: number;
    experience: number;
    health: number;
    healthmax: number;
    mana: number;
    manamax: number;
    town_id: number;
    world: number;
    vocation: Vocation;
    updatedAt: Date;
}

// Enum for vocations
export enum Vocation {
    Rookie = 0,
    Druid = 1,
    Sorcerer = 2,
    Paladin = 3,
    Knight = 4
}

// Helper function for vocation names
export function getVocationName(vocationId: number): string {
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

export const defaultCharacterData: CharacterData = {
    level: GAME_CONSTANTS.INITIAL_LEVEL,
    experience: GAME_CONSTANTS.INITIAL_EXPERIENCE,
    health: GAME_CONSTANTS.INITIAL_HEALTH,
    healthmax: GAME_CONSTANTS.INITIAL_HEALTH,
    mana: GAME_CONSTANTS.INITIAL_MANA,
    manamax: GAME_CONSTANTS.INITIAL_MANA,
    town_id: GAME_CONSTANTS.DEFAULT_TOWN,
    world: GAME_CONSTANTS.DEFAULT_WORLD,
    vocation: Vocation.Rookie,
    updatedAt: new Date()
};

// Updated vocation mapping
export const vocationMap: Record<string, Vocation> = {
    Rookie: Vocation.Rookie,
    Druid: Vocation.Druid,
    Sorcerer: Vocation.Sorcerer,
    Paladin: Vocation.Paladin,
    Knight: Vocation.Knight
};

// Helper function to validate vocation
export const isValidVocation = (vocation: number): vocation is Vocation => {
    return Object.values(Vocation).includes(vocation);
};
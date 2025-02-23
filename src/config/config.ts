// Configuration file for default character settings in the game

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
    vocation: number;
    updatedAt: Date;
}

export const defaultCharacterData: CharacterData = {
    level: 8,
    experience: 4200,
    health: 185,
    healthmax: 185,
    mana: 35,
    manamax: 35,
    town_id: 1,
    world: 1,
    vocation: 0,  // Default vocation (Rookie)
    updatedAt: new Date()
};

// Enum for vocations
export enum Vocation {
    Rookie = 0,
    Druid = 1,
    Sorcerer = 2,
    Paladin = 3,
    Knight = 4
}

// Updated vocation mapping
export const vocationMap: Record<string, Vocation> = {
    Rookie: Vocation.Rookie,
    Druid: Vocation.Druid,
    Sorcerer: Vocation.Sorcerer,
    Paladin: Vocation.Paladin,
    Knight: Vocation.Knight
};
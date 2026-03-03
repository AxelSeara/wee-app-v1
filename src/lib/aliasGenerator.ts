const HISTORICAL_NAMES = [
  "Leonidas",
  "Cleopatra",
  "Hypatia",
  "Tesla",
  "DaVinci",
  "Ada",
  "Curie",
  "Boudica",
  "SunTzu",
  "Octavia"
];

const PLANTS = [
  "Oak",
  "Ivy",
  "Cedar",
  "Lotus",
  "Sage",
  "Moss",
  "Fern",
  "Maple",
  "Bamboo",
  "Willow"
];

const FANTASY_WORDS = [
  "Rune",
  "Myth",
  "Arcane",
  "Dragon",
  "Aether",
  "Phoenix",
  "Oracle",
  "Shadow",
  "Storm",
  "Nova"
];

const CAT_BREEDS = [
  "MaineCoon",
  "Sphynx",
  "Bengal",
  "Siamese",
  "Ragdoll",
  "Persian",
  "Siberian",
  "Savannah",
  "Birman",
  "Abyssinian"
];

const pick = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

export const generateAlias = (): string => {
  const leftPool = [pick(HISTORICAL_NAMES), pick(PLANTS)];
  const rightPool = [pick(FANTASY_WORDS), pick(CAT_BREEDS)];
  const left = pick(leftPool);
  const right = pick(rightPool);
  const number = Math.floor(10 + Math.random() * 90);
  return `${left}${right}${number}`;
};

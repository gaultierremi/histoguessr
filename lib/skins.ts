export type SkinId =
  | "default"
  | "napoleon_hat"
  | "egypt_crown"
  | "viking_helmet"
  | "louis_wig"
  | "scholar_hat"
  | "knight_helmet";

export type Skin = {
  id: SkinId;
  name: string;
  emoji: string;
  unlockCondition: string;
  description: string;
};

export const SKINS: Skin[] = [
  { id: "default",       name: "Explorateur",           emoji: "🧑",  unlockCondition: "default",       description: "Ton avatar de base" },
  { id: "scholar_hat",   name: "Toque de savant",        emoji: "🎓",  unlockCondition: "10_games",      description: "10 parties jouées" },
  { id: "knight_helmet", name: "Heaume de chevalier",    emoji: "🪖",  unlockCondition: "streak_3",      description: "Streak de 3 jours" },
  { id: "napoleon_hat",  name: "Chapeau de Napoléon",    emoji: "🎩",  unlockCondition: "50_games",      description: "50 parties jouées" },
  { id: "viking_helmet", name: "Casque viking",          emoji: "⛑️", unlockCondition: "streak_7",      description: "Streak de 7 jours" },
  { id: "egypt_crown",   name: "Couronne égyptienne",    emoji: "👑",  unlockCondition: "100_games",     description: "100 parties jouées" },
  { id: "louis_wig",     name: "Perruque de Louis XIV",  emoji: "👱",  unlockCondition: "perfect_score", description: "Score parfait en ligne du temps" },
];

export function getSkinById(id: string): Skin {
  return SKINS.find((s) => s.id === id) ?? SKINS[0];
}

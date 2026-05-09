// ============================================================
// CASINHA HUB — Branding centralizado
// ============================================================

export const APP_NAME = "Casinha Hub";
export const APP_TAGLINE = "O centro de controle da sua casa";
export const APP_DESCRIPTION = "Gestão doméstica, finanças, compras, estoque e rotina da casa em um só lugar.";

export const APP_SLOGANS = [
  "Sua casa organizada em um só lugar",
  "Finanças, compras e rotina integradas",
  "O sistema operacional da sua casa",
] as const;

export const APP_META = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
  ogTitle: APP_NAME,
  ogDescription: `O centro de controle da sua casa. ${APP_DESCRIPTION}`,
} as const;

// Textos de UI
export const UI_COPY = {
  loginTitle: `Acesse o ${APP_NAME}`,
  loginDesc: "Organize finanças, compras, estoque e a rotina da sua casa em um único lugar.",
  signupButton: "Criar minha conta",
  installPrompt: `Instale o ${APP_NAME} na tela inicial`,
  assistantIntro: `Você é o Assistente Doméstico do ${APP_NAME}, o hub completo de gestão doméstica.`,
} as const;

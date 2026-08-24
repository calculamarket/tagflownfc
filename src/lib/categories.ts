// Categorias de produção. Um lote pode ser criado para uma categoria (ex.:
// "Pet Tag"); as tags herdam a categoria e, na ativação, o cliente já é levado
// direto ao formulário certo (com a moldagem daquela categoria).

export type SimpleMode = "pix" | "links" | "emergency";
export type CategoryId = "pet" | "emergencia" | "pix" | "menu";

export type CategoryDef = {
  id: CategoryId;
  label: string;
  icon: string;
  mode: SimpleMode;
  // Moldagem usada no formulário (principalmente no modo emergency).
  titleLabel?: string;
  titlePlaceholder?: string;
  defaultMessage?: string;
  infoPlaceholder?: string;
  intro?: string;
};

export const CATEGORIES: CategoryDef[] = [
  {
    id: "pet",
    label: "Pet Tag",
    icon: "🐾",
    mode: "emergency",
    titleLabel: "Nome do pet",
    titlePlaceholder: "Rex",
    defaultMessage: "Me perdi! Se me encontrar, avise meus donos 🐾",
    infoPlaceholder: "Ex.: castrado, toma remédio às 8h, vacinas em dia, dócil…",
    intro: "Cadastre os dados do seu pet e os contatos de quem deve ser avisado se ele for encontrado.",
  },
  {
    id: "emergencia",
    label: "Emergência",
    icon: "🆘",
    mode: "emergency",
    titleLabel: "Nome",
    titlePlaceholder: "João da Silva",
    defaultMessage: "Em caso de emergência, avise:",
    infoPlaceholder: "Ex.: alergia a penicilina, tipo sanguíneo O+, medicação contínua…",
    intro: "Cadastre contatos de emergência e informações importantes (alergias, tipo sanguíneo…).",
  },
  { id: "pix", label: "PIX", icon: "💠", mode: "pix" },
  { id: "menu", label: "Menu de links", icon: "🔗", mode: "links" },
];

export function categoryById(id?: string | null): CategoryDef | null {
  return CATEGORIES.find((c) => c.id === id) ?? null;
}

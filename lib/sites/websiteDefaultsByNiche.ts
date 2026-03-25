export type WebsiteNicheKey =
  | "barbershop"
  | "clothing_brand"
  | "electronics_store"
  | "beauty_salon"
  | "dentistry"
  | "generic";

export type WebsiteNicheDefaults = {
  businessType: string;
  aliases: string[];
  styleDirection: string;
  visualDirection: string;
  colorDirection: string;
  tone: string;
  primaryGoal: string;
  primaryCTA: string;
  sections: string[];
  contentBlocks: string[];
  styleKeywords: string[];
  audienceTemplate: (city: string) => string;
  needsPricing: boolean;
  needsMap: boolean;
};

export const websiteDefaultsByNiche: Record<WebsiteNicheKey, WebsiteNicheDefaults> = {
  barbershop: {
    businessType: "barbershop",
    aliases: ["барбер", "barber", "barbershop", "мужск", "стрижк"],
    styleDirection: "dark premium masculine",
    visualDirection: "bold hero, masculine premium cards, strong booking path",
    colorDirection: "dark base + warm accent (gold/amber)",
    tone: "уверенный, энергичный, премиальный",
    primaryGoal: "онлайн-записи и звонки",
    primaryCTA: "Записаться",
    sections: ["hero", "services", "barbers", "pricing", "reviews", "booking", "contacts"],
    contentBlocks: ["оффер на первом экране", "карточки услуг", "мастера", "соц.доказательство", "форма записи", "контакты"],
    styleKeywords: ["premium", "dark", "masculine", "commercial"],
    audienceTemplate: (city: string) => `мужчины 18-45 в ${city}, которым важны стиль и сервис`,
    needsPricing: true,
    needsMap: true
  },
  clothing_brand: {
    businessType: "clothing brand",
    aliases: ["одежд", "бренд", "fashion", "lookbook", "коллекц"],
    styleDirection: "fashion editorial clean premium",
    visualDirection: "editorial hero, lookbook rhythm, catalog highlights",
    colorDirection: "clean neutral palette + premium accent",
    tone: "брендовый, стильный, уверенный",
    primaryGoal: "каталожные переходы и заявки",
    primaryCTA: "Смотреть коллекцию",
    sections: ["hero", "new_collection", "catalog_highlights", "lookbook", "benefits", "reviews", "contacts"],
    contentBlocks: ["обложка коллекции", "хиты каталога", "lookbook/визуал", "качество материалов", "отзывы", "контакты"],
    styleKeywords: ["fashion", "editorial", "clean", "premium"],
    audienceTemplate: (city: string) => `покупатели 18-35 в ${city}, которые выбирают стиль и качество`,
    needsPricing: true,
    needsMap: false
  },
  electronics_store: {
    businessType: "electronics store",
    aliases: ["техник", "electronics", "гаджет", "store", "shop", "магазин"],
    styleDirection: "tech premium trust-centered",
    visualDirection: "high-contrast hero, category grid, featured products, trust badges",
    colorDirection: "deep neutral base + electric accent",
    tone: "профессиональный, технологичный, деловой",
    primaryGoal: "заказы и обращения",
    primaryCTA: "Подобрать технику",
    sections: ["hero", "categories", "featured_products", "benefits", "guarantee", "reviews", "contact_form", "contacts"],
    contentBlocks: ["категории товаров", "хиты продаж", "гарантия", "условия доставки/оплаты", "форма обращения", "контакты"],
    styleKeywords: ["tech", "premium", "trust", "commercial"],
    audienceTemplate: (city: string) => `клиенты 18-45 в ${city}, которые покупают технику для работы и дома`,
    needsPricing: true,
    needsMap: true
  },
  beauty_salon: {
    businessType: "beauty salon",
    aliases: ["салон", "beauty", "nail", "маник", "бров", "ресниц"],
    styleDirection: "elegant clean contemporary",
    visualDirection: "elegant hero, refined service cards, strong booking flow",
    colorDirection: "light clean base + soft premium accent",
    tone: "деликатный, экспертный, заботливый",
    primaryGoal: "онлайн-записи",
    primaryCTA: "Записаться онлайн",
    sections: ["hero", "services", "masters", "pricing", "reviews", "booking", "contacts"],
    contentBlocks: ["лидирующий оффер", "услуги и цены", "мастера", "отзывы", "форма записи", "контакты"],
    styleKeywords: ["elegant", "clean", "premium", "beauty"],
    audienceTemplate: (city: string) => `женщины 20-45 в ${city}, которым важны качество и сервис`,
    needsPricing: true,
    needsMap: true
  },
  dentistry: {
    businessType: "dentistry clinic",
    aliases: ["стомат", "dent", "клиник", "дентал"],
    styleDirection: "clean medical trust",
    visualDirection: "trust-focused hero, doctor profiles, clear treatment flow",
    colorDirection: "clean white/blue clinical palette",
    tone: "спокойный, экспертный, внушающий доверие",
    primaryGoal: "записи на консультацию",
    primaryCTA: "Записаться на консультацию",
    sections: ["hero", "services", "doctors", "pricing", "reviews", "faq", "contact_form", "contacts"],
    contentBlocks: ["медицинский оффер", "направления лечения", "врачи", "цены", "отзывы", "форма записи", "контакты"],
    styleKeywords: ["medical", "clean", "trust", "conversion"],
    audienceTemplate: (city: string) => `жители ${city}, которым важны надежность, прозрачность цен и комфорт`,
    needsPricing: true,
    needsMap: true
  },
  generic: {
    businessType: "local business",
    aliases: [],
    styleDirection: "modern commercial contemporary",
    visualDirection: "clear conversion hierarchy, strong hero, structured sections",
    colorDirection: "balanced commercial palette with strong contrast",
    tone: "уверенный, коммерческий, современный",
    primaryGoal: "заявки и обращения",
    primaryCTA: "Оставить заявку",
    sections: ["hero", "services", "benefits", "reviews", "faq", "contact_form", "contacts"],
    contentBlocks: ["оффер", "услуги", "выгоды", "отзывы", "форма заявки", "контакты"],
    styleKeywords: ["modern", "commercial", "clean", "conversion"],
    audienceTemplate: (city: string) => `локальные клиенты в ${city}, которым важны качество и удобство`,
    needsPricing: false,
    needsMap: true
  }
};

export function resolveWebsiteNiche(input: string, explicitNiche = ""): WebsiteNicheKey {
  const source = `${explicitNiche} ${input}`.toLowerCase();
  const keys = Object.keys(websiteDefaultsByNiche) as WebsiteNicheKey[];
  for (const key of keys) {
    if (key === "generic") continue;
    const cfg = websiteDefaultsByNiche[key];
    if (cfg.aliases.some((alias) => source.includes(alias))) return key;
  }
  return "generic";
}


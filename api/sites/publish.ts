import { createPublishedSite, type PublishedSitePayload } from "./_store";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const payload = (req.body || {}) as Partial<PublishedSitePayload>;

    const safePayload: PublishedSitePayload = {
      businessName: String(payload.businessName || "CFlow Site"),
      city: String(payload.city || ""),
      logoUrl: String(payload.logoUrl || ""),
      accentColor: String(payload.accentColor || "#0f172a"),
      baseColor: String(payload.baseColor || "#f8fafc"),
      heroTitle: String(payload.heroTitle || "Сайт вашего бизнеса"),
      heroSubtitle: String(payload.heroSubtitle || ""),
      about: String(payload.about || ""),
      primaryCta: String(payload.primaryCta || "Связаться"),
      secondaryCta: String(payload.secondaryCta || "Услуги"),
      trustStats: Array.isArray(payload.trustStats) ? payload.trustStats.slice(0, 3) : [],
      valueProps: Array.isArray(payload.valueProps) ? payload.valueProps.slice(0, 3) : [],
      processSteps: Array.isArray(payload.processSteps) ? payload.processSteps.slice(0, 4) : [],
      testimonials: Array.isArray(payload.testimonials) ? payload.testimonials.slice(0, 6) : [],
      faq: Array.isArray(payload.faq) ? payload.faq.slice(0, 10) : [],
      contactLine: String(payload.contactLine || ""),
      products: Array.isArray(payload.products) ? payload.products.slice(0, 24) : [],
      sections: payload.sections && typeof payload.sections === "object" ? (payload.sections as Record<string, boolean>) : {},
      sectionOrder: Array.isArray(payload.sectionOrder) ? payload.sectionOrder.map((item) => String(item)) : [],
      galleryUrls: Array.isArray(payload.galleryUrls) ? payload.galleryUrls.slice(0, 20).map((item) => String(item)) : [],
      cabinetEnabled: payload.cabinetEnabled !== false,
      telegramBot: String(payload.telegramBot || "@clientsflow_support_bot")
    };

    const doc = await createPublishedSite(safePayload);
    const host = req.headers?.host ? `https://${req.headers.host}` : process.env.OPENROUTER_SITE_URL || "https://clients-flow-ten.vercel.app";
    res.status(200).json({ slug: doc.slug, url: `${host}/s/${doc.slug}` });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Publish failed" });
  }
}

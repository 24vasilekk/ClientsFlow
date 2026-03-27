declare const process: { env: Record<string, string | undefined> };

import { createPublishedSite, type PublishedSitePayload } from "../../lib/sites/store.js";
import { authErrorPayload, requireRequestContext } from "../_auth/session.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const traceId = String(req.headers?.["x-trace-id"] || req.body?.traceId || `trace_sites_publish_${Date.now().toString(36)}`);
  try {
    await requireRequestContext(req, "api/sites/publish");
  } catch (error: any) {
    const failure = authErrorPayload(error, traceId);
    res.status(failure.status).json(failure.body);
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
      telegramBot: String(payload.telegramBot || "@clientsflow_support_bot"),
      socialLinks:
        payload.socialLinks && typeof payload.socialLinks === "object"
          ? {
              telegram: typeof payload.socialLinks.telegram === "string" ? payload.socialLinks.telegram : "",
              whatsapp: typeof payload.socialLinks.whatsapp === "string" ? payload.socialLinks.whatsapp : "",
              instagram: typeof payload.socialLinks.instagram === "string" ? payload.socialLinks.instagram : ""
            }
          : { telegram: "", whatsapp: "", instagram: "" },
      theme:
        payload.theme && typeof payload.theme === "object"
          ? {
              fontHeading: typeof payload.theme.fontHeading === "string" ? payload.theme.fontHeading : "",
              fontBody: typeof payload.theme.fontBody === "string" ? payload.theme.fontBody : "",
              density:
                payload.theme.density === "airy" || payload.theme.density === "balanced" || payload.theme.density === "compact"
                  ? payload.theme.density
                  : "balanced",
              radius:
                payload.theme.radius === "soft" || payload.theme.radius === "rounded" || payload.theme.radius === "sharp"
                  ? payload.theme.radius
                  : "soft",
              contrast:
                payload.theme.contrast === "soft" || payload.theme.contrast === "medium" || payload.theme.contrast === "high"
                  ? payload.theme.contrast
                  : "medium"
            }
          : { fontHeading: "", fontBody: "", density: "balanced", radius: "soft", contrast: "medium" },
      layoutSpec: Array.isArray(payload.layoutSpec) ? payload.layoutSpec.slice(0, 32) : [],
      pageDsl: Array.isArray(payload.pageDsl) ? payload.pageDsl.slice(0, 32) : [],
      pageCode: typeof payload.pageCode === "string" ? payload.pageCode : ""
    };

    const doc = await createPublishedSite(safePayload);
    const path = `/s/${doc.slug}`;
    const host = req.headers?.host ? `https://${req.headers.host}` : process.env.OPENROUTER_SITE_URL || "https://clients-flow-ten.vercel.app";
    res.status(200).json({ slug: doc.slug, path, url: `${host}${path}` });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Publish failed" });
  }
}

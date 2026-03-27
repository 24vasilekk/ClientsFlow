import { getPublishedSite } from "../../lib/sites/store.js";
import { authErrorPayload, requireRequestContext } from "../_auth/session.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const traceId = String(req.headers?.["x-trace-id"] || req.query?.traceId || `trace_sites_get_${Date.now().toString(36)}`);
  try {
    await requireRequestContext(req, "api/sites/get");
  } catch (error: any) {
    const failure = authErrorPayload(error, traceId);
    res.status(failure.status).json(failure.body);
    return;
  }

  try {
    const slug = String(req.query?.slug || "").trim();
    if (!slug) {
      res.status(400).json({ error: "slug is required" });
      return;
    }
    const site = await getPublishedSite(slug);
    if (!site) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.status(200).json(site);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Fetch failed" });
  }
}

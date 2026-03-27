import { authErrorPayload, requireAuthenticatedRequest } from "../_auth/session.js";
import { readJsonSafe, supabaseRestOrThrow } from "../_db/supabase.js";

type AnyRecord = Record<string, any>;

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nowIso(): string {
  return new Date().toISOString();
}

export default async function handler(req: any, res: any) {
  const traceId = asString(req.headers?.["x-trace-id"]).trim() || `trace_workspace_accept_${Date.now().toString(36)}`;
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed", traceId });
    return;
  }

  try {
    const auth = await requireAuthenticatedRequest(req, "api/workspace/accept-invite");
    const token = asString(req.body?.token).trim();
    if (!token) {
      res.status(400).json({ ok: false, error: "token_required", traceId });
      return;
    }
    const authEmail = asString(auth.email).trim().toLowerCase();
    if (!authEmail) {
      res.status(400).json({ ok: false, error: "auth_email_required", traceId });
      return;
    }

    const inviteResp = await supabaseRestOrThrow(
      `workspace_invites?invite_token=eq.${encodeURIComponent(token)}&select=*&limit=1`,
      {},
      "workspace_accept_invite_load"
    );
    const inviteRows = await readJsonSafe<AnyRecord[]>(inviteResp);
    const invite = Array.isArray(inviteRows) ? inviteRows[0] : null;
    if (!invite) {
      res.status(404).json({ ok: false, error: "invite_not_found", traceId });
      return;
    }
    if (asString(invite.status) !== "pending") {
      res.status(409).json({ ok: false, error: "invite_not_pending", traceId });
      return;
    }
    const inviteEmail = asString(invite.email).trim().toLowerCase();
    if (!inviteEmail || inviteEmail !== authEmail) {
      res.status(403).json({ ok: false, error: "invite_email_mismatch", traceId });
      return;
    }
    const expiresAtTs = new Date(asString(invite.expires_at)).getTime();
    if (!Number.isFinite(expiresAtTs) || expiresAtTs < Date.now()) {
      await supabaseRestOrThrow(
        `workspace_invites?id=eq.${encodeURIComponent(asString(invite.id))}`,
        { method: "PATCH", body: JSON.stringify({ status: "expired", updated_at: nowIso() }) },
        "workspace_accept_invite_expire"
      );
      res.status(410).json({ ok: false, error: "invite_expired", traceId });
      return;
    }

    const workspaceId = asString(invite.workspace_id).trim();
    const role = asString(invite.role).trim().toLowerCase() === "admin" ? "admin" : "member";
    const memberId = `wm_${workspaceId}_${auth.userId}`.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 180);

    await supabaseRestOrThrow(
      "workspace_members?on_conflict=workspace_id,user_id",
      {
        method: "POST",
        body: JSON.stringify([
          {
            id: memberId,
            workspace_id: workspaceId,
            user_id: auth.userId,
            role,
            status: "active",
            invited_by: asString(invite.invited_by_user_id) || null,
            joined_at: nowIso(),
            created_at: nowIso(),
            updated_at: nowIso()
          }
        ])
      },
      "workspace_accept_invite_upsert_member"
    );

    await supabaseRestOrThrow(
      `workspace_invites?id=eq.${encodeURIComponent(asString(invite.id))}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          status: "accepted",
          accepted_by_user_id: auth.userId,
          accepted_at: nowIso(),
          updated_at: nowIso()
        })
      },
      "workspace_accept_invite_mark_accepted"
    );

    res.status(200).json({
      ok: true,
      status: "accepted",
      workspaceId,
      role,
      userId: auth.userId,
      traceId
    });
  } catch (error: any) {
    if (error?.code?.startsWith?.("auth_")) {
      const failure = authErrorPayload(error, traceId);
      res.status(failure.status).json(failure.body);
      return;
    }
    res.status(500).json({ ok: false, error: error?.message || "workspace_accept_invite_failed", traceId });
  }
}


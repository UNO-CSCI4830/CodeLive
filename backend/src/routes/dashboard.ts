import { Router, Request, Response } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { supabaseAdmin } from "../lib/supabase";

const router = Router();

/* ------------------------------------------------------------------ */
/*  GET /api/dashboard — upcoming sessions + recent reports           */
/*  (interviewer-only data; candidates get empty reports array)       */
/* ------------------------------------------------------------------ */
router.get(
  "/api/dashboard",
  requireAuth,
  async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;

    /* Fetch the caller's role to decide what data to return. */
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileErr) {
      res.status(500).json({ error: profileErr.message });
      return;
    }

    const isInterviewer = profile?.role === "interviewer";

    /* 1 — Upcoming sessions (waiting / active, owned by this user) */
    const { data: upRows, error: upErr } = await supabaseAdmin
      .from("sessions")
      .select(
        "id, join_code, status, candidate_id, created_at, problems:session_problems(category)",
      )
      .or("status.eq.waiting,status.eq.active")
      .eq("interviewer_id", user.id)
      .order("created_at", { ascending: false })
      .limit(6);

    if (upErr) {
      res.status(500).json({ error: upErr.message });
      return;
    }

    /* 2 — Recent reports (interviewer only, top 5) */
    let rptRows: any[] = [];
    if (isInterviewer) {
      const { data, error: rptErr } = await supabaseAdmin
        .from("interview_reports")
        .select(
          `id, session_id, status, overall_summary, ai_use_score, generated_at, created_at,
           session:sessions!inner(join_code, candidate_id, candidate_name, interviewer_id)`,
        )
        .eq("session.interviewer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (rptErr) {
        res.status(500).json({ error: rptErr.message });
        return;
      }
      rptRows = data ?? [];
    }

    /* 3 — Batch-fetch candidate display names from profiles */
    const allCandidateIds = [
      ...new Set([
        ...(upRows ?? []).map((s: any) => s.candidate_id).filter(Boolean),
        ...rptRows.map((r: any) => r.session?.candidate_id).filter(Boolean),
      ] as string[]),
    ];

    let nameMap = new Map<string, string>();
    if (allCandidateIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, name")
        .in("id", allCandidateIds);
      nameMap = new Map(
        (profiles ?? []).map((p: any) => [p.id, p.name]),
      );
    }

    /* Attach _candidateName to each row */
    const upcoming = (upRows ?? []).map((s: any) => {
      const profileName = s.candidate_id
        ? nameMap.get(s.candidate_id) ?? null
        : null;
      return {
        ...s,
        _candidateName:
          profileName ??
          (s.candidate_id
            ? `Candidate ${s.candidate_id.slice(0, 6)}`
            : null),
      };
    });

    const reports = rptRows.map((r: any) => {
      const session = r.session;
      const cid = session?.candidate_id as string | null;
      const profileName = cid ? nameMap.get(cid) ?? null : null;
      const sessionName =
        typeof session?.candidate_name === "string" &&
        session.candidate_name.trim() !== ""
          ? session.candidate_name.trim()
          : null;
      return {
        ...r,
        _candidateName:
          profileName ??
          sessionName ??
          (cid ? `Candidate ${cid.slice(0, 6)}` : "Candidate"),
      };
    });

    res.json({ upcoming, reports });
  },
);

export default router;

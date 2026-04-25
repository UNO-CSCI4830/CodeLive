import { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../lib/supabase";
import type { User } from "@supabase/supabase-js";

/** Augmented request type — available after requireAuth. */
export interface AuthRequest extends Request {
  user: User;
}

/**
 * Express middleware that validates the Supabase JWT from the
 * `Authorization: Bearer <token>` header and attaches the
 * authenticated user to `req.user`.
 *
 * Uses the service-role admin client so we don't create a new
 * Supabase client on every single request.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.slice(7);

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  /* Attach user to the request so downstream handlers can access it. */
  (req as AuthRequest).user = user;
  next();
}

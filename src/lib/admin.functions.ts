import { createServerFn, createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Auth + admin-role gate. Runs after requireSupabaseAuth and reuses its context. */
const requireAdmin = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { data } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!data) throw new Error("Acesso restrito a administradores.");
    return next();
  });

/** Global platform metrics (users, tags, reads, subscriptions, revenue). */
export const adminStats = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    const startMonth = new Date();
    startMonth.setDate(1);
    startMonth.setHours(0, 0, 0, 0);

    const [
      { count: users },
      { count: tags },
      { count: readsTotal },
      { count: readsToday },
      { count: readsMonth },
      { data: subs },
      { data: plans },
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("tags").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("reads").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("reads")
        .select("id", { count: "exact", head: true })
        .gte("created_at", startToday.toISOString()),
      supabaseAdmin
        .from("reads")
        .select("id", { count: "exact", head: true })
        .gte("created_at", startMonth.toISOString()),
      supabaseAdmin.from("subscriptions").select("plan_id, status").eq("status", "active"),
      supabaseAdmin.from("plans").select("id, name, price_cents").order("price_cents"),
    ]);

    const priceById = new Map((plans ?? []).map((p) => [p.id, p.price_cents]));
    const nameById = new Map((plans ?? []).map((p) => [p.id, p.name]));

    const revenueCents = (subs ?? []).reduce((sum, s) => sum + (priceById.get(s.plan_id) ?? 0), 0);

    // Plan distribution: active subs per plan; users without a subscription
    // count as the cheapest plan (Free), matching resolvePlanUsage's fallback.
    const distribution = new Map<string, number>();
    for (const p of plans ?? []) distribution.set(p.name, 0);
    for (const s of subs ?? []) {
      const name = nameById.get(s.plan_id);
      if (name) distribution.set(name, (distribution.get(name) ?? 0) + 1);
    }
    const freeName = (plans ?? [])[0]?.name;
    if (freeName) {
      const withoutSub = Math.max(0, (users ?? 0) - (subs?.length ?? 0));
      distribution.set(freeName, (distribution.get(freeName) ?? 0) + withoutSub);
    }

    return {
      users: users ?? 0,
      tags: tags ?? 0,
      reads_total: readsTotal ?? 0,
      reads_today: readsToday ?? 0,
      reads_month: readsMonth ?? 0,
      active_subscriptions: subs?.length ?? 0,
      revenue_cents: revenueCents,
      plan_distribution: Array.from(distribution.entries()).map(([name, count]) => ({ name, count })),
    };
  });

/** Paginated-ish user list with optional search, enriched with plan + tag count. */
export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .inputValidator((d: { search?: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    // Strip characters that would break the PostgREST .or() filter expression.
    const search = data.search?.trim().replace(/[,()*%]/g, "");
    if (search) query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);

    const { data: profiles, error } = await query;
    if (error) throw new Error(error.message);

    const [{ data: allTags }, { data: subs }, { data: plans }, { data: adminRoles }] =
      await Promise.all([
        supabaseAdmin.from("tags").select("user_id"),
        supabaseAdmin.from("subscriptions").select("user_id, plan_id, status"),
        supabaseAdmin.from("plans").select("id, name").order("price_cents"),
        supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin"),
      ]);

    const tagCount = new Map<string, number>();
    for (const t of allTags ?? []) {
      // Unclaimed stock tags have no owner yet.
      if (!t.user_id) continue;
      tagCount.set(t.user_id, (tagCount.get(t.user_id) ?? 0) + 1);
    }

    const planNameById = new Map((plans ?? []).map((p) => [p.id, p.name]));
    const planByUser = new Map(
      (subs ?? []).filter((s) => s.status === "active").map((s) => [s.user_id, s.plan_id]),
    );
    const freeName = (plans ?? [])[0]?.name ?? "Free";
    const adminSet = new Set((adminRoles ?? []).map((r) => r.user_id));

    return (profiles ?? []).map((p) => ({
      id: p.id,
      email: p.email,
      full_name: p.full_name,
      created_at: p.created_at,
      tag_count: tagCount.get(p.id) ?? 0,
      plan_id: planByUser.get(p.id) ?? null,
      plan_name: planByUser.has(p.id) ? planNameById.get(planByUser.get(p.id)!) ?? freeName : freeName,
      is_admin: adminSet.has(p.id),
    }));
  });

/** List of plans for the admin plan-picker. */
export const adminListPlans = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("plans")
      .select("id, name, price_cents, max_tags")
      .order("price_cents");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Production batches of pre-generated (unclaimed) tags. */
export const adminListBatches = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: batches, error } = await supabaseAdmin
      .from("tag_batches")
      .select("id, name, quantity, notes, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);

    // How many pieces of each batch have already been activated.
    const { data: claimed } = await supabaseAdmin
      .from("tags")
      .select("batch_id")
      .not("batch_id", "is", null)
      .not("claimed_at", "is", null);

    const claimedByBatch = new Map<string, number>();
    for (const t of claimed ?? []) {
      if (t.batch_id) claimedByBatch.set(t.batch_id, (claimedByBatch.get(t.batch_id) ?? 0) + 1);
    }

    return (batches ?? []).map((b) => ({ ...b, claimed: claimedByBatch.get(b.id) ?? 0 }));
  });

/** Generate a batch of unclaimed tags, each with a secret activation code. */
export const adminCreateBatch = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(80),
        quantity: z.number().int().min(1).max(500),
        notes: z.string().trim().max(500).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { newTagId } = await import("./tag-id");
    const { generateClaimCode, normalizeClaimCode } = await import("./claim-code");

    const { data: batch, error: batchError } = await supabaseAdmin
      .from("tag_batches")
      .insert({
        name: data.name,
        quantity: data.quantity,
        notes: data.notes ?? null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (batchError) throw new Error(batchError.message);

    const rows = Array.from({ length: data.quantity }, (_, i) => ({
      id: newTagId(),
      name: `${data.name} #${i + 1}`,
      user_id: null,
      claim_code: normalizeClaimCode(generateClaimCode()),
      batch_id: batch.id,
      status: "active" as const,
      destination_type: "url" as const,
      destination: {},
    }));

    const { error: insertError } = await supabaseAdmin.from("tags").insert(rows);
    if (insertError) throw new Error(insertError.message);

    return { ok: true, batchId: batch.id, quantity: rows.length };
  });

/**
 * Rows for the production export of a batch: public id, activation code and the
 * URL that goes into the printed QR. Admin-only — claim_code is secret.
 */
export const adminBatchTags = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .inputValidator((d: { batchId: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("tags")
      .select("id, claim_code, claimed_at")
      .eq("batch_id", data.batchId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Assign (or change) a user's active subscription plan. */
export const adminSetUserPlan = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), planId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("subscriptions")
      .upsert(
        { user_id: data.userId, plan_id: data.planId, status: "active" },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

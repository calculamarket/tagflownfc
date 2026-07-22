import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type PlanUsage = {
  plan: {
    id: string;
    name: string;
    max_tags: number;
    price_cents: number;
    features: string[];
  };
  used: number;
  remaining: number;
};

/**
 * Resolve the effective plan for a user (active subscription, or the cheapest
 * plan — Free — as fallback) together with current tag usage. Pure helper: uses
 * whatever Supabase client is passed in, so it works both with an RLS-scoped
 * user client and the admin client.
 */
export async function resolvePlanUsage(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<PlanUsage> {
  const [{ data: sub }, { data: plans }, { count }] = await Promise.all([
    supabase.from("subscriptions").select("plan_id, status").eq("user_id", userId).maybeSingle(),
    supabase
      .from("plans")
      .select("id, name, max_tags, price_cents, features")
      .order("price_cents", { ascending: true }),
    supabase.from("tags").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);

  const list = plans ?? [];
  const chosen =
    (sub?.status === "active" ? list.find((p) => p.id === sub.plan_id) : undefined) ?? list[0];

  const used = count ?? 0;
  const maxTags = chosen?.max_tags ?? 0;

  return {
    plan: {
      id: chosen?.id ?? "",
      name: chosen?.name ?? "Free",
      max_tags: maxTags,
      price_cents: chosen?.price_cents ?? 0,
      features: Array.isArray(chosen?.features) ? (chosen!.features as string[]) : [],
    },
    used,
    remaining: Math.max(0, maxTags - used),
  };
}

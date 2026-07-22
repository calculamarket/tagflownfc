import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolvePlanUsage } from "./plans";

/** Current plan + tag usage for the authenticated user. */
export const getMyPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => resolvePlanUsage(context.supabase, context.userId));

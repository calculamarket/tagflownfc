import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeClaimCode } from "./claim-code";
import { z } from "zod";

/**
 * Bind a pre-generated (unclaimed) tag to the signed-in user using the secret
 * activation code printed on the label.
 *
 * Runs with the service role because unclaimed tags have user_id NULL and are
 * therefore invisible to every RLS policy — the lookup could not work with the
 * caller's own client. Only the claimed tag's id is returned; nothing about
 * other tags is ever exposed.
 */
export const claimTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ code: z.string().min(4).max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    const code = normalizeClaimCode(data.code);
    if (code.length < 8) throw new Error("Código inválido.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();

    // A multi-QR piece (cube, triangle, totem) activates through its kit: one
    // code releases every face at once.
    const { data: kit } = await supabaseAdmin
      .from("tag_kits")
      .select("id, model, slots, user_id, claimed_at")
      .eq("claim_code", code)
      .maybeSingle();

    if (kit) {
      if (kit.claimed_at || kit.user_id) throw new Error("Código inválido ou já utilizado.");

      const { data: claimedKit, error: kitError } = await supabaseAdmin
        .from("tag_kits")
        .update({ user_id: context.userId, claimed_at: now })
        .eq("id", kit.id)
        .is("user_id", null) // guards against two people claiming at once
        .select("id")
        .maybeSingle();
      if (kitError) throw new Error(kitError.message);
      if (!claimedKit) throw new Error("Código inválido ou já utilizado.");

      const { error: tagsError } = await supabaseAdmin
        .from("tags")
        .update({ user_id: context.userId, claimed_at: now })
        .eq("kit_id", kit.id)
        .is("user_id", null);
      if (tagsError) throw new Error(tagsError.message);

      return { ok: true as const, kind: "kit" as const, id: kit.id, model: kit.model, slots: kit.slots };
    }

    // Single-QR piece: the code lives on the tag itself.
    const { data: tag, error } = await supabaseAdmin
      .from("tags")
      .select("id, name, user_id, claimed_at")
      .eq("claim_code", code)
      .maybeSingle();

    if (error) throw new Error(error.message);
    // Same message for "does not exist" and "already used" so the endpoint can't
    // be used to probe which codes are valid.
    if (!tag || tag.claimed_at || tag.user_id) {
      throw new Error("Código inválido ou já utilizado.");
    }

    const { error: updateError } = await supabaseAdmin
      .from("tags")
      .update({ user_id: context.userId, claimed_at: now })
      .eq("id", tag.id)
      .is("user_id", null);

    if (updateError) throw new Error(updateError.message);

    return { ok: true as const, kind: "tag" as const, id: tag.id, name: tag.name };
  });

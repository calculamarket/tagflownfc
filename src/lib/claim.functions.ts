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
/**
 * Claim an unclaimed piece by its public tag id — the "scan and activate"
 * flow, no code required. Security is physical: whoever can scan the piece
 * (before it is sold / while the QR is uncovered) can claim it. Only stock with
 * no owner is claimable, so tags created in the panel are never at risk.
 * Scanning any face of a multi-QR piece claims the whole kit.
 */
export const claimByTagId = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ tagId: z.string().min(1).max(32) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();

    const { data: tag } = await supabaseAdmin
      .from("tags")
      .select("id, name, user_id, kit_id")
      .eq("id", data.tagId)
      .maybeSingle();

    if (!tag) throw new Error("Etiqueta não encontrada.");
    if (tag.user_id) throw new Error("Esta etiqueta já foi ativada.");

    if (tag.kit_id) {
      const { data: claimedKit } = await supabaseAdmin
        .from("tag_kits")
        .update({ user_id: context.userId, claimed_at: now })
        .eq("id", tag.kit_id)
        .is("user_id", null) // race guard: first claimer wins
        .select("id, model")
        .maybeSingle();
      if (!claimedKit) throw new Error("Esta peça já foi ativada.");

      await supabaseAdmin
        .from("tags")
        .update({ user_id: context.userId, claimed_at: now })
        .eq("kit_id", tag.kit_id)
        .is("user_id", null);

      return { ok: true as const, kind: "kit" as const, id: claimedKit.id, model: claimedKit.model };
    }

    const { data: claimed } = await supabaseAdmin
      .from("tags")
      .update({ user_id: context.userId, claimed_at: now })
      .eq("id", tag.id)
      .is("user_id", null)
      .select("id, name")
      .maybeSingle();
    if (!claimed) throw new Error("Esta etiqueta já foi ativada.");

    return { ok: true as const, kind: "tag" as const, id: claimed.id, name: claimed.name };
  });

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

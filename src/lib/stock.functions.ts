import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Pre-generate unclaimed tags ("stock") so a piece can be printed and sold
 * ready-made: the buyer scans the printed QR, signs in and activates it,
 * choosing the destination afterwards — the same flow used by /ativar.
 *
 * The rows are created with user_id NULL, which is what the public resolver
 * treats as "unclaimed" and turns into the activation screen.
 */
export const createStockTags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(60).default("Placa Pix"),
        quantity: z.number().int().min(1).max(200),
        model: z.string().trim().min(1).max(40).default("Placa Pix"),
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
        model: data.model,
        slots: 1,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (batchError) throw new Error(batchError.message);

    const rows = Array.from({ length: data.quantity }, (_, i) => ({
      id: newTagId(),
      name: data.quantity > 1 ? `${data.name} #${i + 1}` : data.name,
      user_id: null,
      batch_id: batch.id,
      slot: 1,
      status: "active" as const,
      destination_type: "url" as const,
      destination: {},
      claim_code: normalizeClaimCode(generateClaimCode()),
    }));

    const { error } = await supabaseAdmin.from("tags").insert(rows);
    if (error) throw new Error(error.message);

    return {
      batchId: batch.id,
      tags: rows.map((r, i) => ({ index: i + 1, id: r.id, code: r.claim_code })),
    };
  });

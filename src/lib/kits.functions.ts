import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Every piece the user owns, with its faces. */
export const listKits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: kits, error } = await supabase
      .from("tag_kits")
      .select("id, model, slots, claimed_at")
      .eq("user_id", userId)
      .order("claimed_at", { ascending: false });
    if (error) throw new Error(error.message);
    if (!kits?.length) return [];

    const { data: tags } = await supabase
      .from("tags")
      .select("id, name, slot, slot_label, destination_type, status, read_count, kit_id")
      .in(
        "kit_id",
        kits.map((k) => k.id),
      )
      .order("slot", { ascending: true });

    return kits.map((kit) => ({
      ...kit,
      faces: (tags ?? []).filter((t) => t.kit_id === kit.id),
    }));
  });

/** A single piece with its faces, for the configuration screen. */
export const getKit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: kit, error } = await supabase
      .from("tag_kits")
      .select("id, model, slots, claimed_at")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!kit) throw new Error("Peça não encontrada.");

    const { data: faces } = await supabase
      .from("tags")
      .select("id, name, slot, slot_label, destination, destination_type, status, read_count")
      .eq("kit_id", kit.id)
      .order("slot", { ascending: true });

    return { ...kit, faces: faces ?? [] };
  });

/** Rename a face ("Frente", "Cardápio", …) so the piece matches how it is used. */
export const renameFace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ tagId: z.string().min(1), label: z.string().trim().max(60) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // RLS keeps this to the owner's own tags.
    const { error } = await context.supabase
      .from("tags")
      .update({ slot_label: data.label || null })
      .eq("id", data.tagId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

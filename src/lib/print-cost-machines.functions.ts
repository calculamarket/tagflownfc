import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Perfis de máquina salvos (preço, vida útil, potência, custo do kWh) para o
// usuário só selecionar depois em vez de digitar de novo. Nome único por
// usuário — salvar de novo com o mesmo nome atualiza o perfil (upsert).
const machineSchema = z.object({
  name: z.string().trim().min(1).max(80),
  machine_price_cents: z.number().int().min(0),
  machine_life_hours: z.number().min(0),
  power_watts: z.number().min(0),
  kwh_price_cents: z.number().int().min(0),
});

export const listMachines = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("print_cost_machines")
      .select("*")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveMachine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => machineSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase
      .from("print_cost_machines")
      .upsert({ ...data, user_id: context.userId }, { onConflict: "user_id,name" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteMachine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("print_cost_machines").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

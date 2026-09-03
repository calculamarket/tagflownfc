import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Entradas: percentuais/grandezas físicas como número, dinheiro em CENTAVOS
// (inteiros) para bater com as colunas *_cents da tabela.
const saveSchema = z.object({
  tag_id: z.string().min(1).max(32).nullable().optional(),
  label: z.string().trim().max(120).nullable().optional(),

  machine_price_cents: z.number().int().min(0),
  machine_life_hours: z.number().min(0),
  power_watts: z.number().min(0),
  kwh_price_cents: z.number().int().min(0),
  filament_grams: z.number().min(0),
  filament_price_kg_cents: z.number().int().min(0),
  waste_pct: z.number().min(0),
  print_hours: z.number().min(0),
  prep_minutes: z.number().min(0),
  labor_hour_cents: z.number().int().min(0),
  failure_rate_pct: z.number().min(0),
  extra_costs_cents: z.number().int().min(0),
  margin_pct: z.number().min(0),
  sells_marketplace: z.boolean(),
  marketplace_fee_pct: z.number().min(0),

  cost_filament_cents: z.number().int(),
  cost_energy_cents: z.number().int(),
  cost_depreciation_cents: z.number().int(),
  cost_labor_cents: z.number().int(),
  cost_base_cents: z.number().int(),
  cost_with_failure_cents: z.number().int(),
  suggested_price_cents: z.number().int(),
  net_profit_cents: z.number().int(),
  real_margin_pct: z.number(),
});

export const listCostCalculations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("print_cost_calculations")
      .select("*, tag:tags(id, name)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveCostCalculation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => saveSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase
      .from("print_cost_calculations")
      .insert({ ...data, user_id: context.userId, tag_id: data.tag_id ?? null })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteCostCalculation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("print_cost_calculations")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Meta de lucro por máquina/mês + capacidade (horas/dia × dias/mês). Uma
// linha por usuário — não é histórico, é a configuração corrente.
const settingsSchema = z.object({
  profit_goal_cents: z.number().int().min(0),
  machine_hours_per_day: z.number().min(0).max(24),
  machine_days_per_month: z.number().min(0).max(31),
});

export const getCostSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("print_cost_settings")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const saveCostSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => settingsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("print_cost_settings")
      .upsert(
        { ...data, user_id: context.userId, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Cálculo de custo de impressão 3D. As fórmulas replicam exatamente a versão
// standalone da calculadora — não altere a ordem nem os operadores sem revisar
// os testes de aceitação junto ao usuário.

export type PrintCostInputs = {
  machinePrice: number; // preço da máquina (R$)
  machineLifeHours: number; // vida útil (h)
  powerWatts: number; // potência (W)
  kwhPrice: number; // custo do kWh (R$)
  filamentGrams: number; // peso do filamento (g)
  filamentPriceKg: number; // preço do filamento (R$/kg)
  wastePct: number; // % perda/purga
  printHours: number; // tempo de impressão (h)
  prepMinutes: number; // tempo de preparo/pós (min)
  laborHour: number; // valor da hora de trabalho (R$)
  failureRatePct: number; // % taxa de falha
  extraCosts: number; // custos extras (R$)
  marginPct: number; // % margem desejada
  sellsMarketplace: boolean;
  marketplaceFeePct: number; // % comissão do marketplace
};

export type PrintCostResult = {
  custoFilamento: number;
  custoEnergia: number;
  custoDepreciacao: number;
  custoMaoDeObra: number;
  custoBase: number;
  custoComFalha: number;
  precoVendaSugerido: number;
  lucroLiquido: number;
  margemReal: number;
};

export const EMPTY_INPUTS: PrintCostInputs = {
  machinePrice: 0,
  machineLifeHours: 0,
  powerWatts: 0,
  kwhPrice: 0,
  filamentGrams: 0,
  filamentPriceKg: 0,
  wastePct: 0,
  printHours: 0,
  prepMinutes: 0,
  laborHour: 0,
  failureRatePct: 0,
  extraCosts: 0,
  marginPct: 0,
  sellsMarketplace: false,
  marketplaceFeePct: 0,
};

const safe = (n: number) => (Number.isFinite(n) ? n : 0);

/** Replica exatamente a lógica da calculadora standalone. */
export function calcPrintCost(i: PrintCostInputs): PrintCostResult {
  const comissao = i.sellsMarketplace ? safe(i.marketplaceFeePct) : 0;

  const custoFilamento =
    (safe(i.filamentGrams) * (1 + safe(i.wastePct) / 100) / 1000) * safe(i.filamentPriceKg);

  const custoEnergia = (safe(i.powerWatts) / 1000) * safe(i.printHours) * safe(i.kwhPrice);

  const deprecPorHora =
    safe(i.machineLifeHours) > 0 ? safe(i.machinePrice) / safe(i.machineLifeHours) : 0;
  const custoDepreciacao = deprecPorHora * safe(i.printHours);

  const custoMaoDeObra = (safe(i.prepMinutes) / 60) * safe(i.laborHour);

  const custoBase =
    custoFilamento + custoEnergia + custoDepreciacao + custoMaoDeObra + safe(i.extraCosts);

  // Divisores podem zerar/negativar com entradas extremas: protege contra
  // Infinity/negativo para a UI não quebrar enquanto o usuário digita.
  const failureDiv = 1 - safe(i.failureRatePct) / 100;
  const custoComFalha = failureDiv > 0 ? custoBase / failureDiv : custoBase;

  const priceDiv = 1 - safe(i.marginPct) / 100 - comissao / 100;
  const precoVendaSugerido = priceDiv > 0 ? custoComFalha / priceDiv : 0;

  const lucroLiquido =
    precoVendaSugerido - custoComFalha - (precoVendaSugerido * comissao) / 100;

  const margemReal =
    precoVendaSugerido > 0 ? (lucroLiquido / precoVendaSugerido) * 100 : 0;

  return {
    custoFilamento,
    custoEnergia,
    custoDepreciacao,
    custoMaoDeObra,
    custoBase,
    custoComFalha,
    precoVendaSugerido,
    lucroLiquido,
    margemReal,
  };
}

export function formatBRL(v: number): string {
  return (Number.isFinite(v) ? v : 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

const toCents = (v: number) => Math.round(safe(v) * 100);

/** Empacota inputs + resultados no formato de linha do banco (valores em centavos). */
export function toCalculationRow(i: PrintCostInputs, r: PrintCostResult) {
  return {
    machine_price_cents: toCents(i.machinePrice),
    machine_life_hours: safe(i.machineLifeHours),
    power_watts: safe(i.powerWatts),
    kwh_price_cents: toCents(i.kwhPrice),
    filament_grams: safe(i.filamentGrams),
    filament_price_kg_cents: toCents(i.filamentPriceKg),
    waste_pct: safe(i.wastePct),
    print_hours: safe(i.printHours),
    prep_minutes: safe(i.prepMinutes),
    labor_hour_cents: toCents(i.laborHour),
    failure_rate_pct: safe(i.failureRatePct),
    extra_costs_cents: toCents(i.extraCosts),
    margin_pct: safe(i.marginPct),
    sells_marketplace: i.sellsMarketplace,
    marketplace_fee_pct: safe(i.marketplaceFeePct),
    cost_filament_cents: toCents(r.custoFilamento),
    cost_energy_cents: toCents(r.custoEnergia),
    cost_depreciation_cents: toCents(r.custoDepreciacao),
    cost_labor_cents: toCents(r.custoMaoDeObra),
    cost_base_cents: toCents(r.custoBase),
    cost_with_failure_cents: toCents(r.custoComFalha),
    suggested_price_cents: toCents(r.precoVendaSugerido),
    net_profit_cents: toCents(r.lucroLiquido),
    real_margin_pct: safe(r.margemReal),
  };
}

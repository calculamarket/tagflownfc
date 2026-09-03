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
  taxPct: number; // % de imposto sobre a venda (ex.: Simples Nacional)
  sellsMarketplace: boolean;
  marketplaceFeePct: number; // % comissão do marketplace
  affiliateFeePct: number; // % comissão para afiliados (só quando vende em marketplace)
};

export type PrintCostResult = {
  custoFilamento: number;
  custoEnergia: number;
  custoDepreciacao: number;
  custoMaoDeObra: number;
  custoBase: number;
  custoComFalha: number;
  /** Imposto sobre a venda, em R$ (percentual aplicado sobre o preço de venda sugerido). */
  custoImposto: number;
  /** Comissão do marketplace, em R$ (0 quando não vende em marketplace). */
  custoComissaoMarketplace: number;
  /** Comissão de afiliados, em R$ (0 quando não vende em marketplace). */
  custoComissaoAfiliados: number;
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
  taxPct: 0,
  sellsMarketplace: false,
  marketplaceFeePct: 0,
  affiliateFeePct: 0,
};

const safe = (n: number) => (Number.isFinite(n) ? n : 0);

/** Replica exatamente a lógica da calculadora standalone. */
export function calcPrintCost(i: PrintCostInputs): PrintCostResult {
  // Comissão de marketplace e de afiliados só valem quando a venda é em
  // marketplace; o imposto incide sempre que há venda.
  const marketplacePct = i.sellsMarketplace ? safe(i.marketplaceFeePct) : 0;
  const affiliatePct = i.sellsMarketplace ? safe(i.affiliateFeePct) : 0;
  const taxPct = safe(i.taxPct);
  const totalFeePct = marketplacePct + affiliatePct + taxPct;

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

  const priceDiv = 1 - safe(i.marginPct) / 100 - totalFeePct / 100;
  const precoVendaSugerido = priceDiv > 0 ? custoComFalha / priceDiv : 0;

  const custoImposto = (precoVendaSugerido * taxPct) / 100;
  const custoComissaoMarketplace = (precoVendaSugerido * marketplacePct) / 100;
  const custoComissaoAfiliados = (precoVendaSugerido * affiliatePct) / 100;

  const lucroLiquido =
    precoVendaSugerido -
    custoComFalha -
    custoImposto -
    custoComissaoMarketplace -
    custoComissaoAfiliados;

  const margemReal =
    precoVendaSugerido > 0 ? (lucroLiquido / precoVendaSugerido) * 100 : 0;

  return {
    custoFilamento,
    custoEnergia,
    custoDepreciacao,
    custoMaoDeObra,
    custoBase,
    custoComFalha,
    custoImposto,
    custoComissaoMarketplace,
    custoComissaoAfiliados,
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
    tax_pct: safe(i.taxPct),
    sells_marketplace: i.sellsMarketplace,
    marketplace_fee_pct: safe(i.marketplaceFeePct),
    affiliate_fee_pct: safe(i.affiliateFeePct),
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

/** Meta de lucro por máquina/mês e o regime de operação usado para calcular a capacidade. */
export type CapacityGoalInputs = {
  /** Meta de lucro líquido por máquina, em R$/mês. */
  profitGoal: number;
  machineHoursPerDay: number;
  machineDaysPerMonth: number;
};

export type CapacityGoalResult = {
  /** Horas de produção disponíveis por mês (horas/dia × dias/mês). */
  monthlyCapacityHours: number;
  /** Máximo de unidades que a máquina imprime no mês, dado o tempo de impressão do produto. */
  maxUnitsPerMonth: number;
  /** Unidades/mês necessárias para bater a meta. Null quando o produto não dá lucro (meta inatingível a qualquer quantidade). */
  neededUnitsForGoal: number | null;
  /** Dá pra bater a meta sem estourar a capacidade da máquina? */
  feasible: boolean;
  /** % da capacidade mensal usada (para bater a meta, ou rodando no máximo quando inviável). */
  utilizationPct: number;
  /** Lucro possível nesse produto rodando a máquina 100% do tempo disponível. */
  maxProfitAtCapacity: number;
};

/**
 * Quanto vender de um produto por mês para bater a meta de lucro por máquina,
 * sempre limitado às horas de impressão que a máquina tem disponíveis no mês.
 */
export function calcCapacityGoal(
  printHours: number,
  profitPerUnit: number,
  goal: CapacityGoalInputs,
): CapacityGoalResult {
  const monthlyCapacityHours = Math.max(
    0,
    safe(goal.machineHoursPerDay) * safe(goal.machineDaysPerMonth),
  );
  const ph = safe(printHours);
  const maxUnitsPerMonth = ph > 0 ? Math.floor(monthlyCapacityHours / ph) : 0;
  const maxProfitAtCapacity = maxUnitsPerMonth * safe(profitPerUnit);

  if (profitPerUnit <= 0) {
    return {
      monthlyCapacityHours,
      maxUnitsPerMonth,
      neededUnitsForGoal: null,
      feasible: false,
      utilizationPct: 0,
      maxProfitAtCapacity,
    };
  }

  const neededUnitsForGoal = Math.ceil(safe(goal.profitGoal) / profitPerUnit);
  const feasible = neededUnitsForGoal <= maxUnitsPerMonth;
  const unitsForUtilization = feasible ? neededUnitsForGoal : maxUnitsPerMonth;
  const utilizationPct =
    monthlyCapacityHours > 0 ? ((unitsForUtilization * ph) / monthlyCapacityHours) * 100 : 0;

  return {
    monthlyCapacityHours,
    maxUnitsPerMonth,
    neededUnitsForGoal,
    feasible,
    utilizationPct,
    maxProfitAtCapacity,
  };
}

/** Um produto candidato ao mix de produção — os únicos dados que o plano precisa. */
export type MixProduct = {
  id: string;
  label: string;
  printHours: number;
  profitPerUnit: number;
};

/** Quanto vender de um produto dentro do plano de mix, e quanto isso consome/gera. */
export type ProductionMixItem = {
  id: string;
  label: string;
  units: number;
  hoursUsed: number;
  profit: number;
  /** Lucro por hora de máquina desse produto — é o critério usado para ranquear os "melhores itens". */
  profitPerHour: number;
};

export type ProductionMixResult = {
  /** Produtos a produzir, ranqueados do melhor pro pior lucro/hora — os "melhores itens" a vender. */
  items: ProductionMixItem[];
  monthlyCapacityHours: number;
  totalHoursUsed: number;
  totalProfit: number;
  profitGoal: number;
  /** Bate a meta usando 100% da capacidade mensal com os produtos cadastrados? */
  feasible: boolean;
  /** Quanto falta para a meta mesmo usando 100% da capacidade com o mix atual. */
  shortfall: number;
  /** Quanto o lucro do mix passa da meta, usando toda a capacidade disponível. */
  surplus: number;
};

/**
 * Monta o plano de produção do mês: usa 100% da capacidade disponível da
 * máquina (horas/dia × dias/mês) alocando primeiro para o produto cadastrado
 * com maior lucro por hora, depois o próximo melhor, e assim por diante até a
 * capacidade se esgotar — mostrando o lucro máximo possível no mês com o mix
 * atual de produtos, não só o mínimo para bater a meta.
 */
export function calcProductionMix(
  products: MixProduct[],
  goal: CapacityGoalInputs,
): ProductionMixResult {
  const monthlyCapacityHours = Math.max(
    0,
    safe(goal.machineHoursPerDay) * safe(goal.machineDaysPerMonth),
  );
  const profitGoal = safe(goal.profitGoal);

  // Só entram no mix produtos que de fato consomem tempo de máquina e dão lucro
  // — os demais não ajudam a decidir o que produzir.
  const candidates = products
    .filter((p) => safe(p.printHours) > 0 && safe(p.profitPerUnit) > 0)
    .map((p) => ({ ...p, density: safe(p.profitPerUnit) / safe(p.printHours) }))
    .sort((a, b) => b.density - a.density);

  let remainingHours = monthlyCapacityHours;
  let cumulativeProfit = 0;
  const items: ProductionMixItem[] = [];

  for (const p of candidates) {
    if (remainingHours <= 0) break;

    const units = Math.floor(remainingHours / p.printHours);
    if (units <= 0) continue;

    const hoursUsed = units * p.printHours;
    const profit = units * p.profitPerUnit;
    items.push({ id: p.id, label: p.label, units, hoursUsed, profit, profitPerHour: p.density });
    cumulativeProfit += profit;
    remainingHours -= hoursUsed;
  }

  return {
    items,
    monthlyCapacityHours,
    totalHoursUsed: monthlyCapacityHours - remainingHours,
    totalProfit: cumulativeProfit,
    profitGoal,
    feasible: cumulativeProfit >= profitGoal,
    shortfall: Math.max(0, profitGoal - cumulativeProfit),
    surplus: Math.max(0, cumulativeProfit - profitGoal),
  };
}

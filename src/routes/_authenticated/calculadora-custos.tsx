import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listTags } from "@/lib/tags.functions";
import {
  listCostCalculations,
  saveCostCalculation,
  deleteCostCalculation,
  getCostSettings,
  saveCostSettings,
} from "@/lib/print-cost.functions";
import {
  calcPrintCost,
  calcCapacityGoal,
  calcProductionMix,
  formatBRL,
  toCalculationRow,
  EMPTY_INPUTS,
  type PrintCostInputs,
  type CapacityGoalInputs,
  type CapacityGoalResult,
} from "@/lib/print-cost";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from "@/components/ui/command";
import {
  Calculator,
  Save,
  Trash2,
  ChevronsUpDown,
  Check,
  Package,
  Target,
  ClipboardList,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/calculadora-custos")({
  head: () => ({ meta: [{ title: "Calculadora de Custos · 3D QR" }] }),
  component: CalculatorPage,
});

type FieldKey = Exclude<keyof PrintCostInputs, "sellsMarketplace">;
type FieldDef = {
  key: FieldKey;
  label: string;
  suffix?: string;
  prefix?: string;
  placeholder?: string;
  /** "duration" renderiza campos separados de horas/minutos em vez do NumberField genérico. */
  kind?: "duration";
};

const SECTIONS: { title: string; hint?: string; fields: FieldDef[] }[] = [
  {
    title: "Máquina e energia",
    hint: "Potência = consumo médio da impressora (≈150 W). kWh = preço da sua energia (≈ R$ 0,75 por kWh, não R$ 75).",
    fields: [
      { key: "machinePrice", label: "Preço da máquina", prefix: "R$", placeholder: "2000" },
      { key: "machineLifeHours", label: "Vida útil", suffix: "h", placeholder: "5000" },
      { key: "powerWatts", label: "Potência", suffix: "W", placeholder: "150" },
      { key: "kwhPrice", label: "Custo do kWh", prefix: "R$", placeholder: "0,75" },
    ],
  },
  {
    title: "Filamento",
    fields: [
      { key: "filamentGrams", label: "Peso do filamento", suffix: "g" },
      { key: "filamentPriceKg", label: "Preço do filamento", prefix: "R$", suffix: "/kg" },
      { key: "wastePct", label: "Perda / purga", suffix: "%" },
    ],
  },
  {
    title: "Tempo e mão de obra",
    fields: [
      { key: "printHours", label: "Tempo de impressão", kind: "duration" },
      { key: "prepMinutes", label: "Preparo / pós-processo", suffix: "min" },
      { key: "laborHour", label: "Valor da hora de trabalho", prefix: "R$" },
    ],
  },
  {
    title: "Risco, extras e margem",
    fields: [
      { key: "failureRatePct", label: "Taxa de falha", suffix: "%" },
      { key: "extraCosts", label: "Custos extras", prefix: "R$" },
      { key: "marginPct", label: "Margem desejada", suffix: "%" },
      { key: "taxPct", label: "Imposto sobre a venda", suffix: "%" },
    ],
  },
];

function CalculatorPage() {
  const qc = useQueryClient();
  const [inputs, setInputs] = useState<PrintCostInputs>(EMPTY_INPUTS);
  const [tagId, setTagId] = useState<string | null>(null);
  const [label, setLabel] = useState("");

  const { data: tags = [] } = useQuery({ queryKey: ["tags"], queryFn: () => listTags() });
  const { data: history = [] } = useQuery({
    queryKey: ["cost-calculations"],
    queryFn: () => listCostCalculations(),
  });

  // Meta de lucro por máquina/mês + capacidade (horas/dia × dias/mês). Usada
  // pela tabela de Produtos Calculados abaixo para dizer quanto vender de
  // cada produto para bater a meta, dentro do limite de horas da máquina.
  const [profitGoal, setProfitGoal] = useState(1000);
  const [hoursPerDay, setHoursPerDay] = useState(16);
  const [daysPerMonth, setDaysPerMonth] = useState(30);
  const [settingsSeeded, setSettingsSeeded] = useState(false);

  const { data: costSettings } = useQuery({
    queryKey: ["cost-settings"],
    queryFn: () => getCostSettings(),
  });

  useEffect(() => {
    if (costSettings && !settingsSeeded) {
      setProfitGoal(costSettings.profit_goal_cents / 100);
      setHoursPerDay(Number(costSettings.machine_hours_per_day));
      setDaysPerMonth(Number(costSettings.machine_days_per_month));
      setSettingsSeeded(true);
    }
  }, [costSettings, settingsSeeded]);

  const goalInputs: CapacityGoalInputs = {
    profitGoal,
    machineHoursPerDay: hoursPerDay,
    machineDaysPerMonth: daysPerMonth,
  };
  const monthlyCapacityHours = Math.max(0, hoursPerDay * daysPerMonth);

  // Plano de produção do mês: quanto vender de cada produto cadastrado para
  // bater a meta de lucro, usando a capacidade da máquina da forma mais
  // eficiente (mais lucro/hora primeiro).
  const productionMix = calcProductionMix(
    history.map((h) => ({
      id: h.id,
      label: h.label || (h as { tag?: { name?: string } | null }).tag?.name || "Sem nome",
      printHours: Number(h.print_hours),
      profitPerUnit: h.net_profit_cents / 100,
    })),
    goalInputs,
  );

  const saveSettings = useMutation({
    mutationFn: () =>
      saveCostSettings({
        data: {
          profit_goal_cents: Math.round(profitGoal * 100),
          machine_hours_per_day: hoursPerDay,
          machine_days_per_month: daysPerMonth,
        },
      }),
    onSuccess: () => {
      toast.success("Meta de produção salva.");
      qc.invalidateQueries({ queryKey: ["cost-settings"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const result = useMemo(() => calcPrintCost(inputs), [inputs]);

  const selectedTag = tags.find((t) => t.id === tagId) ?? null;

  const save = useMutation({
    mutationFn: () =>
      saveCostCalculation({
        data: {
          tag_id: tagId,
          label: label.trim() || selectedTag?.name || null,
          ...toCalculationRow(inputs, result),
        },
      }),
    onSuccess: () => {
      toast.success("Cálculo salvo no histórico.");
      qc.invalidateQueries({ queryKey: ["cost-calculations"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteCostCalculation({ data: { id } }),
    onSuccess: () => {
      toast.success("Cálculo removido.");
      qc.invalidateQueries({ queryKey: ["cost-calculations"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const setField = (key: FieldKey, raw: string) =>
    setInputs((s) => ({ ...s, [key]: parseDecimal(raw) }));

  const hasData = inputs.printHours > 0 || inputs.filamentGrams > 0 || inputs.machinePrice > 0;

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-lg bg-primary/10 grid place-items-center text-primary">
          <Calculator className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calculadora de Custos 3D</h1>
          <p className="text-sm text-muted-foreground">
            Calcule o custo real de cada peça impressa e o preço de venda sugerido.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px] items-start">
        {/* Formulário */}
        <div className="space-y-6">
          {/* Vínculo com produto */}
          <div className="rounded-lg border border-border bg-card p-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Vincular a uma tag (opcional)</Label>
                <TagCombobox
                  tags={tags}
                  value={tagId}
                  onChange={setTagId}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Nome do cálculo</Label>
                <Input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder={selectedTag?.name || "Ex.: Chaveiro coração"}
                />
              </div>
            </div>
          </div>

          {SECTIONS.map((section) => (
            <div key={section.title} className="rounded-lg border border-border bg-card p-5">
              <div className="text-sm font-semibold">{section.title}</div>
              {section.hint && (
                <p className="mt-1 mb-3 text-xs text-muted-foreground">{section.hint}</p>
              )}
              <div className={cn("grid gap-4 sm:grid-cols-3", !section.hint && "mt-4")}>
                {section.fields.map((f) =>
                  f.kind === "duration" ? (
                    <DurationField
                      key={f.key}
                      label={f.label}
                      value={inputs[f.key]}
                      onChange={(hours) => setInputs((s) => ({ ...s, [f.key]: hours }))}
                    />
                  ) : (
                    <NumberField
                      key={f.key}
                      def={f}
                      value={inputs[f.key]}
                      onChange={(v) => setField(f.key, v)}
                    />
                  ),
                )}
              </div>
            </div>
          ))}

          {/* Marketplace */}
          <div className="rounded-lg border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Vende em marketplace?</div>
                <p className="text-xs text-muted-foreground">
                  Inclui a comissão da plataforma no preço sugerido.
                </p>
              </div>
              <Switch
                checked={inputs.sellsMarketplace}
                onCheckedChange={(v) => setInputs((s) => ({ ...s, sellsMarketplace: v }))}
              />
            </div>
            {inputs.sellsMarketplace && (
              <div className="grid gap-4 sm:grid-cols-3">
                <NumberField
                  def={{ key: "marketplaceFeePct", label: "Comissão do marketplace", suffix: "%" }}
                  value={inputs.marketplaceFeePct}
                  onChange={(v) => setField("marketplaceFeePct", v)}
                />
                <NumberField
                  def={{ key: "affiliateFeePct", label: "Comissão para afiliados", suffix: "%" }}
                  value={inputs.affiliateFeePct}
                  onChange={(v) => setField("affiliateFeePct", v)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Resultado (sticky) */}
        <div className="lg:sticky lg:top-6 space-y-4">
          <div className="rounded-lg border border-border bg-card p-5 space-y-3">
            <div className="text-sm font-semibold">Resultado</div>

            <Row label="Tempo de impressão" value={formatDuration(inputs.printHours)} />
            <Row label="Filamento" value={formatBRL(result.custoFilamento)} />
            <Row label="Energia" value={formatBRL(result.custoEnergia)} />
            <Row label="Depreciação" value={formatBRL(result.custoDepreciacao)} />
            <Row label="Mão de obra" value={formatBRL(result.custoMaoDeObra)} />
            <div className="border-t border-border pt-3">
              <Row label="Custo base" value={formatBRL(result.custoBase)} strong />
              <Row label="Custo com falha" value={formatBRL(result.custoComFalha)} />
            </div>

            {(result.custoImposto > 0 ||
              result.custoComissaoMarketplace > 0 ||
              result.custoComissaoAfiliados > 0) && (
              <div className="border-t border-border pt-3">
                {result.custoImposto > 0 && (
                  <Row label="Imposto sobre a venda" value={formatBRL(result.custoImposto)} />
                )}
                {result.custoComissaoMarketplace > 0 && (
                  <Row
                    label="Comissão marketplace"
                    value={formatBRL(result.custoComissaoMarketplace)}
                  />
                )}
                {result.custoComissaoAfiliados > 0 && (
                  <Row
                    label="Comissão afiliados"
                    value={formatBRL(result.custoComissaoAfiliados)}
                  />
                )}
              </div>
            )}

            <div className="rounded-md bg-primary/10 p-3 space-y-2">
              <div className="text-xs text-muted-foreground">Preço de venda sugerido</div>
              <div className="text-2xl font-semibold text-primary">
                {formatBRL(result.precoVendaSugerido)}
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Lucro líquido</span>
                <span className="font-medium">{formatBRL(result.lucroLiquido)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Margem real</span>
                <span className="font-medium">{result.margemReal.toFixed(1)}%</span>
              </div>
            </div>

            <Button
              className="w-full"
              disabled={!hasData || save.isPending}
              onClick={() => save.mutate()}
            >
              <Save className="size-4" /> {save.isPending ? "Salvando…" : "Salvar no histórico"}
            </Button>
          </div>
        </div>
      </div>

      {/* Meta de produção por máquina */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Target className="size-4 text-primary" />
          <div className="text-sm font-semibold">Meta de produção por máquina</div>
        </div>
        <p className="text-xs text-muted-foreground">
          Defina quanto cada máquina precisa lucrar por mês e quantas horas por mês ela roda. A
          tabela de Produtos Calculados abaixo usa isso para mostrar quanto vender de cada produto
          para bater a meta — sempre dentro do limite de horas disponíveis da máquina.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <GoalField
            label="Meta de lucro líquido / máquina / mês"
            prefix="R$"
            value={profitGoal}
            onChange={setProfitGoal}
          />
          <GoalField
            label="Horas de operação por dia"
            suffix="h"
            value={hoursPerDay}
            onChange={setHoursPerDay}
          />
          <GoalField
            label="Dias de operação por mês"
            suffix="dias"
            value={daysPerMonth}
            onChange={setDaysPerMonth}
          />
        </div>
        <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
          <span className="text-xs text-muted-foreground">Capacidade mensal por máquina</span>
          <span className="text-sm font-semibold">{formatDuration(monthlyCapacityHours)}</span>
        </div>
        <Button size="sm" disabled={saveSettings.isPending} onClick={() => saveSettings.mutate()}>
          <Save className="size-4" /> {saveSettings.isPending ? "Salvando…" : "Salvar meta"}
        </Button>
      </div>

      {/* Plano de produção (mix de produtos) */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="size-4 text-primary" />
          <div className="text-sm font-semibold">Plano de produção do mês</div>
        </div>
        <p className="text-xs text-muted-foreground">
          Com os produtos cadastrados e a capacidade da máquina, este é o jeito mais eficiente de
          usar as horas disponíveis: começa pelo produto de maior lucro por hora e completa com os
          seguintes até bater a meta.
        </p>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Cadastre ao menos um produto calculado para ver o plano de produção.
          </p>
        ) : (
          <>
            {productionMix.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum produto cadastrado dá lucro hoje — ajuste os cálculos para gerar um plano.
              </p>
            ) : (
              <ol className="space-y-2">
                {productionMix.items.map((item, idx) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2 text-sm"
                  >
                    <span>
                      <span className="font-semibold">{idx + 1}.</span> Vender{" "}
                      <span className="font-semibold">{item.units} un</span> de {item.label}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDuration(item.hoursUsed)} · {formatBRL(item.profit)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
            <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
              <span className="text-xs text-muted-foreground">Capacidade usada no plano</span>
              <span className="text-sm font-semibold">
                {formatDuration(productionMix.totalHoursUsed)} de{" "}
                {formatDuration(productionMix.monthlyCapacityHours)}
              </span>
            </div>
            {productionMix.feasible ? (
              <div className="rounded-md bg-success/15 px-3 py-2 text-sm text-success">
                Meta batida: lucro estimado de {formatBRL(productionMix.totalProfit)} (meta{" "}
                {formatBRL(profitGoal)}).
              </div>
            ) : (
              <div className="rounded-md bg-warning/15 px-3 py-2 text-sm text-warning-foreground">
                Mesmo usando 100% da capacidade com os produtos cadastrados, faltam{" "}
                {formatBRL(productionMix.shortfall)} para a meta de {formatBRL(profitGoal)}.
              </div>
            )}
          </>
        )}
      </div>

      {/* Produtos calculados */}
      <div className="rounded-lg border border-border bg-card">
        <div className="p-5 border-b border-border">
          <div className="font-semibold">Produtos Calculados</div>
          <p className="text-sm text-muted-foreground">
            Seus cálculos salvos, mais recentes primeiro — com quanto vender por mês para bater a
            meta de lucro por máquina, dentro da capacidade disponível.
          </p>
        </div>
        {history.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            Nenhum cálculo salvo ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium">Cálculo</th>
                  <th className="px-4 py-3 font-medium">Tag</th>
                  <th className="px-4 py-3 font-medium">Custo</th>
                  <th className="px-4 py-3 font-medium">Preço sugerido</th>
                  <th className="px-4 py-3 font-medium">Margem</th>
                  <th className="px-4 py-3 font-medium">Qtd./mês p/ meta</th>
                  <th className="px-4 py-3 font-medium">Capacidade máx./mês</th>
                  <th className="px-4 py-3 font-medium">Situação</th>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {history.map((h) => {
                  const goal = calcCapacityGoal(
                    Number(h.print_hours),
                    h.net_profit_cents / 100,
                    goalInputs,
                  );
                  return (
                    <tr key={h.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{h.label || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {(h as { tag?: { name?: string } | null }).tag?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatBRL(h.cost_with_failure_cents / 100)}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {formatBRL(h.suggested_price_cents / 100)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {Number(h.real_margin_pct).toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {goal.neededUnitsForGoal === null ? "—" : `${goal.neededUnitsForGoal} un`}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {goal.maxUnitsPerMonth} un
                      </td>
                      <td className="px-4 py-3">
                        <GoalStatusBadge goal={goal} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(h.created_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm" variant="ghost"
                          onClick={() => { if (confirm("Remover este cálculo?")) del.mutate(h.id); }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/** Aceita formato brasileiro: "0,75" → 0.75. Vazio/inválido → 0; nunca negativo. */
function parseDecimal(raw: string): number {
  if (raw.trim() === "") return 0;
  const n = parseFloat(raw.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function NumberField({
  def, value, onChange,
}: { def: FieldDef; value: number; onChange: (v: string) => void }) {
  // Guarda o texto digitado (não o número): assim "0," e "0,75" não são
  // atropelados pela reconversão a número enquanto o usuário digita.
  const [raw, setRaw] = useState(value ? String(value).replace(".", ",") : "");
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{def.label}</Label>
      <div className="relative">
        {def.prefix && (
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {def.prefix}
          </span>
        )}
        <Input
          type="text"
          inputMode="decimal"
          value={raw}
          onChange={(e) => {
            // Mantém só dígitos, vírgula e ponto — evita letras/sinal.
            const v = e.target.value.replace(/[^\d.,]/g, "");
            setRaw(v);
            onChange(v);
          }}
          placeholder={def.placeholder ?? "0"}
          className={cn(def.prefix && "pl-8", def.suffix && "pr-10")}
        />
        {def.suffix && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {def.suffix}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Campo numérico genérico (label + prefixo/sufixo opcional) para a "Meta de
 * produção por máquina" — mesma aparência do NumberField, mas independente de
 * FieldDef/PrintCostInputs e com onChange já em número (não string bruta).
 */
function GoalField({
  label,
  prefix,
  suffix,
  value,
  onChange,
}: {
  label: string;
  prefix?: string;
  suffix?: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const [raw, setRaw] = useState(value ? String(value).replace(".", ",") : "");
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {prefix}
          </span>
        )}
        <Input
          type="text"
          inputMode="decimal"
          value={raw}
          onChange={(e) => {
            const v = e.target.value.replace(/[^\d.,]/g, "");
            setRaw(v);
            onChange(parseDecimal(v));
          }}
          placeholder="0"
          className={cn(prefix && "pl-8", suffix && "pr-12")}
        />
        {suffix && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

/** Selo de situação da linha na tabela de Produtos Calculados: dá pra bater a meta? */
function GoalStatusBadge({ goal }: { goal: CapacityGoalResult }) {
  if (goal.neededUnitsForGoal === null) {
    return (
      <span className="inline-flex items-center rounded-full bg-destructive/15 px-2 py-0.5 text-xs text-destructive">
        Sem lucro
      </span>
    );
  }
  if (goal.feasible) {
    return (
      <span className="inline-flex items-center rounded-full bg-success/15 px-2 py-0.5 text-xs text-success">
        Viável · {Math.round(goal.utilizationPct)}% da capacidade
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-warning/15 px-2 py-0.5 text-xs text-warning-foreground">
      Máx. {formatBRL(goal.maxProfitAtCapacity)}/mês
    </span>
  );
}

/** Converte horas decimais (ex.: 1.3667) em texto "1h 22min" para exibição fora do form. */
function formatDuration(hoursDecimal: number): string {
  const totalMinutes = Math.round(Math.max(0, hoursDecimal) * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0 && m === 0) return "0min";
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

/**
 * Tempo de impressão como horas + minutos (ex.: "1h e 22min") em vez de uma
 * casa decimal só — evita ter que converter minutos de cabeça (22min = 0,37h).
 * Internamente ainda guarda horas decimais, então o resto do cálculo não muda.
 */
function DurationField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (hoursDecimal: number) => void;
}) {
  const totalMinutesInit = Math.round(Math.max(0, value || 0) * 60);
  const initH = Math.floor(totalMinutesInit / 60);
  const initM = totalMinutesInit % 60;
  const [h, setH] = useState(initH ? String(initH) : "");
  const [m, setM] = useState(initM ? String(initM) : "");

  const commit = (hStr: string, mStr: string) => {
    const hn = Math.max(0, parseInt(hStr, 10) || 0);
    const mn = Math.max(0, Math.min(59, parseInt(mStr, 10) || 0));
    onChange(hn + mn / 60);
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type="text"
            inputMode="numeric"
            value={h}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "");
              setH(v);
              commit(v, m);
            }}
            placeholder="0"
            className="pr-8"
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            h
          </span>
        </div>
        <div className="relative flex-1">
          <Input
            type="text"
            inputMode="numeric"
            value={m}
            onChange={(e) => {
              let v = e.target.value.replace(/\D/g, "");
              if (v !== "" && Number(v) > 59) v = "59";
              setM(v);
              commit(h, v);
            }}
            placeholder="0"
            className="pr-10"
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            min
          </span>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "font-semibold" : "font-medium"}>{value}</span>
    </div>
  );
}

function TagCombobox({
  tags, value, onChange,
}: {
  tags: { id: string; name: string }[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = tags.find((t) => t.id === value) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="w-full justify-between font-normal"
        >
          <span className="flex items-center gap-2 truncate">
            <Package className="size-4 text-muted-foreground shrink-0" />
            {selected ? selected.name : <span className="text-muted-foreground">Sem vínculo</span>}
          </span>
          <ChevronsUpDown className="size-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar tag…" />
          <CommandList>
            <CommandEmpty>Nenhuma tag encontrada.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__none__"
                onSelect={() => { onChange(null); setOpen(false); }}
              >
                <Check className={cn("size-4", value === null ? "opacity-100" : "opacity-0")} />
                Sem vínculo
              </CommandItem>
              {tags.map((t) => (
                <CommandItem
                  key={t.id}
                  value={`${t.name} ${t.id}`}
                  onSelect={() => { onChange(t.id); setOpen(false); }}
                >
                  <Check className={cn("size-4", value === t.id ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{t.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

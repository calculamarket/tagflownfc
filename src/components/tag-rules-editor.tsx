import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listRules, upsertRule, deleteRule } from "@/lib/rules.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Route } from "lucide-react";
import { toast } from "sonner";

type ConditionType = "device" | "country" | "time" | "scan_count";

function describe(type: string, v: Record<string, unknown>): string {
  switch (type) {
    case "device":
      return `Se o dispositivo for ${String(v.platform ?? "?")}`;
    case "country":
      return `Se o país for ${(Array.isArray(v.countries) ? v.countries.join(", ") : "?")}`;
    case "time":
      return `Entre ${String(v.from ?? "?")} e ${String(v.to ?? "?")} (horário de Brasília)`;
    case "scan_count":
      return `Nos primeiros ${String(v.max ?? "?")} acessos`;
    default:
      return type;
  }
}

export function TagRulesEditor({ tagId }: { tagId: string }) {
  const qc = useQueryClient();
  const { data: rules = [] } = useQuery({
    queryKey: ["tag-rules", tagId],
    queryFn: () => listRules({ data: { tagId } }),
  });

  const [type, setType] = useState<ConditionType>("device");
  const [platform, setPlatform] = useState("ios");
  const [countries, setCountries] = useState("BR");
  const [from, setFrom] = useState("11:00");
  const [to, setTo] = useState("15:00");
  const [max, setMax] = useState("100");
  const [url, setUrl] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["tag-rules", tagId] });

  const add = useMutation({
    mutationFn: () => {
      const condition_value: Record<string, unknown> =
        type === "device" ? { platform }
        : type === "country" ? { countries: countries.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean) }
        : type === "time" ? { from, to }
        : { max: Number(max) };
      return upsertRule({
        data: { tag_id: tagId, priority: rules.length, condition_type: type, condition_value, destination_url: url },
      });
    },
    onSuccess: () => { toast.success("Regra adicionada"); setUrl(""); invalidate(); },
    onError: (e) => toast.error((e as Error).message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteRule({ data: { id } }),
    onSuccess: () => { toast.success("Regra removida"); invalidate(); },
  });

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Route className="size-4" />
        <div>
          <h3 className="font-medium">Regras dinâmicas</h3>
          <p className="text-xs text-muted-foreground">
            Redirecione a mesma tag para destinos diferentes conforme o contexto. A primeira regra
            que combinar tem prioridade; sem match, usa o destino padrão.
          </p>
        </div>
      </div>

      {rules.length > 0 && (
        <div className="divide-y divide-border">
          {rules.map((r) => (
            <div key={r.id} className="py-2.5 flex items-center gap-3 text-sm">
              <div className="flex-1 min-w-0">
                <div>{describe(r.condition_type, (r.condition_value ?? {}) as Record<string, unknown>)}</div>
                <div className="text-xs text-muted-foreground truncate">→ {r.destination_url}</div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove.mutate(r.id)} title="Remover">
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-md border border-border p-3 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Condição</Label>
            <Select value={type} onValueChange={(x) => setType(x as ConditionType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="device">Dispositivo</SelectItem>
                <SelectItem value="country">País</SelectItem>
                <SelectItem value="time">Faixa de horário</SelectItem>
                <SelectItem value="scan_count">Primeiros N acessos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {type === "device" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Plataforma</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ios">iOS (iPhone/iPad)</SelectItem>
                  <SelectItem value="android">Android</SelectItem>
                  <SelectItem value="desktop">Computador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {type === "country" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Países (código, separados por vírgula)</Label>
              <Input value={countries} onChange={(e) => setCountries(e.target.value)} placeholder="BR, US" />
            </div>
          )}
          {type === "time" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">De</Label>
                <Input type="time" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Até</Label>
                <Input type="time" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
          )}
          {type === "scan_count" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Até quantos acessos</Label>
              <Input inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value)} />
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Redirecionar para</Label>
          <Input placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>

        <Button size="sm" disabled={!url.trim() || add.isPending} onClick={() => add.mutate()}>
          <Plus className="size-4" /> Adicionar regra
        </Button>
      </div>
    </div>
  );
}

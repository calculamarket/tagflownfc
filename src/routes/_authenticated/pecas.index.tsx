import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listKits } from "@/lib/kits.functions";
import { DESTINATION_LABELS } from "@/lib/destination";
import { Button } from "@/components/ui/button";
import { Boxes, PackageCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pecas/")({
  head: () => ({ meta: [{ title: "Minhas Peças · 3D QR" }] }),
  component: KitsPage,
});

function KitsPage() {
  const { data: kits = [], isLoading } = useQuery({
    queryKey: ["kits"],
    queryFn: () => listKits(),
  });

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Minhas Peças</h1>
          <p className="text-sm text-muted-foreground">
            Produtos com mais de um QR Code. Cada face pode apontar para um destino diferente.
          </p>
        </div>
        <Link to="/ativar">
          <Button variant="outline"><PackageCheck className="size-4" /> Ativar peça</Button>
        </Link>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {!isLoading && kits.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-card p-16 text-center">
          <Boxes className="size-6 mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Você ainda não ativou nenhuma peça com vários QR Codes.
          </p>
          <Link to="/ativar" className="mt-4 inline-block">
            <Button variant="outline">Ativar com o código da embalagem</Button>
          </Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {kits.map((kit) => (
          <Link
            key={kit.id}
            to="/pecas/$id"
            params={{ id: kit.id }}
            className="rounded-lg border border-border bg-card p-5 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Boxes className="size-4 text-primary" />
              <span className="font-medium">{kit.model}</span>
              <span className="text-xs text-muted-foreground">· {kit.slots} QR Codes</span>
            </div>
            <div className="mt-3 space-y-1">
              {kit.faces.slice(0, 4).map((f) => (
                <div key={f.id} className="flex justify-between text-xs">
                  <span className="text-muted-foreground truncate">
                    {f.slot_label || `Face ${f.slot}`}
                  </span>
                  <span className="truncate ml-2">{DESTINATION_LABELS[f.destination_type]}</span>
                </div>
              ))}
              {kit.faces.length > 4 && (
                <div className="text-xs text-muted-foreground">
                  +{kit.faces.length - 4} outras faces
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

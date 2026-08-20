import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getTag } from "@/lib/tags.functions";
import { pageTitle } from "@/lib/brand";
import { SimpleTagConfig } from "@/components/simple-config";

export const Route = createFileRoute("/_authenticated/configurar/$id")({
  head: () => ({ meta: [{ title: pageTitle("Configurar etiqueta") }] }),
  component: ConfigurePage,
});

type Tag = Awaited<ReturnType<typeof getTag>>;

function ConfigurePage() {
  const { id } = Route.useParams();
  const [tag, setTag] = useState<Tag | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTag({ data: { id } }).then(setTag).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="p-10 grid place-items-center">
        <div className="size-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }
  if (!tag) return <div className="p-6">Etiqueta não encontrada.</div>;

  return (
    <div className="p-6 lg:p-10 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurar etiqueta</h1>
        <p className="text-sm text-muted-foreground">
          Escolha o que sua etiqueta vai fazer. Você pode trocar depois quando quiser.
        </p>
      </div>
      <SimpleTagConfig
        id={tag.id}
        initialName={tag.name}
        editableName={false}
        initialType={tag.destination_type}
        initialDestination={(tag.destination ?? {}) as Record<string, string>}
        initialNotify={tag.notify_on_scan}
        preserve={{
          status: tag.status,
          qr_style: (tag.qr_style ?? {}) as Record<string, string>,
          description: tag.description ?? null,
          category: tag.category ?? null,
          max_scans: tag.max_scans ?? null,
          activate_at: tag.activate_at ?? null,
          expire_at: tag.expire_at ?? null,
          access_password: tag.access_password ?? null,
        }}
      />
    </div>
  );
}

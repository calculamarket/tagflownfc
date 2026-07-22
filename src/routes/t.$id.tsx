import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { resolveTag } from "@/lib/tags-public.functions";
import { buildDestinationUrl } from "@/lib/destination";

export const Route = createFileRoute("/t/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "Redirecionando…" }, { name: "robots", content: "noindex" }] }),
  component: RedirectPage,
});

function RedirectPage() {
  const { id } = Route.useParams();
  const [state, setState] = useState<"loading" | "not_found" | "inactive">("loading");

  useEffect(() => {
    (async () => {
      const res = await resolveTag({ data: { id, referrer: document.referrer || null } });
      if (!res.ok) return setState(res.reason);
      const target = buildDestinationUrl(res.destination_type, res.destination, id);
      if (target) {
        window.location.replace(target);
      } else {
        setState("not_found");
      }
    })().catch(() => setState("not_found"));
  }, [id]);

  return (
    <div className="min-h-screen grid place-items-center bg-background text-foreground p-6">
      <div className="text-center">
        {state === "loading" && (
          <>
            <div className="mx-auto size-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            <p className="mt-4 text-sm text-muted-foreground">Redirecionando…</p>
          </>
        )}
        {state === "not_found" && (
          <>
            <h1 className="text-2xl font-semibold">Tag não encontrada</h1>
            <p className="mt-2 text-sm text-muted-foreground">Este endereço não corresponde a nenhuma etiqueta.</p>
          </>
        )}
        {state === "inactive" && (
          <>
            <h1 className="text-2xl font-semibold">Tag inativa</h1>
            <p className="mt-2 text-sm text-muted-foreground">Esta etiqueta está pausada ou arquivada.</p>
          </>
        )}
      </div>
    </div>
  );
}

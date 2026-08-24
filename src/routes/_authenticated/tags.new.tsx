import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { newTagId } from "@/lib/tag-id";
import { pageTitle } from "@/lib/brand";
import { SimpleTagConfig } from "@/components/simple-config";
import { TagForm } from "@/components/tag-form";
import type { CategoryId } from "@/lib/categories";

export const Route = createFileRoute("/_authenticated/tags/new")({
  head: () => ({ meta: [{ title: pageTitle("Nova tag") }] }),
  validateSearch: (s: Record<string, unknown>): { advanced?: boolean; category?: CategoryId } => {
    const categories: CategoryId[] = ["pet", "emergencia", "idoso", "pix", "menu", "wifi"];
    const category = typeof s.category === "string" && categories.includes(s.category as CategoryId)
      ? s.category as CategoryId
      : undefined;
    return {
      ...(s.advanced === "1" || s.advanced === true ? { advanced: true } : {}),
      ...(category ? { category } : {}),
    };
  },
  component: NewTag,
});

function NewTag() {
  const { advanced, category } = Route.useSearch();
  const navigate = useNavigate();
  // Um id novo por montagem da página; só vira tag de verdade ao salvar.
  const id = useMemo(() => newTagId(), []);

  if (advanced) {
    return (
      <div className="p-6 lg:p-10 max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold tracking-tight">Nova tag (avançado)</h1>
        <p className="text-sm text-muted-foreground">
          Todos os tipos de destino. Prefere o simples?{" "}
          <Link to="/tags/new" className="underline hover:text-foreground">Voltar ao modo rápido</Link>.
        </p>
        <div className="mt-6">
          <TagForm
            initial={{
              id, name: "", description: "", category: "",
              status: "active", destination_type: "url", destination: {}, qr_style: {},
              max_scans: "", activate_at: "", expire_at: "", access_password: "",
            }}
            onSaved={() => navigate({ to: "/tags" })}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nova etiqueta</h1>
        <p className="text-sm text-muted-foreground">
          Escolha o que ela vai fazer. Precisa de Wi-Fi, vCard, landing page, teste A/B…?{" "}
          <Link to="/tags/new" search={{ advanced: true }} className="underline hover:text-foreground">
            Modo avançado
          </Link>
          .
        </p>
      </div>
      <SimpleTagConfig
        id={id}
        initialName=""
        editableName
        initialType="url"
        initialDestination={{}}
        category={category}
        newTag
      />
    </div>
  );
}

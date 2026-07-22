import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { TagForm } from "@/components/tag-form";
import { newTagId } from "@/lib/tag-id";
import { useMemo } from "react";

export const Route = createFileRoute("/_authenticated/tags/new")({
  head: () => ({ meta: [{ title: "Nova tag · TagFlow" }] }),
  component: NewTag,
});

function NewTag() {
  const navigate = useNavigate();
  const id = useMemo(() => newTagId(), []);
  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold tracking-tight">Nova tag</h1>
      <p className="text-sm text-muted-foreground">Configure o destino e as informações da etiqueta.</p>
      <div className="mt-6">
        <TagForm
          initial={{
            id, name: "", description: "", category: "",
            status: "active", destination_type: "url", destination: {}, qr_style: {},
          }}
          onSaved={() => navigate({ to: "/tags" })}
        />
      </div>
    </div>
  );
}

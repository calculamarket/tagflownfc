import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getTag } from "@/lib/tags.functions";
import { TagForm } from "@/components/tag-form";
import { TagRulesEditor } from "@/components/tag-rules-editor";

export const Route = createFileRoute("/_authenticated/tags/$id")({
  head: () => ({ meta: [{ title: "Editar tag · TagFlow" }] }),
  loader: ({ params, context }) =>
    context.queryClient.ensureQueryData(
      queryOptions({ queryKey: ["tag", params.id], queryFn: () => getTag({ data: { id: params.id } }) }),
    ),
  component: EditTag,
});

function EditTag() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: tag } = useSuspenseQuery(
    queryOptions({ queryKey: ["tag", id], queryFn: () => getTag({ data: { id } }) }),
  );

  if (!tag) return <div className="p-6">Tag não encontrada.</div>;

  const toLocalInput = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold tracking-tight">Editar tag</h1>
      <div className="mt-6">
        <TagForm
          initial={{
            id: tag.id,
            name: tag.name,
            description: tag.description ?? "",
            category: tag.category ?? "",
            status: tag.status,
            destination_type: tag.destination_type,
            destination: (tag.destination as Record<string, string>) ?? {},
            qr_style: (tag.qr_style as Record<string, string>) ?? {},
            max_scans: tag.max_scans != null ? String(tag.max_scans) : "",
            activate_at: toLocalInput(tag.activate_at),
            expire_at: toLocalInput(tag.expire_at),
            access_password: tag.access_password ?? "",
          }}
          editing
          onSaved={() => navigate({ to: "/tags" })}
        />
        <div className="mt-6">
          <TagRulesEditor tagId={tag.id} />
        </div>
      </div>
    </div>
  );
}

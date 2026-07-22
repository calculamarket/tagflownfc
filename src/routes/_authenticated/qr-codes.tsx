import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { listTags } from "@/lib/tags.functions";
import { TagQrPreview } from "@/components/tag-qr-preview";

const tagsQO = queryOptions({ queryKey: ["tags"], queryFn: () => listTags() });

export const Route = createFileRoute("/_authenticated/qr-codes")({
  head: () => ({ meta: [{ title: "QR Codes · TagFlow" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(tagsQO),
  component: QRPage,
});

function QRPage() {
  const { data: tags } = useSuspenseQuery(tagsQO);
  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">QR Codes</h1>
      <p className="text-sm text-muted-foreground">Um QR Code é gerado automaticamente para cada tag.</p>
      {tags.length === 0 ? (
        <div className="text-sm text-muted-foreground">Crie uma tag primeiro.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tags.map((t) => (
            <div key={t.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
              <TagQrPreview id={t.id} size={180} />
              <div>
                <div className="font-medium truncate">{t.name}</div>
                <div className="text-xs text-muted-foreground font-mono">/t/{t.id}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

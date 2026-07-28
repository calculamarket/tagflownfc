import { Sparkles } from "lucide-react";
import { BRAND } from "@/lib/brand";

export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground mt-1">{description}</p>
      <div className="mt-8 rounded-lg border border-dashed border-border bg-card p-12 text-center">
        <Sparkles className="size-6 mx-auto text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">Em breve nesta fase do {BRAND.name}.</p>
      </div>
    </div>
  );
}

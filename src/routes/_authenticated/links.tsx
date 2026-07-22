import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";
export const Route = createFileRoute("/_authenticated/links")({
  head: () => ({ meta: [{ title: "Links · TagFlow" }] }),
  component: () => <PlaceholderPage title="Links Inteligentes" description="Gerencie links dinâmicos que podem apontar para diferentes destinos." />,
});

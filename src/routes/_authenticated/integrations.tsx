import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";
export const Route = createFileRoute("/_authenticated/integrations")({
  head: () => ({ meta: [{ title: "Integrações · TagFlow" }] }),
  component: () => <PlaceholderPage title="Integrações" description="Conecte o TagFlow com outras ferramentas." />,
});

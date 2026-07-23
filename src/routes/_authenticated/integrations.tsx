import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";
export const Route = createFileRoute("/_authenticated/integrations")({
  head: () => ({ meta: [{ title: "Integrações · 3D QR" }] }),
  component: () => <PlaceholderPage title="Integrações" description="Conecte o 3D QR com outras ferramentas." />,
});

import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";
export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({ meta: [{ title: "Equipe · 3D QR" }] }),
  component: () => <PlaceholderPage title="Equipe" description="Convide membros da sua equipe para colaborar." />,
});

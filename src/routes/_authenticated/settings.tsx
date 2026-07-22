import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";
export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Configurações · TagFlow" }] }),
  component: () => <PlaceholderPage title="Configurações" description="Preferências do workspace." />,
});

import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";
export const Route = createFileRoute("/_authenticated/automations")({
  head: () => ({ meta: [{ title: "Automações · TagFlow" }] }),
  component: () => <PlaceholderPage title="Automações" description="Webhooks para eventos: tag lida, criada e alterada. Em breve." />,
});

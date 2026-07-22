import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";
export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics · TagFlow" }] }),
  component: () => <PlaceholderPage title="Analytics" description="Análise avançada por país, cidade, dispositivo e origem. Em breve." />,
});

import { createFileRoute } from "@tanstack/react-router";
import { AtlanticLanding } from "@/components/atlantic-landing";
import landingCss from "../atlantic-landing.css?url";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nukkia — O cuidado é seu. A próxima ideia, da Nukkia." },
      {
        name: "description",
        content:
          "Do contexto da sua clínica ao conteúdo revisado e ao planejamento do mês. Crie, guarde e organize suas próximas entregas com a Nukkia.",
      },
    ],
    links: [{ rel: "stylesheet", href: landingCss }],
  }),
  component: AtlanticLanding,
});

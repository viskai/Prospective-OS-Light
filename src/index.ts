export interface Env {
  DB: D1Database;
}

// Rôles du §8 du cahier des charges.
export type Role = "admin" | "direction" | "rh" | "pedago" | "sg" | "compta" | "board";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/health") {
      const row = await env.DB.prepare("SELECT 1 AS ok").first();
      return Response.json({ status: "ok", db: row?.ok === 1 });
    }
    return new Response("OS Light — à implémenter (voir docs/plan-de-realisation.md)", { status: 501 });
  },
} satisfies ExportedHandler<Env>;

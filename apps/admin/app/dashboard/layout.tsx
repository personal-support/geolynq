/*
 * GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
 * Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
 * total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
 * Unauthorized copying, replication, redistribution or commercial use is prohibited.
 */
import { redirect } from "next/navigation";
import { signOut } from "@/app/login/actions";
import { RadarMark } from "@/components/radar-mark";
import { FaixaDemonstracao } from "@/components/avisos";
import { Sidebar } from "@/components/sidebar";
import { getEventosSimulados, getMembership, getMemberships, getSession } from "@/lib/data";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getSession();
  if (!user) redirect("/login");

  let m: Awaited<ReturnType<typeof getMembership>> = null;
  let falhou = false;
  try {
    m = await getMembership();
  } catch {
    falhou = true;
  }
  if (falhou) {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <div className="max-w-md text-center">
          <RadarMark size={44} className="mx-auto text-ink" />
          <h1 className="mt-5 text-[28px] font-semibold leading-tight">Não conseguimos carregar o painel agora</h1>
          <p className="mt-3 text-[15px] text-ink-2">É um problema temporário de conexão, e a sua conta não foi alterada. Aguarde alguns segundos e atualize a página.</p>
          <a href="/dashboard" className="mt-6 inline-block rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-ink-2">
            Tentar de novo
          </a>
        </div>
      </main>
    );
  }
  if (!m) {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <div className="max-w-md text-center">
          <RadarMark size={44} className="mx-auto text-ink" />
          <h1 className="mt-5 text-[28px] font-semibold leading-tight">Sua conta ainda não está ligada a uma marca</h1>
          <p className="mt-3 text-[15px] text-ink-2">
            Você entrou como <strong>{user.email}</strong>, mas nenhuma marca foi vinculada a este acesso. Peça à GeoLynq para concluir o
            cadastro.
          </p>
          <form action={signOut} className="mt-6">
            <button type="submit" className="rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-ink-2">
              Sair
            </button>
          </form>
        </div>
      </main>
    );
  }

  const [ev, todos] = await Promise.all([getEventosSimulados(m.tenant.id), getMemberships()]);

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar
        cliente={m.tenant.name}
        slug={m.tenant.slug}
        status={m.tenant.status}
        email={m.email}
        clientes={todos.map((x) => ({ slug: x.tenant.slug, nome: x.tenant.name }))}
      />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:px-11 lg:py-10">
        <div className="mx-auto max-w-[1180px]">
          {ev && ev.simulados > 0 ? <FaixaDemonstracao simulados={ev.simulados} total={ev.total} /> : null}
          {children}
        </div>
      </main>
    </div>
  );
}

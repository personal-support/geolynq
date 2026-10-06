import { redirect } from "next/navigation";
import { signOut } from "@/app/login/actions";
import { RadarMark } from "@/components/radar-mark";
import { Sidebar } from "@/components/sidebar";
import { getMembership, getSession } from "@/lib/data";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getSession();
  if (!user) redirect("/login");

  const m = await getMembership().catch(() => null);
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

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar cliente={m.tenant.name} status={m.tenant.status} email={m.email} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:px-11 lg:py-10">
        <div className="mx-auto max-w-[1180px]">{children}</div>
      </main>
    </div>
  );
}

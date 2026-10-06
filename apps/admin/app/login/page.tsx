import type { Metadata } from "next";
import { RadarMark } from "@/components/radar-mark";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar · GeoLynq" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "";

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-ink text-white lg:flex lg:flex-col lg:justify-between lg:p-14">
        <div className="flex items-center gap-3">
          <RadarMark size={36} className="text-white" />
          <p className="font-display text-2xl font-semibold tracking-tight">GeoLynq</p>
        </div>

        <div className="relative z-10 max-w-lg">
          <h1 className="text-[46px] font-semibold leading-[1.02]">
            Veja onde o seu produto é procurado e <span className="text-[#ff8a5c]">ainda não é encontrado.</span>
          </h1>
          <p className="mt-6 max-w-md text-[17px] leading-relaxed text-white/70">
            Cada busca feita no site da sua marca vira um ponto no mapa. Onde não há revendedor por perto, aparece uma lacuna para
            a sua equipe comercial preencher.
          </p>
        </div>

        <p className="text-sm text-white/45">Radar de cobertura para marcas que vendem por revendedores.</p>

        {/* anéis decorativos: o raio de 100 km do widget */}
        <svg aria-hidden viewBox="0 0 600 600" className="pointer-events-none absolute -right-48 -bottom-48 w-[760px] text-white/[0.09]">
          {[80, 160, 240, 320].map((r) => (
            <circle key={r} cx="300" cy="300" r={r} fill="none" stroke="currentColor" strokeWidth="1.5" />
          ))}
          <circle cx="410" cy="250" r="9" fill="#d94a18" />
          <circle cx="410" cy="250" r="24" fill="none" stroke="#d94a18" strokeWidth="1.5" strokeOpacity="0.6" />
        </svg>
      </section>

      <section className="flex items-center justify-center px-6 py-14 sm:px-12">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex items-center gap-2.5 lg:hidden">
            <RadarMark size={30} className="text-ink" />
            <p className="font-display text-xl font-semibold tracking-tight">GeoLynq</p>
          </div>
          <h2 className="text-[30px] font-semibold leading-none">Entrar no painel</h2>
          <p className="mt-2.5 text-[15px] text-ink-2">Use o e-mail e a senha que a GeoLynq cadastrou para a sua marca.</p>
          <LoginForm next={next} />
          <p className="mt-8 text-sm text-ink-3">Sem acesso ou esqueceu a senha? Fale com o seu contato na GeoLynq.</p>
        </div>
      </section>
    </main>
  );
}

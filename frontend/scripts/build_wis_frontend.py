import os
import subprocess
import time

def run_cmd(cmd, cwd=None):
    print(f"Exec: {cmd}")
    result = subprocess.run(cmd, shell=True, cwd=cwd)
    if result.returncode != 0:
        raise Exception(f"Command failed: {cmd}")

def build_frontend():
    print("Iniciando construccion del frontend WIS en Next.js 14...")
    
    frontend_dir = "wis-frontend"
    
    if not os.path.exists(frontend_dir):
        run_cmd("npx --yes create-next-app@14 wis-frontend --typescript --tailwind --eslint --app --src-dir --import-alias @/* --use-npm")
    
    print("\nInstalando lucide-react y framer-motion...")
    run_cmd("npm install lucide-react framer-motion", cwd=frontend_dir)
    
    print("\nReescribiendo tailwind.config.ts...")
    tailwind_config = """import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0A0A08",
        brand: {
          accent: "#F0B429",
          text: "#F0EFE8",
          surface: "#1E1E1A",
        }
      },
      fontFamily: {
        syne: ["var(--font-syne)"],
        sans: ["var(--font-dm-sans)"],
        mono: ["var(--font-jetbrains-mono)"],
      },
    },
  },
  plugins: [],
};
export default config;
"""
    with open(f"{frontend_dir}/tailwind.config.ts", "w", encoding="utf-8") as f:
        f.write(tailwind_config)

    print("\nReescribiendo layout.tsx y fonts...")
    layout_tsx = """import type { Metadata } from "next";
import { Syne, DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const syne = Syne({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-syne" });
const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-dm-sans" });
const jetBrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" });

export const metadata: Metadata = {
  title: "WIS | Work In Silence",
  description: "Tu negocio en automático. Conectamos IA con tus procesos reales.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className={`${syne.variable} ${dmSans.variable} ${jetBrainsMono.variable} bg-background text-brand-text font-sans antialiased selection:bg-brand-accent selection:text-background`}>
        {children}
      </body>
    </html>
  );
}
"""
    with open(f"{frontend_dir}/src/app/layout.tsx", "w", encoding="utf-8") as f:
        f.write(layout_tsx)
        
    print("\nReescribiendo globals.css...")
    globals_css = """@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background-color: #0A0A08;
  color: #F0EFE8;
}

@layer utilities {
  .text-balance {
    text-wrap: balance;
  }
}
"""
    with open(f"{frontend_dir}/src/app/globals.css", "w", encoding="utf-8") as f:
        f.write(globals_css)

    print("\nReescribiendo page.tsx...")
    page_tsx = """'use client';
import { motion } from 'framer-motion';
import { ArrowRight, MessageSquare, Code, Cpu, Link, ChevronRight, Mail } from 'lucide-react';
import { FormEvent, useState } from 'react';

const FadeIn = ({ children, delay = 0, className = '' }: { children: React.ReactNode, delay?: number, className?: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-100px" }}
    transition={{ duration: 0.6, delay }}
    className={className}
  >
    {children}
  </motion.div>
);

export default function Home() {
  const [formData, setFormData] = useState({ name: '', company: '', email: '', message: '' });

  const handleContactSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await fetch('http://localhost:4000/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      alert('Mensaje enviado. Estaremos en contacto.');
      setFormData({ name: '', company: '', email: '', message: '' });
    } catch (err) {
      console.error(err);
      alert('Error enviando mensaje.');
    }
  };

  return (
    <main className="min-h-screen">
      {/* 1. NAV */}
      <nav className="fixed top-0 w-full bg-background/80 backdrop-blur-md z-50 border-b border-brand-surface/50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 font-syne font-bold text-xl tracking-tight">
            <span className="text-brand-accent">W</span>I<span className="text-brand-surface">S</span>
          </div>
          <div className="hidden md:flex gap-8 text-sm font-medium">
            <a href="#servicios" className="hover:text-brand-accent transition-colors">Servicios</a>
            <a href="#blog" className="hover:text-brand-accent transition-colors">Blog</a>
            <a href="#contacto" className="hover:text-brand-accent transition-colors">Contacto</a>
          </div>
          <a href="#contacto" className="bg-brand-accent text-background px-6 py-2.5 rounded-full font-bold text-sm hover:opacity-90 transition-opacity">
            Hablemos
          </a>
        </div>
      </nav>

      {/* 2. HERO */}
      <section className="pt-48 pb-32 px-6">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <motion.h1 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            className="font-syne font-extrabold text-4xl md:text-5xl lg:text-6xl tracking-tight text-balance leading-tight"
          >
            Tu negocio en <span className="text-brand-accent">automático.</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            className="text-lg md:text-xl text-brand-text/70 max-w-2xl mx-auto text-balance"
          >
            Conectamos IA con tus procesos reales. Sin demos vacías.
          </motion.p>
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
          >
            <a href="#contacto" className="w-full sm:w-auto bg-brand-accent text-background px-8 py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-transform hover:scale-105">
              <MessageSquare size={18} /> WhatsApp
            </a>
            <a href="#servicios" className="w-full sm:w-auto bg-brand-surface text-brand-text px-8 py-4 rounded-full font-medium flex items-center justify-center gap-2 hover:bg-brand-surface/80 transition-transform hover:scale-105 border border-brand-surface/50">
              Conocé WIS <ArrowRight size={18} />
            </a>
          </motion.div>
        </div>
      </section>

      {/* 3. SERVICIOS */}
      <section id="servicios" className="py-24 px-6 bg-brand-surface/30">
        <div className="max-w-7xl mx-auto">
          <FadeIn className="mb-16">
            <h2 className="font-syne font-bold text-4xl md:text-5xl">Servicios</h2>
          </FadeIn>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { icon: MessageSquare, title: "Agentes de ventas con IA", desc: "Clasificación inteligente y persuasión 24/7." },
              { icon: Cpu, title: "Automatización de atención", desc: "Respuestas exactas, no más cuellos de botella." },
              { icon: Link, title: "Integraciones entre sistemas", desc: "Tus herramientas actuales conversando entre sí." },
              { icon: Code, title: "Desarrollo con IA", desc: "Soluciones a la medida de tu complejidad." }
            ].map((s, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <div className="bg-brand-surface p-8 rounded-2xl hover:border-brand-accent border border-transparent transition-all group duration-300">
                  <s.icon className="text-brand-accent mb-6 w-10 h-10 group-hover:scale-110 transition-transform" />
                  <h3 className="font-bold text-xl mb-3">{s.title}</h3>
                  <p className="text-brand-text/60">{s.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* 4. PROCESO */}
      <section className="py-24 px-6 border-y border-brand-surface/50">
        <div className="max-w-7xl mx-auto">
          <FadeIn className="mb-16">
            <h2 className="font-syne font-bold text-4xl md:text-5xl text-center">Nuestro Proceso</h2>
          </FadeIn>
          <div className="flex flex-col md:flex-row justify-between relative">
            <div className="hidden md:block absolute top-[28px] left-[10%] right-[10%] h-[1px] bg-brand-surface border-dashed"></div>
            {[
              "Entendemos tu operación",
              "Diseñamos el sistema",
              "Lo construimos y entregamos"
            ].map((step, i) => (
              <FadeIn key={i} delay={i * 0.2} className="flex-1 relative mb-12 md:mb-0 px-6">
                <div className="flex flex-col items-center text-center">
                  <div className="w-14 h-14 bg-background border-2 border-brand-accent rounded-full flex items-center justify-center font-mono text-brand-accent font-bold text-xl mb-6 relative z-10 shadow-[0_0_15px_rgba(240,180,41,0.2)]">
                    0{i + 1}
                  </div>
                  <h3 className="font-bold text-lg max-w-[200px] text-balance">{step}</h3>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* 5. DIFERENCIAL */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-12">
          {[
            { title: "Nos metemos en el negocio", text: "No somos solo devs. Analizamos tus cuellos de botella reales." },
            { title: "Construimos, no prometemos", text: "Prototipos rápidos, valor inmediato. Sin humo." },
            { title: "Work In Silence", text: "Ejecución perfecta sin ruido. Los resultados hablan solos." }
          ].map((item, i) => (
            <FadeIn key={i} delay={i * 0.1}>
              <h3 className="font-syne font-bold text-2xl text-brand-accent mb-4">{item.title}</h3>
              <p className="text-brand-text/70">{item.text}</p>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* 6. BLOG PREVIEW */}
      <section id="blog" className="py-24 px-6 bg-brand-surface/20">
        <div className="max-w-7xl mx-auto">
          <FadeIn className="flex justify-between items-end mb-12">
            <h2 className="font-syne font-bold text-4xl">Últimos Casos</h2>
            <a href="#" className="hidden sm:flex items-center gap-2 text-brand-accent font-mono text-sm hover:underline">Ver todos <ChevronRight size={16} /></a>
          </FadeIn>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { id: 1, title: 'Cómo la IA puede reducir 40hs semanales en atención al cliente.', date: 'MAR 2026', img: 'https://picsum.photos/seed/ai1/600/400' },
              { id: 2, title: 'Automatización de flujos B2B: 3 casos de éxito reales.', date: 'FEB 2026', img: 'https://picsum.photos/seed/ai2/600/400' },
              { id: 3, title: 'Por qué tu agencia necesita un Agente de Ventas en 2026.', date: 'ENE 2026', img: 'https://picsum.photos/seed/ai3/600/400' },
            ].map((article, i) => (
              <FadeIn key={article.id} delay={i * 0.1}>
                <div className="group cursor-pointer">
                  <div className="h-48 bg-brand-surface rounded-xl mb-6 overflow-hidden relative">
                    <img src={article.img} alt={article.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
                  </div>
                  <div className="font-mono text-xs text-brand-accent mb-3 flex gap-4">
                    <span>CASO DE ESTUDIO</span>
                    <span className="text-brand-text/40">{article.date}</span>
                  </div>
                  <h3 className="font-bold text-lg mb-2 group-hover:text-brand-accent transition-colors">{article.title}</h3>
                </div>
              </FadeIn>
            ))}
          </div>

          {/* NEWSLETTER */}
          <FadeIn delay={0.4}>
            <div className="mt-20 bg-brand-surface p-8 md:p-12 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-8 border border-brand-surface/50 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-brand-accent/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
              <div className="relative z-10">
                <h3 className="font-syne font-bold text-2xl md:text-3xl mb-2">Newsletter</h3>
                <p className="text-brand-text/60 max-w-md">Recibí tácticas de automatización e IA directamente en tu bandeja de entrada.</p>
              </div>
              <div className="flex flex-col sm:flex-row w-full md:w-auto gap-3 relative z-10">
                <input type="email" placeholder="tu@email.com" className="bg-background border border-brand-surface/50 rounded-xl px-5 py-3 focus:outline-none focus:border-brand-accent min-w-[250px]" />
                <button className="bg-brand-accent text-background font-bold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity">Suscribirme</button>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* 7. CONTACTO */}
      <section id="contacto" className="py-32 px-6">
        <div className="max-w-3xl mx-auto bg-brand-surface p-8 md:p-12 rounded-3xl border border-brand-surface/50">
          <FadeIn>
            <h2 className="font-syne font-bold text-3xl md:text-4xl mb-2">Iniciemos el sistema.</h2>
            <p className="text-brand-text/60 mb-10">Dejanos tus datos o escribinos directo por WhatsApp.</p>
            <form onSubmit={handleContactSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block font-mono text-xs mb-2 text-brand-text/50">NOMBRE</label>
                  <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-background border border-brand-surface/50 rounded-lg p-4 focus:outline-none focus:border-brand-accent transition-colors" />
                </div>
                <div>
                  <label className="block font-mono text-xs mb-2 text-brand-text/50">EMPRESA</label>
                  <input required value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} className="w-full bg-background border border-brand-surface/50 rounded-lg p-4 focus:outline-none focus:border-brand-accent transition-colors" />
                </div>
              </div>
              <div className="grid md:grid-cols-1 gap-6">
                <div>
                  <label className="block font-mono text-xs mb-2 text-brand-text/50">EMAIL</label>
                  <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-background border border-brand-surface/50 rounded-lg p-4 focus:outline-none focus:border-brand-accent transition-colors" />
                </div>
              </div>
              <div>
                <label className="block font-mono text-xs mb-2 text-brand-text/50">¿EN QUÉ PODEMOS AYUDARTE?</label>
                <textarea required rows={4} value={formData.message} onChange={e => setFormData({...formData, message: e.target.value})} className="w-full bg-background border border-brand-surface/50 rounded-lg p-4 focus:outline-none focus:border-brand-accent transition-colors"></textarea>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <button type="submit" className="flex-1 bg-brand-accent text-background font-bold py-4 rounded-xl hover:opacity-90 transition-opacity">
                  Enviar Mensaje
                </button>
                <a href="https://wa.me/5492235428861" target="_blank" className="flex-1 bg-[#25D366] text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
                  <MessageSquare size={18} /> WhatsApp
                </a>
                <a href="mailto:ortu@wis-agency.com" className="flex-1 bg-brand-surface border border-brand-text/10 text-brand-text font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-brand-surface/80 transition-opacity">
                  <Mail size={18} /> Email
                </a>
              </div>
            </form>

            <div className="mt-12 pt-8 border-t border-brand-surface border-dashed">
              <h3 className="font-syne font-bold text-xl mb-4">Contactanos directamente:</h3>
              <div className="flex flex-col gap-3 font-mono text-sm text-brand-text/80">
                <a href="mailto:ortu@wis-agency.com" className="flex items-center gap-3 hover:text-brand-accent transition-colors w-fit"><Mail size={16}/> ortu@wis-agency.com</a>
                <a href="https://instagram.com/wis.agency" target="_blank" className="flex items-center gap-3 hover:text-brand-accent transition-colors w-fit"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg> @wis.agency</a>
                <a href="https://wa.me/5492235428861" target="_blank" className="flex items-center gap-3 hover:text-brand-accent transition-colors w-fit"><MessageSquare size={16}/> WhatsApp directo</a>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* 8. FOOTER */}
      <footer className="border-t border-brand-surface/50 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="font-syne font-bold text-xl tracking-tight grayscale opacity-50">
            W I S
          </div>
          <div className="flex gap-6 font-mono text-xs text-brand-text/40">
            <a href="https://instagram.com/wis.agency" target="_blank" className="hover:text-brand-text">INSTAGRAM</a>
            <a href="https://wa.me/5492235428861" target="_blank" className="hover:text-brand-text">WHATSAPP</a>
            <a href="mailto:ortu@wis-agency.com" className="hover:text-brand-text">EMAIL</a>
          </div>
          <div className="font-mono text-xs text-brand-text/40">
            wis-agency.com · Work In Silence · 2025
          </div>
        </div>
      </footer>
    </main>
  );
}
"""
    with open(f"{frontend_dir}/src/app/page.tsx", "w", encoding="utf-8") as f:
        f.write(page_tsx)

    print("\nProceso exitoso. WIS Frontend ha sido construido en ./wis-frontend")

if __name__ == "__main__":
    build_frontend()

'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, MessageSquare, Code, Cpu, Link, ChevronRight, Mail, X, Menu, Loader2 } from 'lucide-react';
import { FormEvent, useState, useEffect } from 'react';

const FAQ_ITEMS = [
  { q: '¿Cuánto tiempo tarda en implementarse una automatización?', a: 'Depende de la complejidad, pero la mayoría de los proyectos están en producción en 2 a 4 semanas.' },
  { q: '¿Necesito tener conocimientos técnicos?', a: 'No. Nosotros nos encargamos de todo el desarrollo. Solo necesitás contarnos cómo funciona tu negocio.' },
  { q: '¿Qué pasa si la automatización no funciona como esperamos?', a: 'Tenemos garantía de 90 días. Si no ves resultados, te devolvemos el dinero.' },
  { q: '¿Con qué herramientas trabajan?', a: 'n8n, Supabase, Claude AI, WhatsApp Business API, entre otras. Siempre elegimos la herramienta correcta para cada problema.' },
  { q: '¿Trabajan con empresas de cualquier rubro?', a: 'Sí, aunque tenemos experiencia especial en retail, salud, inmobiliarias y concesionarias.' },
];

const BLOG_ARTICLES = [
  {
    id: 1,
    title: 'Cómo la IA puede reducir 40hs semanales en atención al cliente.',
    date: 'MAR 2026',
    img: 'https://picsum.photos/800/400?random=1',
    content: 'Las empresas que implementan agentes de IA en su atención al cliente reportan una reducción promedio de 40 horas semanales en tareas repetitivas. Esto no significa reemplazar personas, sino liberarlas para que se enfoquen en lo que realmente importa: resolver problemas complejos y construir relaciones con los clientes.\n\nEn WIS, hemos implementado sistemas de clasificación inteligente que priorizan tickets, responden consultas frecuentes y escalan solo lo necesario a un humano. El resultado: tiempos de respuesta 5x más rápidos y equipos más contentos.\n\nLa clave está en entrenar al agente con datos reales de tu negocio, no con respuestas genéricas. Cada empresa tiene su lenguaje, sus productos y sus clientes. Un agente bien entrenado se siente como hablar con alguien que realmente conoce la empresa.'
  },
  {
    id: 2,
    title: 'Automatización de flujos B2B: 3 casos de éxito reales.',
    date: 'FEB 2026',
    img: 'https://picsum.photos/800/400?random=2',
    content: 'La automatización B2B no es solo conectar APIs. Es entender el flujo completo de información entre empresas y eliminar los puntos de fricción.\n\nCaso 1: Una distribuidora procesaba pedidos por email manualmente. Implementamos un sistema que lee emails, extrae datos del pedido, verifica stock en tiempo real y genera la orden automáticamente. Resultado: de 45 minutos por pedido a 2 minutos.\n\nCaso 2: Una agencia de marketing sincronizaba reportes entre 5 plataformas copiando datos a mano. Creamos un pipeline que consolida métricas de Google Ads, Meta, Analytics y CRM en un dashboard unificado. Resultado: reportes que tomaban 4 horas ahora se generan solos.\n\nCaso 3: Un estudio contable recibía documentación de clientes por 7 canales distintos. Centralizamos todo en un sistema inteligente que clasifica, extrae datos y pre-carga en el sistema contable. Resultado: 60% menos de errores de carga.'
  },
  {
    id: 3,
    title: 'Por qué tu agencia necesita un Agente de Ventas en 2026.',
    date: 'ENE 2026',
    img: 'https://picsum.photos/800/400?random=3',
    content: 'En 2026, no tener un agente de ventas con IA es como no tener sitio web en 2010. La tecnología ya no es experimental: es infraestructura básica.\n\nUn agente de ventas con IA puede calificar leads las 24 horas, responder consultas técnicas sobre tus servicios, agendar reuniones y nutrir prospectos fríos. Todo esto sin que tu equipo pierda tiempo en leads que no van a cerrar.\n\nLa diferencia entre un chatbot genérico y un agente de ventas real está en la personalización. Nuestros agentes entienden tu propuesta de valor, conocen tus casos de éxito y saben hacer las preguntas correctas para calificar. No son un formulario con esteroides: son un vendedor que nunca duerme.\n\nEl ROI típico que vemos: por cada $1 invertido en un agente de ventas, las empresas recuperan $8 en pipeline generado en los primeros 90 días.'
  }
];

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
  const [formStatus, setFormStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [formTouched, setFormTouched] = useState<Record<string, boolean>>({});
  const [selectedArticle, setSelectedArticle] = useState<typeof BLOG_ARTICLES[0] | null>(null);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterStatus, setNewsletterStatus] = useState<'idle' | 'success'>('idle');
  const [emailCopied, setEmailCopied] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [waTooltip, setWaTooltip] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const copyEmail = () => {
    navigator.clipboard.writeText('ortu@wis-agency.com');
    setEmailCopied(true);
    setTimeout(() => setEmailCopied(false), 2000);
  };

  const handleNewsletter = async () => {
    if (!newsletterEmail || !newsletterEmail.includes('@')) return;
    try {
      await fetch('https://wis-backend.xbgh9n.easypanel.host/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newsletterEmail })
      });
    } catch {
      try {
        const existing = JSON.parse(localStorage.getItem('wis_newsletter_emails') || '[]');
        existing.push({ email: newsletterEmail, date: new Date().toISOString() });
        localStorage.setItem('wis_newsletter_emails', JSON.stringify(existing));
      } catch {}
    }
    setNewsletterStatus('success');
    setNewsletterEmail('');
  };

  const handleContactSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormStatus('loading');
    try {
      const res = await fetch('https://wis-backend.xbgh9n.easypanel.host/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (!res.ok) throw new Error('Response not ok');
      setFormStatus('success');
      setFormData({ name: '', company: '', email: '', message: '' });
      setFormTouched({});
    } catch (err) {
      console.error(err);
      setFormStatus('error');
    }
  };

  const fieldError = (field: string) => {
    if (!formTouched[field]) return null;
    const v = formData[field as keyof typeof formData];
    if (!v.trim()) return 'Este campo es obligatorio';
    if (field === 'email' && !v.includes('@')) return 'Ingresá un email válido';
    return null;
  };

  const inputClass = (field: string) =>
    `w-full bg-background border rounded-lg p-4 focus:outline-none transition-colors ${
      fieldError(field) ? 'border-red-500/60 focus:border-red-500' : 'border-brand-surface/50 focus:border-brand-accent'
    }`;

  return (
    <main className="min-h-screen">
      {/* 1. NAV */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-background/95 backdrop-blur-lg border-b border-brand-surface/50 shadow-lg shadow-black/20' : 'bg-background/80 backdrop-blur-md border-b border-transparent'}`}>
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 font-syne font-bold text-xl tracking-tight">
            <span className="text-brand-accent">W</span>I<span className="text-brand-surface">S</span>
          </div>
          <div className="hidden md:flex gap-8 text-sm font-medium">
            <a href="#servicios" className="hover:text-brand-accent transition-colors">Servicios</a>
            <a href="#sobre-wis" className="hover:text-brand-accent transition-colors">Nosotros</a>
            <a href="#faq" className="hover:text-brand-accent transition-colors">FAQ</a>
            <a href="#blog" className="hover:text-brand-accent transition-colors">Blog</a>
            <a href="#contacto" className="hover:text-brand-accent transition-colors">Contacto</a>
          </div>
          <div className="flex items-center gap-3">
            <a href="https://wa.me/5492235428861" target="_blank" className="bg-brand-accent text-background px-6 py-2.5 rounded-full font-bold text-sm hover:opacity-90 transition-opacity flex items-center gap-2">
              <MessageSquare size={14} /> Hablemos
            </a>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden text-brand-text p-2">
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
        {/* Mobile menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-background/95 backdrop-blur-lg border-b border-brand-surface/50 overflow-hidden"
            >
              <div className="flex flex-col gap-4 px-6 py-6 text-sm font-medium">
                <a href="#servicios" onClick={() => setMobileMenuOpen(false)} className="hover:text-brand-accent transition-colors">Servicios</a>
                <a href="#sobre-wis" onClick={() => setMobileMenuOpen(false)} className="hover:text-brand-accent transition-colors">Nosotros</a>
                <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="hover:text-brand-accent transition-colors">FAQ</a>
                <a href="#blog" onClick={() => setMobileMenuOpen(false)} className="hover:text-brand-accent transition-colors">Blog</a>
                <a href="#contacto" onClick={() => setMobileMenuOpen(false)} className="hover:text-brand-accent transition-colors">Contacto</a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* 2. HERO */}
      <section className="pt-48 pb-24 px-6">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <motion.h1
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            className="font-syne font-black text-4xl md:text-5xl lg:text-6xl text-brand-text tracking-tight text-balance leading-tight"
          >
            Tu negocio en automático.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            className="text-base md:text-lg text-brand-accent/90 max-w-2xl mx-auto text-balance font-medium"
          >
            Ahorramos +20hs semanales a nuestros clientes y los ayudamos a generar más ingresos con automatizaciones de IA.
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
            className="text-base md:text-lg text-brand-text/60 max-w-2xl mx-auto text-balance"
          >
            Conectamos IA con tus procesos reales.
          </motion.p>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
          >
            <a href="https://wa.me/5492235428861" target="_blank" className="w-full sm:w-auto bg-brand-accent text-background px-8 py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-transform hover:scale-105">
              <MessageSquare size={18} /> Quiero automatizar mi negocio
            </a>
            <a href="#servicios" className="w-full sm:w-auto bg-brand-surface text-brand-text px-8 py-4 rounded-full font-medium flex items-center justify-center gap-2 hover:bg-brand-surface/80 transition-transform hover:scale-105 border border-brand-surface/50">
              Ver servicios <ArrowRight size={18} />
            </a>
          </motion.div>
        </div>
      </section>

      {/* 2.5 GARANTÍA */}
      <section className="py-20 px-6" style={{ backgroundColor: '#0F0F0C' }}>
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <FadeIn>
            <div className="text-center p-8 rounded-2xl">
              <div className="mb-4 flex justify-center">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#F0B429" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <h3 className="font-syne font-extrabold text-4xl md:text-5xl text-brand-text mb-2" style={{ fontWeight: 800 }}>+20hs</h3>
              <p className="text-brand-text/60 font-sans">ahorradas por semana en promedio</p>
            </div>
          </FadeIn>
          <FadeIn delay={0.1}>
            <div className="text-center p-8 rounded-2xl">
              <div className="mb-4 flex justify-center">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#F0B429" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <h3 className="font-syne font-extrabold text-4xl md:text-5xl text-brand-text mb-2" style={{ fontWeight: 800 }}>3x</h3>
              <p className="text-brand-text/60 font-sans">Mayor conversión de los leads que ya tenés</p>
            </div>
          </FadeIn>
          <FadeIn delay={0.2}>
            <div className="text-center p-8 rounded-2xl border-2 border-brand-accent/60 shadow-[0_0_30px_rgba(240,180,41,0.1)]">
              <div className="mb-4 flex justify-center">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#F0B429" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <h3 className="font-syne font-extrabold text-4xl md:text-5xl text-brand-accent mb-2" style={{ fontWeight: 800 }}>90 días</h3>
              <p className="text-brand-text/60 font-sans">Si no ves resultados, te devolvemos el dinero</p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* 2.6 SOBRE WIS */}
      <section id="sobre-wis" className="py-24 px-6">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <FadeIn>
            <div>
              <h2 className="font-syne font-bold text-4xl md:text-5xl mb-6">Work In Silence<span className="text-brand-accent">.</span></h2>
              <p className="text-brand-text/70 text-lg leading-relaxed">
                WIS nació de un proceso personal de aprendizaje silencioso. Mientras el mercado gritaba sobre IA, nosotros construíamos. Somos una agencia de automatización que primero entiende tu negocio, después construye. Sin demos infinitas, sin tecnología por la tecnología.
              </p>
            </div>
          </FadeIn>
          <FadeIn delay={0.2}>
            <div className="rounded-2xl overflow-hidden">
              <img src="https://picsum.photos/600/400?random=10" alt="Sobre WIS" className="w-full h-[300px] md:h-[400px] object-cover rounded-2xl" />
            </div>
          </FadeIn>
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
            {BLOG_ARTICLES.map((article, i) => (
              <FadeIn key={article.id} delay={i * 0.1}>
                <div className="group cursor-pointer" onClick={() => setSelectedArticle(article)}>
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
                <h3 className="font-syne font-bold text-2xl md:text-3xl mb-2">Recibí contenido sobre IA y automatización</h3>
                <p className="text-brand-text/60 max-w-md">Tácticas, casos de uso y novedades directo a tu bandeja de entrada.</p>
              </div>
              <div className="flex flex-col w-full md:w-auto gap-3 relative z-10">
                {newsletterStatus === 'success' ? (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl px-5 py-3 text-sm font-medium">
                    ¡Gracias! Te avisamos cuando haya novedades.
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="email"
                      placeholder="tu@email.com"
                      value={newsletterEmail}
                      onChange={e => setNewsletterEmail(e.target.value)}
                      className="bg-background border border-brand-surface/50 rounded-xl px-5 py-3 focus:outline-none focus:border-brand-accent min-w-[250px]"
                    />
                    <button
                      onClick={handleNewsletter}
                      className="bg-brand-accent text-background font-bold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
                    >
                      Suscribirme
                    </button>
                  </div>
                )}
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* 6.5 FAQ */}
      <section id="faq" className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <FadeIn>
            <h2 className="font-syne font-bold text-4xl md:text-5xl mb-12 text-center">Preguntas frecuentes</h2>
          </FadeIn>
          <div className="space-y-3">
            {FAQ_ITEMS.map((faq, i) => (
              <FadeIn key={i} delay={i * 0.05}>
                <div className="border border-brand-surface/50 rounded-2xl overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="flex items-center justify-between w-full p-6 text-left font-medium hover:text-brand-accent transition-colors"
                  >
                    <span>{faq.q}</span>
                    <ChevronRight size={18} className={`transition-transform duration-300 flex-shrink-0 ml-4 ${openFaq === i ? 'rotate-90' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {openFaq === i && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <p className="px-6 pb-6 text-brand-text/60 leading-relaxed">{faq.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </FadeIn>
            ))}
          </div>
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
                  <input
                    required
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    onBlur={() => setFormTouched({...formTouched, name: true})}
                    className={inputClass('name')}
                  />
                  {fieldError('name') && <p className="text-red-400 text-xs mt-1">{fieldError('name')}</p>}
                </div>
                <div>
                  <label className="block font-mono text-xs mb-2 text-brand-text/50">EMPRESA</label>
                  <input
                    required
                    value={formData.company}
                    onChange={e => setFormData({...formData, company: e.target.value})}
                    onBlur={() => setFormTouched({...formTouched, company: true})}
                    className={inputClass('company')}
                  />
                  {fieldError('company') && <p className="text-red-400 text-xs mt-1">{fieldError('company')}</p>}
                </div>
              </div>
              <div>
                <label className="block font-mono text-xs mb-2 text-brand-text/50">EMAIL</label>
                <input
                  required
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  onBlur={() => setFormTouched({...formTouched, email: true})}
                  className={inputClass('email')}
                />
                {fieldError('email') && <p className="text-red-400 text-xs mt-1">{fieldError('email')}</p>}
              </div>
              <div>
                <label className="block font-mono text-xs mb-2 text-brand-text/50">¿EN QUÉ PODEMOS AYUDARTE?</label>
                <textarea
                  required
                  rows={4}
                  value={formData.message}
                  onChange={e => setFormData({...formData, message: e.target.value})}
                  onBlur={() => setFormTouched({...formTouched, message: true})}
                  className={inputClass('message')}
                ></textarea>
                {fieldError('message') && <p className="text-red-400 text-xs mt-1">{fieldError('message')}</p>}
              </div>
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <button
                  type="submit"
                  disabled={formStatus === 'loading'}
                  className="flex-1 bg-brand-accent text-background font-bold py-4 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {formStatus === 'loading' ? (
                    <><Loader2 size={18} className="animate-spin" /> Enviando...</>
                  ) : (
                    'Enviar Mensaje'
                  )}
                </button>
                <a href="https://wa.me/5492235428861" target="_blank" className="flex-1 bg-[#25D366] text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
                  <MessageSquare size={18} /> WhatsApp
                </a>
                <button type="button" onClick={copyEmail} className="flex-1 bg-brand-surface border border-brand-text/10 text-brand-text font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-brand-surface/80 transition-opacity relative">
                  <Mail size={18} /> {emailCopied ? '¡Email copiado!' : 'Copiar Email'}
                </button>
              </div>
              {formStatus === 'success' && (
                <div className="mt-6 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl p-4 text-sm font-medium flex items-center gap-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  ¡Mensaje enviado con éxito! Nos pondremos en contacto pronto.
                </div>
              )}
              {formStatus === 'error' && (
                <div className="mt-6 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-4 text-sm font-medium flex items-center gap-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                  Hubo un error al enviar el mensaje. Intentá nuevamente o escribinos por WhatsApp.
                </div>
              )}
            </form>

            <div className="mt-12 pt-8 border-t border-brand-surface border-dashed">
              <h3 className="font-syne font-bold text-xl mb-4">Contactanos directamente:</h3>
              <div className="flex flex-col gap-3 font-mono text-sm text-brand-text/80">
                <button onClick={copyEmail} className="flex items-center gap-3 hover:text-brand-accent transition-colors w-fit cursor-pointer relative">
                  <Mail size={16}/> ortu@wis-agency.com
                  {emailCopied && <span className="absolute -top-6 left-0 bg-emerald-500 text-white text-xs px-2 py-1 rounded">¡Copiado!</span>}
                </button>
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
            <button onClick={copyEmail} className="hover:text-brand-text cursor-pointer">EMAIL</button>
          </div>
          <div className="font-mono text-xs text-brand-text/40">
            wis-agency.com · Work In Silence · 2025
          </div>
        </div>
      </footer>

      {/* FLOATING WHATSAPP */}
      <a
        href="https://wa.me/5492235428861"
        target="_blank"
        className="fixed bottom-6 right-6 z-50 group"
        onMouseEnter={() => setWaTooltip(true)}
        onMouseLeave={() => setWaTooltip(false)}
      >
        <div className="w-14 h-14 bg-[#25D366] rounded-full flex items-center justify-center shadow-lg shadow-[#25D366]/30 hover:scale-110 transition-transform">
          <MessageSquare size={24} className="text-white" />
        </div>
        <AnimatePresence>
          {waTooltip && (
            <motion.span
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="absolute right-16 top-1/2 -translate-y-1/2 bg-brand-surface text-brand-text text-xs font-medium px-3 py-2 rounded-lg whitespace-nowrap border border-brand-surface/50"
            >
              Chateanos
            </motion.span>
          )}
        </AnimatePresence>
      </a>

      {/* ARTICLE MODAL */}
      <AnimatePresence>
        {selectedArticle && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/90 backdrop-blur-md z-[60] flex items-center justify-center p-4 md:p-8"
            onClick={() => setSelectedArticle(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="bg-brand-surface rounded-3xl border border-brand-surface/50 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="relative">
                <img src={selectedArticle.img} alt={selectedArticle.title} className="w-full h-56 md:h-72 object-cover rounded-t-3xl" />
                <div className="absolute inset-0 bg-gradient-to-t from-brand-surface via-transparent to-transparent rounded-t-3xl" />
                <button
                  onClick={() => setSelectedArticle(null)}
                  className="absolute top-4 right-4 bg-background/60 backdrop-blur-sm rounded-full p-2 hover:bg-background/80 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-8 md:p-12">
                <div className="font-mono text-xs text-brand-accent mb-4 flex gap-4">
                  <span>CASO DE ESTUDIO</span>
                  <span className="text-brand-text/40">{selectedArticle.date}</span>
                </div>
                <h2 className="font-syne font-bold text-2xl md:text-3xl mb-6">{selectedArticle.title}</h2>
                {selectedArticle.content.split('\n\n').map((p, i) => (
                  <p key={i} className="text-brand-text/70 mb-4 leading-relaxed">{p}</p>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

import type { Metadata } from 'next';
import { DM_Sans, JetBrains_Mono, Syne } from 'next/font/google';
import Script from 'next/script';
import './globals.css';

const syne = Syne({ subsets: ['latin'], weight: ['700', '800'], variable: '--font-syne' });
const dmSans = DM_Sans({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-dm-sans' });
const jetBrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' });

export const metadata: Metadata = {
  metadataBase: new URL('https://wis-agency.com'),
  title: { default: 'WIS Agency | Automatización con IA para empresas', template: '%s | WIS Agency' },
  description: 'Diseñamos agentes de IA, workflows e integraciones para que tu empresa ahorre tiempo, venda mejor y opere con menos fricción. Argentina y LATAM.',
  keywords: ['automatización con IA', 'agencia de IA Argentina', 'agentes de IA para empresas', 'automatización WhatsApp', 'n8n', 'integración de sistemas', 'automatización de procesos', 'IA para PyMEs'],
  alternates: { canonical: 'https://wis-agency.com' },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large' } },
  openGraph: { type: 'website', locale: 'es_AR', url: 'https://wis-agency.com', siteName: 'WIS Agency', title: 'Automatización con IA para que tu negocio crezca sin sumar caos', description: 'Agentes, integraciones y sistemas que eliminan trabajo manual y aceleran tus ventas.', images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'WIS Agency — Work In Silence' }] },
  twitter: { card: 'summary_large_image', title: 'Automatización con IA para empresas | WIS Agency', description: 'Agentes, integraciones y sistemas que trabajan para tu negocio.', images: ['/og-image.png'] },
  icons: { icon: '/favicon.png', apple: '/icon-512.png' },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', '@id': 'https://wis-agency.com/#organization', name: 'WIS Agency', url: 'https://wis-agency.com', logo: 'https://wis-agency.com/logo.png', email: 'ortu@wis-agency.com', areaServed: ['AR', 'LATAM'], sameAs: ['https://instagram.com/wis.agency'] },
    { '@type': 'WebSite', '@id': 'https://wis-agency.com/#website', url: 'https://wis-agency.com', name: 'WIS Agency', publisher: { '@id': 'https://wis-agency.com/#organization' }, inLanguage: 'es-AR' },
    { '@type': 'Service', serviceType: 'Automatización con inteligencia artificial', provider: { '@id': 'https://wis-agency.com/#organization' }, areaServed: ['AR', 'LATAM'], description: 'Agentes de IA, automatización de procesos e integración de sistemas para empresas.' },
    { '@type': 'FAQPage', mainEntity: [
      { '@type': 'Question', name: '¿Qué tipo de empresas trabajan con WIS?', acceptedAnswer: { '@type': 'Answer', text: 'Trabajamos con PyMEs y equipos en crecimiento que quieren eliminar tareas manuales y mejorar su operación.' } },
      { '@type': 'Question', name: '¿Tengo que cambiar todas mis herramientas?', acceptedAnswer: { '@type': 'Answer', text: 'No. Partimos de lo que ya usás y conectamos las piezas que tienen sentido.' } },
      { '@type': 'Question', name: '¿Cuánto tarda una implementación?', acceptedAnswer: { '@type': 'Answer', text: 'Un primer piloto suele estar listo entre 2 y 4 semanas, según el alcance.' } },
    ] },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><head><Script id="wis-jsonld" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /><Script id="gtm-script" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-MB8NZMQC');` }} /><Script src="https://www.googletagmanager.com/gtag/js?id=G-BRH24BX6BY" strategy="afterInteractive" /><Script id="ga4-script" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-BRH24BX6BY');` }} /></head><body className={`${syne.variable} ${dmSans.variable} ${jetBrainsMono.variable}`}><noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-MB8NZMQC" height="0" width="0" style={{ display: 'none', visibility: 'hidden' }} /></noscript>{children}</body></html>;
}

import type { Metadata } from 'next';
import { Nunito_Sans } from 'next/font/google';
import Script from 'next/script';
import './globals.css';

const wisFont = Nunito_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-wis' });

export const metadata: Metadata = {
  metadataBase: new URL('https://wis-agency.com'),
  title: { default: 'WIS Agency | Automatización con IA para empresas', template: '%s | WIS Agency' },
  description: 'WIS diseña sistemas con inteligencia artificial para ordenar la atención, el seguimiento y los procesos de tu empresa.',
  keywords: ['automatización con IA', 'agencia de IA Argentina', 'agentes de IA para empresas', 'automatización WhatsApp', 'n8n', 'integración de sistemas', 'automatización de procesos', 'IA para PyMEs', 'automatización comercial', 'casos de éxito IA'],
  alternates: { canonical: 'https://wis-agency.com' },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large' } },
  openGraph: { type: 'website', locale: 'es_AR', url: 'https://wis-agency.com', siteName: 'WIS Agency', title: 'La tecnología que trabaja por vos | WIS Agency', description: 'Sistemas con IA para ordenar la atención, el seguimiento y los procesos de tu empresa.', images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'WIS Agency — Work In Silence' }] },
  twitter: { card: 'summary_large_image', title: 'La tecnología que trabaja por vos | WIS Agency', description: 'Sistemas con IA para ordenar la atención, el seguimiento y los procesos de tu empresa.', images: ['/og-image.png'] },
  icons: { icon: '/favicon.png', apple: '/icon-512.png' },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', '@id': 'https://wis-agency.com/#organization', name: 'WIS Agency', url: 'https://wis-agency.com', logo: 'https://wis-agency.com/og-image.png', email: 'ortu@wis-agency.com', areaServed: ['AR', 'LATAM'], sameAs: ['https://instagram.com/wis.agency'] },
    { '@type': 'WebSite', '@id': 'https://wis-agency.com/#website', url: 'https://wis-agency.com', name: 'WIS Agency', publisher: { '@id': 'https://wis-agency.com/#organization' }, inLanguage: 'es-AR' },
    { '@type': 'Service', serviceType: 'Automatización con inteligencia artificial', provider: { '@id': 'https://wis-agency.com/#organization' }, areaServed: ['AR', 'LATAM'], description: 'Agentes de IA, automatización de procesos e integración de sistemas para empresas.' },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><head><Script id="wis-jsonld" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /><Script id="gtm-script" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-MB8NZMQC');` }} /><Script src="https://www.googletagmanager.com/gtag/js?id=G-BRH24BX6BY" strategy="afterInteractive" /><Script id="ga4-script" dangerouslySetInnerHTML={{ __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-BRH24BX6BY');` }} /></head><body className={wisFont.variable}><noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-MB8NZMQC" height="0" width="0" style={{ display: 'none', visibility: 'hidden' }} /></noscript>{children}</body></html>;
}

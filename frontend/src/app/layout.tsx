import type { Metadata } from "next";
import { Syne, DM_Sans, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const syne = Syne({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-syne" });
const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-dm-sans" });
const jetBrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" });

export const metadata: Metadata = {
  title: "WIS Agency | Automatización con IA para tu empresa",
  description:
    "Conectamos IA con los procesos reales de tu negocio. Agentes de ventas, automatización de WhatsApp e integraciones. Argentina y LATAM.",
  metadataBase: new URL("https://wis-agency.com"),
  alternates: {
    canonical: "https://wis-agency.com",
  },
  openGraph: {
    title: "WIS Agency | Automatización con IA para tu empresa",
    description:
      "Conectamos IA con los procesos reales de tu negocio. Agentes de ventas, automatización de WhatsApp e integraciones. Argentina y LATAM.",
    url: "https://wis-agency.com",
    images: [{ url: "/og-image.png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "WIS Agency | Automatización con IA para tu empresa",
    description:
      "Conectamos IA con los procesos reales de tu negocio. Agentes de ventas, automatización de WhatsApp e integraciones. Argentina y LATAM.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <head>
        <Script
          id="gtm-script"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-MB8NZMQC');`
          }}
        />
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-BRH24BX6BY"
          strategy="afterInteractive"
        />
        <Script id="ga4-script" strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-BRH24BX6BY');
            `
          }}
        />
        <link rel="icon" href="/favicon.png" sizes="32x32"/>
        <link rel="apple-touch-icon" href="/icon-512.png"/>
        <link rel="manifest" href="/manifest.json"/>
        <meta property="og:image" content="https://wis-agency.com/og-image.png"/>
        <meta property="og:image:width" content="1200"/>
        <meta property="og:image:height" content="630"/>
        <meta name="twitter:image" content="https://wis-agency.com/og-image.png"/>
      </head>
      <body className={`${syne.variable} ${dmSans.variable} ${jetBrainsMono.variable} bg-background text-brand-text font-sans antialiased selection:bg-brand-accent selection:text-background`}>
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-MB8NZMQC"
            height="0" width="0"
            style={{display:'none', visibility:'hidden'}}
          />
        </noscript>
        {children}
      </body>
    </html>
  );
}

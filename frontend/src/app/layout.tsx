import type { Metadata } from "next";
import { Syne, DM_Sans, JetBrains_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";

const syne = Syne({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-syne" });
const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-dm-sans" });
const jetBrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" });
const playfair = Playfair_Display({ subsets: ["latin"], weight: ["700", "800", "900"], variable: "--font-playfair" });

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
      <body className={`${syne.variable} ${dmSans.variable} ${jetBrainsMono.variable} ${playfair.variable} bg-background text-brand-text font-sans antialiased selection:bg-brand-accent selection:text-background`}>
        {children}
      </body>
    </html>
  );
}

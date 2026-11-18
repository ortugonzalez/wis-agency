import Link from 'next/link';

export default function NotFound() {
  return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#080908', color: '#f5f0e6', fontFamily: 'Arial, sans-serif' }}><div style={{ maxWidth: 520 }}><span style={{ color: '#f2b52d', fontSize: 12, letterSpacing: '.16em' }}>WIS / 404</span><h1 style={{ fontSize: 'clamp(56px, 10vw, 120px)', lineHeight: .9, letterSpacing: '-.08em', fontWeight: 500, margin: '24px 0' }}>Esta página no está.</h1><p style={{ color: '#9a9b95', lineHeight: 1.7 }}>Pero podemos ayudarte a ordenar la que sí necesitás.</p><Link href="/" style={{ display: 'inline-block', marginTop: 24, padding: '14px 20px', borderRadius: 999, color: '#080908', background: '#f2b52d', fontWeight: 700 }}>Volver a WIS</Link></div></main>;
}

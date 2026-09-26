# Prueba de punta a punta

## Ejecutable localmente sin credenciales

La suite cubre:

- 280 y 281 caracteres ponderados.
- emojis, hashtags, URLs de 23 caracteres y NFC.
- single, hilo válido y parte inválida.
- publicación exitosa, hilo secuencial, parte ya publicada, falla intermedia, resultado incierto y dry-run.

Ejecutar:

```powershell
rtk npm test
```

Resultado de esta implementación: 12 pruebas, 12 PASS después de corregir la importación CommonJS de `twitter-text` y el reconocimiento de outcomes inciertos.

## Pendiente por entorno

No se ejecutó una prueba real contra X, Telegram, Supabase ni n8n porque el acceso vivo a n8n devolvió HTTP 502 y no hay autorización OAuth/token disponible en este contexto. La prueba real requiere cuenta correcta, texto visible al usuario y aprobación explícita; el código queda con dry-run por defecto.

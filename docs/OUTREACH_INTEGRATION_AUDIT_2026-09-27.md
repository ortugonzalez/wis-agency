# Auditoría read-only de integraciones comerciales

Fecha: 27 de septiembre de 2026. No se enviaron mensajes, no se activaron workflows y no se modificaron credenciales.

## Email

- El alias histórico es `Ortu - WIS <ortu@wis-agency.com>` mediante Gmail/Brevo.
- La verificación histórica no demuestra salud actual. Antes del canario deben revisarse alias, reply-to, firma, SPF, DKIM y DMARC.
- No existe un sender n8n de prospección WIS versionado ni un workflow actual reutilizable de forma segura.
- Los nodos de email encontrados pertenecen a BORA, MundoVera o QH y quedan fuera de alcance.

## WhatsApp WIS

Los cuatro workflows identificados permanecen inactivos:

- `CLXi4JbfHbEreCqf`: legacy inbound/responder; no cumple el flujo email-first y queda excluido del canario.
- `ueC3CT1EnYvnEXGZ`: draft outbound compliance-first; referencia útil para research, consentimiento y control, sin sender.
- `b1db0wIuKMPiDUgf`: inbound opt-out, deduplicación y handoff; su HTTP real debe sustituirse por stub en dry-run.
- `c7G5VrTf0EPiey7t`: envío posterior a QA; es la base más cercana, pero requiere idempotencia y reconciliación de `OUTCOME_UNKNOWN`.

DUGAS y QH están separados por nombre, ID y contenido. No fueron tocados y no deben reutilizarse.

## Bloqueos antes del canario

1. Crear un sender de email WIS aislado.
2. Agregar la clave idempotente canónica a cola y proveedor.
3. Implementar reconciliación antes de reintentar resultados inciertos.
4. Validar sesión WIS 5679 y bloquear cualquier envío fuera de la ventana de 24 horas; el canal Baileys no usa plantillas oficiales.
5. Revalidar salud actual de Gmail/Brevo.
6. Ejecutar 25 fixtures con proveedores sustituidos por stubs.

Conclusión: las integraciones están correctamente separadas, pero aún no están listas para envío real. El canario debe permanecer en `WAITING_APPROVAL` hasta cerrar estos bloqueos.



# Auditoría segura del canal de email WIS

Fecha: 27 de septiembre de 2026  
Última comprobación autenticada de sólo lectura: `2026-09-27T07:46:47Z`  
Alcance: Gmail, Brevo, n8n, DNS del dominio remitente y baseline local del sender.

## Resultado ejecutivo

**Estado: `WAITING_APPROVAL / NOT READY FOR CANARY`.**

Se creó una implementación local, versionada y deliberadamente desactivada en `integrations/email/**`. No se enviaron emails, no se importaron ni activaron workflows, no se modificaron credenciales o cuentas y no se ejecutaron pruebas con efectos externos.

El inventario vivo de n8n fue consultado sólo mediante `GET`: hay 159 workflows, de los cuales 12 contienen nodos de email; los 12 pertenecen a alcances ajenos identificables y los 12 están inactivos. No existe un workflow WIS de email, no aparece una referencia al alias `ortu@wis-agency.com` y no se reutilizó ninguno de esos flujos. Tampoco hay ejecuciones recientes devueltas para esos 12 workflows.

No fue posible confirmar el alias actual de Gmail ni el remitente de Brevo con las credenciales de sólo lectura disponibles. Por diseño, una referencia de credencial en n8n no se considera evidencia de alias verificado.

## Evidencia y hallazgos

| Control | Resultado | Evidencia / interpretación |
|---|---|---|
| Alias Gmail `Ortu - WIS <ortu@wis-agency.com>` | **NO VERIFICADO** | No había una credencial/API Gmail read-only que permitiera listar aliases. La configuración local mantiene `alias_verification=PENDING`. |
| Brevo sender | **NO VERIFICADO** | `BREVO_API_KEY` no estaba disponible en la fuente local consultada. No se intentó autenticación alternativa. |
| n8n WIS aislado | **AUSENTE EN VIVO** | 0 workflows WIS email entre 159; 12/12 workflows con nodos email son ajenos y están inactivos. Tipos de referencia observados: Gmail OAuth2 y SMTP. |
| Logs n8n de email | **SIN EVIDENCIA RECIENTE** | La consulta de hasta cinco ejecuciones por cada workflow email devolvió 0 ejecuciones. Esto no prueba salud del canal. |
| From | **CONTRATO LOCAL, NO VALIDADO EN PROVEEDOR** | Runtime y export fijan `Ortu - WIS`; Gmail deberá demostrar que efectivamente emite con `ortu@wis-agency.com`. |
| Reply-To | **CONTRATO LOCAL** | Fijado en `ortu@wis-agency.com`; falta validación por mensaje interno aprobado. |
| Firma | **BLOQUEADA** | No se encontró un HTML aprobado/versionado. Se incluyó sólo un ejemplo marcado “NO APROBADO”; el runtime exige estado `APPROVED`, hash SHA-256 exacto y ausencia de Gravatar. |
| CC/BCC | **BLOQUEADO POR CÓDIGO** | El preflight rechaza ambos campos y el workflow no los configura. |
| SPF | **PUBLICADO, ALINEACIÓN NO DEMOSTRADA** | `v=spf1 include:_spf.mx.cloudflare.net ~all`. No aparecen autorizaciones explícitas de Google o Brevo; debe validarse el proveedor/MAIL FROM definitivo antes del canario. |
| DKIM | **NO VERIFICADO** | No hubo TXT ni CNAME en los selectores comunes `google`, `default`, `mail`, `brevo` y `sib`. Sin el selector autoritativo no corresponde afirmar que DKIM está ausente. |
| DMARC | **PUBLICADO EN MONITOREO** | `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com`. No aplica cuarentena o rechazo y por sí solo no prueba alineación. |
| MX | **CLOUDFLARE EMAIL ROUTING** | `route1.mx.cloudflare.net`, `route2.mx.cloudflare.net`, `route3.mx.cloudflare.net`. Esto describe recepción, no autoriza envío. |

## Baseline local entregada

- `integrations/email/config.schema.json`: esquema estricto de remitente, reply-to, firma, referencias de credenciales y límites.
- `integrations/email/config.disabled.json`: `enabled=false`, `dry_run=true`, alias y firma en `PENDING`.
- `integrations/email/runtime.mjs`: preflight fail-closed, hash de copy y firma, idempotencia durable y construcción de un solo sobre individual; no contiene transporte de red.
- `integrations/email/workflows/wis-email-sender.disabled.json`: export n8n inactivo con trigger manual, hard gate `ENABLED=false` y nodo Gmail también desactivado. Usa placeholders, no credenciales.
- `integrations/email/health-check.mjs`: DNS público y auditoría autenticada opcional exclusivamente `GET`, con salida resumida y sin secretos/IDs.
- `integrations/email/signature.example.html`: muestra no aprobada y sin recursos remotos.
- `integrations/email/test/email-sender.test.mjs`: pruebas offline de los gates.

La triple desactivación del export es intencional. El canario no debe obtenerse editando este baseline: luego de cerrar los controles debe generarse un export de canario separado, revisado por QA y sujeto a aprobación humana.

## Verificaciones offline ejecutadas

- `rtk node --test integrations/email/test/email-sender.test.mjs`: **4/4 PASS**.
- `rtk npm test`: **PASS**; validación de agentes, dos dry-runs y **10/10 tests PASS**.
- El fixture habilitado sólo en memoria confirmó sobre individual, `From`, `Reply-To`, copy inmutable, firma por hash, idempotencia, sin CC/BCC.
- Casos negativos confirmados: sender desactivado, alias no verificado, cambio de asunto o copy, Gravatar, CC/BCC y clave duplicada.

## Bloqueos exactos antes del canario

1. **Alias Gmail:** listar aliases con una API/credencial read-only y demostrar que `ortu@wis-agency.com` está verificado y permitido para la credencial WIS exclusiva.
2. **Elección de transporte:** decidir Gmail o Brevo para el canario. No mezclar ambos ni reutilizar referencias ajenas.
3. **Brevo, si se elige:** proporcionar acceso read-only y confirmar sender activo `Ortu - WIS <ortu@wis-agency.com>`.
4. **Autenticación del dominio:** obtener el selector DKIM real del proveedor, verificar su registro y corregir/validar SPF para el MAIL FROM definitivo. Confirmar alineación SPF o DKIM con `wis-agency.com`; DMARC `p=none` no alcanza como evidencia de entrega autenticada.
5. **Firma:** aprobar el HTML exacto sin Gravatar, versionarlo de forma segura y registrar su SHA-256 en la configuración de canario.
6. **Credencial exclusiva:** crear/seleccionar una referencia n8n de WIS; no usar Gmail OAuth2/SMTP de BORA, MundoVera, QH, DUGAS u otro proyecto.
7. **Persistencia:** conectar `Outreach_Queue` y `Outreach_Events` y reconstruir antes de cada enqueue el índice desde cola más reconciliación del proveedor.
8. **Reconciliación:** definir y probar por stub la transición durable `OUTCOME_UNKNOWN → RECONCILED`; no reintentar timeouts sin evidencia.
9. **Observabilidad:** persistir provider reference real, intento, entrega, rebote, respuesta, baja y motivo de pausa; 0 ejecuciones recientes no valida salud.
10. **Canario interno:** con aprobación humana explícita, enviar primero a un buzón controlado y verificar headers reales, From, Reply-To, firma, SPF, DKIM, DMARC y respuesta. Esta es una prueba externa y no fue ejecutada.
11. **Lote comercial:** QA independiente y aprobación vigente para combinación exacta de lote, canal, versión, secuencia y cantidad; el sender debe mantenerse en `WAITING_APPROVAL` hasta entonces.

## Criterio de salida

El canal sólo puede pasar a canario cuando los once bloqueos anteriores tengan evidencia durable. La primera activación/importación de workflow, cualquier cambio de credencial y cualquier envío —incluso interno— requieren aprobación humana explícita.

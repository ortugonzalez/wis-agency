# Canal WhatsApp WIS 5679 (local, no oficial)

Este módulo es una barrera local, versionada y **desactivada** para la conexión WIS cuya identidad completa debe verificarse y cuyo número termina en `5679`. No usa la API oficial de WhatsApp/Meta ni Kapso: el transporte previsto es Baileys, una conexión no oficial con riesgo de bloqueo o suspensión.

No contiene transporte, QR, cookies, credenciales ni código que llame a WhatsApp. Su única función actual es validar y persistir una cola local segura. `channel.config.json` debe conservar `enabled: false` hasta que el propietario apruebe por separado un canario y la activación. Cambiar ese flag o conectar un worker es un efecto externo y queda fuera de esta entrega.

## Controles implementados

- vínculo estricto a `owner=WIS`, `connection_id=wis-5679` e identidad E.164 terminada en `5679`;
- rechazo explícito de namespaces DUGAS y QH;
- clave durable `prospect_key + campaign_id + WHATSAPP + sequence` con fingerprint del payload;
- opt-in verificable y baja durable (la evidencia sensible se conserva sólo como SHA-256);
- email inicial previo, no simultaneidad de canales, QA independiente y aprobación exacta vigente;
- máximo 10 conversaciones iniciadas por día, 15 minutos entre envíos y una sola secuencia de seguimiento;
- `OUTCOME_UNKNOWN` bloqueado hasta un evento durable `RECONCILED` con evidencia;
- cola con estado `EN_COLA_DESACTIVADA`; no existe adaptador de envío.

## Ventana de 24 horas y plantillas

Este canal no oficial no soporta ni simula plantillas oficiales. Por eso no depende de un catálogo de plantillas: fuera de las 24 horas desde el opt-in/inbound verificable bloquea con `SERVICE_WINDOW_EXPIRED`. La salida segura es obtener un nuevo inbound/consentimiento verificable o usar, en otro canal oficial y con aprobación específica, la capacidad de plantillas correspondiente.

## Pruebas offline

Desde la raíz del repositorio:

```powershell
rtk node --test integrations/whatsapp/channel.test.mjs
```

Las pruebas usan directorios temporales, no abren red y no envían mensajes.

# WIS Operations Dashboard

Panel operativo local para observar research, QA, canales, historial y controles desde un único lugar.

## Alcance

- resumen ejecutivo y calidad del lote;
- cobertura de las 149 distribuidoras existentes;
- historial previo de 59 prospectos, 50 envíos y 52 eventos;
- salud separada de Gmail/Brevo y WhatsApp 5679;
- botones para registrar research, QA, copy y actualización;
- programación diaria o cada X minutos, inicialmente pausada.

La fuente operativa sigue siendo el Google Sheet `WIS · Operaciones de Agentes`. `Dashboard_Snapshot`, `Automation_Control`, `Task_Commands` y `Channel_Health` consolidan la vista. El servidor local mantiene una cola append-only de comandos; esos comandos no envían mensajes ni activan proveedores.

## Vista local

Desde la raíz:

```powershell
rtk npm run dashboard:start
```

Abrir `http://127.0.0.1:4174/#overview`. Sin el servidor, el front funciona como snapshot de lectura, pero los botones y horarios no persisten.

Las programaciones se guardan localmente y comienzan en `PAUSED`. Para que ejecuten agentes reales hace falta conectar un consumidor autenticado de `Task_Commands`; esa conexión aún no está habilitada.

## Publicación

El manifiesto de Sites está preparado, pero no agrega autenticación por sí mismo. El despliegue exige aprobación humana explícita según `AGENTS.md` y debe verificarse como privado `owner-only` antes de compartir cualquier URL.

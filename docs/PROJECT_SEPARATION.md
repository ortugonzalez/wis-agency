# Separación de proyectos WIS

## Proyecto activo

`WIS BOTS` se limita al pipeline comercial paralelo de WIS:

1. investigación de prospectos;
2. redacción de email y WhatsApp;
3. envío y seguimiento de email;
4. envío y seguimiento de WhatsApp elegible;
5. orquestación, aprobación humana y QA.

Los únicos roles activos son `wis-orchestrator`, `prospect-research`, `outreach-copy`, `email-sender`, `whatsapp-sender` y `qa-ops`.

El flujo prioritario es completar 300 distribuidoras argentinas medianas o chicas y, después, 300 empresas logísticas de Latinoamérica. Se opera en lotes de 25, con email como primer canal y WhatsApp únicamente después de un opt-in verificable. Los envíos reales y las activaciones externas requieren aprobación humana por lote.

## Sistemas retirados del alcance activo

Los siguientes roles y activos dejan de formar parte del registro, dashboard y cola comercial:

- `content-strategy`;
- `linkedin-operator`;
- `x-operator`;
- `web-brand`;
- `automation-integrations` como rol generalista;
- `growth-research` y `commercial-activation`, reemplazados por roles comerciales más específicos.

Sus directorios, scripts, workflows, documentación e historial se conservan sin modificaciones para una migración posterior a proyectos independientes. No se eliminan, reorganizan, activan ni ejecutan desde el pipeline comercial.

## Conversaciones históricas

Las conversaciones sobre LinkedIn, X, contenido y web se conservan abiertas como referencia histórica, pero no se asignan a los seis roles activos ni aparecen en la cola comercial. Las conversaciones de prospección, email, WhatsApp, orquestación y QA pueden seguir utilizándose como fuentes de contexto sin duplicarlas ni archivarlas.

## Límites de integración

- Gmail/Brevo y los workflows WIS de n8n/Kapso-MundoVera son las integraciones objetivo del proyecto comercial.
- DUGAS y QH quedan expresamente fuera de alcance.
- Los sistemas retirados mantienen sus controles de seguridad actuales, pero no reciben nuevas tareas desde este proyecto.
- Ninguna credencial, cookie, token, QR o estado de sesión se copia entre proyectos, Git, Sheets o handoffs.
- Cualquier migración futura debe crear su propio registro, dashboard, permisos, pruebas y aprobación antes de modificar los activos preservados.

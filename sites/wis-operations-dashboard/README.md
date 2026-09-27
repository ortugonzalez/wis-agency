# WIS Operations Dashboard

Panel estático de lectura para observar el sistema multiagente WIS desde un único lugar.

## Alcance

- resumen ejecutivo y camino crítico;
- tareas, ejecuciones, aprobaciones y handoffs;
- registro de nueve agentes y sus límites;
- mapa de conversaciones fuente;
- filtros y detalle de tareas sin escrituras externas.

La fuente operativa sigue siendo el Google Sheet `WIS · Operaciones de Agentes`. El dashboard incluido en este commit es un snapshot fechado; no activa automatizaciones ni modifica datos.

## Vista local

Servir el directorio `dist` con cualquier servidor HTTP estático. No abrir directamente con `file://`, porque algunos navegadores restringen comportamientos de scripts locales.

## Publicación

El manifiesto de Sites está preparado. El despliegue exige aprobación humana explícita según `AGENTS.md`.

# Operación comercial WIS

La operación usa cuatro roles activos. `wis-orchestrator` asigna lotes y registra aprobaciones; `prospect-intelligence` reúne evidencia y redacta; `outreach-ops` prepara los canales; `qa-ops` revisa de forma independiente.

El tamaño normal de lote es 25. Cada fila y cada mensaje tienen un único propietario por etapa. Toda salida externa requiere QA y una aprobación humana vigente que coincida exactamente con campaña, lote, canal, versión, secuencia y cantidad.

El orden es: evidencia → solución desarrollable → copy → QA → aprobación → email → reconciliación → WhatsApp elegible. Las pruebas de entrega son mensajes semilla independientes, nunca CC/BCC.

Ver [COMMERCIAL_OBJECTIVE.md](./COMMERCIAL_OBJECTIVE.md) para el contrato operativo completo.

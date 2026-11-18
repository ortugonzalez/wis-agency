const present = value => Boolean(String(value ?? "").trim());
const enabled = value => String(value ?? "").trim().toLowerCase() === "true";

const item = (name, ok, detail, blocker = "") => ({ name, ok: Boolean(ok), detail, blocker: ok ? "" : blocker });

export function productionReadiness(env = process.env) {
  const groups = {
    dashboard: [
      item("Autenticación obligatoria", enabled(env.WIS_REQUIRE_AUTH), "Basic auth activada", "WIS_REQUIRE_AUTH=true"),
      item("Usuario del dashboard", present(env.WIS_DASHBOARD_USERNAME), "Usuario configurado", "WIS_DASHBOARD_USERNAME"),
      item("Contraseña hasheada", /^[a-f0-9]{64}$/i.test(String(env.WIS_DASHBOARD_PASSWORD_SHA256 || "")), "SHA-256 configurado", "WIS_DASHBOARD_PASSWORD_SHA256 (64 hex)"),
      item("Mutaciones remotas", enabled(env.WIS_ALLOW_REMOTE_MUTATIONS), "Botones remotos habilitados con control de origen", "WIS_ALLOW_REMOTE_MUTATIONS=true"),
      item("QA de despliegue", enabled(env.WIS_DASHBOARD_DEPLOYMENT_QA_PASSED), "Revisión independiente del release", "WIS_DASHBOARD_DEPLOYMENT_QA_PASSED=true")
    ],
    sheets: [
      item("Cuenta de servicio", present(env.GOOGLE_SERVICE_ACCOUNT_EMAIL), "Email configurado", "GOOGLE_SERVICE_ACCOUNT_EMAIL"),
      item("Clave privada", present(env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_B64) || present(env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY), "Clave configurada fuera de Git", "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_B64"),
      item("Planilla comercial", present(env.WIS_COMMERCIAL_SHEET_ID), "ID configurado", "WIS_COMMERCIAL_SHEET_ID"),
      item("Planilla operativa", present(env.WIS_OPERATIONS_SHEET_ID), "ID configurado", "WIS_OPERATIONS_SHEET_ID"),
      item("Escrituras operativas", enabled(env.WIS_SHEETS_WRITES_ENABLED), "Escrituras explícitamente habilitadas", "WIS_SHEETS_WRITES_ENABLED=true"),
      item("Webhook de cambios", present(env.WIS_SHEETS_CHANGE_TOKEN), "HMAC configurado", "WIS_SHEETS_CHANGE_TOKEN"),
      item("Sincronización E2E", enabled(env.WIS_SHEETS_SYNC_E2E_PASSED), "Sheets → HMAC → dashboard → SSE verificado", "WIS_SHEETS_SYNC_E2E_PASSED=true")
    ],
    telegram: [
      item("Token del bot", present(env.WIS_TELEGRAM_BOT_TOKEN), "Token configurado", "WIS_TELEGRAM_BOT_TOKEN"),
      item("Secret del webhook", present(env.WIS_TELEGRAM_WEBHOOK_SECRET), "Secret configurado", "WIS_TELEGRAM_WEBHOOK_SECRET"),
      item("Usuario permitido", String(env.WIS_TELEGRAM_ALLOWED_USER_IDS || "").split(",").some(value => /^\d+$/.test(value.trim())), "Allowlist numérica configurada", "WIS_TELEGRAM_ALLOWED_USER_IDS"),
      item("Transcripción OpenAI", present(env.OPENAI_API_KEY), "Clave disponible sólo en el entorno", "OPENAI_API_KEY"),
      item("Texto E2E", enabled(env.WIS_TELEGRAM_TEXT_E2E_PASSED), "Comando de texto validado", "WIS_TELEGRAM_TEXT_E2E_PASSED=true"),
      item("Audio E2E", enabled(env.WIS_TELEGRAM_AUDIO_E2E_PASSED), "Audio real transcripto y eliminado", "WIS_TELEGRAM_AUDIO_E2E_PASSED=true"),
      item("QA independiente", enabled(env.WIS_TELEGRAM_QA_PASSED), "Bot revisado independientemente", "WIS_TELEGRAM_QA_PASSED=true")
    ],
    email: [
      item("Proveedor único", String(env.WIS_EMAIL_PROVIDER || "").toLowerCase() === "wis_mailer", "WIS Mailer seleccionado", "WIS_EMAIL_PROVIDER=wis_mailer"),
      item("Remitente dedicado", String(env.WIS_EMAIL_SENDER || "").toLowerCase() === "ortu@wis-ia.com", "ortu@wis-ia.com", "WIS_EMAIL_SENDER=ortu@wis-ia.com"),
      item("Worker WIS Mailer", present(env.WIS_EMAIL_ENQUEUE_URL) && present(env.WIS_EMAIL_API_TOKEN), "Endpoint y token configurados", "WIS_EMAIL_ENQUEUE_URL + WIS_EMAIL_API_TOKEN"),
      item("Eventos WIS Mailer", present(env.WIS_EMAIL_EVENT_SECRET), "Webhook firmado configurado", "WIS_EMAIL_EVENT_SECRET"),
      item("Buzón Microsoft 365", enabled(env.WIS_EMAIL_MAILBOX_VERIFIED), "Mailbox WIS exacto verificado en el worker", "WIS_EMAIL_MAILBOX_VERIFIED=true"),
      item("Aplicación Entra", enabled(env.WIS_EMAIL_ENTRA_APP_VERIFIED), "Aplicación y credenciales verificadas en el worker; secretos no duplicados en el dashboard", "WIS_EMAIL_ENTRA_APP_VERIFIED=true"),
      item("Consentimiento Graph", enabled(env.WIS_EMAIL_GRAPH_ADMIN_CONSENTED), "Mail.ReadWrite y Mail.Send consentidos administrativamente", "WIS_EMAIL_GRAPH_ADMIN_CONSENTED=true"),
      item("Firma WIS", enabled(env.WIS_EMAIL_SIGNATURE_APPROVED), "Firma HTML aprobada", "WIS_EMAIL_SIGNATURE_APPROVED=true"),
      item("DNS alineado", enabled(env.WIS_EMAIL_DNS_VERIFIED), "MX, SPF, DKIM y DMARC verificados", "WIS_EMAIL_DNS_VERIFIED=true"),
      item("Pruebas semilla", enabled(env.WIS_EMAIL_SEED_TESTS_PASSED), "Gmail, Microsoft y Yahoo registrados", "WIS_EMAIL_SEED_TESTS_PASSED=true"),
      item("QA independiente", enabled(env.WIS_EMAIL_QA_PASSED), "Mailer y monitor revisados independientemente", "WIS_EMAIL_QA_PASSED=true"),
      item("Salida de email", enabled(env.WIS_EMAIL_OUTBOUND_ENABLED) && enabled(env.WIS_MAILER_OUTBOUND_ENABLED), "Salida aprobada y habilitada", "Aprobación humana antes de activar")
    ],
    whatsapp: [
      item("Identidad 5679", enabled(env.WIS_WHATSAPP_IDENTITY_VERIFIED), "Línea verificada", "WIS_WHATSAPP_IDENTITY_VERIFIED=true"),
      item("Sesión conectada", enabled(env.WIS_WHATSAPP_SESSION_CONNECTED), "Sesión activa", "Revincular QR y verificar identidad"),
      item("Webhook exclusivo", present(env.WIS_WHATSAPP_WEBHOOK_URL) && present(env.WIS_WHATSAPP_WEBHOOK_TOKEN), "Adaptador WIS configurado", "WIS_WHATSAPP_WEBHOOK_URL + token"),
      item("Eventos WhatsApp", present(env.WIS_WHATSAPP_EVENT_SECRET), "Webhook firmado configurado", "WIS_WHATSAPP_EVENT_SECRET"),
      item("Riesgo de transporte aceptado", enabled(env.WIS_WHATSAPP_TRANSPORT_APPROVED), "Baileys aprobado separadamente", "Aprobación humana separada"),
      item("QA de webhook", enabled(env.WIS_WHATSAPP_WEBHOOK_QA_PASSED), "Puente firmado revisado independientemente", "WIS_WHATSAPP_WEBHOOK_QA_PASSED=true"),
      item("Rollback verificado", enabled(env.WIS_WHATSAPP_ROLLBACK_VERIFIED), "Desactivación y recuperación comprobadas", "WIS_WHATSAPP_ROLLBACK_VERIFIED=true"),
      item("Salida WhatsApp", enabled(env.WIS_WHATSAPP_OUTBOUND_ENABLED) && String(env.WIS_WHATSAPP_OUTBOUND_PAUSED || "true").toLowerCase() === "false", "Salida aprobada y sin pausa", "Aprobación humana antes de activar")
    ]
  };
  const summary = Object.fromEntries(Object.entries(groups).map(([name, checks]) => [name, {
    ready: checks.every(check => check.ok),
    completed: checks.filter(check => check.ok).length,
    total: checks.length
  }]));
  return {
    ready: Object.values(summary).every(group => group.ready),
    generatedAt: new Date().toISOString(),
    summary,
    groups,
    safety: {
      secretsExposed: false,
      outboundEmailEnabled: summary.email.ready,
      outboundWhatsappEnabled: summary.whatsapp.ready
    }
  };
}


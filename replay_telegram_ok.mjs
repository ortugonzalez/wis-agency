import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync('C:/Users/Operador/Desktop/Playground/.env', 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    }),
);

const configuredBase = String(env.N8N_API_BASE_URL || '').replace(/\/$/, '');
const publicBase = configuredBase.replace(/\/api\/v1$/i, '');
const webhookPath = '/webhook/nEzq5nGzYQ663wXM/telegraminbound/webhook';
const authorizedId = 7512675688;

const payload = {
  update_id: Math.floor(Date.now() / 1000),
  message: {
    message_id: Math.floor(Date.now() / 1000),
    from: { id: authorizedId, is_bot: false, first_name: 'Ortu' },
    chat: { id: authorizedId, first_name: 'Ortu', type: 'private' },
    date: Math.floor(Date.now() / 1000),
    text: 'OK',
    reply_to_message: { message_id: 4183 },
  },
};

const response = await fetch(`${publicBase}${webhookPath}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
  signal: AbortSignal.timeout(30000),
});
const raw = await response.text();
if (!response.ok) throw new Error(`${response.status}: ${raw}`);
console.log(JSON.stringify({ ok: true, status: response.status, accepted: true }, null, 2));

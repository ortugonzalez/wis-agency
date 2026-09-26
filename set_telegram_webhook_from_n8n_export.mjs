import fs from 'node:fs';

const credentialsPath = '/tmp/wis-credentials.json';
const targetUrl = process.argv[2];
if (!targetUrl?.startsWith('https://')) throw new Error('Falta URL HTTPS del webhook');

const exported = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
const credentials = Array.isArray(exported) ? exported : exported.data || [];
const telegram = credentials.find((item) => item.name === 'Telegram account' || item.type === 'telegramApi');
const token = telegram?.data?.accessToken;
if (!token) throw new Error('No se encontró el token de Telegram en la exportación temporal');

const setResponse = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: targetUrl, drop_pending_updates: false }),
  signal: AbortSignal.timeout(30000),
});
const setResult = await setResponse.json();
if (!setResponse.ok || setResult.ok !== true) throw new Error(`setWebhook falló: ${JSON.stringify(setResult)}`);

const infoResponse = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`, {
  signal: AbortSignal.timeout(30000),
});
const info = await infoResponse.json();
if (!infoResponse.ok || info.ok !== true) throw new Error('getWebhookInfo falló');

console.log(JSON.stringify({
  ok: true,
  url: info.result?.url,
  pending_update_count: info.result?.pending_update_count,
  last_error_date: info.result?.last_error_date,
  last_error_message: info.result?.last_error_message,
}, null, 2));

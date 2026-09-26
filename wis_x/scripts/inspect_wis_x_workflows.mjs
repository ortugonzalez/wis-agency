import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync('C:/Users/Operador/Desktop/Playground/.env', 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => { const i = line.indexOf('='); return [line.slice(0, i).trim(), line.slice(i + 1).trim()]; }),
);
const configuredBase = String(env.N8N_API_BASE_URL || '').replace(/\/$/, '');
const apiRoot = /\/api\/v1$/i.test(configuredBase) ? configuredBase : `${configuredBase}/api/v1`;
const headers = { 'X-N8N-API-KEY': env.N8N_API_KEY };

const response = await fetch(`${apiRoot}/workflows?limit=100`, { headers });
const list = await response.json();
console.log(JSON.stringify((list.data || []).filter((item) => item.name.includes('WIS X')).map((item) => ({ id: item.id, name: item.name, active: item.active })), null, 2));

const dedicated = await (await fetch(`${apiRoot}/workflows/VT1s1aTNn4y9BZo0`, { headers })).json();
console.log(JSON.stringify(dedicated.nodes.map((node) => ({ name: node.name, type: node.type, parameters: node.parameters, credentials: node.credentials })), null, 2));

import fs from 'node:fs';

const env = Object.fromEntries(fs.readFileSync('C:/Users/Operador/Desktop/Playground/.env', 'utf8').split(/\r?\n/).filter((line) => line && !line.startsWith('#') && line.includes('=')).map((line) => { const i = line.indexOf('='); return [line.slice(0, i).trim(), line.slice(i + 1).trim()]; }));
const configuredBase = String(env.N8N_API_BASE_URL || '').replace(/\/$/, '');
const apiRoot = /\/api\/v1$/i.test(configuredBase) ? configuredBase : `${configuredBase}/api/v1`;
const response = await fetch(`${apiRoot}/workflows/VT1s1aTNn4y9BZo0`, { headers: { 'X-N8N-API-KEY': env.N8N_API_KEY } });
const workflow = await response.json();
if (!response.ok) throw new Error(`n8n_${response.status}`);
console.log(JSON.stringify((workflow.nodes || []).map((node) => ({ name: node.name, type: node.type, typeVersion: node.typeVersion, parameters: node.parameters, credentialNames: Object.values(node.credentials || {}).map((credential) => credential.name) }))));

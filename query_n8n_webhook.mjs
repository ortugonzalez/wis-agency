import { DatabaseSync } from 'node:sqlite';

const workflowId = process.argv[2];
if (!workflowId) throw new Error('Falta workflow id');
const database = new DatabaseSync('/home/node/.n8n/database.sqlite', { readOnly: true });
const columns = database.prepare('PRAGMA table_info(webhook_entity)').all().map((row) => row.name);
const rows = database.prepare('SELECT * FROM webhook_entity WHERE workflowId = ?').all(workflowId);
console.log(JSON.stringify({ columns, rows }, null, 2));

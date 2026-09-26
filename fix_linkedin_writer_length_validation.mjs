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

const writerId = '1ZWaUJr5t3HWFrqa';
const ensureOnly = process.argv.includes('--ensure-only');
const configuredBase = String(env.N8N_API_BASE_URL || '').replace(/\/$/, '');
const apiRoot = /\/api\/v1$/i.test(configuredBase) ? configuredBase : `${configuredBase}/api/v1`;
const headers = { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' };

async function api(path, options = {}) {
  const response = await fetch(`${apiRoot}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
    signal: AbortSignal.timeout(30_000),
  });
  const raw = await response.text();
  let body;
  try { body = JSON.parse(raw); } catch { body = raw; }
  if (!response.ok) throw new Error(`n8n_${response.status}_${path}`);
  return body;
}

function parserIsFixed(code) {
  return code.includes("bodyPost.length < 600 || bodyPost.length > 950")
    && code.includes("finalPost.length > 3000")
    && code.includes("const questionMatches = [...bodyPost.matchAll")
    && code.includes("const finalQuestionMatch = bodyPost.match")
    && code.includes("(?:Porque|Que)")
    && !code.includes("finalPost.length < 650 || finalPost.length > 1300");
}

function buildIsFixed(code) {
  return code.includes("const titlePublisher = String(noticia.titulo || '')")
    && code.includes('const fallbackPublisher = noticia.autor');
}

const workflow = await api(`/workflows/${writerId}`);
const node = workflow.nodes.find((candidate) => candidate.name === 'Parse LLM Response');
const buildNode = workflow.nodes.find((candidate) => candidate.name === 'Build Prompt');
if (!node) throw new Error('missing_node:Parse LLM Response');
if (!buildNode) throw new Error('missing_node:Build Prompt');

let changed = false;
if (!parserIsFixed(String(node.parameters.jsCode || ''))) {
  if (ensureOnly) throw new Error('writer_length_validation_not_fixed');
  let code = String(node.parameters.jsCode || '').replace(
    "if (finalPost.length < 650 || finalPost.length > 1300) throw new Error('longitud fuera de 650-1300 caracteres');",
    [
      "if (bodyPost.length < 600 || bodyPost.length > 950) throw new Error('cuerpo fuera de 600-950 caracteres');",
      "if (finalPost.length > 3000) throw new Error('post completo supera 3000 caracteres');",
    ].join('\n  '),
  );
  if (!code.includes('const questionMatches = [...bodyPost.matchAll')) {
    code = code.replace(
      "    .trim();\n  const finalPost = bodyPost + '\\n\\n' + String(prev.citation_line || '').trim();",
      [
        "    .trim();",
        "  const questionMatches = [...bodyPost.matchAll(/¿[^?]*\\?/g)];",
        "  if (questionMatches.length > 1) {",
        "    let seenQuestions = 0;",
        "    bodyPost = bodyPost.replace(/¿[^?]*\\?/g, (question) => {",
        "      seenQuestions += 1;",
        "      return seenQuestions === questionMatches.length ? question : '';",
        "    }).replace(/[ \\t]{2,}/g, ' ').replace(/\\n[ \\t]+/g, '\\n').trim();",
        "  }",
        "  const finalPost = bodyPost + '\\n\\n' + String(prev.citation_line || '').trim();",
      ].join('\n'),
    );
  }
  if (!code.includes('const finalQuestionMatch = bodyPost.match')) {
    code = code.replace(
      "  const finalPost = bodyPost + '\\n\\n' + String(prev.citation_line || '').trim();",
      [
        "  if (bodyPost.length > 950) {",
        "    const finalQuestionMatch = bodyPost.match(/¿[^?]*\\?\\s*$/);",
        "    const finalQuestion = finalQuestionMatch?.[0]?.trim() || '';",
        "    let prose = finalQuestionMatch ? bodyPost.slice(0, finalQuestionMatch.index).trim() : bodyPost;",
        "    const sentences = prose.match(/[\\s\\S]*?[.!](?=\\s|$)/g) || [prose];",
        "    while (sentences.length > 1) {",
        "      const candidateProse = sentences.slice(0, -1).join('').trim();",
        "      const candidate = (candidateProse + (finalQuestion ? '\\n\\n' + finalQuestion : '')).trim();",
        "      if (candidate.length < 600) break;",
        "      sentences.pop();",
        "      prose = candidateProse;",
        "      bodyPost = candidate;",
        "      if (bodyPost.length <= 950) break;",
        "    }",
        "  }",
        "  const finalPost = bodyPost + '\\n\\n' + String(prev.citation_line || '').trim();",
      ].join('\n'),
    );
  }
  if (!code.includes('(?:Porque|Que)')) {
    code = code.replace(
      "  if (bodyPost.length > 950) {",
      [
        "  bodyPost = bodyPost.replace(/(^|[.!]\\s+|\\n+)(?:Porque|Que)\\s+([a-záéíóúñ])/g,",
        "    (_, prefix, firstLetter) => prefix + firstLetter.toUpperCase());",
        "  if (bodyPost.length > 950) {",
      ].join('\n'),
    );
  }
  node.parameters.jsCode = code;
  if (!parserIsFixed(node.parameters.jsCode)) throw new Error('parser_patch_failed');
  await api(`/workflows/${writerId}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: workflow.name,
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: workflow.settings,
      staticData: workflow.staticData,
    }),
  });
  changed = true;
}

if (!buildIsFixed(String(buildNode.parameters.jsCode || ''))) {
  if (ensureOnly) throw new Error('writer_source_label_not_fixed');
  buildNode.parameters.jsCode = String(buildNode.parameters.jsCode || '').replace(
    "const sourceProfile = sourceProfiles[noticia.fuente] || [noticia.autor || noticia.fuente || 'Artículo original', 'publicado el ' + fallbackDate + '.'];",
    [
      "const titlePublisher = String(noticia.titulo || '').split(/\\s+-\\s+/).at(-1)?.trim();",
      "const fallbackPublisher = noticia.autor || (titlePublisher && titlePublisher !== noticia.titulo ? titlePublisher : '') || noticia.fuente || 'Artículo original';",
      "const sourceProfile = sourceProfiles[noticia.fuente] || [fallbackPublisher, 'publicado el ' + fallbackDate + '.'];",
    ].join('\n'),
  );
  if (!buildIsFixed(buildNode.parameters.jsCode)) throw new Error('build_prompt_patch_failed');
  await api(`/workflows/${writerId}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: workflow.name,
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: workflow.settings,
      staticData: workflow.staticData,
    }),
  });
  changed = true;
}

let saved = await api(`/workflows/${writerId}`);
if (workflow.active && !saved.active) {
  await api(`/workflows/${writerId}/activate`, { method: 'POST', body: '{}' });
  saved = await api(`/workflows/${writerId}`);
}
const savedNode = saved.nodes.find((candidate) => candidate.name === 'Parse LLM Response');
const savedBuildNode = saved.nodes.find((candidate) => candidate.name === 'Build Prompt');
if (!saved.active) throw new Error('writer_inactive');
if (!parserIsFixed(String(savedNode?.parameters?.jsCode || ''))) throw new Error('writer_fix_not_persisted');
if (!buildIsFixed(String(savedBuildNode?.parameters?.jsCode || ''))) throw new Error('writer_source_fix_not_persisted');

console.log(JSON.stringify({
  ok: true,
  changed,
  writer_active: saved.active,
  body_limit: '600-950',
  full_post_limit: 3000,
}, null, 2));

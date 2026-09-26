import { exploratoryScenarios } from './rules.mjs';

export function validateAiScenario(value) {
  if (!value || typeof value !== 'object' || !value.title || !value.category || !('expected' in value)) return null;
  return {
    id: String(value.id || `ai-${String(value.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`),
    title: String(value.title),
    category: String(value.category),
    input: value.input ?? null,
    expected: String(value.expected),
    status: 'planned',
    generatedBy: 'ai',
  };
}

export async function generateExploratoryScenarios({ target, inventory = {}, aiProvider = null }) {
  const deterministic = exploratoryScenarios(target, inventory);
  if (typeof aiProvider !== 'function') return { scenarios: deterministic, source: 'deterministic' };
  const suggestions = await aiProvider({ target, inventory, baselineScenarios: deterministic });
  const accepted = Array.isArray(suggestions) ? suggestions.map(validateAiScenario).filter(Boolean) : [];
  const seen = new Set(deterministic.map((item) => item.id));
  const unique = accepted.filter((item) => !seen.has(item.id));
  return { scenarios: [...deterministic, ...unique], source: unique.length ? 'deterministic+ai' : 'deterministic' };
}

export async function classifyFindings({ findings, context, aiProvider = null }) {
  if (typeof aiProvider !== 'function') return { findings, source: 'deterministic' };
  const classifications = await aiProvider({ findings, context });
  if (!Array.isArray(classifications)) return { findings, source: 'deterministic' };
  const byId = new Map(classifications.filter((item) => item?.id).map((item) => [item.id, item]));
  return {
    findings: findings.map((item) => {
      const update = byId.get(item.id);
      if (!update) return item;
      return { ...item, severity: ['critical', 'high', 'medium', 'low', 'info'].includes(update.severity) ? update.severity : item.severity, confidence: Math.max(0, Math.min(1, Number(update.confidence ?? item.confidence))), category: update.category || item.category, aiRationale: String(update.rationale || '').slice(0, 1000) || null };
    }),
    source: 'deterministic+ai',
  };
}

export function createOpenAiCompatibleProvider({ url, apiKey, model, fetchImpl = fetch }) {
  if (!url || !apiKey || !model) throw new Error('ai_provider_requires_url_api_key_and_model');
  return async ({ target, inventory, baselineScenarios }) => {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ model, temperature: 0.1, response_format: { type: 'json_object' }, messages: [
        { role: 'system', content: 'Return only JSON: {"scenarios":[{"title":string,"category":string,"input":any,"expected":string}]}. Do not propose destructive actions.' },
        { role: 'user', content: JSON.stringify({ target, inventory, baselineScenarios }) },
      ] }),
    });
    if (!response.ok) throw new Error(`ai_provider_${response.status}`);
    const body = await response.json();
    const content = body.choices?.[0]?.message?.content;
    const parsed = typeof content === 'string' ? JSON.parse(content) : content;
    return parsed?.scenarios || [];
  };
}

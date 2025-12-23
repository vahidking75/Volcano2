export type Model = 'midjourney' | 'sdxl' | 'flux' | 'dalle';

export type BlockCategory =
  | 'SUBJECT'
  | 'SCENE'
  | 'STYLE'
  | 'COMPOSITION'
  | 'LIGHTING'
  | 'CAMERA'
  | 'MOOD'
  | 'MATERIALS'
  | 'COLOR'
  | 'POST'
  | 'NEGATIVE';

export type PromptBlock = {
  id: string;
  label: string;
  value: string;
  category: BlockCategory;
  weight?: number; // optional emphasis multiplier
};

export type StudioDoc = {
  subject: string;
  blocks: PromptBlock[];
  negative: string;
  model: Model;
  params: {
    aspect?: string;
    stylize?: number;
    quality?: number;
    seed?: string;
  };
};

export function applyWeight(value: string, weight?: number, model?: Model) {
  if (!weight || weight === 1) return value;
  if (model === 'sdxl' || model === 'flux') {
    // Stable Diffusion-ish: (token:1.3)
    const w = Math.max(0.2, Math.min(2.0, Number(weight.toFixed(2))));
    return `(${value}:${w})`;
  }
  // Midjourney doesn't support weights the same way; use subtle repetition.
  const repeats = Math.max(1, Math.min(3, Math.round(weight)));
  return Array.from({ length: repeats }, () => value).join(', ');
}

export function buildPrompt(doc: StudioDoc) {
  const parts: string[] = [];
  const s = doc.subject.trim();
  if (s) parts.push(s);

  for (const b of doc.blocks) {
    if (b.category === 'NEGATIVE') continue;
    const v = b.value.trim();
    if (!v) continue;
    parts.push(applyWeight(v, b.weight, doc.model));
  }

  const base = parts.filter(Boolean).join(', ');

  if (doc.model === 'midjourney') {
    const params: string[] = [];
    if (doc.params.aspect) params.push(`--ar ${doc.params.aspect}`);
    if (doc.params.stylize != null) params.push(`--s ${doc.params.stylize}`);
    if (doc.params.quality != null) params.push(`--q ${doc.params.quality}`);
    if (doc.params.seed) params.push(`--seed ${doc.params.seed}`);
    return `${base} ${params.join(' ')}`.trim();
  }

  if (doc.model === 'sdxl' || doc.model === 'flux') {
    const negative = doc.negative.trim();
    return negative ? `${base}\n\nNegative prompt: ${negative}` : base;
  }

  // DALL·E style: sentence-like. Keep it clean.
  return base;
}

export type LintIssue = { level: 'error' | 'warn'; code: string; message: string; hint?: string };

const CONTRADICTIONS: Array<{ a: RegExp; b: RegExp; message: string }> = [
  { a: /black\s*and\s*white|monochrome|noir/i, b: /vibrant|neon|pastel|colorful/i, message: 'Color contradiction: monochrome/noir with vibrant/pastel cues.' },
  { a: /macro|extreme\s*close\s*up/i, b: /wide\s*shot|panoramic|aerial|drone/i, message: 'Camera contradiction: macro/close-up with wide/drone cues.' },
  { a: /minimal|minimalist/i, b: /ornate|baroque|maximal/i, message: 'Style contradiction: minimal with ornate/maximal cues.' }
];

export function lintPrompt(doc: StudioDoc): LintIssue[] {
  const issues: LintIssue[] = [];
  const text = buildPrompt({ ...doc, params: { ...doc.params } });

  if (!doc.subject.trim()) {
    issues.push({ level: 'error', code: 'NO_SUBJECT', message: 'Missing subject.', hint: 'Describe the main subject in one clear sentence.' });
  }

  const blocksByCat = new Map<string, number>();
  for (const b of doc.blocks) blocksByCat.set(b.category, (blocksByCat.get(b.category) || 0) + 1);

  if ((blocksByCat.get('CAMERA') || 0) === 0) {
    issues.push({ level: 'warn', code: 'NO_CAMERA', message: 'No camera/view cues.', hint: 'Add lens/shot type (wide, 35mm, macro, aerial, etc.).' });
  }
  if ((blocksByCat.get('LIGHTING') || 0) === 0) {
    issues.push({ level: 'warn', code: 'NO_LIGHTING', message: 'No lighting cues.', hint: 'Add lighting like golden hour, cinematic, volumetric, softbox…' });
  }

  const normalized = text.toLowerCase();

  // Simple redundancy detector: repeated identical tokens after splitting.
  const tokens = normalized.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
  const seen = new Map<string, number>();
  for (const t of tokens) seen.set(t, (seen.get(t) || 0) + 1);
  const redundants = [...seen.entries()].filter(([, c]) => c >= 3).map(([t]) => t);
  if (redundants.length) {
    issues.push({ level: 'warn', code: 'REDUNDANT', message: `Repeated phrases: ${redundants.slice(0, 4).join(', ')}`, hint: 'Remove duplicates; emphasize with weighting instead.' });
  }

  for (const c of CONTRADICTIONS) {
    if (c.a.test(normalized) && c.b.test(normalized)) {
      issues.push({ level: 'warn', code: 'CONTRADICTION', message: c.message, hint: 'Pick one direction, or clarify which part is monochrome vs colorful.' });
    }
  }

  if (text.length > 900 && doc.model === 'dalle') {
    issues.push({ level: 'warn', code: 'TOO_LONG', message: 'Prompt is very long for DALL·E-style prompting.', hint: 'Reduce to the most important details (subject, setting, style, lighting, camera).' });
  }

  return issues;
}

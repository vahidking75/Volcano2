'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Wand2,
  Layers,
  Copy,
  Trash2,
  X,
  PlusCircle,
  History,
  Globe,
  BookOpen,
  Network,
  Search,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Settings2,
  Sparkles,
  Menu
} from 'lucide-react';

import { LIBRARY, type LibraryCategory } from '@/lib/library';
import { buildPrompt, lintPrompt, type Model, type PromptBlock, type StudioDoc } from '@/lib/prompt';

type Toast = { message: string; type: 'success' | 'error' };

type Tab = 'library' | 'discover' | 'define' | 'context' | 'lint' | 'projects' | 'settings';

const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

function classNames(...s: Array<string | false | undefined | null>) {
  return s.filter(Boolean).join(' ');
}

function prettyTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function VolcanoStudio() {
  // --- core studio state ---
  const [subject, setSubject] = useState('');
  const [model, setModel] = useState<Model>('sdxl');
  const [negative, setNegative] = useState('');
  const [params, setParams] = useState<StudioDoc['params']>({ aspect: '1:1', stylize: 150, quality: 1 });

  const [activeCat, setActiveCat] = useState<LibraryCategory['id']>('STYLE');
  const [blocks, setBlocks] = useState<PromptBlock[]>([]);

  // ui state
  const [tab, setTab] = useState<Tab>('library');
  const [toast, setToast] = useState<Toast | null>(null);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);

  // online panels state
  const [discoverTerm, setDiscoverTerm] = useState('');
  const [discoverItems, setDiscoverItems] = useState<Array<{ word: string; score: number }>>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);

  const [defineWord, setDefineWord] = useState('');
  const [defineData, setDefineData] = useState<any>(null);
  const [isDefining, setIsDefining] = useState(false);

  const [entityQuery, setEntityQuery] = useState('');
  const [wpResults, setWpResults] = useState<any>(null);
  const [wpSummary, setWpSummary] = useState<any>(null);
  const [wdResults, setWdResults] = useState<any>(null);
  const [wdAttrs, setWdAttrs] = useState<any>(null);
  const [cnData, setCnData] = useState<any>(null);
  const [isContexting, setIsContexting] = useState(false);

  const [projects, setProjects] = useState<Array<{ id: string; name: string; updated_at: number }>>([]);
  const [activeProjectName, setActiveProjectName] = useState('Untitled Volcano Project');
  const [savingProject, setSavingProject] = useState(false);

  // local recent history (copy events)
  const [copyHistory, setCopyHistory] = useState<Array<{ id: string; text: string; ts: number }>>([]);

  const category = useMemo(() => LIBRARY.find(c => c.id === activeCat)!, [activeCat]);

  const doc: StudioDoc = useMemo(
    () => ({ subject, blocks, negative, model, params }),
    [subject, blocks, negative, model, params]
  );

  const promptText = useMemo(() => buildPrompt(doc), [doc]);
  const lint = useMemo(() => lintPrompt(doc), [doc]);

  useEffect(() => {
    const t = toast ? setTimeout(() => setToast(null), 3000) : null;
    return () => {
      if (t) clearTimeout(t);
    };
  }, [toast]);

  useEffect(() => {
    // load local copy history
    try {
      const saved = localStorage.getItem('volcano_copy_history_v1');
      if (saved) setCopyHistory(JSON.parse(saved));
    } catch {}
  }, []);

  const showToast = (message: string, type: Toast['type'] = 'success') => setToast({ message, type });

  function addBlockFromItem(item: { label: string; value: string; weight?: number }) {
    const b: PromptBlock = { id: genId(), label: item.label, value: item.value, category: activeCat, weight: item.weight };
    setBlocks(prev => [...prev, b]);
  }

  function addBlock(label: string, value: string, categoryId: any = activeCat) {
    const b: PromptBlock = { id: genId(), label, value, category: categoryId };
    setBlocks(prev => [...prev, b]);
  }

  function removeBlock(id: string) {
    setBlocks(prev => prev.filter(b => b.id !== id));
  }

  function updateWeight(id: string, w: number) {
    setBlocks(prev => prev.map(b => (b.id === id ? { ...b, weight: w } : b)));
  }

  function clearBlocks() {
    setBlocks([]);
  }

  async function handleCopy() {
    if (!promptText.trim()) {
      showToast('Prompt is empty!', 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(promptText);
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = promptText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }

    const entry = { id: genId(), text: promptText, ts: Date.now() };
    const next = [entry, ...copyHistory].slice(0, 30);
    setCopyHistory(next);
    try {
      localStorage.setItem('volcano_copy_history_v1', JSON.stringify(next));
    } catch {}

    showToast('Copied! Saved to local history.');
  }

  // --- Online feature #1: vocabulary discovery (Datamuse multipass) ---
  async function runDiscover(term?: string) {
    const t = (term ?? discoverTerm).trim() || category.searchTerm;
    setIsDiscovering(true);
    try {
      const url = new URL('/api/datamuse', window.location.origin);
      url.searchParams.set('term', t);
      url.searchParams.set('max', '30');
      url.searchParams.set('flavors', 'ml,syn,trg,adj');
      if (category.topics) url.searchParams.set('topics', category.topics);

      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Discover failed');
      setDiscoverItems(json.items || []);
      showToast(`Discovered ${json.items?.length || 0} terms online.`);
    } catch (e: any) {
      showToast(e?.message || 'Discovery failed', 'error');
    } finally {
      setIsDiscovering(false);
    }
  }

  // --- Online feature #2: dictionary definitions ---
  async function runDefine(word?: string) {
    const w = (word ?? defineWord).trim();
    if (!w) return;
    setIsDefining(true);
    try {
      const url = new URL('/api/dictionary', window.location.origin);
      url.searchParams.set('word', w);
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Not found');
      setDefineData(json.data);
    } catch (e: any) {
      setDefineData(null);
      showToast(e?.message || 'Definition failed', 'error');
    } finally {
      setIsDefining(false);
    }
  }

  // --- Online feature #3/#4/#5: context: Wikipedia + Wikidata + ConceptNet ---
  async function runContext(query?: string) {
    const q = (query ?? entityQuery).trim();
    if (!q) return;

    setIsContexting(true);
    setWpResults(null);
    setWpSummary(null);
    setWdResults(null);
    setWdAttrs(null);
    setCnData(null);

    try {
      // Wikipedia search
      {
        const u = new URL('/api/wikipedia', window.location.origin);
        u.searchParams.set('mode', 'search');
        u.searchParams.set('q', q);
        const r = await fetch(u);
        const j = await r.json();
        if (r.ok) setWpResults(j.data);
      }

      // Wikidata search
      {
        const u = new URL('/api/wikidata', window.location.origin);
        u.searchParams.set('mode', 'search');
        u.searchParams.set('q', q);
        const r = await fetch(u);
        const j = await r.json();
        if (r.ok) setWdResults(j.data);
      }

      // ConceptNet graph
      {
        const u = new URL('/api/conceptnet', window.location.origin);
        u.searchParams.set('term', q);
        u.searchParams.set('limit', '25');
        const r = await fetch(u);
        const j = await r.json();
        if (r.ok) setCnData(j.data);
      }

      showToast('Fetched online context.');
    } catch (e: any) {
      showToast(e?.message || 'Context lookup failed', 'error');
    } finally {
      setIsContexting(false);
    }
  }

  async function loadWpSummary(title: string) {
    setIsContexting(true);
    try {
      const u = new URL('/api/wikipedia', window.location.origin);
      u.searchParams.set('mode', 'summary');
      u.searchParams.set('title', title);
      const r = await fetch(u);
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'Summary failed');
      setWpSummary(j.data);
    } catch (e: any) {
      showToast(e?.message || 'Summary failed', 'error');
    } finally {
      setIsContexting(false);
    }
  }

  async function loadWdAttrs(id: string) {
    setIsContexting(true);
    try {
      const u = new URL('/api/wikidata', window.location.origin);
      u.searchParams.set('mode', 'attrs');
      u.searchParams.set('id', id);
      const r = await fetch(u);
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'Attrs failed');
      setWdAttrs(j.data);
    } catch (e: any) {
      showToast(e?.message || 'Wikidata attrs failed', 'error');
    } finally {
      setIsContexting(false);
    }
  }

  // --- Online feature #6: cloud-ish projects (server persistence via sqlite) ---
  async function refreshProjects() {
    try {
      const r = await fetch('/api/projects', { cache: 'no-store' });
      const j = await r.json();
      if (r.ok) setProjects(j.items || []);
    } catch {}
  }

  useEffect(() => {
    refreshProjects();
  }, []);

  async function saveProject(existingId?: string) {
    if (!activeProjectName.trim()) {
      showToast('Project name required', 'error');
      return;
    }
    setSavingProject(true);
    try {
      const r = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: existingId, name: activeProjectName, payload: doc })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'Save failed');
      showToast('Saved to server projects.');
      await refreshProjects();
      return j.id as string;
    } catch (e: any) {
      showToast(e?.message || 'Save failed', 'error');
    } finally {
      setSavingProject(false);
    }
  }

  async function loadProject(id: string) {
    try {
      const r = await fetch(`/api/projects/${id}`, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'Load failed');
      const payload: StudioDoc = j.payload;
      setSubject(payload.subject || '');
      setBlocks(payload.blocks || []);
      setNegative(payload.negative || '');
      setModel(payload.model || 'sdxl');
      setParams(payload.params || { aspect: '1:1', stylize: 150, quality: 1 });
      setActiveProjectName(j.name || 'Untitled Volcano Project');
      showToast('Project loaded.');
    } catch (e: any) {
      showToast(e?.message || 'Load failed', 'error');
    }
  }

  async function deleteProject(id: string) {
    try {
      const r = await fetch('/api/projects', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (r.ok) {
        showToast('Deleted.');
        await refreshProjects();
      }
    } catch {}
  }

  // --- Online feature #7: smart suggestions from context into blocks ---
  function addConceptSuggestion(word: string) {
    const clean = word.replace(/_/g, ' ').trim();
    if (!clean) return;
    addBlock(clean, clean, 'SCENE');
    showToast(`Added concept: ${clean}`);
  }

  // --- Online feature #8: model-aware formatting + export ---
  function downloadTxt() {
    const blob = new Blob([promptText], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${activeProjectName.replace(/[^a-z0-9\-\_]+/gi, '_').slice(0, 50)}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // auto-fill discover/define from selection
  function useWord(word: string) {
    setDefineWord(word);
    setDiscoverTerm(word);
  }

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 overflow-hidden">
      {/* LEFT NAV */}
      <aside className="w-72 hidden md:flex flex-col border-r border-slate-800 bg-slate-900 shrink-0">
        <div className="h-16 flex items-center px-5 border-b border-slate-800 shrink-0">
          <div className="bg-emerald-500/20 p-2 rounded-lg mr-3">
            <Wand2 className="text-emerald-400" size={20} />
          </div>
          <div>
            <div className="font-extrabold tracking-wide text-white leading-none">VOLCANO</div>
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Virtuoso Prompt Studio</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 p-3">
          <div className="text-[10px] font-bold text-slate-600 uppercase px-3 py-2">Categories</div>
          <div className="space-y-1">
            {LIBRARY.map(cat => (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveCat(cat.id);
                  setTab('library');
                  setDiscoverItems([]);
                }}
                className={classNames(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group',
                  activeCat === cat.id
                    ? 'bg-slate-800 border-l-2 border-emerald-500 text-emerald-100'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                )}
              >
                <span className={classNames('transition-colors', activeCat === cat.id ? 'text-emerald-400' : 'text-slate-500 group-hover:text-white')}>
                  {cat.icon}
                </span>
                <span className="font-medium text-sm">{cat.label}</span>
                <span className="ml-auto text-xs bg-slate-950 text-slate-500 px-2 py-0.5 rounded-full">
                  {cat.items.length}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-8 border-t border-slate-800 pt-4 pb-20">
            <div className="flex items-center gap-2 px-3 py-2 text-slate-600 mb-2">
              <History size={12} />
              <div className="text-[10px] font-bold uppercase">Local Copy History</div>
            </div>
            <div className="space-y-1">
              {copyHistory.length === 0 && <div className="px-3 text-xs text-slate-600 italic">No copy history yet.</div>}
              {copyHistory.map(h => (
                <button
                  key={h.id}
                  className="w-full text-left group relative text-xs text-slate-400 hover:text-white hover:bg-slate-800 p-2 rounded mx-1"
                  onClick={async () => {
                    try { await navigator.clipboard.writeText(h.text); } catch {}
                    showToast('Copied history item!');
                  }}
                >
                  <div className="truncate pr-4">{h.text}</div>
                  <div className="text-[9px] text-slate-600 mt-0.5">{prettyTime(h.ts)}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* CENTER */}
      <main className="flex-1 flex flex-col h-full relative min-w-0">
        {/* Mobile header */}
        <div className="md:hidden h-14 border-b border-slate-800 flex items-center justify-between px-4 bg-slate-900 shrink-0">
          <div className="flex items-center gap-2 font-bold text-white">
            <Wand2 size={18} className="text-emerald-500" /> Volcano
          </div>
          <button
            onClick={() => setMobilePanelOpen(true)}
            className="text-slate-200 bg-slate-800/60 hover:bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-bold"
            aria-label="Open panels"
          >
            <Menu size={16} /> Panels
          </button>
        </div>

        <div className="text-xs text-slate-500">Desktop recommended</div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 p-4 md:p-8 pb-28">
          {/* Subject */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl shadow-2xl mb-6">
            <div className="bg-slate-900/80 rounded-t-2xl px-4 py-2 border-b border-slate-800 flex justify-between items-center">
              <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                <Sparkles size={14} /> Subject
              </div>
              <div className="text-[10px] text-slate-500 uppercase font-bold">Step 1</div>
            </div>
            <textarea
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Describe your main subject (who/what) + key details..."
              className="w-full bg-slate-950/40 rounded-b-2xl p-4 text-lg text-white placeholder-slate-600 focus:outline-none focus:bg-slate-950 h-32 resize-none leading-relaxed"
            />
          </div>

          {/* Blocks */}
          <div className="mb-6">
            <div className="flex justify-between items-end mb-3 px-1">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <Layers size={14} /> Modifier Stack
              </div>
              {blocks.length > 0 && (
                <button
                  onClick={clearBlocks}
                  className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 px-2 py-1 rounded hover:bg-red-950/30"
                >
                  <Trash2 size={12} /> Clear
                </button>
              )}
            </div>

            <div className="min-h-[120px] bg-slate-900/30 border-2 border-dashed border-slate-800 rounded-2xl p-4 flex flex-wrap gap-3 content-start">
              {blocks.length === 0 && (
                <div className="w-full h-24 flex flex-col items-center justify-center text-slate-600">
                  <div className="text-sm font-medium">Pick items from the right panel</div>
                  <div className="text-xs mt-1">Tip: use Discover for online vocabulary</div>
                </div>
              )}

              {blocks.map(block => (
                <div
                  key={block.id}
                  className="bg-slate-800 border border-slate-700 hover:border-emerald-500/50 text-emerald-100 pl-3 pr-2 py-2 rounded-lg flex items-center gap-2 shadow-lg"
                  title={`${block.category}: ${block.value}`}
                >
                  <span className="text-sm font-medium">{block.label}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0.2}
                      max={2.0}
                      step={0.1}
                      value={block.weight ?? 1}
                      onChange={e => updateWeight(block.id, Number(e.target.value) || 1)}
                      className="w-16 bg-slate-950/60 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                      title="Weight"
                    />
                    <button
                      onClick={() => {
                        useWord(block.label);
                        setTab('define');
                        runDefine(block.label);
                      }}
                      className="text-slate-500 hover:text-slate-200 p-1 rounded"
                      title="Define"
                    >
                      <BookOpen size={14} />
                    </button>
                    <button
                      onClick={() => removeBlock(block.id)}
                      className="text-slate-500 hover:text-red-400 p-1 rounded"
                      title="Remove"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Negative prompt (sd/flx) */}
          {(model === 'sdxl' || model === 'flux') && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl shadow-2xl mb-6">
              <div className="bg-slate-900/80 rounded-t-2xl px-4 py-2 border-b border-slate-800 flex justify-between items-center">
                <div className="text-xs font-bold text-rose-300 uppercase tracking-wider">Negative prompt</div>
                <div className="text-[10px] text-slate-500 uppercase font-bold">Optional</div>
              </div>
              <textarea
                value={negative}
                onChange={e => setNegative(e.target.value)}
                placeholder="low quality, blurry, extra limbs, watermark..."
                className="w-full bg-slate-950/40 rounded-b-2xl p-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:bg-slate-950 h-20 resize-none"
              />
            </div>
          )}

          {/* Output */}
          <div className="bg-black/40 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Final prompt ({model})</div>
              <div className="flex gap-2">
                <button
                  onClick={downloadTxt}
                  className="text-xs px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
                >
                  Download .txt
                </button>
                <button
                  onClick={handleCopy}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-lg text-sm font-bold flex items-center gap-2"
                >
                  <Copy size={16} /> Copy
                </button>
              </div>
            </div>

            <pre className="w-full whitespace-pre-wrap font-mono text-sm text-slate-300 break-words bg-slate-950/40 border border-slate-800 rounded-lg p-3">
              {promptText || <span className="text-slate-600 italic">Your prompt will appear here...</span>}
            </pre>
          </div>

          {/* Lint summary */}
          {lint.length > 0 && (
            <div className="mt-4 border border-slate-800 bg-slate-900/40 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Quality checks</div>
                <button onClick={() => setTab('lint')} className="text-xs text-emerald-300 hover:text-emerald-200">Open Lint Panel</button>
              </div>
              <div className="mt-3 space-y-2">
                {lint.slice(0, 3).map((i, idx) => (
                  <div key={idx} className={classNames('text-sm', i.level === 'error' ? 'text-red-300' : 'text-amber-200')}>
                    <span className="font-bold mr-2">{i.level.toUpperCase()}</span>
                    {i.message}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Toast */}
        {toast && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-4 py-3 rounded-lg shadow-2xl border border-slate-700 flex items-center gap-3">
            {toast.type === 'success' ? <CheckCircle2 className="text-emerald-400" size={18} /> : <AlertCircle className="text-red-400" size={18} />}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        )}
      </main>


      {/* MOBILE PANELS (full-screen) */}
      {mobilePanelOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/60">
          <div className="absolute inset-0 bg-slate-900 flex flex-col">
            <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
                <Globe size={16} className="text-purple-300" /> Online Intelligence
              </div>
              <button
                onClick={() => setMobilePanelOpen(false)}
                className="text-slate-200 bg-slate-800/60 hover:bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-bold"
                aria-label="Close panels"
              >
                <X size={16} /> Close
              </button>
            </div>

            <div className="border-b border-slate-800 px-3 py-2 overflow-x-auto">
              <div className="flex gap-1 min-w-max">
                <TabButton label="Library" active={tab==='library'} onClick={() => setTab('library')} icon={<PlusCircle size={14} />} />
                <TabButton label="Discover" active={tab==='discover'} onClick={() => setTab('discover')} icon={<Globe size={14} />} />
                <TabButton label="Define" active={tab==='define'} onClick={() => setTab('define')} icon={<BookOpen size={14} />} />
                <TabButton label="Context" active={tab==='context'} onClick={() => setTab('context')} icon={<Network size={14} />} />
                <TabButton label="Lint" active={tab==='lint'} onClick={() => setTab('lint')} icon={<Sparkles size={14} />} />
                <TabButton label="Projects" active={tab==='projects'} onClick={() => setTab('projects')} icon={<Save size={14} />} />
                <TabButton label="Settings" active={tab==='settings'} onClick={() => setTab('settings')} icon={<Settings2 size={14} />} />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 p-4 pb-28">

          {tab === 'library' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="font-bold text-white flex items-center gap-2 text-sm">
                  {category.icon} {category.label}
                </div>
                <div className="text-[10px] text-slate-500 bg-slate-800 px-2 py-1 rounded-full">{category.items.length}</div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {category.items.map((item, idx) => (
                  <button
                    key={`${item.label}-${idx}`}
                    onClick={() => addBlockFromItem(item)}
                    className="group text-left p-3 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-800 hover:border-emerald-500/50"
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium text-sm text-slate-200 group-hover:text-emerald-400">{item.label}</span>
                      <PlusCircle size={14} className="text-slate-600 group-hover:text-emerald-500 opacity-0 group-hover:opacity-100" />
                    </div>
                    {item.desc && <div className="text-[11px] text-slate-500 group-hover:text-slate-400 line-clamp-1">{item.desc}</div>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === 'discover' && (
            <div className="space-y-3">
              <div className="text-sm font-bold text-white">Discover vocabulary (Datamuse)</div>
              <div className="text-xs text-slate-400">Online multi-pass discovery for the active category.</div>
              <div className="flex gap-2">
                <input
                  value={discoverTerm}
                  onChange={e => setDiscoverTerm(e.target.value)}
                  placeholder={`e.g. ${category.searchTerm}`}
                  className="flex-1 bg-slate-950/60 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                />
                <button
                  disabled={isDiscovering}
                  onClick={() => runDiscover()}
                  className="bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/30 hover:border-purple-500 text-purple-200 px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2"
                >
                  {isDiscovering ? <RefreshCw className="animate-spin" size={16} /> : <Search size={16} />}
                  {isDiscovering ? 'Searching…' : 'Discover'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {discoverItems.map((it, idx) => (
                  <button
                    key={`${it.word}-${idx}`}
                    onClick={() => {
                      addBlock(it.word, category.id === 'STYLE' ? `${it.word} style` : it.word);
                      useWord(it.word);
                    }}
                    className="text-left p-2 rounded-lg border border-slate-800 bg-slate-900/40 hover:bg-slate-800"
                    title={`Score: ${it.score}`}
                  >
                    <div className="text-sm text-slate-200">{it.word}</div>
                    <div className="text-[10px] text-slate-500">score {it.score}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === 'define' && (
            <div className="space-y-3">
              <div className="text-sm font-bold text-white">Define a term</div>
              <div className="flex gap-2">
                <input
                  value={defineWord}
                  onChange={e => setDefineWord(e.target.value)}
                  placeholder="type a word…"
                  className="flex-1 bg-slate-950/60 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                />
                <button
                  disabled={isDefining}
                  onClick={() => runDefine()}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2"
                >
                  {isDefining ? <RefreshCw className="animate-spin" size={16} /> : <BookOpen size={16} />}
                  {isDefining ? 'Loading…' : 'Define'}
                </button>
              </div>

              {defineData && (
                <div className="border border-slate-800 rounded-xl bg-slate-950/30 p-3 space-y-2">
                  <div className="text-xs text-slate-400">dictionaryapi.dev</div>
                  {defineData?.[0]?.phonetics?.[0]?.text && (
                    <div className="text-slate-200 text-sm">Pronunciation: <span className="font-mono">{defineData[0].phonetics[0].text}</span></div>
                  )}
                  {(defineData?.[0]?.meanings || []).slice(0, 3).map((m: any, idx: number) => (
                    <div key={idx} className="border-t border-slate-800 pt-2">
                      <div className="text-xs uppercase tracking-wide text-emerald-300 font-bold">{m.partOfSpeech}</div>
                      <ul className="mt-1 space-y-1">
                        {(m.definitions || []).slice(0, 2).map((d: any, di: number) => (
                          <li key={di} className="text-sm text-slate-200">
                            • {d.definition}
                            {d.example && <div className="text-xs text-slate-400 mt-1">Example: {d.example}</div>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {!defineData && !isDefining && (
                <div className="text-xs text-slate-500">Tip: click the little book icon on any modifier chip.</div>
              )}
            </div>
          )}

          {tab === 'context' && (
            <div className="space-y-3">
              <div className="text-sm font-bold text-white">Entity context</div>
              <div className="text-xs text-slate-400">Wikipedia + Wikidata + ConceptNet (free online knowledge).</div>
              <div className="flex gap-2">
                <input
                  value={entityQuery}
                  onChange={e => setEntityQuery(e.target.value)}
                  placeholder="Try: Shushtar, Hokusai, Ferrari 250 GTO…"
                  className="flex-1 bg-slate-950/60 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                />
                <button
                  disabled={isContexting}
                  onClick={() => runContext()}
                  className="bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/30 hover:border-purple-500 text-purple-200 px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2"
                >
                  {isContexting ? <RefreshCw className="animate-spin" size={16} /> : <Network size={16} />}
                  {isContexting ? 'Loading…' : 'Fetch'}
                </button>
              </div>

              {/* Wikipedia results */}
              {wpResults?.pages?.length > 0 && (
                <div className="border border-slate-800 rounded-xl bg-slate-950/30 p-3">
                  <div className="text-xs font-bold text-slate-300 uppercase tracking-wide">Wikipedia</div>
                  <div className="mt-2 space-y-2">
                    {wpResults.pages.slice(0, 5).map((p: any) => (
                      <button
                        key={p.id}
                        onClick={() => loadWpSummary(p.title)}
                        className="w-full text-left p-2 rounded-lg bg-slate-900/40 hover:bg-slate-800 border border-slate-800"
                      >
                        <div className="text-sm text-slate-200 font-medium">{p.title}</div>
                        {p.description && <div className="text-xs text-slate-500">{p.description}</div>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {wpSummary?.extract && (
                <div className="border border-slate-800 rounded-xl bg-slate-950/30 p-3">
                  <div className="text-xs font-bold text-slate-300 uppercase tracking-wide">Summary</div>
                  <div className="text-sm text-slate-200 mt-2">{wpSummary.extract}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      onClick={() => addBlock('Context', wpSummary.title, 'SCENE')}
                      className="text-xs px-3 py-2 rounded bg-emerald-600/20 border border-emerald-500/30 text-emerald-200 hover:bg-emerald-600/30"
                    >
                      Add as scene cue
                    </button>
                    <button
                      onClick={() => {
                        setDiscoverTerm(wpSummary.title);
                        setTab('discover');
                        runDiscover(wpSummary.title);
                      }}
                      className="text-xs px-3 py-2 rounded bg-purple-600/20 border border-purple-500/30 text-purple-200 hover:bg-purple-600/30"
                    >
                      Discover related words
                    </button>
                  </div>
                </div>
              )}

              {/* Wikidata results */}
              {wdResults?.search?.length > 0 && (
                <div className="border border-slate-800 rounded-xl bg-slate-950/30 p-3">
                  <div className="text-xs font-bold text-slate-300 uppercase tracking-wide">Wikidata</div>
                  <div className="mt-2 space-y-2">
                    {wdResults.search.slice(0, 6).map((e: any) => (
                      <button
                        key={e.id}
                        onClick={() => loadWdAttrs(e.id)}
                        className="w-full text-left p-2 rounded-lg bg-slate-900/40 hover:bg-slate-800 border border-slate-800"
                      >
                        <div className="text-sm text-slate-200 font-medium">{e.label} <span className="text-xs text-slate-500">({e.id})</span></div>
                        {e.description && <div className="text-xs text-slate-500">{e.description}</div>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {wdAttrs?.results?.bindings?.length > 0 && (
                <div className="border border-slate-800 rounded-xl bg-slate-950/30 p-3">
                  <div className="text-xs font-bold text-slate-300 uppercase tracking-wide">Wikidata attributes</div>
                  <div className="mt-2 space-y-1 text-sm text-slate-200">
                    {wdAttrs.results.bindings.slice(0, 6).map((b: any, idx: number) => (
                      <div key={idx} className="border-t border-slate-800 pt-2">
                        <div className="font-bold">{b.itemLabel?.value}</div>
                        {b.itemDescription?.value && <div className="text-xs text-slate-400">{b.itemDescription.value}</div>}
                        <div className="text-xs text-slate-400 mt-1">
                          {b.instanceOfLabel?.value ? `Type: ${b.instanceOfLabel.value}` : ''}
                          {b.countryLabel?.value ? ` • Country: ${b.countryLabel.value}` : ''}
                          {b.locationLabel?.value ? ` • Location: ${b.locationLabel.value}` : ''}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {b.instanceOfLabel?.value && (
                            <button
                              onClick={() => addBlock('Type', b.instanceOfLabel.value, 'SCENE')}
                              className="text-xs px-3 py-2 rounded bg-slate-800 hover:bg-slate-700"
                            >
                              Add type
                            </button>
                          )}
                          {b.countryLabel?.value && (
                            <button
                              onClick={() => addBlock('Country', b.countryLabel.value, 'SCENE')}
                              className="text-xs px-3 py-2 rounded bg-slate-800 hover:bg-slate-700"
                            >
                              Add country
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ConceptNet */}
              {cnData?.edges?.length > 0 && (
                <div className="border border-slate-800 rounded-xl bg-slate-950/30 p-3">
                  <div className="text-xs font-bold text-slate-300 uppercase tracking-wide">ConceptNet</div>
                  <div className="text-xs text-slate-400 mt-1">Click an edge target to add as a concept cue.</div>
                  <div className="mt-2 grid grid-cols-1 gap-2">
                    {cnData.edges.slice(0, 10).map((e: any, idx: number) => {
                      const rel = e.rel?.label || 'RelatedTo';
                      const end = e.end?.label || e.end?.term || '';
                      return (
                        <button
                          key={idx}
                          onClick={() => addConceptSuggestion(end)}
                          className="text-left p-2 rounded-lg bg-slate-900/40 hover:bg-slate-800 border border-slate-800"
                        >
                          <div className="text-xs text-slate-400">{rel}</div>
                          <div className="text-sm text-slate-200 font-medium">{end}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'lint' && (
            <div className="space-y-3">
              <div className="text-sm font-bold text-white">Prompt linter</div>
              <div className="text-xs text-slate-400">Logic checks + contradictions + missing cues.</div>

              <div className="space-y-2">
                {lint.length === 0 && <div className="text-sm text-emerald-200">Looks good ✨</div>}
                {lint.map((i, idx) => (
                  <div
                    key={idx}
                    className={classNames(
                      'p-3 rounded-xl border',
                      i.level === 'error'
                        ? 'border-red-500/30 bg-red-950/20'
                        : 'border-amber-500/30 bg-amber-950/20'
                    )}
                  >
                    <div className={classNames('text-xs font-bold uppercase', i.level === 'error' ? 'text-red-300' : 'text-amber-200')}>
                      {i.level} — {i.code}
                    </div>
                    <div className="text-sm text-slate-200 mt-1">{i.message}</div>
                    {i.hint && <div className="text-xs text-slate-400 mt-2">Hint: {i.hint}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'projects' && (
            <div className="space-y-3">
              <div className="text-sm font-bold text-white">Projects (server)</div>
              <div className="text-xs text-slate-400">Saved on the server via SQLite (anonymous session cookie).</div>

              <div className="flex gap-2">
                <input
                  value={activeProjectName}
                  onChange={e => setActiveProjectName(e.target.value)}
                  className="flex-1 bg-slate-950/60 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                  placeholder="Project name"
                />
                <button
                  disabled={savingProject}
                  onClick={() => saveProject()}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2"
                >
                  {savingProject ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
                  Save
                </button>
                <button
                  onClick={refreshProjects}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2"
                >
                  <RefreshCw size={16} />
                </button>
              </div>

              <div className="space-y-2">
                {projects.length === 0 && <div className="text-xs text-slate-500">No server projects yet.</div>}
                {projects.map(p => (
                  <div key={p.id} className="border border-slate-800 rounded-xl bg-slate-950/30 p-3 flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium text-slate-200">{p.name}</div>
                      <div className="text-xs text-slate-500">Updated {prettyTime(p.updated_at)}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => loadProject(p.id)} className="text-xs px-3 py-2 rounded bg-slate-800 hover:bg-slate-700">Load</button>
                      <button onClick={() => deleteProject(p.id)} className="text-xs px-3 py-2 rounded bg-red-950/30 border border-red-500/30 text-red-200 hover:bg-red-950/50">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'settings' && (
            <div className="space-y-4">
              <div className="text-sm font-bold text-white">Model mode</div>
              <div className="text-xs text-slate-400">Volcano formats prompts differently per model family.</div>

              <div className="grid grid-cols-2 gap-2">
                {(['sdxl', 'flux', 'midjourney', 'dalle'] as Model[]).map(m => (
                  <button
                    key={m}
                    onClick={() => setModel(m)}
                    className={classNames(
                      'p-3 rounded-xl border text-left',
                      model === m ? 'border-emerald-500/40 bg-emerald-950/20' : 'border-slate-800 bg-slate-950/30 hover:bg-slate-800'
                    )}
                  >
                    <div className="text-sm text-slate-200 font-bold">{m.toUpperCase()}</div>
                    <div className="text-xs text-slate-500">
                      {m === 'midjourney' && 'Adds --ar, --s, --q, --seed'}
                      {m === 'sdxl' && 'Adds Negative prompt + weights'}
                      {m === 'flux' && 'SD-style negative + weights'}
                      {m === 'dalle' && 'Clean sentence-style prompt'}
                    </div>
                  </button>
                ))}
              </div>

              {model === 'midjourney' && (
                <div className="border border-slate-800 rounded-xl bg-slate-950/30 p-3 space-y-3">
                  <div className="text-xs font-bold text-slate-300 uppercase tracking-wide">Midjourney parameters</div>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Aspect (--ar)" value={params.aspect || ''} onChange={v => setParams(p => ({ ...p, aspect: v }))} placeholder="1:1" />
                    <Field label="Stylize (--s)" value={String(params.stylize ?? 150)} onChange={v => setParams(p => ({ ...p, stylize: Number(v) || 150 }))} placeholder="150" />
                    <Field label="Quality (--q)" value={String(params.quality ?? 1)} onChange={v => setParams(p => ({ ...p, quality: Number(v) || 1 }))} placeholder="1" />
                    <Field label="Seed (--seed)" value={params.seed || ''} onChange={v => setParams(p => ({ ...p, seed: v }))} placeholder="optional" />
                  </div>
                </div>
              )}

              <div className="border border-slate-800 rounded-xl bg-slate-950/30 p-3">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wide">Quick actions</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setSubject('');
                      setBlocks([]);
                      setNegative('');
                      showToast('Cleared doc.');
                    }}
                    className="text-xs px-3 py-2 rounded bg-slate-800 hover:bg-slate-700"
                  >
                    New doc
                  </button>
                  <button
                    onClick={() => {
                      setTab('discover');
                      runDiscover(category.searchTerm);
                    }}
                    className="text-xs px-3 py-2 rounded bg-purple-600/20 border border-purple-500/30 text-purple-200 hover:bg-purple-600/30"
                  >
                    Discover for current category
                  </button>
                </div>
              </div>
            </div>
          )}

            </div>
          </div>
        </div>
      )}

      {/* RIGHT PANEL */}
      <aside className="w-[420px] hidden lg:flex flex-col border-l border-slate-800 bg-slate-900 shrink-0">
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
            <Globe size={16} className="text-purple-300" /> Online Intelligence
          </div>
          <div className="flex gap-1">
            <TabButton label="Library" active={tab==='library'} onClick={() => setTab('library')} icon={<PlusCircle size={14} />} />
            <TabButton label="Discover" active={tab==='discover'} onClick={() => setTab('discover')} icon={<Globe size={14} />} />
            <TabButton label="Define" active={tab==='define'} onClick={() => setTab('define')} icon={<BookOpen size={14} />} />
            <TabButton label="Context" active={tab==='context'} onClick={() => setTab('context')} icon={<Network size={14} />} />
            <TabButton label="Lint" active={tab==='lint'} onClick={() => setTab('lint')} icon={<Sparkles size={14} />} />
            <TabButton label="Projects" active={tab==='projects'} onClick={() => setTab('projects')} icon={<Save size={14} />} />
            <TabButton label="Settings" active={tab==='settings'} onClick={() => setTab('settings')} icon={<Settings2 size={14} />} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 p-4 pb-24">
          {tab === 'library' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="font-bold text-white flex items-center gap-2 text-sm">
                  {category.icon} {category.label}
                </div>
                <div className="text-[10px] text-slate-500 bg-slate-800 px-2 py-1 rounded-full">{category.items.length}</div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {category.items.map((item, idx) => (
                  <button
                    key={`${item.label}-${idx}`}
                    onClick={() => addBlockFromItem(item)}
                    className="group text-left p-3 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-800 hover:border-emerald-500/50"
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium text-sm text-slate-200 group-hover:text-emerald-400">{item.label}</span>
                      <PlusCircle size={14} className="text-slate-600 group-hover:text-emerald-500 opacity-0 group-hover:opacity-100" />
                    </div>
                    {item.desc && <div className="text-[11px] text-slate-500 group-hover:text-slate-400 line-clamp-1">{item.desc}</div>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === 'discover' && (
            <div className="space-y-3">
              <div className="text-sm font-bold text-white">Discover vocabulary (Datamuse)</div>
              <div className="text-xs text-slate-400">Online multi-pass discovery for the active category.</div>
              <div className="flex gap-2">
                <input
                  value={discoverTerm}
                  onChange={e => setDiscoverTerm(e.target.value)}
                  placeholder={`e.g. ${category.searchTerm}`}
                  className="flex-1 bg-slate-950/60 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                />
                <button
                  disabled={isDiscovering}
                  onClick={() => runDiscover()}
                  className="bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/30 hover:border-purple-500 text-purple-200 px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2"
                >
                  {isDiscovering ? <RefreshCw className="animate-spin" size={16} /> : <Search size={16} />}
                  {isDiscovering ? 'Searching…' : 'Discover'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {discoverItems.map((it, idx) => (
                  <button
                    key={`${it.word}-${idx}`}
                    onClick={() => {
                      addBlock(it.word, category.id === 'STYLE' ? `${it.word} style` : it.word);
                      useWord(it.word);
                    }}
                    className="text-left p-2 rounded-lg border border-slate-800 bg-slate-900/40 hover:bg-slate-800"
                    title={`Score: ${it.score}`}
                  >
                    <div className="text-sm text-slate-200">{it.word}</div>
                    <div className="text-[10px] text-slate-500">score {it.score}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === 'define' && (
            <div className="space-y-3">
              <div className="text-sm font-bold text-white">Define a term</div>
              <div className="flex gap-2">
                <input
                  value={defineWord}
                  onChange={e => setDefineWord(e.target.value)}
                  placeholder="type a word…"
                  className="flex-1 bg-slate-950/60 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                />
                <button
                  disabled={isDefining}
                  onClick={() => runDefine()}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2"
                >
                  {isDefining ? <RefreshCw className="animate-spin" size={16} /> : <BookOpen size={16} />}
                  {isDefining ? 'Loading…' : 'Define'}
                </button>
              </div>

              {defineData && (
                <div className="border border-slate-800 rounded-xl bg-slate-950/30 p-3 space-y-2">
                  <div className="text-xs text-slate-400">dictionaryapi.dev</div>
                  {defineData?.[0]?.phonetics?.[0]?.text && (
                    <div className="text-slate-200 text-sm">Pronunciation: <span className="font-mono">{defineData[0].phonetics[0].text}</span></div>
                  )}
                  {(defineData?.[0]?.meanings || []).slice(0, 3).map((m: any, idx: number) => (
                    <div key={idx} className="border-t border-slate-800 pt-2">
                      <div className="text-xs uppercase tracking-wide text-emerald-300 font-bold">{m.partOfSpeech}</div>
                      <ul className="mt-1 space-y-1">
                        {(m.definitions || []).slice(0, 2).map((d: any, di: number) => (
                          <li key={di} className="text-sm text-slate-200">
                            • {d.definition}
                            {d.example && <div className="text-xs text-slate-400 mt-1">Example: {d.example}</div>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {!defineData && !isDefining && (
                <div className="text-xs text-slate-500">Tip: click the little book icon on any modifier chip.</div>
              )}
            </div>
          )}

          {tab === 'context' && (
            <div className="space-y-3">
              <div className="text-sm font-bold text-white">Entity context</div>
              <div className="text-xs text-slate-400">Wikipedia + Wikidata + ConceptNet (free online knowledge).</div>
              <div className="flex gap-2">
                <input
                  value={entityQuery}
                  onChange={e => setEntityQuery(e.target.value)}
                  placeholder="Try: Shushtar, Hokusai, Ferrari 250 GTO…"
                  className="flex-1 bg-slate-950/60 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                />
                <button
                  disabled={isContexting}
                  onClick={() => runContext()}
                  className="bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/30 hover:border-purple-500 text-purple-200 px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2"
                >
                  {isContexting ? <RefreshCw className="animate-spin" size={16} /> : <Network size={16} />}
                  {isContexting ? 'Loading…' : 'Fetch'}
                </button>
              </div>

              {/* Wikipedia results */}
              {wpResults?.pages?.length > 0 && (
                <div className="border border-slate-800 rounded-xl bg-slate-950/30 p-3">
                  <div className="text-xs font-bold text-slate-300 uppercase tracking-wide">Wikipedia</div>
                  <div className="mt-2 space-y-2">
                    {wpResults.pages.slice(0, 5).map((p: any) => (
                      <button
                        key={p.id}
                        onClick={() => loadWpSummary(p.title)}
                        className="w-full text-left p-2 rounded-lg bg-slate-900/40 hover:bg-slate-800 border border-slate-800"
                      >
                        <div className="text-sm text-slate-200 font-medium">{p.title}</div>
                        {p.description && <div className="text-xs text-slate-500">{p.description}</div>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {wpSummary?.extract && (
                <div className="border border-slate-800 rounded-xl bg-slate-950/30 p-3">
                  <div className="text-xs font-bold text-slate-300 uppercase tracking-wide">Summary</div>
                  <div className="text-sm text-slate-200 mt-2">{wpSummary.extract}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      onClick={() => addBlock('Context', wpSummary.title, 'SCENE')}
                      className="text-xs px-3 py-2 rounded bg-emerald-600/20 border border-emerald-500/30 text-emerald-200 hover:bg-emerald-600/30"
                    >
                      Add as scene cue
                    </button>
                    <button
                      onClick={() => {
                        setDiscoverTerm(wpSummary.title);
                        setTab('discover');
                        runDiscover(wpSummary.title);
                      }}
                      className="text-xs px-3 py-2 rounded bg-purple-600/20 border border-purple-500/30 text-purple-200 hover:bg-purple-600/30"
                    >
                      Discover related words
                    </button>
                  </div>
                </div>
              )}

              {/* Wikidata results */}
              {wdResults?.search?.length > 0 && (
                <div className="border border-slate-800 rounded-xl bg-slate-950/30 p-3">
                  <div className="text-xs font-bold text-slate-300 uppercase tracking-wide">Wikidata</div>
                  <div className="mt-2 space-y-2">
                    {wdResults.search.slice(0, 6).map((e: any) => (
                      <button
                        key={e.id}
                        onClick={() => loadWdAttrs(e.id)}
                        className="w-full text-left p-2 rounded-lg bg-slate-900/40 hover:bg-slate-800 border border-slate-800"
                      >
                        <div className="text-sm text-slate-200 font-medium">{e.label} <span className="text-xs text-slate-500">({e.id})</span></div>
                        {e.description && <div className="text-xs text-slate-500">{e.description}</div>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {wdAttrs?.results?.bindings?.length > 0 && (
                <div className="border border-slate-800 rounded-xl bg-slate-950/30 p-3">
                  <div className="text-xs font-bold text-slate-300 uppercase tracking-wide">Wikidata attributes</div>
                  <div className="mt-2 space-y-1 text-sm text-slate-200">
                    {wdAttrs.results.bindings.slice(0, 6).map((b: any, idx: number) => (
                      <div key={idx} className="border-t border-slate-800 pt-2">
                        <div className="font-bold">{b.itemLabel?.value}</div>
                        {b.itemDescription?.value && <div className="text-xs text-slate-400">{b.itemDescription.value}</div>}
                        <div className="text-xs text-slate-400 mt-1">
                          {b.instanceOfLabel?.value ? `Type: ${b.instanceOfLabel.value}` : ''}
                          {b.countryLabel?.value ? ` • Country: ${b.countryLabel.value}` : ''}
                          {b.locationLabel?.value ? ` • Location: ${b.locationLabel.value}` : ''}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {b.instanceOfLabel?.value && (
                            <button
                              onClick={() => addBlock('Type', b.instanceOfLabel.value, 'SCENE')}
                              className="text-xs px-3 py-2 rounded bg-slate-800 hover:bg-slate-700"
                            >
                              Add type
                            </button>
                          )}
                          {b.countryLabel?.value && (
                            <button
                              onClick={() => addBlock('Country', b.countryLabel.value, 'SCENE')}
                              className="text-xs px-3 py-2 rounded bg-slate-800 hover:bg-slate-700"
                            >
                              Add country
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ConceptNet */}
              {cnData?.edges?.length > 0 && (
                <div className="border border-slate-800 rounded-xl bg-slate-950/30 p-3">
                  <div className="text-xs font-bold text-slate-300 uppercase tracking-wide">ConceptNet</div>
                  <div className="text-xs text-slate-400 mt-1">Click an edge target to add as a concept cue.</div>
                  <div className="mt-2 grid grid-cols-1 gap-2">
                    {cnData.edges.slice(0, 10).map((e: any, idx: number) => {
                      const rel = e.rel?.label || 'RelatedTo';
                      const end = e.end?.label || e.end?.term || '';
                      return (
                        <button
                          key={idx}
                          onClick={() => addConceptSuggestion(end)}
                          className="text-left p-2 rounded-lg bg-slate-900/40 hover:bg-slate-800 border border-slate-800"
                        >
                          <div className="text-xs text-slate-400">{rel}</div>
                          <div className="text-sm text-slate-200 font-medium">{end}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'lint' && (
            <div className="space-y-3">
              <div className="text-sm font-bold text-white">Prompt linter</div>
              <div className="text-xs text-slate-400">Logic checks + contradictions + missing cues.</div>

              <div className="space-y-2">
                {lint.length === 0 && <div className="text-sm text-emerald-200">Looks good ✨</div>}
                {lint.map((i, idx) => (
                  <div
                    key={idx}
                    className={classNames(
                      'p-3 rounded-xl border',
                      i.level === 'error'
                        ? 'border-red-500/30 bg-red-950/20'
                        : 'border-amber-500/30 bg-amber-950/20'
                    )}
                  >
                    <div className={classNames('text-xs font-bold uppercase', i.level === 'error' ? 'text-red-300' : 'text-amber-200')}>
                      {i.level} — {i.code}
                    </div>
                    <div className="text-sm text-slate-200 mt-1">{i.message}</div>
                    {i.hint && <div className="text-xs text-slate-400 mt-2">Hint: {i.hint}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'projects' && (
            <div className="space-y-3">
              <div className="text-sm font-bold text-white">Projects (server)</div>
              <div className="text-xs text-slate-400">Saved on the server via SQLite (anonymous session cookie).</div>

              <div className="flex gap-2">
                <input
                  value={activeProjectName}
                  onChange={e => setActiveProjectName(e.target.value)}
                  className="flex-1 bg-slate-950/60 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                  placeholder="Project name"
                />
                <button
                  disabled={savingProject}
                  onClick={() => saveProject()}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2"
                >
                  {savingProject ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
                  Save
                </button>
                <button
                  onClick={refreshProjects}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2"
                >
                  <RefreshCw size={16} />
                </button>
              </div>

              <div className="space-y-2">
                {projects.length === 0 && <div className="text-xs text-slate-500">No server projects yet.</div>}
                {projects.map(p => (
                  <div key={p.id} className="border border-slate-800 rounded-xl bg-slate-950/30 p-3 flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium text-slate-200">{p.name}</div>
                      <div className="text-xs text-slate-500">Updated {prettyTime(p.updated_at)}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => loadProject(p.id)} className="text-xs px-3 py-2 rounded bg-slate-800 hover:bg-slate-700">Load</button>
                      <button onClick={() => deleteProject(p.id)} className="text-xs px-3 py-2 rounded bg-red-950/30 border border-red-500/30 text-red-200 hover:bg-red-950/50">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'settings' && (
            <div className="space-y-4">
              <div className="text-sm font-bold text-white">Model mode</div>
              <div className="text-xs text-slate-400">Volcano formats prompts differently per model family.</div>

              <div className="grid grid-cols-2 gap-2">
                {(['sdxl', 'flux', 'midjourney', 'dalle'] as Model[]).map(m => (
                  <button
                    key={m}
                    onClick={() => setModel(m)}
                    className={classNames(
                      'p-3 rounded-xl border text-left',
                      model === m ? 'border-emerald-500/40 bg-emerald-950/20' : 'border-slate-800 bg-slate-950/30 hover:bg-slate-800'
                    )}
                  >
                    <div className="text-sm text-slate-200 font-bold">{m.toUpperCase()}</div>
                    <div className="text-xs text-slate-500">
                      {m === 'midjourney' && 'Adds --ar, --s, --q, --seed'}
                      {m === 'sdxl' && 'Adds Negative prompt + weights'}
                      {m === 'flux' && 'SD-style negative + weights'}
                      {m === 'dalle' && 'Clean sentence-style prompt'}
                    </div>
                  </button>
                ))}
              </div>

              {model === 'midjourney' && (
                <div className="border border-slate-800 rounded-xl bg-slate-950/30 p-3 space-y-3">
                  <div className="text-xs font-bold text-slate-300 uppercase tracking-wide">Midjourney parameters</div>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Aspect (--ar)" value={params.aspect || ''} onChange={v => setParams(p => ({ ...p, aspect: v }))} placeholder="1:1" />
                    <Field label="Stylize (--s)" value={String(params.stylize ?? 150)} onChange={v => setParams(p => ({ ...p, stylize: Number(v) || 150 }))} placeholder="150" />
                    <Field label="Quality (--q)" value={String(params.quality ?? 1)} onChange={v => setParams(p => ({ ...p, quality: Number(v) || 1 }))} placeholder="1" />
                    <Field label="Seed (--seed)" value={params.seed || ''} onChange={v => setParams(p => ({ ...p, seed: v }))} placeholder="optional" />
                  </div>
                </div>
              )}

              <div className="border border-slate-800 rounded-xl bg-slate-950/30 p-3">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wide">Quick actions</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setSubject('');
                      setBlocks([]);
                      setNegative('');
                      showToast('Cleared doc.');
                    }}
                    className="text-xs px-3 py-2 rounded bg-slate-800 hover:bg-slate-700"
                  >
                    New doc
                  </button>
                  <button
                    onClick={() => {
                      setTab('discover');
                      runDiscover(category.searchTerm);
                    }}
                    className="text-xs px-3 py-2 rounded bg-purple-600/20 border border-purple-500/30 text-purple-200 hover:bg-purple-600/30"
                  >
                    Discover for current category
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function TabButton({ label, active, onClick, icon }: { label: string; active: boolean; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={classNames(
        'px-2 py-2 rounded-lg text-xs font-bold flex items-center gap-1 border',
        active ? 'bg-slate-800 border-slate-700 text-white' : 'bg-transparent border-transparent text-slate-400 hover:bg-slate-800 hover:border-slate-700'
      )}
      title={label}
    >
      {icon}
      <span className="hidden xl:inline">{label}</span>
    </button>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="text-xs text-slate-400">
      <div className="mb-1">{label}</div>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-slate-950/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
      />
    </label>
  );
}

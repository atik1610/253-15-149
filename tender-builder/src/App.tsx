import { useMemo, useState } from 'react';
import { BLOCKING, buildPackage, getStatus, readPdf, type F, type Req, type Tender, type Status } from './logic';

type L = 'en' | 'bn';
const T: Record<string, Record<L, string>> = {
  title: { en: 'Tender Document Package Builder', bn: 'টেন্ডার ডকুমেন্ট প্যাকেজ বিল্ডার' },
  load: { en: '1. Open requirements.json', bn: '১. requirements.json খুলুন' },
  upload: { en: '2. Upload PDF files', bn: '২. PDF ফাইল আপলোড করুন' },
  docs: { en: '3. Required documents', bn: '৩. প্রয়োজনীয় ডকুমেন্ট' },
  files: { en: 'Uploaded files', bn: 'আপলোড করা ফাইল' },
  pages: { en: 'pages', bn: 'পৃষ্ঠা' },
  remove: { en: 'Remove', bn: 'মুছুন' },
  dup: { en: 'Duplicate', bn: 'ডুপ্লিকেট' },
  none: { en: '— no file —', bn: '— ফাইল নেই —' },
  expiry: { en: 'Expiry date', bn: 'মেয়াদ শেষের তারিখ' },
  deadline: { en: 'Submission deadline', bn: 'জমার শেষ তারিখ' },
  gen: { en: 'Generate & Download Package', bn: 'প্যাকেজ তৈরি ও ডাউনলোড' },
  why: { en: 'Cannot generate yet:', bn: 'এখনো তৈরি করা যাচ্ছে না:' },
  notpdf: { en: 'is not a PDF and was rejected.', bn: 'PDF নয়, তাই বাতিল করা হয়েছে।' },
  locked: { en: 'is password-protected and cannot be used.', bn: 'পাসওয়ার্ড দিয়ে সুরক্ষিত, ব্যবহার করা যাবে না।' },
  bad: { en: 'is damaged and cannot be read.', bn: 'নষ্ট, পড়া যাচ্ছে না।' },
  badjson: { en: 'Invalid requirements.json.', bn: 'requirements.json সঠিক নয়।' },
  mandatory: { en: 'Required', bn: 'বাধ্যতামূলক' },
  optional: { en: 'Optional', bn: 'ঐচ্ছিক' },
  missing: { en: 'Missing', bn: 'অনুপস্থিত' },
  expiry_needed: { en: 'Expiry date needed', bn: 'মেয়াদের তারিখ দরকার' },
  expired: { en: 'Expired', bn: 'মেয়াদ উত্তীর্ণ' },
  not_provided: { en: 'Not provided', bn: 'দেওয়া হয়নি' },
  ok: { en: 'OK', bn: 'ঠিক আছে' },
};
const COLOR: Record<Status, string> = { missing: 'bg-red-100 text-red-800', expiry_needed: 'bg-amber-100 text-amber-800', expired: 'bg-red-100 text-red-800', not_provided: 'bg-gray-100 text-gray-700', ok: 'bg-green-100 text-green-800' };

export default function App() {
  const [lang, setLang] = useState<L>('en');
  const [tender, setTender] = useState<Tender | null>(null);
  const [reqs, setReqs] = useState<Req[]>([]);
  const [files, setFiles] = useState<F[]>([]);
  const [match, setMatch] = useState<Record<string, string>>({}); // reqId -> fileId
  const [exp, setExp] = useState<Record<string, string>>({});
  const [msgs, setMsgs] = useState<string[]>([]);
  const t = (k: string) => T[k][lang];

  const dupOf = useMemo(() => {
    const g: Record<string, F[]> = {};
    files.forEach((f) => (g[f.hash] ||= []).push(f));
    const m: Record<string, boolean> = {};
    Object.values(g).forEach((a) => a.length > 1 && a.forEach((f) => (m[f.id] = true)));
    return m;
  }, [files]);

  const rows = useMemo(() => reqs.map((r) => {
    const file = files.find((f) => f.id === match[r.id]);
    return { r, file, status: tender ? getStatus(r, file, exp[r.id], tender.submission_deadline) : ('missing' as Status) };
  }), [reqs, files, match, exp, tender]);
  const blockers = rows.filter((x) => BLOCKING.includes(x.status));
  const name = (r: Req) => (lang === 'bn' && r.title_bn ? r.title_bn : r.title_en);

  async function loadReq(file?: File) {
    if (!file) return;
    try {
      const j = JSON.parse(await file.text());
      if (!j.tender || !Array.isArray(j.requirements)) throw 0;
      setTender(j.tender); setReqs([...j.requirements].sort((a: Req, b: Req) => a.order - b.order));
      setMatch({}); setExp({});
    } catch { setMsgs((m) => [...m, t('badjson')]); }
  }
  async function addFiles(list: FileList | null) {
    if (!list) return;
    for (const f of Array.from(list)) {
      try { const p = await readPdf(f); setFiles((x) => [...x, p]); }
      catch (e: any) { setMsgs((m) => [...m, `"${f.name}" ${t(['notpdf', 'locked', 'bad'].includes(e.message) ? e.message : 'bad')}`]); }
    }
  }
  const removeFile = (id: string) => { setFiles((x) => x.filter((f) => f.id !== id)); setMatch((m) => Object.fromEntries(Object.entries(m).filter(([, v]) => v !== id))); };
  const setM = (rid: string, fid: string) => setMatch((m) => { const n = { ...m }; if (fid) n[rid] = fid; else delete n[rid]; return n; });
  function options(rid: string) {
    const used = new Map(Object.entries(match).filter(([k]) => k !== rid).map(([k, v]) => [v, k]));
    const usedHashes = new Set([...used.keys()].map((id) => files.find((f) => f.id === id)?.hash));
    return files.filter((f) => !used.has(f.id) && !(usedHashes.has(f.hash)));
  }
  async function generate() {
    if (!tender) return;
    const items = rows.filter((x) => x.file).map((x) => ({ title: x.r.title_en, file: x.file! }));
    const bytes = await buildPackage(tender, items);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
    a.download = `${tender.tender_id}_Package.pdf`; a.click();
  }

  return (
    <div className={`mx-auto max-w-5xl p-4 text-gray-900 ${lang === 'bn' ? 'font-sans' : ''}`}>
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <button className="rounded border px-3 py-1" onClick={() => setLang(lang === 'en' ? 'bn' : 'en')}>{lang === 'en' ? 'বাংলা' : 'English'}</button>
      </header>

      {msgs.length > 0 && (
        <div className="mt-3 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {msgs.map((m, i) => <p key={i}>{m}</p>)}
          <button className="mt-1 underline" onClick={() => setMsgs([])}>OK</button>
        </div>
      )}

      <section className="mt-4"><label className="font-semibold">{t('load')}</label>
        <input type="file" accept=".json,application/json" className="mt-1 block" onChange={(e) => { loadReq(e.target.files?.[0]); e.target.value = ''; }} /></section>

      {tender && (<>
        <section className="mt-3 rounded border bg-gray-50 p-3 text-sm">
          <p><b>{tender.tender_id}</b> — {tender.title}</p>
          <p>{tender.procuring_entity} · {tender.bidder}</p>
          <p>{t('deadline')}: <b>{tender.submission_deadline}</b></p>
        </section>

        <section className="mt-4"><label className="font-semibold">{t('upload')}</label>
          <input type="file" multiple accept="application/pdf,.pdf" className="mt-1 block" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          {files.length > 0 && <h3 className="mt-2 font-semibold">{t('files')}</h3>}
          <ul className="text-sm">{files.map((f) => (
            <li key={f.id} className="flex items-center gap-2 border-b py-1">
              <span className="flex-1 break-all">{f.name} · {f.pages} {t('pages')}</span>
              {dupOf[f.id] && <span className="rounded bg-orange-100 px-2 text-orange-800">{t('dup')}</span>}
              <button className="text-red-700 underline" onClick={() => removeFile(f.id)}>{t('remove')}</button>
            </li>))}</ul>
        </section>

        <section className="mt-4"><h2 className="font-semibold">{t('docs')}</h2>
          <div className="mt-1 space-y-2">{rows.map(({ r, file, status }) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 rounded border p-2">
              <div className="min-w-48 flex-1"><b>{r.order}. {name(r)}</b>
                <div className="text-xs text-gray-500">{r.mandatory ? t('mandatory') : t('optional')}</div></div>
              <select className="max-w-56 rounded border p-1" value={match[r.id] ?? ''} onChange={(e) => setM(r.id, e.target.value)}>
                <option value="">{t('none')}</option>
                {file && <option value={file.id}>{file.name}</option>}
                {options(r.id).filter((f) => f.id !== file?.id).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              {r.has_expiry && file && (
                <label className="text-sm">{t('expiry')}: <input type="date" className="rounded border p-1" value={exp[r.id] ?? ''} onChange={(e) => setExp((x) => ({ ...x, [r.id]: e.target.value }))} /></label>)}
              <span className={`rounded px-2 py-1 text-sm font-medium ${COLOR[status]}`}>{t(status)}</span>
            </div>))}</div>
        </section>

        <section className="mt-4">
          {blockers.length > 0 && (<div className="mb-2 text-sm text-red-700"><p>{t('why')}</p>
            <ul className="list-disc pl-5">{blockers.map(({ r, status }) => <li key={r.id}>{name(r)} — {t(status)}</li>)}</ul></div>)}
          <button disabled={blockers.length > 0} onClick={generate} className="rounded bg-blue-700 px-4 py-2 text-white disabled:cursor-not-allowed disabled:bg-gray-400">{t('gen')}</button>
        </section></>)}
    </div>
  );
}

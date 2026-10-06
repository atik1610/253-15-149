import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
export type Req = { id: string; order: number; title_en: string; title_bn: string; mandatory: boolean; has_expiry: boolean };
export type Tender = { tender_id: string; title: string; procuring_entity: string; bidder: string; submission_deadline: string };
export type F = { id: string; name: string; pages: number; hash: string; data: ArrayBuffer };
export type Status = 'missing' | 'expiry_needed' | 'expired' | 'not_provided' | 'ok';
export const BLOCKING: Status[] = ['missing', 'expiry_needed', 'expired'];

export function getStatus(r: Req, file: F | undefined, exp: string | undefined, deadline: string): Status {
  if (!file) return r.mandatory ? 'missing' : 'not_provided';
  if (r.has_expiry) {
    if (!exp) return 'expiry_needed';
    if (exp < deadline) return 'expired'; // same day is OK (YYYY-MM-DD string compare)
  }
  return 'ok';
}
async function sha(b: ArrayBuffer) {
  const h = await crypto.subtle.digest('SHA-256', b);
  return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
export async function readPdf(file: File): Promise<F> {
  const data = await file.arrayBuffer();
  const head = new TextDecoder().decode(new Uint8Array(data.slice(0, 1024)));
  if (!head.includes('%PDF-')) throw new Error('notpdf');
  try {
    const doc = await PDFDocument.load(data);
    return { id: crypto.randomUUID(), name: file.name, pages: doc.getPageCount(), hash: await sha(data), data };
  } catch (e: any) {
    throw new Error(/encrypt/i.test(String(e?.message)) ? 'locked' : 'bad');
  }
}
const safe = (s: string) => String(s ?? '').replace(/[^\x20-\x7E]/g, '?');
const wrap = (s: string, n: number) => safe(s).match(new RegExp(`.{1,${n}}(\\s|$)|\\S+`, 'g'))?.map((x) => x.trim()) ?? [''];

export async function buildPackage(t: Tender, items: { title: string; file: F }[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  const bold = await out.embedFont(StandardFonts.HelveticaBold);
  const FOOT = 32;
  const cover = out.addPage([595, 842]);
  let y = 780;
  const line = (txt: string, b = false, size = 11) => { cover.drawText(txt, { x: 50, y, size, font: b ? bold : font, color: rgb(0, 0, 0) }); y -= size + 7; };
  line('TENDER DOCUMENT PACKAGE', true, 20); y -= 8;
  const fields: [string, string][] = [['Tender ID', t.tender_id], ['Title', t.title], ['Procuring Entity', t.procuring_entity], ['Bidder', t.bidder], ['Submission Deadline', t.submission_deadline], ['Package Date', new Date().toISOString().slice(0, 10)]];
  for (const [k, v] of fields) { const ls = wrap(v, 70); line(`${k}: ${ls[0]}`, false); ls.slice(1).forEach((l) => line(`    ${l}`)); }
  y -= 10; line('Included Documents', true, 14);
  items.forEach((it, i) => line(`${i + 1}. ${wrap(it.title, 85)[0]}`));
  for (const it of items) {
    const src = await PDFDocument.load(it.file.data);
    const emb = await out.embedPages(src.getPages());
    emb.forEach((e) => { const p = out.addPage([e.width, e.height + FOOT]); p.drawPage(e, { x: 0, y: FOOT }); });
  }
  const pages = out.getPages();
  pages.forEach((p, i) => {
    const txt = `${safe(t.tender_id)} | Page ${i + 1} of ${pages.length}`;
    const w = font.widthOfTextAtSize(txt, 10);
    p.drawText(txt, { x: (p.getWidth() - w) / 2, y: 12, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
  });
  return out.save();
}

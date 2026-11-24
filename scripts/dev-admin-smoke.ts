import 'dotenv/config';

async function main() {
  const BASE = process.env.BASE ?? 'http://localhost:3001';

  async function login() {
    const r = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'password', identifier: 'admin', password: 'admin123' }),
    });
    const setc = r.headers.getSetCookie?.() ?? [];
    const cookie = setc.map((c: string) => c.split(';')[0]).join('; ');
    if (!setc.some((c: string) => c.startsWith('leou_session'))) throw new Error('session not set');
    return cookie;
  }

  async function api(cookie: string, path: string, method = 'GET', body?: unknown) {
    const r = await fetch(`${BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  }

  const cookie = await login();

  const cls = await api(cookie, '/api/admin/classes');
  const class11 = cls.data.classes.find((c: { id: string; name: string }) => c.name === 'Class 11');
  console.log('class11 id:', class11.id);

  const sub = await api(cookie, '/api/admin/subjects');
  const phy = sub.data.subjects.find((s: { id: string; name: string }) => s.name === 'Physics');
  const chem = sub.data.subjects.find((s: { id: string; name: string }) => s.name === 'Chemistry');
  console.log('have PHY/CHEM:', !!phy, !!chem);

  const batch = await api(cookie, `/api/admin/classes/${class11.id}/batches`, 'POST', {
    name: 'Smoke Section',
    subjectIds: [phy.id, chem.id],
  });
  console.log('create batch:', batch.status, batch.data.batch?.name ?? batch.data.error);

  const bId = batch.data.batch?.id;
  if (bId) {
    const patch = await api(cookie, `/api/admin/batches/${bId}`, 'PATCH', { name: 'Smoke Section A' });
    console.log('patch batch:', patch.status, patch.data.batch?.name);
    const delReq = await api(cookie, `/api/admin/batches/${bId}`, 'DELETE');
    console.log('delete batch:', delReq.status, JSON.stringify(delReq.data));
  }

  const badDel = await api(cookie, `/api/admin/classes/${class11.id}`, 'DELETE');
  console.log('delete non-empty class (expect 409):', badDel.status, badDel.data.error);

  const newSubj = await api(cookie, '/api/admin/subjects', 'POST', { name: 'Smoke Subject', classIds: [class11.id] });
  console.log('create subject:', newSubj.status, newSubj.data.subject?.name ?? newSubj.data.error);
  const nsId = newSubj.data.subject?.id;
  if (nsId) {
    const patchS = await api(cookie, `/api/admin/subjects/${nsId}`, 'PATCH', { classIds: [] });
    console.log('patch subject (unallot):', patchS.status, 'classes now:', patchS.data.subject?.classes?.length);
    const delS = await api(cookie, `/api/admin/subjects/${nsId}`, 'DELETE');
    console.log('delete subject:', delS.status, JSON.stringify(delS.data));
  }

  const newCls = await api(cookie, '/api/admin/classes', 'POST', { name: 'Smoke Class', hasStreams: true, sortOrder: 99 });
  console.log('create class:', newCls.status, newCls.data.classroom?.name ?? newCls.data.error);
  const cId = newCls.data.classroom?.id;
  if (cId) {
    const delC = await api(cookie, `/api/admin/classes/${cId}`, 'DELETE');
    console.log('delete empty class:', delC.status, JSON.stringify(delC.data));
  }
  const dupCls = await api(cookie, '/api/admin/classes', 'POST', { name: 'Class 11' });
  console.log('dup class (expect 409):', dupCls.status, dupCls.data.error);
}
main().catch((e) => { console.error(e); process.exit(1); });

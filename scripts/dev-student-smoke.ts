import 'dotenv/config';

async function main() {
  const BASE = process.env.BASE ?? 'http://localhost:3001';

  async function adminLogin() {
    const r = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'password', identifier: 'admin', password: 'admin123' }) });
    const setc = r.headers.getSetCookie?.() ?? [];
    return setc.map((c: string) => c.split(';')[0]).join('; ');
  }

  async function api(cookie: string, path: string, method = 'GET', body?: unknown) {
    const r = await fetch(`${BASE}${path}`, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  }

  const cookie = await adminLogin();

  const opts = await (await fetch(`${BASE}/api/enrollment/options`)).json();
  const cls = opts.classes.find((c: { hasStreams: boolean; subjects: unknown[] }) => c.hasStreams && c.subjects.length);
  const subjId = cls.subjects[0].id;
  const vec = () => Array.from({ length: 128 }, (_, i) => 0.1 + (i % 7) * 0.013);
  const photo = 'data:image/jpeg;base64,' + Buffer.from('face').toString('base64');

  const create = await api(cookie, '/api/admin/students', 'POST', {
    fullName: 'Admin Created Student', classRoomId: cls.id, stream: 'SCIENCE',
    subjectIds: [subjId], schoolName: 'Test School', schoolStatus: 'CURRENT',
    email: 'adminmake@leou.test', phone: '+917700000001', username: 'adminmake',
    password: 'AdminMake123', faceEmbeddings: [vec(), vec(), vec(), vec(), vec()], facePhoto: photo,
  });
  console.log('create student:', create.status, create.data.student?.id ?? create.data.error);
  const sid = create.data.student?.id;
  if (!sid) return;

  const list = await fetch(`${BASE}/admin/students`, { headers: { Cookie: cookie } });
  console.log('list page shows student:', (await list.text()).includes('Admin Created Student'));

  const ac = await api(cookie, `/api/admin/students/${sid}/access-code`, 'POST');
  console.log('access code generated:', ac.status, /^\d{6}$/.test(String(ac.data.code)));

  // assign to a batch of the student's class
  const batchesRes = await fetch(`${BASE}/api/admin/classes/${cls.id}/batches`, { headers: { Cookie: cookie } });
  const clsData = (await batchesRes.json()).classroom;
  console.log('class batches:', clsData.batches.map((b: { id: string; name: string }) => b.name).join(', ') || 'none');
  if (clsData.batches.length) {
    const assign = await api(cookie, `/api/admin/students/${sid}`, 'PATCH', { batchIds: [clsData.batches[0].id] });
    console.log('assign batch:', assign.status, JSON.stringify(assign.data.error ?? 'ok'));
    const wrong = await api(cookie, `/api/admin/students/${sid}`, 'PATCH', { batchIds: ['bad-id'] });
    console.log('assign bad batch (expect 400):', wrong.status, wrong.data.error);
  }

  const susp = await api(cookie, `/api/admin/students/${sid}`, 'PATCH', { status: 'SUSPENDED' });
  console.log('suspend:', susp.status, susp.data.student?.status);
  const loginBlocked = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'password', identifier: 'adminmake', password: 'AdminMake123' }) });
  console.log('login while suspended (expect 403):', loginBlocked.status);

  const del = await api(cookie, `/api/admin/students/${sid}`, 'DELETE');
  console.log('delete student:', del.status, del.data.error ?? 'ok');
}
main().catch((e) => { console.error(e); process.exit(1); });

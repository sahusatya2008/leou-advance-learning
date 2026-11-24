import 'dotenv/config';
async function main() {
  const BASE = process.env.BASE ?? 'http://localhost:3001';
  const r = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'password', identifier: 'admin', password: 'admin123' }) });
  const setc = r.headers.getSetCookie?.() ?? [];
  const cookie = setc.map((c: string) => c.split(';')[0]).join('; ');
  const opts = await (await fetch(`${BASE}/api/enrollment/options`)).json();
  const cls = opts.classes.find((c: { hasStreams: boolean; subjects: unknown[] }) => c.hasStreams && c.subjects.length);
  const vec = () => Array.from({ length: 128 }, (_, i) => 0.1 + (i % 7) * 0.013);
  const create = await fetch(`${BASE}/api/admin/students`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({
    fullName: 'Manage Render Student', classRoomId: cls.id, stream: 'SCIENCE', subjectIds: [cls.subjects[0].id],
    schoolName: 'Test School', schoolStatus: 'CURRENT', email: 'render@leou.test', phone: '+917700000002',
    username: 'renderstudent', password: 'RenderPass123', faceEmbeddings: [vec(), vec(), vec(), vec(), vec()],
    facePhoto: 'data:image/jpeg;base64,aW1n', }) });
  const sid = (await create.json()).student?.id;
  const page = await (await fetch(`${BASE}/admin/students/${sid}`, { headers: { Cookie: cookie } })).text();
  console.log('manage page status renderer:', page.includes('Manage Render Student'), page.includes('Enrolled') ? 'enrolled=true' : 'enrolled=missing');
  await fetch(`${BASE}/api/admin/students/${sid}`, { method: 'DELETE', headers: { Cookie: cookie } });
}
main().catch((e) => { console.error(e); process.exit(1); });

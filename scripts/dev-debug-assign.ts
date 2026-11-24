import 'dotenv/config';
async function main() {
  const BASE = process.env.BASE ?? 'http://localhost:3001';
  const vec = () => Array.from({ length: 128 }, (_, i) => 0.1 + (i % 7) * 0.013);
  const ar = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'password', identifier: 'admin', password: 'admin123' }) });
  const acookie = (ar.headers.getSetCookie?.() ?? []).map((c: string) => c.split(';')[0]).join('; ');
  const opts = await (await fetch(`${BASE}/api/enrollment/options`)).json();
  const cls = opts.classes.find((c: { hasStreams: boolean; subjects: unknown[] }) => c.hasStreams && c.subjects.length);
  const subjId = cls.subjects[0].id;
  const create = await fetch(`${BASE}/api/admin/students`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: acookie }, body: JSON.stringify({
    fullName: 'Debug Assign Student', classRoomId: cls.id, stream: 'SCIENCE', subjectIds: [subjId],
    schoolName: 'Test School', schoolStatus: 'CURRENT', email: 'dassign@leou.test', phone: '+917700000004',
    username: 'dassign', password: 'DebugPass123', faceEmbeddings: [vec(), vec(), vec(), vec(), vec()],
    facePhoto: 'data:image/jpeg;base64,aW1n', }) });
  const sid = (await create.json()).student?.id;
  const br = await fetch(`${BASE}/api/admin/classes/${cls.id}/batches`, { headers: { Cookie: acookie } });
  const batches_ = (await br.json()).classroom.batches;
  console.log('batches of class:', JSON.stringify(batches_.map((b: { id: string; name: string }) => b.name)));
  const bid = batches_[0].id;
  const patch = await fetch(`${BASE}/api/admin/students/${sid}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: acookie }, body: JSON.stringify({ batchIds: [bid] }) });
  console.log('patch:', patch.status, await patch.text());
  // verify via manage page profile (batches included)
  const manage = await (await fetch(`${BASE}/admin/students/${sid}`, { headers: { Cookie: acookie } })).text();
  console.log('manage contains Section:', manage.includes('Section'));
  await fetch(`${BASE}/api/admin/students/${sid}`, { method: 'DELETE', headers: { Cookie: acookie } });
}
main().catch((e) => { console.error(e); process.exit(1); });

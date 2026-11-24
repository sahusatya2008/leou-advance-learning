import 'dotenv/config';
async function main() {
  const BASE = process.env.BASE ?? 'http://localhost:3001';
  const vec = () => Array.from({ length: 128 }, (_, i) => 0.1 + (i % 7) * 0.013);

  const ar = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'password', identifier: 'admin', password: 'admin123' }) });
  const acookie = (ar.headers.getSetCookie?.() ?? []).map((c: string) => c.split(';')[0]).join('; ');

  const opts = (await (await fetch(`${BASE}/api/enrollment/options`)).json()) as { classes: { id: string; hasStreams: boolean; subjects: { id: string }[] }[] };
  const cls = opts.classes.find((c) => c.hasStreams && c.subjects.length) ?? opts.classes.find((c) => c.subjects.length);
  if (!cls) throw new Error('no class with subjects');
  console.log('class:', cls.id, 'subjects:', cls.subjects.length);

  const create = await fetch(`${BASE}/api/admin/students`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: acookie },
    body: JSON.stringify({
      fullName: 'Shell Test Student', classRoomId: cls.id, stream: 'SCIENCE', subjectIds: [cls.subjects[0].id],
      schoolName: 'Test School', schoolStatus: 'CURRENT', email: 'shell@leou.test', phone: '+917700000003',
      username: 'shellstudent', password: 'ShellPass123', faceEmbeddings: [vec(), vec(), vec(), vec(), vec()],
      facePhoto: 'data:image/jpeg;base64,aW1n',
    }),
  });
  if (create.status === 201) console.log('student created');
  else { const b = await create.json().catch(() => ({})); console.log('student create:', create.status, JSON.stringify(b)); }

  // ensure assigned to the first batch of the class
  const br = (await (await fetch(`${BASE}/api/admin/classes/${cls.id}/batches`, { headers: { Cookie: acookie } })).json()) as { classroom: { batches: { id: string }[] } };
  const batchId = br.classroom.batches[0]?.id;
  if (!batchId) throw new Error('class has no batches');
  const list = (await (await fetch(`${BASE}/api/admin/students`, { headers: { Cookie: acookie } })).json()) as { students: { id: string; username: string }[] };
  const stu = list.students.find((s) => s.username === 'shellstudent');
  if (!stu) throw new Error('student still missing');
  const patch = await fetch(`${BASE}/api/admin/students/${stu.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: acookie }, body: JSON.stringify({ batchIds: [batchId] }) });
  console.log('assign batch:', patch.status, 'batch', batchId);
}
main().catch((e) => { console.error(e); process.exit(1); });
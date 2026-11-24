import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'
import { hash } from 'bcryptjs'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const db = new PrismaClient({ adapter })

async function main() {
  const adminPw = await hash('admin123', 12)
  const admin = await db.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@leou.edu',
      phone: '+910000000000',
      passwordHash: adminPw,
      role: 'ADMIN',
    },
  })
  console.log('admin:', admin.username)

  const class11 = await db.classRoom.upsert({
    where: { name: 'Class 11' },
    update: { hasStreams: true, sortOrder: 1 },
    create: { name: 'Class 11', hasStreams: true, sortOrder: 1 },
  })
  const class12 = await db.classRoom.upsert({
    where: { name: 'Class 12' },
    update: { hasStreams: true, sortOrder: 2 },
    create: { name: 'Class 12', hasStreams: true, sortOrder: 2 },
  })
  const class10 = await db.classRoom.upsert({
    where: { name: 'Class 10' },
    update: { sortOrder: 0 },
    create: { name: 'Class 10', sortOrder: 0 },
  })
  console.log('classes:', class11.name, class12.name, class10.name)

  const makeSubject = async (name: string, code: string) =>
    db.subject.upsert({ where: { code }, update: {}, create: { name, code } })

  const physics = await makeSubject('Physics', 'PHY')
  const chemistry = await makeSubject('Chemistry', 'CHE')
  const maths = await makeSubject('Mathematics', 'MAT')
  const biology = await makeSubject('Biology', 'BIO')
  const cs = await makeSubject('Computer Science', 'CS')
  const english = await makeSubject('English', 'ENG')

  const allot = async (classRoomId: string, subjectId: string) =>
    db.subjectClass
      .upsert({ where: { subjectId_classRoomId: { subjectId, classRoomId } }, update: {}, create: { subjectId, classRoomId } })
      .catch(() => null)

  for (const s of [physics, chemistry, maths, biology, cs, english]) {
    await allot(class11.id, s.id)
    await allot(class12.id, s.id)
  }
  const batch = await db.batch.upsert({
    where: { classRoomId_name: { classRoomId: class11.id, name: 'Section A' } },
    update: {},
    create: { classRoomId: class11.id, name: 'Section A' },
  })
  await db.batchSubject.upsert({
    where: { batchId_subjectId: { batchId: batch.id, subjectId: physics.id } },
    update: {},
    create: { batchId: batch.id, subjectId: physics.id },
  })
  await db.batchSubject.upsert({
    where: { batchId_subjectId: { batchId: batch.id, subjectId: chemistry.id } },
    update: {},
    create: { batchId: batch.id, subjectId: chemistry.id },
  })
  console.log('batch:', batch.name)

  console.log('seed complete')
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
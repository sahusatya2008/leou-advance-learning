# leou-advance-learning

A full-stack tuition platform built with Next.js (App Router), Prisma/PostgreSQL,
and a Python face-verification service.

## What is included

- Role-based accounts for students, parents and administrators, with face
  verification used for student signup and login.
- Student onboarding with plan selection and manual UPI payment verification.
- Courses: Computing/Encoding, a free General Organic Chemistry course, and a
  gated Haloalkanes course for eligible Class 12 CBSE Chemistry students.
  Chemistry concepts are rendered as interactive 3D scenes on Canvas 2D (no
  WebGL dependency).
- Assignments, assessments, practical programming tasks, doubts and progress
  tracking, with localStorage-based course progress where applicable.
- Admin panels for users, payments, questions, content and activity logs.
- A small Node code-runner service and a FastAPI face/OCR service.

## Stack

- Next.js App Router, React 19, TypeScript, Tailwind CSS 4
- Prisma ORM 7 with the `pg` driver adapter, PostgreSQL 16
- Python FastAPI face pipeline (insightface / ONNX) and Tesseract OCR for payment screens
- Multi-stage Docker build using the standalone Next.js output

## Local setup

1. Copy `.env.example` to `.env` and fill in the values (database URL,
   `JWT_SECRET`, payment UPI settings). Never commit the real `.env`.
2. Install dependencies: `npm install`
3. Generate the client and apply migrations: `npx prisma generate` then `npm run db:migrate`
4. Start the face service: `npm run face:serve`
5. Start the app: `npm run dev` (http://localhost:3000)

Useful scripts: `npm run typecheck`, `npm run lint`, `npm run check:data`, and the
various `test:*` scripts under `scripts/`.

## Production

Build the image and start the stack:

```bash
docker build -t leou-platform:local .
docker compose up -d
```

Migrations are a separate step so the runtime image stays small:

```bash
docker build --target migrate -t leou-migrate .
docker run --rm --env-file .env leou-migrate
```

## Repository policy

Real credentials live only in the git-ignored `.env`. Model weights, the live
payment QR image, the operations runbook, local uploads/backups/logs and
editor/agent scaffolding are intentionally excluded from this repository.
`.env.example` is the safe, committed template.

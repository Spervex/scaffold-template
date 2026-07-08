import path from 'node:path';
import { BaseGenerator } from './base.generator.js';
import { type CliOptions, type FileDefinition, type GeneratorResult } from '../types.js';
import { logger } from '../utils/logger.js';
import { mergeDeps, applyExtras } from '../shared/packages.js';

function getNextjsFullstackPackageJson(options: CliOptions): Record<string, unknown> {
  const base: Record<string, unknown> = {
    name: options.projectName,
    version: '0.1.0',
    private: true,
    scripts: {
      dev: 'next dev',
      build: 'next build',
      start: 'next start',
      lint: 'next lint',
    },
    dependencies: {
      next: '^16.2.9',
      react: '^19.2.7',
      'react-dom': '^19.2.7',
    },
    devDependencies: {
      '@types/node': '^24.13.2',
      '@types/react': '^19.2.17',
      '@types/react-dom': '^19.2.3',
      typescript: '~6.0.2',
      'eslint-config-next': '^16.0.0',
    },
  };

  if (options.database === 'mongodb') {
    (base.dependencies as Record<string, string>).mongoose = '^9.6.1';
  } else {
    (base.dependencies as Record<string, string>)['@prisma/client'] = '^6.0.0';
    (base.devDependencies as Record<string, string>).prisma = '^6.0.0';
    (base.scripts as Record<string, string>)['db:generate'] = 'prisma generate';
    (base.scripts as Record<string, string>)['db:push'] = 'prisma db push';
  }

  return mergeDeps(base, options, true) as Record<string, unknown>;
}

const NEXTJS_FULLSTACK_TS_CONFIG: Record<string, unknown> = {
  compilerOptions: {
    target: 'ES2017',
    lib: ['dom', 'dom.iterable', 'esnext'],
    allowJs: true,
    skipLibCheck: true,
    strict: true,
    noEmit: true,
    esModuleInterop: true,
    module: 'esnext',
    moduleResolution: 'bundler',
    resolveJsonModule: true,
    isolatedModules: true,
    jsx: 'preserve',
    incremental: true,
    plugins: [{ name: 'next' }],
    paths: {
      '@/*': ['./src/*'],
    },
  },
  include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
  exclude: ['node_modules'],
};

export class NextjsFullstackGenerator extends BaseGenerator {
  async generate(): Promise<GeneratorResult> {
    const dbLabel = this.options.database === 'postgresql' ? 'PostgreSQL' : 'MongoDB';
    logger.step(`Generating Next.js full-stack project (API routes + ${dbLabel})...`);

    const dir = this.options.projectDir;
    const files: FileDefinition[] = this.getFiles(dir);

    await this.writeFiles(files);

    logger.success(`Next.js full-stack project created in ${dir}`);
    return { filesCreated: files.length, dir };
  }

  private getFiles(dir: string): FileDefinition[] {
    const isPostgres = this.options.database === 'postgresql';
    const files: FileDefinition[] = [
      // ── Root config files ──────────────────────────────────
      {
        path: path.join(dir, 'package.json'),
        content: this.formatJson(getNextjsFullstackPackageJson(this.options)),
      },
      {
        path: path.join(dir, 'tsconfig.json'),
        content: this.formatJson(NEXTJS_FULLSTACK_TS_CONFIG),
      },
      {
        path: path.join(dir, 'next.config.ts'),
        content: `import type { NextConfig } from 'next';

const nextConfig: NextConfig = {};

export default nextConfig;
`,
      },
      {
        path: path.join(dir, 'next-env.d.ts'),
        content: `/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
`,
      },
      {
        path: path.join(dir, '.env.example'),
        content: isPostgres
          ? `NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/myapp
`
          : `NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/myapp
`,
      },
      {
        path: path.join(dir, '.gitignore'),
        content: `# dependencies
/node_modules
/.pnp
.pnp.js

# testing
/coverage

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# local env files
.env*.local

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts
`,
      },
      {
        path: path.join(dir, 'README.md'),
        content: `# ${this.options.projectName}

A full-stack Next.js application scaffolded with \`create-scaffold\`.

## Getting Started

1. Copy \`.env.example\` to \`.env\` and configure your database connection string.
2. Install dependencies:

\`\`\`bash
pnpm install
\`\`\`

3. Start the development server:

\`\`\`bash
pnpm dev
\`\`\`

## API Endpoints

- \`GET /api/health\` - Health check
- \`GET /api/users\` - Get all users
- \`POST /api/users\` - Create a new user
- \`GET /api/users/[id]\` - Get user by ID
- \`PUT /api/users/[id]\` - Update a user
- \`DELETE /api/users/[id]\` - Delete a user

## Scripts

| Command | Description |
|---------|-------------|
| \`pnpm dev\` | Start development server |
| \`pnpm build\` | Build for production |
| \`pnpm start\` | Start production server |
| \`pnpm lint\` | Lint source files |
${isPostgres ? '| `pnpm db:push` | Push schema changes to database |\n| `pnpm db:generate` | Generate Prisma client |' : ''}`,
      },

      // ── prisma/ (PostgreSQL only) ─────────────────────────
      ...(isPostgres
        ? [
            {
              path: path.join(dir, 'prisma', 'schema.prisma'),
              content: `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(uuid())
  name      String
  email     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
`,
            },
          ]
        : []),

      // ── app/ ───────────────────────────────────────────────
      {
        path: path.join(dir, 'app', 'layout.tsx'),
        content: `import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Next.js Fullstack App',
  description: 'Generated by create-scaffold',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
`,
      },
      {
        path: path.join(dir, 'app', 'page.tsx'),
        content: `import Link from 'next/link';

export default function Home() {
  return (
    <div className="container">
      <header className="hero">
        <h1 className="hero-title">Next.js + ${isPostgres ? 'PostgreSQL' : 'MongoDB'}</h1>
        <p className="hero-subtitle">
          Full-stack application scaffolded with create-scaffold.
        </p>
        <div className="hero-actions">
          <Link href="/api/health" className="btn btn-primary">
            Check API Health
          </Link>
          <a
            href="https://nextjs.org/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
          >
            Next.js Docs
          </a>
        </div>
      </header>

      <main className="features">
        <div className="feature-card">
          <h2>App Router</h2>
          <p>Built on the modern App Router pattern with server components and API routes.</p>
        </div>
        <div className="feature-card">
          <h2>${isPostgres ? 'PostgreSQL + Prisma' : 'MongoDB + Mongoose'}</h2>
          <p>Integrated ${isPostgres ? 'PostgreSQL connection with Prisma ORM' : 'MongoDB connection with Mongoose models'} and validation.</p>
        </div>
        <div className="feature-card">
          <h2>REST API</h2>
          <p>Built-in API routes for CRUD operations with proper error handling.</p>
        </div>
      </main>

      <footer className="footer">
        <p>Powered by Next.js</p>
      </footer>
    </div>
  );
}
`,
      },
      {
        path: path.join(dir, 'app', 'globals.css'),
        content: `:root {
  --color-primary: #0070f3;
  --color-primary-dark: #0051b3;
  --color-bg: #ffffff;
  --color-bg-secondary: #f5f5f5;
  --color-text: #1a1a1a;
  --color-text-secondary: #666666;
  --color-border: #e0e0e0;
  --max-width: 1100px;
  --border-radius: 8px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-primary: #3291ff;
    --color-primary-dark: #0070f3;
    --color-bg: #0a0a0a;
    --color-bg-secondary: #1a1a1a;
    --color-text: #e0e0e0;
    --color-text-secondary: #999999;
    --color-border: #333333;
  }
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  scroll-behavior: smooth;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
    Ubuntu, Cantarell, sans-serif;
  background: var(--color-bg);
  color: var(--color-text);
  line-height: 1.6;
}

.container {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 0 1rem;
}

.hero {
  text-align: center;
  padding: 4rem 0;
}

.hero-title {
  font-size: 3rem;
  font-weight: 700;
  margin-bottom: 1rem;
  background: linear-gradient(135deg, var(--color-primary), #7928ca);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-subtitle {
  font-size: 1.2rem;
  color: var(--color-text-secondary);
  margin-bottom: 2rem;
}

.hero-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.btn {
  padding: 0.75rem 1.5rem;
  border-radius: var(--border-radius);
  text-decoration: none;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover {
  background: var(--color-primary-dark);
}

.btn-secondary {
  background: var(--color-bg-secondary);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.btn-secondary:hover {
  border-color: var(--color-text);
}

.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  padding: 2rem 0;
}

.feature-card {
  padding: 2rem;
  background: var(--color-bg-secondary);
  border-radius: var(--border-radius);
  border: 1px solid var(--color-border);
}

.feature-card h2 {
  margin-bottom: 0.75rem;
  font-size: 1.25rem;
}

.feature-card p {
  color: var(--color-text-secondary);
}

.footer {
  text-align: center;
  padding: 2rem 0;
  color: var(--color-text-secondary);
  border-top: 1px solid var(--color-border);
  margin-top: 2rem;
}

@media (max-width: 768px) {
  .hero-title {
    font-size: 2rem;
  }

  .hero-actions {
    flex-direction: column;
    align-items: center;
  }
}
`,
      },

      // ── API routes ─────────────────────────────────────────
      {
        path: path.join(dir, 'app', 'api', 'health', 'route.ts'),
        content: `import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function GET() {
  logger.info('Health check requested');
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}
`,
      },
      {
        path: path.join(dir, 'app', 'api', 'users', 'route.ts'),
        content: isPostgres
          ? `import { NextRequest, NextResponse } from 'next/server';
import { connectDatabase } from '@/lib/db';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    await connectDatabase();
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ success: true, count: users.length, data: users });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDatabase();
    const body = await request.json();
    const user = await prisma.user.create({ data: body });
    return NextResponse.json({ success: true, data: user }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 400 }
    );
  }
}
`
          : `import { NextRequest, NextResponse } from 'next/server';
import { connectDatabase } from '@/lib/db';
import { User } from '@/lib/models/User';

export async function GET() {
  try {
    await connectDatabase();
    const users = await User.find().sort({ createdAt: -1 });
    return NextResponse.json({ success: true, count: users.length, data: users });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDatabase();
    const body = await request.json();
    const user = await User.create(body);
    return NextResponse.json({ success: true, data: user }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 400 }
    );
  }
}
`,
      },
      {
        path: path.join(dir, 'app', 'api', 'users', '[id]', 'route.ts'),
        content: isPostgres
          ? `import { NextRequest, NextResponse } from 'next/server';
import { connectDatabase } from '@/lib/db';
import { prisma } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDatabase();
    const { id } = await params;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDatabase();
    const { id } = await params;
    const body = await request.json();
    const user = await prisma.user.update({ where: { id }, data: body });
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDatabase();
    const { id } = await params;
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 }
    );
  }
}
`
          : `import { NextRequest, NextResponse } from 'next/server';
import { connectDatabase } from '@/lib/db';
import { User } from '@/lib/models/User';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDatabase();
    const { id } = await params;
    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDatabase();
    const { id } = await params;
    const body = await request.json();
    const user = await User.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    });
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDatabase();
    const { id } = await params;
    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 }
    );
  }
}
`,
      },

      // ── lib/ ───────────────────────────────────────────────
      {
        path: path.join(dir, 'lib', 'logger.ts'),
        content: `import pino from 'pino';

export const logger = pino({
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty' }
    : undefined,
});
`,
      },
      {
        path: path.join(dir, 'lib', 'db.ts'),
        content: isPostgres
          ? `import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
}
`
          : `import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/myapp';

interface CachedConnection {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: CachedConnection | undefined;
}

const cached: CachedConnection = global.mongooseCache || { conn: null, promise: null };

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

export async function connectDatabase(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI);
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null;
    throw error;
  }

  return cached.conn;
}
`,
      },

      // ── Models (MongoDB only) ──────────────────────────────
      ...(isPostgres
        ? []
        : [
            {
              path: path.join(dir, 'lib', 'models', 'User.ts'),
              content: `import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\\S+@\\S+\\.\\S+$/, 'Please provide a valid email'],
    },
  },
  {
    timestamps: true,
  }
);

export const User = mongoose.model<IUser>('User', userSchema);
`,
            },
          ]),

      // ── Validators ────────────────────────────────────────
      {
        path: path.join(dir, 'lib', 'validators', 'user.ts'),
        content: `export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export function validateCreateUser(data: Record<string, unknown>): ValidationResult {
  const errors: Record<string, string> = {};

  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
    errors.name = 'Name is required';
  } else if (data.name.trim().length < 2) {
    errors.name = 'Name must be at least 2 characters';
  } else if (data.name.trim().length > 100) {
    errors.name = 'Name cannot exceed 100 characters';
  }

  if (!data.email || typeof data.email !== 'string' || !data.email.trim()) {
    errors.email = 'Email is required';
  } else if (!/^\\S+@\\S+\\.\\S+$/.test(data.email as string)) {
    errors.email = 'Please provide a valid email';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
`,
      },
    ];

    // Add extra files from selected packages
    const { files: extraFiles } = applyExtras(this.options, dir);
    files.push(...extraFiles);

    return files;
  }
}

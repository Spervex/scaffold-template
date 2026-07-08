import path from 'node:path';
import type { CliOptions, ExtraPackage, FileDefinition } from '../types.js';

// ── Default packages (always included per project type) ──

export const DEFAULT_DEPS = {
  ALL: {
    zod: '^4.0.1',
    pino: '^10.1.0',
  },
  BACKEND: {
    dotenv: '^16.4.7',
    'pino-http': '^10.0.0',
  },
} as const;

export const DEFAULT_DEV_DEPS = {
  ALL: {},
  BACKEND: {
    'pino-pretty': '^10.0.0',
  },
} as const;

// ── Extra category system ──

export type ExtraCategory = 'backend' | 'frontend' | 'infra';

export type ExtraMeta = {
  category: ExtraCategory;
  label: string;
  hint: string;
  defaultSelected: boolean;
};

// ── Extra config map ──

export const EXTRA_CONFIG: Record<ExtraPackage, {
  deps: Record<string, string>;
  devDeps: Record<string, string>;
  meta: ExtraMeta;
  files: (options: CliOptions, baseDir: string) => FileDefinition[];
}> = {
  // ── Backend Features ──
  auth: {
    deps: { argon2: '^0.41.0', jsonwebtoken: '^9.0.2' },
    devDeps: { '@types/jsonwebtoken': '^9.0.7' },
    meta: { category: 'backend', label: 'Auth', hint: 'argon2 + jsonwebtoken', defaultSelected: true },
    files: () => [],
  },
  compression: {
    deps: { compression: '^1.7.5' },
    devDeps: { '@types/compression': '^1.7.5' },
    meta: { category: 'backend', label: 'Compression', hint: 'Gzip response compression', defaultSelected: false },
    files: () => [],
  },
  'rate-limit': {
    deps: { 'express-rate-limit': '^8.5.2' },
    devDeps: {},
    meta: { category: 'backend', label: 'Rate Limiting', hint: 'express-rate-limit', defaultSelected: false },
    files: () => [],
  },
  email: {
    deps: { nodemailer: '^6.10.0' },
    devDeps: { '@types/nodemailer': '^6.4.17' },
    meta: { category: 'backend', label: 'Email', hint: 'nodemailer — send emails', defaultSelected: false },
    files: () => [],
  },
  swagger: {
    deps: { 'swagger-ui-express': '^5.0.1', 'swagger-jsdoc': '^6.2.8' },
    devDeps: { '@types/swagger-ui-express': '^4.1.7', '@types/swagger-jsdoc': '^6.0.4' },
    meta: { category: 'backend', label: 'Swagger API Docs', hint: 'swagger-ui-express + swagger-jsdoc', defaultSelected: false },
    files: () => [],
  },

  // ── Frontend Features ──
  zustand: {
    deps: { zustand: '^5.0.0' },
    devDeps: {},
    meta: { category: 'frontend', label: 'Zustand', hint: 'Lightweight state management', defaultSelected: true },
    files: () => [],
  },
  tailwindcss: {
    deps: {},
    devDeps: { tailwindcss: '^4.0.0', postcss: '^8.5.0', autoprefixer: '^10.4.20' },
    meta: { category: 'frontend', label: 'Tailwind CSS', hint: 'Utility-first CSS framework', defaultSelected: true },
    files: (options: CliOptions, baseDir: string) => {
      const isVite = options.frontendFramework === 'vite' || options.projectType === 'fullstack-vite';
      if (isVite) {
        return [
          { path: path.join(baseDir, 'tailwind.config.ts'), content: `import type { Config } from 'tailwindcss';\n\nexport default {\n  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],\n  theme: { extend: {} },\n  plugins: [],\n} satisfies Config;\n` },
          { path: path.join(baseDir, 'postcss.config.js'), content: `export default {\n  plugins: {\n    tailwindcss: {},\n    autoprefixer: {},\n  },\n};\n` },
          { path: path.join(baseDir, 'src', 'index.css'), content: '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n' },
        ];
      }
      return [
        { path: path.join(baseDir, 'tailwind.config.ts'), content: `import type { Config } from 'tailwindcss';\n\nexport default {\n  content: ['./app/**/*.{js,ts,jsx,tsx}', './src/**/*.{js,ts,jsx,tsx}'],\n  theme: { extend: {} },\n  plugins: [],\n} satisfies Config;\n` },
        { path: path.join(baseDir, 'postcss.config.js'), content: `export default {\n  plugins: {\n    tailwindcss: {},\n    autoprefixer: {},\n  },\n};\n` },
        { path: path.join(baseDir, 'app', 'globals.css'), content: '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n' },
      ];
    },
  },
  'tanstack-query': {
    deps: { '@tanstack/react-query': '^5.90.3', axios: '^1.7.9' },
    devDeps: {},
    meta: { category: 'frontend', label: 'TanStack Query + Axios', hint: 'Server state & data fetching', defaultSelected: false },
    files: () => [],
  },
  'react-router': {
    deps: { 'react-router-dom': '^7.4.0' },
    devDeps: {},
    meta: { category: 'frontend', label: 'React Router', hint: 'Client-side routing (Vite only)', defaultSelected: false },
    files: () => [],
  },
  shadcn: {
    deps: { 'class-variance-authority': '^0.7.1', clsx: '^2.1.1', 'tailwind-merge': '^3.0.0', 'lucide-react': '^0.460.0', '@radix-ui/react-slot': '^1.1.0' },
    devDeps: {},
    meta: { category: 'frontend', label: 'shadcn/ui', hint: 'Component library (via CLI)', defaultSelected: false },
    files: (options: CliOptions, baseDir: string) => [
      { path: path.join(baseDir, 'components.json'), content: JSON.stringify({ $schema: 'https://ui.shadcn.com/schema.json', style: 'default', rsc: options.frontendFramework === 'nextjs', tsx: true, tailwind: { config: 'tailwind.config.ts', css: options.frontendFramework === 'nextjs' ? 'app/globals.css' : 'src/index.css', baseColor: 'slate', cssVariables: true }, aliases: { components: '@/components', utils: '@/lib/utils' } }, null, 2) + '\n' },
      { path: path.join(baseDir, 'src', 'lib', 'utils.ts'), content: `import { type ClassValue, clsx } from 'clsx';\nimport { twMerge } from 'tailwind-merge';\n\nexport function cn(...inputs: ClassValue[]) {\n  return twMerge(clsx(inputs));\n}\n` },
    ],
  },
  'lucide-react': {
    deps: { 'lucide-react': '^0.460.0' },
    devDeps: {},
    meta: { category: 'frontend', label: 'Lucide React', hint: 'Icon library', defaultSelected: false },
    files: () => [],
  },
  'react-hot-toast': {
    deps: { 'react-hot-toast': '^2.5.0' },
    devDeps: {},
    meta: { category: 'frontend', label: 'React Hot Toast', hint: 'Toast notifications', defaultSelected: false },
    files: () => [],
  },
  motion: {
    deps: { motion: '^12.0.0' },
    devDeps: {},
    meta: { category: 'frontend', label: 'Motion', hint: 'Animations (formerly Framer Motion)', defaultSelected: false },
    files: () => [],
  },
  gsap: {
    deps: { gsap: '^3.12.0' },
    devDeps: {},
    meta: { category: 'frontend', label: 'GSAP', hint: 'Advanced animations', defaultSelected: false },
    files: () => [],
  },

  // ── Cross-cutting / Infra ──
  redis: {
    deps: { redis: '^4.6.0' },
    devDeps: {},
    meta: { category: 'infra', label: 'Redis', hint: 'Caching & pub/sub', defaultSelected: false },
    files: () => [],
  },
  slack: {
    deps: { '@slack/webhook': '^7.0.0' },
    devDeps: {},
    meta: { category: 'infra', label: 'Slack Webhook', hint: 'Deploy/monitor alerts', defaultSelected: false },
    files: (_options: CliOptions, baseDir: string) => [
      {
        path: path.join(baseDir, 'src', 'lib', 'notifications', 'slack.ts'),
        content: `import { IncomingWebhook } from '@slack/webhook';\n\nconst webhookUrl = process.env.SLACK_WEBHOOK_URL;\nlet webhook: IncomingWebhook | null = null;\nif (webhookUrl) {\n  webhook = new IncomingWebhook(webhookUrl);\n}\n\nexport async function sendSlackNotification(message: string, options?: { level?: 'info' | 'warn' | 'error' }): Promise<void> {\n  if (!webhook) {\n    console.warn('SLACK_WEBHOOK_URL not configured.');\n    return;\n  }\n  const emoji = options?.level === 'error' ? '🔴' : options?.level === 'warn' ? '🟡' : '🟢';\n  try {\n    await webhook.send({ text: \`\${emoji} \${message}\` });\n  } catch (error) {\n    console.error('Failed to send Slack notification:', error);\n  }\n}\n`,
      },
    ],
  },
  sentry: {
    deps: {},
    devDeps: {},
    meta: { category: 'infra', label: 'Sentry', hint: 'Error tracking & performance', defaultSelected: false },
    files: () => [],
  },
  opentelemetry: {
    deps: {
      '@opentelemetry/api': '^1.9.0',
      '@opentelemetry/sdk-node': '^0.220.0',
      '@opentelemetry/auto-instrumentations-node': '^0.78.0',
    },
    devDeps: {},
    meta: { category: 'infra', label: 'OpenTelemetry', hint: 'Traces, metrics & logs', defaultSelected: false },
    files: (_options: CliOptions, baseDir: string) => [
      {
        path: path.join(baseDir, 'src', 'instrumentation.ts'),
        content: `import { NodeSDK } from '@opentelemetry/sdk-node';\nimport { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';\n\nconst sdk = new NodeSDK({\n  instrumentations: [getNodeAutoInstrumentations()],\n});\n\nsdk.start();\n`,
      },
    ],
  },
  stripe: {
    deps: { stripe: '^17.6.0' },
    devDeps: {},
    meta: { category: 'infra', label: 'Stripe', hint: 'Payment processing', defaultSelected: false },
    files: (_options: CliOptions, baseDir: string) => [
      {
        path: path.join(baseDir, 'src', 'lib', 'stripe.ts'),
        content: `import Stripe from 'stripe';\n\nexport const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {\n  apiVersion: '2025-02-24.acacia',\n});\n`,
      },
    ],
  },
  'socket-io': {
    deps: {},
    devDeps: {},
    meta: { category: 'infra', label: 'Socket.IO', hint: 'Real-time bidirectional communication', defaultSelected: false },
    files: () => [],
  },
  vitest: {
    deps: {},
    devDeps: { vitest: '^2.1.0', '@vitest/coverage-v8': '^2.1.0' },
    meta: { category: 'infra', label: 'Vitest', hint: 'Unit testing framework', defaultSelected: false },
    files: (_options: CliOptions, baseDir: string) => [
      {
        path: path.join(baseDir, 'vitest.config.ts'),
        content: `import { defineConfig } from 'vitest/config';\n\nexport default defineConfig({\n  test: {\n    globals: true,\n    environment: 'node',\n    include: ['**/*.test.ts'],\n    coverage: {\n      provider: 'v8',\n      reporter: ['text', 'json', 'html'],\n    },\n  },\n});\n`,
      },
      {
        path: path.join(baseDir, 'src', 'example.test.ts'),
        content: `import { describe, it, expect } from 'vitest';\n\ndescribe('example', () => {\n  it('should pass', () => {\n    expect(1 + 1).toBe(2);\n  });\n});\n`,
      },
    ],
  },
  playwright: {
    deps: {},
    devDeps: { '@playwright/test': '^1.52.0' },
    meta: { category: 'infra', label: 'Playwright', hint: 'E2E browser testing', defaultSelected: false },
    files: (_options: CliOptions, baseDir: string) => [
      {
        path: path.join(baseDir, 'playwright.config.ts'),
        content: `import { defineConfig, devices } from '@playwright/test';\n\nexport default defineConfig({\n  testDir: './tests/e2e',\n  fullyParallel: true,\n  retries: 2,\n  use: {\n    baseURL: 'http://localhost:3000',\n  },\n  projects: [\n    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },\n  ],\n});\n`,
      },
    ],
  },
  prettier: {
    deps: {},
    devDeps: { prettier: '^3.4.0' },
    meta: { category: 'infra', label: 'Prettier', hint: 'Code formatter', defaultSelected: false },
    files: (_options: CliOptions, baseDir: string) => [
      {
        path: path.join(baseDir, '.prettierrc'),
        content: JSON.stringify({ semi: true, singleQuote: true, tabWidth: 2, trailingComma: 'es5', printWidth: 100, bracketSpacing: true, arrowParens: 'always', endOfLine: 'lf' }, null, 2) + '\n',
      },
    ],
  },
};

// ── Helpers ──

export type PackageJsonLike = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
};

export function applyExtras(options: CliOptions, baseDir: string): { files: FileDefinition[] } {
  const files: FileDefinition[] = [];
  for (const extra of options.extraPackages) {
    const config = EXTRA_CONFIG[extra];
    if (config?.files) {
      files.push(...config.files(options, baseDir));
    }
  }
  return { files };
}

export function mergeDeps(
  base: PackageJsonLike,
  options: CliOptions,
  isBackend: boolean,
): PackageJsonLike {
  const result: PackageJsonLike = {
    ...base,
    dependencies: { ...(base.dependencies || {}) },
    devDependencies: { ...(base.devDependencies || {}) },
  };

  // Apply ALL defaults (zod + pino everywhere)
  for (const [pkg, version] of Object.entries(DEFAULT_DEPS.ALL)) {
    (result.dependencies as Record<string, string>)[pkg] = version as string;
  }
  for (const [pkg, version] of Object.entries(DEFAULT_DEV_DEPS.ALL)) {
    (result.devDependencies as Record<string, string>)[pkg] = version as string;
  }

  // Apply backend-only defaults
  if (isBackend) {
    for (const [pkg, version] of Object.entries(DEFAULT_DEPS.BACKEND)) {
      (result.dependencies as Record<string, string>)[pkg] = version as string;
    }
    for (const [pkg, version] of Object.entries(DEFAULT_DEV_DEPS.BACKEND)) {
      (result.devDependencies as Record<string, string>)[pkg] = version as string;
    }
  }

  // Apply extras from EXTRA_CONFIG
  for (const extra of options.extraPackages) {
    const config = EXTRA_CONFIG[extra];
    if (!config) continue;
    for (const [pkg, version] of Object.entries(config.deps)) {
      (result.dependencies as Record<string, string>)[pkg] = version;
    }
    for (const [pkg, version] of Object.entries(config.devDeps)) {
      (result.devDependencies as Record<string, string>)[pkg] = version;
    }
  }

  return result;
}

export const ALL_EXTRAS: ExtraPackage[] = [
  'auth', 'compression', 'rate-limit', 'email', 'swagger',
  'zustand', 'tailwindcss', 'tanstack-query', 'react-router',
  'shadcn', 'lucide-react', 'react-hot-toast', 'motion', 'gsap',
  'redis', 'slack', 'sentry', 'opentelemetry', 'stripe',
  'socket-io', 'vitest', 'playwright', 'prettier',
];

export function getExtrasByCategory(options: CliOptions): { backend: ExtraPackage[]; frontend: ExtraPackage[]; infra: ExtraPackage[] } {
  const result = { backend: [] as ExtraPackage[], frontend: [] as ExtraPackage[], infra: [] as ExtraPackage[] };
  for (const extra of options.extraPackages) {
    const config = EXTRA_CONFIG[extra];
    if (config?.meta.category === 'backend') result.backend.push(extra);
    else if (config?.meta.category === 'frontend') result.frontend.push(extra);
    else result.infra.push(extra);
  }
  return result;
}

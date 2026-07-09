// ── Shared tsconfigs ──

export const TSCONFIG_NODE = {
  compilerOptions: {
    target: 'ES2022',
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    outDir: './dist',
    rootDir: './src',
    strict: true,
    esModuleInterop: true,
    sourceMap: true,
    declaration: true,
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true,
    resolveJsonModule: true,
  },
  include: ['src/**/*'],
  exclude: ['node_modules', 'dist'],
} as const;

export const TSCONFIG_NEXTJS = {
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
} as const;

export const VITE_TS_CONFIG_ROOT = {
  files: [],
  references: [{ path: './tsconfig.app.json' }, { path: './tsconfig.node.json' }],
} as const;

export const VITE_TS_CONFIG_APP = {
  compilerOptions: {
    target: 'ES2020',
    useDefineForClassFields: true,
    lib: ['ES2020', 'DOM', 'DOM.Iterable'],
    module: 'ESNext',
    skipLibCheck: true,
    moduleResolution: 'bundler',
    allowImportingTsExtensions: true,
    isolatedModules: true,
    moduleDetection: 'force',
    noEmit: true,
    jsx: 'react-jsx',
    strict: true,
    noUnusedLocals: true,
    noUnusedParameters: true,
    noFallthroughCasesInSwitch: true,
    forceConsistentCasingInFileNames: true,
    baseUrl: '.',
    paths: {
      '@/*': ['src/*'],
    },
  },
  include: ['src'],
} as const;

export const VITE_TS_CONFIG_NODE = {
  compilerOptions: {
    target: 'ES2022',
    lib: ['ES2023'],
    module: 'ESNext',
    skipLibCheck: true,
    moduleResolution: 'bundler',
    allowImportingTsExtensions: true,
    isolatedModules: true,
    moduleDetection: 'force',
    noEmit: true,
    strict: true,
    noUnusedLocals: true,
    noUnusedParameters: true,
  },
  include: ['vite.config.ts'],
} as const;

// ── Shared .gitignore content ──

export const GITIGNORE_DEFAULT = `node_modules
dist
.env
.env.local
*.log
*.tsbuildinfo
`;

export const GITIGNORE_NEXTJS = `# dependencies
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
`;

export const GITIGNORE_ROOT = `node_modules
dist
.env
.env.local
*.log
*.tsbuildinfo
.pnpm-store
.next
out
`;

// ── Shared .env.example content ──

export const ENV_BASIC = `NODE_ENV=development
LOG_LEVEL=info
`;

export function envDatabaseMongo(name: string): string {
  return `PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/${name}
CORS_ORIGIN=http://localhost:5173
`;
}

export function envDatabasePostgres(name: string): string {
  return `PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/${name}
CORS_ORIGIN=http://localhost:5173
`;
}

export function envNextjsMongo(): string {
  return `NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/myapp
`;
}

export function envNextjsPostgres(): string {
  return `NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/myapp
`;
}

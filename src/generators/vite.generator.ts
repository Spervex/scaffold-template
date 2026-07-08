import path from 'node:path';
import { BaseGenerator } from './base.generator.js';
import { type CliOptions, type FileDefinition, type GeneratorResult } from '../types.js';
import { logger } from '../utils/logger.js';
import { mergeDeps, applyExtras } from '../shared/packages.js';

function getVitePackageJson(options: CliOptions): Record<string, unknown> {
  const base = {
    name: 'client',
    private: true,
    version: '0.0.0',
    type: 'module',
    scripts: {
      dev: 'vite',
      build: 'tsc -b && vite build',
      preview: 'vite preview',
      lint: 'eslint .',
    },
    dependencies: {
      react: '^19.2.7',
      'react-dom': '^19.2.7',
    },
    devDependencies: {
      '@types/react': '^19.2.17',
      '@types/react-dom': '^19.2.3',
      '@vitejs/plugin-react': '^6.0.3',
      eslint: '^9.0.0',
      typescript: '~6.0.2',
      vite: '^8.1.1',
      '@types/node': '^24.13.2',
    },
  };
  return mergeDeps(base, options, false) as Record<string, unknown>;
}

const VITE_TS_CONFIG_ROOT = {
  files: [],
  references: [
    { path: './tsconfig.app.json' },
    { path: './tsconfig.node.json' },
  ],
};

const VITE_TS_CONFIG_APP = {
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
};

const VITE_TS_CONFIG_NODE = {
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
    noFallthroughCasesInSwitch: true,
  },
  include: ['vite.config.ts'],
};

export class ViteGenerator extends BaseGenerator {
  async generate(): Promise<GeneratorResult> {
    logger.step('Generating Vite + React + TypeScript project...');

    const dir = this.resolvePath(this.options.frontendDirName);
    const files: FileDefinition[] = this.getFiles(dir);

    await this.writeFiles(files);

    logger.success(`Vite project created in ${dir}`);
    return { filesCreated: files.length, dir };
  }

  private getFiles(dir: string): FileDefinition[] {
    const files: FileDefinition[] = [
      {
        path: path.join(dir, 'package.json'),
        content: this.formatJson(getVitePackageJson(this.options)),
      },
      {
        path: path.join(dir, 'tsconfig.json'),
        content: this.formatJson(VITE_TS_CONFIG_ROOT),
      },
      {
        path: path.join(dir, 'tsconfig.app.json'),
        content: this.formatJson(VITE_TS_CONFIG_APP),
      },
      {
        path: path.join(dir, 'tsconfig.node.json'),
        content: this.formatJson(VITE_TS_CONFIG_NODE),
      },
      {
        path: path.join(dir, 'vite.config.ts'),
        content: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
`,
      },
      {
        path: path.join(dir, 'index.html'),
        content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vite + React + TS</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
      },
      {
        path: path.join(dir, 'src', 'main.tsx'),
        content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
`,
      },
      {
        path: path.join(dir, 'src', 'App.tsx'),
        content: `import { useState } from 'react';
import './App.css';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Vite + React + TypeScript</h1>
        <p className="subtitle">Scaffolded with create-scaffold</p>
      </header>
      <main className="app-main">
        <div className="card">
          <button onClick={() => setCount((c) => c + 1)}>
            Count is {count}
          </button>
          <p>
            Edit <code>src/App.tsx</code> and save to test HMR
          </p>
        </div>
      </main>
      <footer className="app-footer">
        <p>Powered by Vite</p>
      </footer>
    </div>
  );
}

export default App;
`,
      },
      {
        path: path.join(dir, 'src', 'App.css'),
        content: `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  text-align: center;
  padding: 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.app-header h1 {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
}

.subtitle {
  font-size: 1.1rem;
  opacity: 0.9;
}

.app-main {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 2rem;
}

.card {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.card button {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  border-radius: 8px;
  border: none;
  background: #667eea;
  color: white;
  cursor: pointer;
  transition: background 0.2s;
}

.card button:hover {
  background: #5a6fd6;
}

.app-footer {
  text-align: center;
  padding: 1rem;
  color: #666;
  border-top: 1px solid #eee;
}

@media (prefers-color-scheme: dark) {
  body {
    background: #1a1a2e;
    color: #e0e0e0;
  }

  .card {
    background: #16213e;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
  }

  .app-footer {
    border-top-color: #333;
    color: #999;
  }
}
`,
      },
      {
        path: path.join(dir, 'src', 'index.css'),
        content: `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
    Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  line-height: 1.5;
  font-weight: 400;
  color-scheme: light dark;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
}

#root {
  width: 100%;
}
`,
      },
      {
        path: path.join(dir, 'src', 'vite-env.d.ts'),
        content: `/// <reference types="vite/client" />
`,
      },
      {
        path: path.join(dir, 'public', 'vite.svg'),
        content: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img" class="iconify iconify--logos" width="31.88" height="32" preserveAspectRatio="xMidYMid meet" viewBox="0 0 256 257"><defs><linearGradient id="IconifyId1813088fe1fbc01fb466" x1="-.828%" x2="57.636%" y1="7.652%" y2="78.411%"><stop offset="0%" stop-color="#41D1FF"></stop><stop offset="100%" stop-color="#BD34FE"></stop></linearGradient><linearGradient id="IconifyId1813088fe1fbc01fb467" x1="43.376%" x2="50.316%" y1="2.242%" y2="89.03%"><stop offset="0%" stop-color="#FFBD4F"></stop><stop offset="100%" stop-color="#FF9640"></stop></linearGradient></defs><path fill="url(#IconifyId1813088fe1fbc01fb466)" d="M255.153 37.938L134.897 252.976c-2.483 4.44-8.862 4.466-11.382.048L.875 37.958c-2.746-4.814 1.371-10.646 6.827-9.67l120.385 21.517a6.537 6.537 0 0 0 2.322-.004l117.867-21.483c5.438-.991 9.574 4.796 6.877 9.62Z"></path><path fill="url(#IconifyId1813088fe1fbc01fb467)" d="M185.432.063L96.44 17.501a3.268 3.268 0 0 0-2.634 3.014l-5.474 92.456a3.268 3.268 0 0 0 3.997 3.378l24.777-5.718c2.318-.535 4.413 1.507 3.936 3.838l-7.361 36.047c-.495 2.426 1.782 4.5 4.151 3.78l15.304-4.649c2.372-.72 4.652 1.36 4.15 3.788l-11.698 56.621c-.732 3.542 3.979 5.473 5.943 2.437l1.313-2.028l72.516-144.72c1.215-2.423-.88-5.186-3.54-4.672l-25.505 4.922c-2.396.462-4.435-1.77-3.759-4.114l16.646-57.705c.677-2.35-1.37-4.583-3.769-4.113Z"></path></svg>
`,
      },
      {
        path: path.join(dir, '.gitignore'),
        content: `node_modules
dist
.env
.env.local
*.tsbuildinfo
`,
      },
      {
        path: path.join(dir, 'README.md'),
        content: `# Vite + React + TypeScript

This project was scaffolded with \`create-scaffold\`.

## Getting Started

\`\`\`bash
pnpm install
pnpm dev
\`\`\`

## Scripts

| Command | Description |
|---------|-------------|
| \`pnpm dev\` | Start development server |
| \`pnpm build\` | Build for production |
| \`pnpm preview\` | Preview production build |
| \`pnpm lint\` | Lint source files |
`,
      },
      {
        path: path.join(dir, 'src', 'pages', '.gitkeep'),
        content: '',
      },
      {
        path: path.join(dir, 'src', 'components', '.gitkeep'),
        content: '',
      },
      {
        path: path.join(dir, 'src', 'hooks', '.gitkeep'),
        content: '',
      },
      {
        path: path.join(dir, 'src', 'lib', '.gitkeep'),
        content: '',
      },
    ];

    // Add extra files from selected packages
    const { files: extraFiles } = applyExtras(this.options, dir);
    files.push(...extraFiles);

    return files;
  }
}

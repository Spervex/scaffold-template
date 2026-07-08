# create-scaffold-cli

> **CLI sub-project** — This directory contains the self-contained CLI tool.
> All commands should be run from within the `cli/` directory.
> For the root template repository, see the [root README](../README.md).

A CLI tool for scaffolding full-stack projects with Vite/Next.js frontend and MERN backend.

## Features

- **Vite + React + TypeScript** — Modern frontend with fast HMR
- **Next.js + TypeScript** — Server-side rendering and static generation
- **MERN Backend** — Express + MongoDB + TypeScript with CRUD API
- **Fullstack** — Combine frontend and backend in a single project
- **Interactive prompts** — Guided project setup
- **Zero prompts mode** — Use `--yes` for automated setup

## Installation

```bash
# Clone the repository
git clone <repo-url> create-scaffold
cd create-scaffold/cli

# Install dependencies
pnpm install

# Link globally (optional)
npm link
```

## Usage

All commands should be run from within the `cli/` directory.

```bash
# Interactive mode
pnpm dev create my-project

# Non-interactive mode
pnpm dev create my-project --yes --type fullstack --frontend vite
```

### CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `-t, --type <type>` | Project type: `frontend`, `backend`, `fullstack`, `system` | `fullstack` |
| `-f, --frontend <framework>` | Frontend framework: `vite`, `nextjs` | `vite` |
| `--frontend-dir <dir>` | Frontend directory: `client`, `frontend` | `client` |
| `--backend-dir <dir>` | Backend directory: `server`, `backend` | `server` |
| `--no-install` | Skip dependency installation | `false` |
| `--no-git` | Skip git initialization | `false` |
| `-p, --package-manager <pm>` | Package manager: `pnpm`, `npm` | `pnpm` |
| `-y, --yes` | Skip all prompts (uses defaults) | `false` |

### Examples

Create a fullstack project with Vite frontend and MERN backend:

```bash
pnpm dev create my-app --yes --type fullstack --frontend vite
```

Create a Next.js project only:

```bash
pnpm dev create my-app --yes --type frontend --frontend nextjs
```

Create a MERN backend only:

```bash
pnpm dev create my-api --yes --type backend
```

## Project Structure (Fullstack)

```
my-project/
├── client/                  # Vite/Next.js frontend
│   ├── src/
│   ├── package.json
│   └── tsconfig.json
├── server/                  # MERN backend
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   └── types/
│   ├── package.json
│   └── tsconfig.json
├── package.json             # Root workspace config (pnpm only)
└── pnpm-workspace.yaml      # Workspace config (pnpm only)
```

## Development (from within cli/)

```bash
pnpm run dev        # Run CLI in development mode
pnpm run build      # Build for production
pnpm run typecheck  # Type check
pnpm run lint       # Lint
pnpm test           # Run tests
```

## License

This project is licensed under the **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International** license.

You are free to use, modify, and share this software for non-commercial purposes, provided you give credit to the original author (Spervex). Commercial use requires prior written permission.

See the [LICENSE](LICENSE) file for details.

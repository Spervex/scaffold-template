import path from 'node:path';
import { BaseGenerator } from './base.generator.js';
import { type CliOptions, type FileDefinition } from '../types.js';
import { mergeDeps, addDatabaseDeps } from '../shared/packages.js';
import {
  TSCONFIG_NODE,
  GITIGNORE_DEFAULT,
  envDatabaseMongo,
  envDatabasePostgres,
} from '../shared/configs.js';
import { pinoLoggerFile, prismaClientFile, prismaSchemaFile } from '../shared/file-snippets.js';

function getMernPackageJson(options: CliOptions): Record<string, unknown> {
  const base: Record<string, unknown> = {
    name: 'server',
    version: '1.0.0',
    description: 'Backend API',
    type: 'module',
    scripts: {
      dev: 'tsx watch src/index.ts',
      build: 'tsc',
      start: 'node dist/index.js',
      typecheck: 'tsc --noEmit',
    },
    dependencies: {
      express: '^4.21.2',
      cors: '^2.8.5',
      helmet: '^8.0.0',
      'express-validator': '^7.0.0',
    },
    devDependencies: {
      typescript: '~6.0.2',
      tsx: '^4.19.0',
      '@types/express': '^4.17.21',
      '@types/cors': '^2.8.17',
      '@types/node': '^24.13.2',
    },
  };

  // Add database-specific dependencies
  addDatabaseDeps(
    base as unknown as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
      scripts: Record<string, string>;
    },
    options.database
  );

  return mergeDeps(base, options, true) as Record<string, unknown>;
}

export class MernGenerator extends BaseGenerator {
  protected getStepLabel(): string {
    const dbLabel = this.options.database === 'postgresql' ? 'PostgreSQL' : 'MongoDB';
    return `Generating backend project (Express + ${dbLabel})...`;
  }

  protected getTargetDir(): string {
    return this.resolvePath(this.options.backendDirName);
  }

  protected getSuccessMessage(dir: string): string {
    return `Backend created in ${dir}`;
  }

  protected buildFiles(dir: string): FileDefinition[] {
    const isPostgres = this.options.database === 'postgresql';
    const files: FileDefinition[] = [
      // ── Root config files ──────────────────────────────────
      {
        path: path.join(dir, 'package.json'),
        content: this.formatJson(getMernPackageJson(this.options)),
      },
      {
        path: path.join(dir, 'tsconfig.json'),
        content: this.formatJson(TSCONFIG_NODE),
      },
      {
        path: path.join(dir, '.env.example'),
        content: isPostgres
          ? envDatabasePostgres(this.options.projectName)
          : envDatabaseMongo(this.options.projectName),
      },
      {
        path: path.join(dir, '.gitignore'),
        content: GITIGNORE_DEFAULT,
      },
      {
        path: path.join(dir, 'README.md'),
        content: `# Backend API

This project was scaffolded with \`create-scaffold\`.

## Getting Started

1. Copy \`.env.example\` to \`.env\` and configure your environment variables.
2. Install dependencies:

\`\`\`bash
pnpm install
\`\`\`

3. Start the development server:

\`\`\`bash
pnpm dev
\`\`\`

## Scripts

| Command | Description |
|---------|-------------|
| \`pnpm dev\` | Start development server with hot reload |
| \`pnpm build\` | Build for production |
| \`pnpm start\` | Start production server |
| \`pnpm typecheck\` | Run TypeScript type checking |
${isPostgres ? '| `pnpm db:push` | Push schema changes to database |\n| `pnpm db:generate` | Generate Prisma client |' : ''}
## API Endpoints

- \`GET /api/health\` - Health check
- \`GET /api/users\` - Get all users
- \`GET /api/users/:id\` - Get user by ID
- \`POST /api/users\` - Create a new user
- \`PUT /api/users/:id\` - Update a user
- \`DELETE /api/users/:id\` - Delete a user
`,
      },

      // ── prisma/ (PostgreSQL only) ─────────────────────────
      ...(isPostgres
        ? [
            {
              path: path.join(dir, 'prisma', 'schema.prisma'),
              content: prismaSchemaFile(),
            },
          ]
        : []),

      // ── Database config ──────────────────────────────────
      {
        path: path.join(dir, 'src', 'config', 'database.ts'),
        content: isPostgres
          ? prismaClientFile()
          : `import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from './logger.js';

export async function connectDatabase(): Promise<void> {
  try {
    mongoose.set('strictQuery', true);

    const conn = await mongoose.connect(env.MONGODB_URI);
    logger.info(\`MongoDB connected: \${conn.connection.host}\`);

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });
  } catch (error) {
    logger.error('MongoDB connection failed:', error);
    process.exit(1);
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected gracefully');
}
`,
      },

      // ── Environment config ────────────────────────────────
      {
        path: path.join(dir, 'src', 'config', 'env.ts'),
        content: isPostgres
          ? `import 'dotenv/config';

export const env = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/myapp',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
} as const;

export function validateEnv(): void {
  const required = ['DATABASE_URL'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(\`Missing required environment variables: \${missing.join(', ')}\`);
  }
}
`
          : `import 'dotenv/config';

export const env = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/myapp',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
} as const;

export function validateEnv(): void {
  const required = ['MONGODB_URI'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(\`Missing required environment variables: \${missing.join(', ')}\`);
  }
}
`,
      },

      // ── Logger ────────────────────────────────────────────
      {
        path: path.join(dir, 'src', 'config', 'logger.ts'),
        content: pinoLoggerFile(),
      },

      // ── Models (MongoDB only) ──────────────────────────────
      ...(isPostgres
        ? []
        : [
            {
              path: path.join(dir, 'src', 'models', 'User.ts'),
              content: `import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
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
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
    },
  },
  {
    timestamps: true,
  },
);

export const User = mongoose.model<IUser>('User', userSchema);
`,
            },
          ]),

      // ── Services ──────────────────────────────────────────
      {
        path: path.join(dir, 'src', 'services', 'user.service.ts'),
        content: isPostgres
          ? `import { prisma } from '../config/database.js';

export class UserService {
  async findAll() {
    return prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  }

  async create(data: { name: string; email: string }) {
    return prisma.user.create({ data });
  }

  async update(id: string, data: { name?: string; email?: string }) {
    return prisma.user.update({ where: { id }, data });
  }

  async delete(id: string) {
    return prisma.user.delete({ where: { id } });
  }
}
`
          : `import { User } from '../models/User.js';
import type { IUser } from '../models/User.js';

export class UserService {
  async findAll(): Promise<IUser[]> {
    return User.find().sort({ createdAt: -1 });
  }

  async findById(id: string): Promise<IUser | null> {
    return User.findById(id);
  }

  async create(data: Partial<IUser>): Promise<IUser> {
    return User.create(data);
  }

  async update(id: string, data: Partial<IUser>): Promise<IUser | null> {
    return User.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  }

  async delete(id: string): Promise<IUser | null> {
    return User.findByIdAndDelete(id);
  }
}
`,
      },

      // ── Controllers ───────────────────────────────────────
      {
        path: path.join(dir, 'src', 'controllers', 'user.controller.ts'),
        content: `import type { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { UserService } from '../services/user.service.js';

const userService = new UserService();

export const getUsers = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const users = await userService.findAll();
    res.json({ success: true, count: users.length, data: users });
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = await userService.findById(req.params.id);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

export const createUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }
    const user = await userService.create(req.body);
    res.status(201).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }
    const user = await userService.update(req.params.id, req.body);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = await userService.delete(req.params.id);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
};
`,
      },

      // ── Routes ────────────────────────────────────────────
      {
        path: path.join(dir, 'src', 'routes', 'index.ts'),
        content: `import { Router } from 'express';
import userRoutes from './user.routes.js';

const router = Router();

router.use('/users', userRoutes);

export default router;
`,
      },
      {
        path: path.join(dir, 'src', 'routes', 'user.routes.ts'),
        content: `import { Router } from 'express';
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} from '../controllers/user.controller.js';
import { createUserValidation, updateUserValidation } from '../validators/user.validator.js';

const router = Router();

router.get('/', getUsers);
router.get('/:id', getUserById);
router.post('/', createUserValidation, createUser);
router.put('/:id', updateUserValidation, updateUser);
router.delete('/:id', deleteUser);

export default router;
`,
      },

      // ── Validators ────────────────────────────────────────
      {
        path: path.join(dir, 'src', 'validators', 'user.validator.ts'),
        content: `import { body } from 'express-validator';

export const createUserValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
];

export const updateUserValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
];
`,
      },

      // ── Middleware ─────────────────────────────────────────
      {
        path: path.join(dir, 'src', 'middleware', 'errorHandler.ts'),
        content: `import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';

interface AppError extends Error {
  statusCode?: number;
  code?: string;
  errors?: Record<string, { message: string }>;
}

export const errorHandler = (
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Mongoose validation error
  if (err.name === 'ValidationError' && err.errors) {
    statusCode = 400;
    const messages = Object.values(err.errors).map((e) => e.message);
    message = messages.join(', ');
  }

  // Mongoose duplicate key error
  if ((err as Record<string, unknown>).code === 11000) {
    statusCode = 400;
    message = 'Duplicate field value';
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Resource not found';
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
`,
      },

      // ── Express app ────────────────────────────────────────
      {
        path: path.join(dir, 'src', 'app.ts'),
        content: `import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createServer() {
  const app = express();

  // Middleware
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(pinoHttp({ logger }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Routes
  app.use('/api', routes);

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
`,
      },

      // ── Entry point ────────────────────────────────────────
      {
        path: path.join(dir, 'src', 'index.ts'),
        content: `import 'dotenv/config';
import { createServer } from './app.js';
import { connectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';

const start = async (): Promise<void> => {
  try {
    await connectDatabase();
    const app = createServer();
    app.listen(env.PORT, () => {
      logger.info(\`Server running on port \${env.PORT} in \${env.NODE_ENV} mode\`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

start();
`,
      },

      // ── Types ──────────────────────────────────────────────
      {
        path: path.join(dir, 'src', 'types', 'index.ts'),
        content: `export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  count?: number;
  error?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
}
`,
      },
    ];

    return files;
  }
}

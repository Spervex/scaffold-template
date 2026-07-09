import path from 'node:path';

export class PathTraversalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PathTraversalError';
  }
}

/**
 * Asserts that `childPath` is a subdirectory (or equal to) `parentPath`.
 * Throws PathTraversalError if the child path escapes the parent.
 * Both paths are resolved to absolute paths before comparison.
 *
 * @example
 * assertSubpath('/safe/dir', '/safe/dir/project')  // OK
 * assertSubpath('/safe/dir', '/safe/dir')           // OK (equal)
 * assertSubpath('/safe/dir', '/etc/passwd')         // throws
 */
export function assertSubpath(parentPath: string, childPath: string): void {
  const resolvedParent = path.resolve(parentPath);
  const resolvedChild = path.resolve(childPath);

  const prefix = resolvedParent + path.sep;
  if (resolvedChild !== resolvedParent && !resolvedChild.startsWith(prefix)) {
    throw new PathTraversalError(
      `Path "${childPath}" resolves to "${resolvedChild}" which is outside the allowed directory "${resolvedParent}".`
    );
  }
}

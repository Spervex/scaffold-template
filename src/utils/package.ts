export function formatPackageJson(data: Record<string, unknown>): string {
  return JSON.stringify(data, null, 2) + '\n';
}

export function createPackageJson(
  name: string,
  dependencies: Record<string, string>,
  devDependencies: Record<string, string>,
  scripts: Record<string, string>
): string {
  return formatPackageJson({
    name,
    version: '0.0.0',
    private: true,
    type: 'module',
    scripts,
    dependencies,
    devDependencies,
  });
}

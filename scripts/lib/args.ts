/** Tiny flag parser shared by the scripts: `--name value` and bare `--flag`. */
export function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

export function opt(name: string, fallback: string): string;
export function opt(name: string): string | undefined;
export function opt(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  const v = i > 0 ? process.argv[i + 1] : undefined;
  return v === undefined || v.startsWith("--") ? fallback : v;
}

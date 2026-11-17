// Shell commands a script runs (`run('npm test')`): through the system's
// shell, in the project's folder, started by the host (hidden on Windows,
// tracked, so they end with the server however it ends), their output
// handed on in whole lines as it comes, and the whole process tree killed
// when the run is stopped.

import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { type Host, killTree } from '@hyperpane/sdk/server';

export interface Command {
  command: string;
  cwd: string;
  env?: Record<string, string>;
  project: string;
  signal: AbortSignal;
  /** Whole lines of its output (stdout and stderr as they come), several
   * at once, `\n` between them. */
  onLines?(text: string): void;
}

export interface Ran {
  /** Its exit code; null when it was killed. */
  code: number | null;
  /** All it wrote (the last megabyte of it). */
  output: string;
}

/** The output kept for `output`. */
const MAX_OUTPUT = 1024 * 1024;

// Colors and cursor moves, which a Log can't show; a carriage return's
// line is what's after it (a progress bar redrawing itself).
const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[()][A-Za-z0-9]/g;
export const plain = (line: string) => {
  const text = line.replace(ANSI, '');
  const cr = text.lastIndexOf('\r', text.length - 2);
  return (cr >= 0 ? text.slice(cr + 1) : text).replace(/\r$/, '');
};

/** The login shell's PATH (Homebrew's, a version manager's) before the
 * server's, which may be only the system's when the app started it from the
 * Dock: `run('node -v')` finds what a terminal would. Asked once. */
let loginPath: Promise<string | null> | null = null;
function pathOfLoginShell(): Promise<string | null> {
  if (process.platform === 'win32') return Promise.resolve(null);
  loginPath ??= new Promise((resolve) => {
    const shell = process.env.SHELL || '/bin/sh';
    execFile(shell, ['-lc', 'printf %s "$PATH"'], { timeout: 5000, encoding: 'utf8' }, (error, stdout) => resolve(error ? null : stdout.trim() || null));
  });
  return loginPath;
}

async function environment(extra: Record<string, string> | undefined): Promise<NodeJS.ProcessEnv> {
  const env: NodeJS.ProcessEnv = { ...process.env };
  const login = await pathOfLoginShell();
  if (login) env.PATH = [...new Set([...login.split(':'), ...(env.PATH ?? '').split(':')].filter(Boolean))].join(':');
  // Tools that color their output when they think a person reads it.
  env.NO_COLOR ??= '1';
  return { ...env, ...extra };
}

/** The shell and its arguments for a command line: sh -c, or cmd /d /s /c. */
export function shellFor(command: string, platform = process.platform): { file: string; args: string[]; verbatim: boolean } {
  if (platform === 'win32') return { file: process.env.ComSpec || 'cmd.exe', args: ['/d', '/s', '/c', `"${command}"`], verbatim: true };
  return { file: '/bin/sh', args: ['-c', command], verbatim: false };
}

/** A folder a command runs in: the project's, or one given from it. */
export function folderFor(projectFolder: string, cwd: unknown): string {
  if (typeof cwd !== 'string' || !cwd.trim()) return projectFolder;
  const given = cwd.trim().replace(/^~(?=$|[\\/])/, os.homedir());
  return path.resolve(projectFolder, given);
}

/** Runs a command and resolves when it has exited, killed or not; rejects
 * only when it couldn't start. */
export async function runCommand(host: Host, c: Command): Promise<Ran> {
  const env = await environment(c.env);
  if (c.signal.aborted) return { code: null, output: '' };
  const shell = shellFor(c.command);
  return new Promise<Ran>((resolve, reject) => {
    const child = host.spawn(shell.file, shell.args, {
      cwd: c.cwd,
      env,
      project: c.project,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsVerbatimArguments: shell.verbatim,
    });
    let output = '';
    const add = (lines: string) => {
      output += `${lines}\n`;
      if (output.length > MAX_OUTPUT) output = output.slice(-MAX_OUTPUT);
      c.onLines?.(lines);
    };
    // Each stream's unfinished last line, kept until its end comes (apart,
    // so stdout's and stderr's halves never join).
    const partial = { out: '', err: '' };
    const take = (which: 'out' | 'err') => (chunk: Buffer) => {
      const text = partial[which] + chunk.toString('utf8');
      const end = text.lastIndexOf('\n');
      if (end < 0) {
        partial[which] = text;
        return;
      }
      partial[which] = text.slice(end + 1);
      add(text.slice(0, end).split('\n').map(plain).join('\n'));
    };
    child.stdout?.on('data', take('out'));
    child.stderr?.on('data', take('err'));
    const kill = () => {
      if (child.pid) void killTree(child.pid).catch(() => child.kill('SIGKILL'));
      else child.kill('SIGKILL');
    };
    c.signal.addEventListener('abort', kill, { once: true });
    child.once('error', (e) => {
      c.signal.removeEventListener('abort', kill);
      reject(new Error(`Couldn’t run “${c.command}”: ${e.message}`));
    });
    child.once('close', (code) => {
      c.signal.removeEventListener('abort', kill);
      for (const rest of [partial.out, partial.err]) if (rest) add(plain(rest));
      resolve({ code: c.signal.aborted ? null : code, output });
    });
  });
}

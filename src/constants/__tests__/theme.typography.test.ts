import fs from 'node:fs';
import path from 'node:path';

import { FontSize } from '@/constants/theme';

const SRC_ROOT = path.resolve(__dirname, '../..');
/** Every screen, and every component a screen composes from. */
const UI_ROOTS = ['app', 'components'].map((dir) => path.join(SRC_ROOT, dir));
/** A raw number as a font size: a `fontSize` style, or a `*Size` prop such as `valueSize={18}`. */
const RAW_SIZE = /\b(?:fontSize\s*:\s*\d|\w*Size=\{\s*\d)/;

function tsxFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : tsxFiles(entryPath);
    return entry.name.endsWith('.tsx') ? [entryPath] : [];
  });
}

describe('Blueprint typography', () => {
  it('exposes exactly the five semantic sizes approved for V2.2', () => {
    expect(FontSize).toEqual({
      micro: 8,
      label: 12,
      body: 14,
      title: 21,
      display: 34,
    });
  });

  it('keeps raw numeric font sizes out of every screen and component', () => {
    const offenders = UI_ROOTS.flatMap(tsxFiles).flatMap((file) => {
      const source = fs.readFileSync(file, 'utf8');
      return source
        .split('\n')
        .map((line, index) => ({ line, lineNumber: index + 1 }))
        .filter(({ line }) => RAW_SIZE.test(line))
        .map(
          ({ line, lineNumber }) => `${path.relative(SRC_ROOT, file)}:${lineNumber}: ${line.trim()}`
        );
    });

    expect(offenders).toEqual([]);
  });
});

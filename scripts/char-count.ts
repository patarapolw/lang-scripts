import { readdirSync, readFileSync } from 'fs';

console.log(process.cwd());
process.chdir(
  '..\\..\\__packages__\\next\\markdown\\pages\\materials\\VN\\fatal-twelve',
);

let charCount = 0;
const lineMap = new Map<string, string[]>();

const files = readdirSync('.')
  .filter((f) => /^week-\d+\.md$/.exec(f))
  .sort()
  .slice(0);

const lastFile = files[files.length - 1];

files.map((f) => {
  const isLastFile = f === lastFile;

  const lines = readFileSync(f, 'utf-8').split('\n');

  let frontMatterState = lines[0] === '---' ? 0 : 2;

  let isComment = false;
  let isQuote = false;
  let dup: {
    lineNumbers: string[];
    ln: string;
    start: number;
    charCount: number;
  } | null = null;

  lines.map((ln, i) => {
    if (frontMatterState > 1) {
      if (['#'].includes(ln[0] || '#')) return;
      ln = ln.trim();

      if (ln.startsWith('<!--')) {
        isComment = true;
      }

      if (isComment && ln.endsWith('-->')) {
        isComment = false;
        return;
      }

      if (isComment) return;

      if (isQuote && ln === '</blockquote>') {
        isQuote = false;
        return;
      } else if (ln === '<blockquote>') {
        isQuote = true;
      }

      if (isQuote) return;

      const originalLine = ln;

      ln = ln.replace(/\!\[.*?\]\(.+?\)/g, '');
      ln = ln.replace(/<\/?[a-z]+>/gi, '');
      ln = ln.replace(/[\p{P}\p{Z}]/gu, '');

      if (!ln) return;

      const lineNumbers = lineMap.get(ln);
      lineMap.set(ln, [
        ...(lineNumbers || []),
        isLastFile ? `L${i + 1}` : `${f} (L${i + 1})`,
      ]);

      if (isLastFile) {
        if (lineNumbers) {
          if (!dup) {
            dup = {
              lineNumbers,
              ln: originalLine,
              start: i + 1,
              charCount: ln.length,
            };
          } else {
            dup.charCount += ln.length;
          }
        } else {
          if (dup) {
            if (dup.charCount > 10) {
              console.log(
                dup.charCount,
                `L${dup.start}` + (dup.start + 1 < i ? `-${i + 1}` : ''),
                dup.lineNumbers,
                dup.ln,
              );
            }
            dup = null;
          }

          charCount += ln.length;
        }
      }
    } else if (ln === '---') frontMatterState++;
  });
});

console.log(lastFile, charCount);

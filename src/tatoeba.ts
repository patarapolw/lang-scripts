import sqlite3 from 'better-sqlite3';
import { createReadStream } from 'fs';
import { join as joinPath } from 'path';
import readline from 'readline';
import * as wakachigaki from 'wakachigaki';
import jieba from 'wasmjieba-nodejs';

export class Tatoeba {
  db: sqlite3.Database;

  constructor(
    public dbpath = 'tmp/tatoeba.db',
    public assetsPath = 'assets/tatoeba',
  ) {
    this.db = sqlite3(dbpath);
    this.db.exec(/* sql */ `
      CREATE TABLE IF NOT EXISTS links (
        id1     INTEGER NOT NULL,
        id2     INTEGER NOT NULL,
        lang1   TEXT NOT NULL,
        lang2   TEXT NOT NULL CHECK (lang1 < lang2),
        PRIMARY KEY (id1, id2)
      );

      CREATE INDEX IF NOT EXISTS idx_links_lang ON links(lang1, lang2);

      CREATE VIRTUAL TABLE IF NOT EXISTS sentence USING fts5 (
        lang,
        full UNINDEXED,
        word
      );
    `);
  }

  async create() {
    await this.getSentences('eng');
    await this.getSentences('cmn');
    await this.getSentences('jpn');

    await this.getLinks();

    return this;
  }

  async getLinks() {
    const rl = readline.createInterface({
      // Fixed filename. Do not change.
      input: createReadStream(joinPath(this.assetsPath, 'links.csv')),
      terminal: false,
    });

    const idToLang = new Map<number, string>();

    this.db
      .prepare(
        /* sql */ `
    SELECT rowid, lang FROM sentence;
    `,
      )
      .all()
      .map((r: any) => {
        idToLang.set(r.rowid, r.lang);
      });

    const stack: any[] = [];
    const stackBatch = 1000;
    const stmt = this.db.prepare(/* sql */ `
      INSERT INTO links (id1, id2, lang1, lang2) VALUES (@id1, @id2, @lang1, @lang2)
      ON CONFLICT DO NOTHING
    `);
    const commitStack = this.db.transaction((ss: any[]) => {
      ss.map((s) => {
        const { id1, id2 } = s;
        const [lang1, lang2] = [idToLang.get(id1), idToLang.get(id2)];
        if (!lang1 || !lang2) return;
        if (lang1 < lang2) {
          stmt.run({ id1, id2, lang1, lang2 });
        }
      });
    });

    rl.on('line', (row) => {
      const [t1, t2] = row.split('\t', 2);
      if (!t1 || !t2) return;

      const [id1, id2] = [Number(t1), Number(t2)];
      if (!id1 || !id2) return;

      stack.push({ id1, id2 });
      if (stack.length > stackBatch) {
        commitStack(stack.splice(0, stackBatch));
      }
    });

    return new Promise((resolve) => {
      rl.once('close', () => {
        commitStack(stack);
        resolve(null);
      });
    });
  }

  async getSentences(lang: 'cmn' | 'jpn' | 'eng') {
    const rl = readline.createInterface({
      input: createReadStream(joinPath(this.assetsPath, `${lang}.tsv`)),
      terminal: false,
    });

    this.db.prepare(/* sql */ `DELETE FROM sentence WHERE lang = ?`).run(lang);

    const stack: any[] = [];
    const stackBatch = 1000;
    const stmt = this.db.prepare(/* sql */ `
          INSERT INTO sentence (rowid, lang, full, word) VALUES (@id, @lang, @full, @word);
        `);
    const commitStack = this.db.transaction((ss: any[]) => {
      ss.map((s) => stmt.run(s));
    });

    const reWord = /[\p{L}\p{N}]/g;

    rl.on('line', (row) => {
      const [idStr, lang, full = ''] = row.split('\t');
      const id = Number(idStr);

      if (!id) return;

      let word = full;
      switch (lang) {
        case 'cmn':
          word = jieba
            .cutForSearch(full, true)
            .filter((t) => reWord.test(t))
            .join(' ');
          break;
        case 'jpn':
          word = wakachigaki
            .tokenize(full)
            .filter((t) => reWord.test(t))
            .join(' ');
          break;
      }

      stack.push({ id, lang, full, word });
      if (stack.length > stackBatch) {
        commitStack(stack.splice(0, stackBatch));
      }
    });

    return new Promise((resolve) => {
      rl.once('close', () => {
        commitStack(stack);
        resolve(null);
      });
    });
  }
}

(async function main() {
  const t = new Tatoeba();
  await t.create();
})();

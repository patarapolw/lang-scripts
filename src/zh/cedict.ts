import sqlite3 from 'better-sqlite3';
import { createReadStream } from 'fs';
import readline from 'readline';

export class Cedict {
  public db: sqlite3.Database;

  constructor(public dbpath = 'tmp/mdbg.db') {
    this.db = sqlite3(dbpath);
    this.db.exec(/* sql */ `
    CREATE TABLE IF NOT EXISTS meta (
      "table"     TEXT NOT NULL PRIMARY KEY,
      updated_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mdbg (
      simplified    TEXT NOT NULL,
      traditional   TEXT,
      pinyin        TEXT NOT NULL,
      english       TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_mdbg_simplified ON mdbg (simplified);
    CREATE INDEX IF NOT EXISTS idx_mdbg_traditional ON mdbg (traditional);
    `);
  }

  async create(): Promise<this> {
    this.db.exec(/* sql */ `DELETE FROM mdbg;`);

    const batchSize = 100;
    const out: (string | null)[][] = [];

    const doCommit = () => {
      const stmt = this.db.prepare(/* sql */ `
      INSERT INTO mdbg (simplified, traditional, pinyin, english) VALUES (?, ?, ?, ?);
      `);

      while (out.length) {
        this.db.transaction((rs: any[]) => {
          rs.map((r) => {
            stmt.run(r);
          });
        })(out.splice(0, batchSize));
      }
    };

    const reCedict = new RegExp('^(.+?) (.+?) \\[(.+?)\\] /(.+)/$');

    const lineReader = readline.createInterface({
      input: createReadStream('assets/cedict_ts.u8'),
      terminal: false,
    });

    lineReader.on('line', (ln) => {
      if (ln[0] === '#') {
        const [, dateStr] = ln.split('#! date=');
        if (dateStr) {
          this.db
            .prepare(
              /* sql */ `
              INSERT OR REPLACE INTO meta ("table", updated_at) VALUES ('mdbg', ?)
              `,
            )
            .run(dateStr);
        }
        return;

        return;
      }
      const [, trad, simp, pinyin, gloss] = reCedict.exec(ln) || [];
      if (!gloss) return;

      out.push([
        simp,
        trad === simp ? null : trad,
        pinyin,
        gloss.replace(/\//g, '\n'),
      ]);

      if (out.length >= batchSize) {
        doCommit();
      }
    });

    await new Promise((resolve) => {
      lineReader.once('close', resolve);
    });

    doCommit();

    return this;
  }
}

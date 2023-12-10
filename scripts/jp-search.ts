import 'dotenv/config';

import fg from 'fast-glob';
import { readFileSync } from 'fs';
import { createInterface } from 'readline';

import { Tatoeba } from '@/tatoeba';
import createConnectionPool, { ConnectionPool, sql } from '@databases/pg';

async function create(db: ConnectionPool) {
  await db.query(sql.file('scripts/pg/sentence.sql'));
}

async function addTatoeba(db: ConnectionPool) {
  const t = new Tatoeba();

  await db.tx(async (db) => {
    const rs: any[] = t.db
      .prepare(/* sql */ `SELECT * FROM sentence WHERE lang = ?`)
      .all('jpn');

    while (rs.length) {
      await db.query(
        sql`INSERT INTO sentence ("tatoeba_id", "text") VALUES ${sql.join(
          rs.splice(0, 1000).map((r) => sql`(${r.id}, ${r.full})`),
          ',',
        )}`,
      );
    }
  });

  t.db.close();
}

async function addImKit(db: ConnectionPool) {
  const cwd = 'C:\\Users\\Hp\\Projects\\immersion-kit-api\\resources';
  for await (const f of fg.stream('**/data.ndjson', { cwd, absolute: true })) {
    const rows = readFileSync(f, 'utf-8')
      .trimEnd()
      .split('\n')
      .map((r, i) => {
        const d = JSON.parse(r);
        return { ...d, i };
      });

    while (rows.length) {
      await db.query(
        sql`INSERT INTO sentence ("text", "source", "line") VALUES ${sql.join(
          rows.splice(0, 10000).map((d) => {
            return sql`(${d.sentence}, ${`${d.id}`}, ${d.i})`;
          }),
          ',',
        )} ON CONFLICT ("source","line") DO NOTHING`,
      );
    }
  }
}

async function addSubtitle(db: ConnectionPool) {
  const reJa = /[\p{sc=Han}\p{sc=Katakana}\p{sc=Hiragana}]/u;

  const cwd = 'C:\\Users\\Hp\\Documents\\Subtitles';
  for await (const f of fg.stream('**/*.srt', { cwd, absolute: true })) {
    const filename = (f as string).split('/').pop();
    const rows = readFileSync(f, 'utf-8')
      .split('\n')
      .filter((s) => reJa.test(s))
      .map((s, i) => {
        return { s, i };
      });

    while (rows.length) {
      await db.query(
        sql`INSERT INTO sentence ("text", "source", "line") VALUES ${sql.join(
          rows.splice(0, 10000).map((d) => {
            return sql`(${d.s}, ${`${filename || f}`}, ${d.i})`;
          }),
          ',',
        )} ON CONFLICT ("source","line") DO NOTHING`,
      );
    }
  }
}

async function search(db: ConnectionPool) {
  console.log('Please enter a search query:');
  const rl = createInterface({
    input: process.stdin,
  });

  rl.on('line', async (s) => {
    if (!s) {
      rl.close();
      return;
    }

    const rs = await db.query(sql`
    SELECT DISTINCT ON ("text") * FROM sentence WHERE "text" &@~ ${s} LIMIT 5
    `);
    if (!rs.length) {
      console.log('Please enter a new query:');
    }

    for (const r of rs) {
      if (r.line && r.source) {
        const ts = await db.query(
          sql`SELECT * FROM sentence WHERE source = ${
            r.source
          } AND line BETWEEN ${r.line - 2} AND ${r.line + 2}`,
        );
        r.text = ts.map((t) => t.text);
      }
      console.log(r);
    }
  });

  return new Promise((resolve) => {
    rl.once('close', resolve);
  });
}

async function main() {
  const db = createConnectionPool({
    connectionString: process.env['POSTGRES_URI'],
    bigIntMode: 'number',
  });

  await search(db);

  await db.dispose();
}

if (require.main === module) {
  main();
}

import 'dotenv/config';

import fg from 'fast-glob';
import { readFileSync } from 'fs';

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
        sql`INSERT INTO sentence ("text", "source") VALUES ${sql.join(
          rows.splice(0, 10000).map((d) => {
            return sql`(${d.sentence}, ${`${d.id}(${d.i + 1})`})`;
          }),
          ',',
        )} ON CONFLICT ("source") DO NOTHING`,
      );
    }
  }
}

async function main() {
  const db = createConnectionPool({
    connectionString: process.env['POSTGRES_URI'],
    bigIntMode: 'number',
  });

  await addImKit(db);

  await db.dispose();
}

if (require.main === module) {
  main();
}

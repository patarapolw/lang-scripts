import 'dotenv/config';

import { Tatoeba } from '@/tatoeba';
import createConnectionPool, { sql } from '@databases/pg';

async function main() {
  const db = createConnectionPool({
    connectionString: process.env['POSTGRES_URI'],
    bigIntMode: 'number',
  });
  // await db.query(sql.file('scripts/pg/sentence.sql'));

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
  await db.dispose();
}

if (require.main === module) {
  main();
}

import axios from 'axios';
import axiosRateLimit from 'axios-rate-limit';
import sqlite3 from 'better-sqlite3';
import dotenv from 'dotenv';

dotenv.config();

export class Wanikani {
  static async create(
    opts: {
      filename?: string;
      apiKey?: string;
      offline?: boolean;
    } = {},
  ) {
    const wk = new this(
      opts.filename || 'tmp/wanikani.db',
      opts.apiKey || process.env['WANIKANI_API_KEY']!,
    );
    await wk.init(opts.offline);
    return wk;
  }

  db = sqlite3(this.filename);
  api = new WanikaniAPI(this.apiKey);

  private constructor(public filename: string, public apiKey: string) {}

  private async init(offline?: boolean) {
    this.db.exec(/* sql */ `
    CREATE TABLE IF NOT EXISTS meta (
      "data_updated_at" TIMESTAMP NOT NULL,
      "meta"            JSON NOT NULL,
      "url"             TEXT PRIMARY KEY NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_meta_updated_at ON meta("data_updated_at");
    `);

    this.db.exec(/* sql */ `
    CREATE TABLE IF NOT EXISTS subjects (
      "object"          TEXT NOT NULL,
      "url"             TEXT NOT NULL,
      "data_updated_at" TIMESTAMP NOT NULL,
      "data"            JSON NOT NULL,
      "id"              INT PRIMARY KEY NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_subjects_updated_at ON subjects("data_updated_at");
    CREATE INDEX IF NOT EXISTS idx_subjects_object ON subjects("object");
    CREATE INDEX IF NOT EXISTS idx_subjects_characters ON subjects(json_extract("data", '$.characters'));
    CREATE INDEX IF NOT EXISTS idx_subjects_level ON subjects(json_extract("data", '$.level'));
    `);

    if (offline) return;

    await (async () => {
      const endpoint = '/subjects';
      let nextUrl = endpoint;
      let doFinalize;

      while (nextUrl) {
        const r = await this.api.$axios.get(nextUrl);
        const { data, data_updated_at, ...meta } = r.data;
        if (nextUrl === endpoint) {
          const p = this.db
            .prepare(/* sql */ `SELECT * FROM meta WHERE "url" = ?`)
            .get(endpoint) as any;

          if (p) {
            if (
              p.data_updated_at === data_updated_at &&
              JSON.parse(p.meta).total_count === meta.total_count
            ) {
              break;
            }
          }

          doFinalize = () =>
            this.db
              .prepare(
                /* sql */ `INSERT OR REPLACE INTO meta (data_updated_at, meta, "url") VALUES (?, ?, ?)`,
              )
              .run(data_updated_at, JSON.stringify(meta), endpoint);
        }

        const stmt = this.db.prepare(
          /* sql */ `INSERT OR REPLACE INTO subjects ("object", "url", data_updated_at, "data", id) VALUES (?, ?, ?, ?, ?)`,
        );

        this.db.transaction((data) => {
          data.map(({ object, url, data_updated_at, data, id }: any) => {
            stmt.run(object, url, data_updated_at, JSON.stringify(data), id);
          });
        })(r.data.data);

        nextUrl = r.data.pages.next_url || '';
        if (!nextUrl) {
          break;
        }
      }

      if (doFinalize) {
        doFinalize();
      }
    })();
  }
}

export class WanikaniAPI {
  $axios = axiosRateLimit(
    axios.create({
      baseURL: 'https://api.wanikani.com/v2',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    }),
    /**
     * https://docs.api.wanikani.com/20170710/#rate-limit
     * Requests per minute	60
     */ {
      /**
       * Per second
       */
      maxRequests: 1,
      perMilliseconds: 1000,
    },
  );

  constructor(public apiKey = process.env['WANIKANI_API_KEY']!) {}

  async subjects() {
    const allData: any[] = [];
    let nextUrl = '/subjects';

    while (true) {
      const r = await this.$axios.get(nextUrl);
      allData.push(r.data.data);

      nextUrl = r.data.pages.next_url || '';
      if (!nextUrl) {
        break;
      }
    }

    return allData;
  }

  async subjectsKanji() {
    const allData: {
      id: number;
      level: number;
      characters: string;
    }[] = [];
    let nextUrl = '/subjects';

    while (true) {
      const r = await this.$axios.get<
        ICollection<
          IResource<{
            characters: string;
            level: number;
          }>
        >
      >(nextUrl, {
        params: {
          types: 'kanji',
        },
      });

      allData.push(
        ...r.data.data.map((d) => ({
          id: d.id,
          level: d.data.level,
          characters: d.data.characters,
        })),
      );

      console.log(r.data.url);

      nextUrl = r.data.pages.next_url || '';
      if (!nextUrl) {
        break;
      }
    }

    return allData;
  }

  async getVocab() {
    const allData: {
      id: number;
      level: number;
      characters: string;
      sentences: {
        ja: string;
        en: string;
      }[];
    }[] = [];
    let nextUrl = '/subjects';

    while (true) {
      const r = await this.$axios.get<
        ICollection<
          IResource<{
            characters: string;
            level: number;
            context_sentences: {
              ja: string;
              en: string;
            }[];
          }>
        >
      >(nextUrl, {
        params: {
          types: 'vocabulary',
        },
      });

      allData.push(
        ...r.data.data.map((d) => ({
          id: d.id,
          level: d.data.level,
          characters: d.data.characters,
          sentences: d.data.context_sentences,
        })),
      );

      console.log(r.data.url);

      nextUrl = r.data.pages.next_url || '';
      if (!nextUrl) {
        break;
      }
    }

    return allData;
  }
}

export interface IResource<T = any> {
  id: number;
  url: string;
  data_updated_at: string; // Date
  data: T;
}

export interface ICollection<T = any> {
  object: string;
  url: string;
  pages: {
    next_url?: string;
    previous_url?: string;
    per_page: number;
  };
  total_count: number;
  data_updated_at: string; // Date
  data: T[];
}

export interface IError {
  error: string;
  code: number;
}

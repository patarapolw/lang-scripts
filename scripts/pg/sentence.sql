CREATE TABLE IF NOT EXISTS sentence (
  "text"      TEXT NOT NULL,
  tatoeba_id  INTEGER,
  source      TEXT,
  line        INTEGER
);

CREATE INDEX IF NOT EXISTS idx_sentence_text ON sentence USING pgroonga("text");
CREATE UNIQUE INDEX IF NOT EXISTS idx_sentence_tatoeba_id ON sentence (tatoeba_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sentence_source ON sentence (source, line);

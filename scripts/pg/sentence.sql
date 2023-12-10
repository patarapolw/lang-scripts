DROP TABLE links;
DROP TABLE sentence;

CREATE TABLE IF NOT EXISTS sentence (
  "text"      TEXT NOT NULL,
  tatoeba_id  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_sentence_text ON sentence USING pgroonga("text");
CREATE INDEX IF NOT EXISTS idx_sentence_tatoeba_id ON sentence (tatoeba_id);

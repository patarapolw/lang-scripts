SELECT s.*
FROM sentence s
, (SELECT DISTINCT ON ("text") * FROM sentence WHERE "text" &@ '事後承諾' LIMIT 5) t
WHERE s.source = t.source AND s.line BETWEEN t.line - 2 AND t.line + 2;

DROP TABLE IF EXISTS essays;
CREATE TABLE essays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    topic TEXT,
    image_key TEXT,
    essay_type TEXT,
    grade_result TEXT
);

CREATE TABLE directories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id INTEGER REFERENCES directories ON DELETE CASCADE,
    type TEXT NOT NULL CHECK ( type IN ('directory', 'file') ),
    record_id INTEGER REFERENCES speech_records ON DELETE CASCADE,
    owner INTEGER NOT NULL REFERENCES users ON DELETE CASCADE
);

CREATE TABLE directory_rights (
    user_id INTEGER NOT NULL REFERENCES users ON DELETE CASCADE,
    directory_id INTEGER NOT NULL REFERENCES directories ON DELETE CASCADE,
    permission TEXT NOT NULL CHECK (permission IN ('READ', 'WRITE')) DEFAULT 'READ',

    UNIQUE (directory_id, user_id)
);

ALTER TABLE speech_records RENAME COLUMN "user" TO owner;
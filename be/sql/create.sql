--------------------------------------------------
-- USERS
--------------------------------------------------

CREATE TABLE users (
	id SERIAL PRIMARY KEY,
	password TEXT NOT NULL,
	username VARCHAR(128) NOT NULL UNIQUE,
	created TIMESTAMP(3) NOT NULL DEFAULT now(),
	active BOOLEAN DEFAULT TRUE,
    role VARCHAR(1) NOT NULL CHECK(role IN ('A', 'U', 'C')) DEFAULT 'U'
);

CREATE INDEX users_username_idx ON users(username);

--------------------------------------------------
-- SESSIONS
--------------------------------------------------

CREATE TABLE sessions (
    session_id TEXT PRIMARY KEY,
	"user" INTEGER NOT NULL REFERENCES users ON DELETE CASCADE,
	accessed TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE INDEX sessions_user_idx ON sessions("user");
CREATE INDEX sessions_accessed_idx ON sessions(accessed);

--------------------------------------------------
-- SPEECH LANGUAGES
--------------------------------------------------

CREATE TABLE speech_records_languages (
    id SERIAL PRIMARY KEY,
    language TEXT NOT NULL UNIQUE,
    language_key TEXT NOT NULL
);

--------------------------------------------------
-- SPEECH LANGUAGES
--------------------------------------------------

CREATE TABLE speech_records_voices (
    id SERIAL PRIMARY KEY,
    language INTEGER REFERENCES speech_records_languages ON DELETE CASCADE,
    speaker TEXT NOT NULL UNIQUE,
    speaker_sex VARCHAR(1) NOT NULL CHECK(speaker_sex IN ('F', 'M'))
);

CREATE INDEX speech_records_languages_lang_idx ON speech_records_languages(language);

--------------------------------------------------
-- SPEECH RECORDS
--------------------------------------------------

CREATE TABLE speech_records (
    id SERIAL PRIMARY KEY,
    name TEXT,
    language INTEGER REFERENCES speech_records_languages ON DELETE CASCADE,
    voice INTEGER REFERENCES speech_records_voices ON DELETE CASCADE,
    text TEXT NOT NULL,
    path TEXT,
    rate DOUBLE PRECISION NOT NULL DEFAULT 1,
    pitch DOUBLE PRECISION NOT NULL DEFAULT 1,
    "user" INTEGER REFERENCES users ON DELETE CASCADE,
    region TEXT NOT NULL DEFAULT 'westeurope',
    pregenerated BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX speech_records_language_idx ON speech_records(language);

CREATE TABLE companies (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

ALTER TABLE users ADD COLUMN company INTEGER REFERENCES companies ON DELETE SET NULL;

CREATE TABLE records_generated_count (
    "user" INTEGER NOT NULL REFERENCES users ON DELETE CASCADE,
    company INTEGER REFERENCES companies ON DELETE SET NULL,
    "record" INTEGER REFERENCES speech_records ON DELETE SET NULL,
    count INTEGER NOT NULL,
    date DATE NOT NULL,

    UNIQUE(date, "user", company, record)
);

CREATE INDEX records_generated_count_date_idx ON records_generated_count(date);

CREATE TABLE microsoft_tokens (
    id SERIAL PRIMARY KEY,
    token TEXT NOT NULL,
    region TEXT NOT NULL
);

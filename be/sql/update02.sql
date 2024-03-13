CREATE TABLE record_configuration (
    id SERIAL PRIMARY KEY,
    language_id INTEGER NOT NULL REFERENCES speech_records_languages ON DELETE CASCADE,
    speaker_id INTEGER NOT NULL REFERENCES speech_records_voices ON DELETE CASCADE,
    rate DOUBLE PRECISION NOT NULL,
    pitch DOUBLE PRECISION NOT NULL,
    owner INTEGER NOT NULL REFERENCES users ON DELETE CASCADE
);

ALTER TABLE speech_records ADD COLUMN record_configuration_id INTEGER REFERENCES record_configuration ON DELETE SET NULL;
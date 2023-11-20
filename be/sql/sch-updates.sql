CREATE TABLE schema_updates (
	filename TEXT PRIMARY KEY,
	applied TIMESTAMPTZ NOT NULL DEFAULT current_timestamp
);

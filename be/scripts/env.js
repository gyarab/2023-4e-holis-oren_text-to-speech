module.exports = {
	host: process.env.TTS_BIND_HOST || "localhost",
	port: process.env.TTS_BIND_PORT || 6300,
	url: process.env.TTS_URL || `http://${process.env.TTS_BIND_HOST || "localhost"}:${process.env.TTS_BIND_PORT || 6300}/`,

	datadir: process.env.TTS_DATADIR || '.',

	//Postgresql database
	pg_host: process.env.TTS_PGSQL_HOST || 'localhost',
	pg_port: Number(process.env.TTS_PGSQL_PORT) || 5432,
	pg_pass: process.env.TTS_PGSQL_PASSWORD || 'tts',
	pg_user: process.env.TTS_PGSQL_USER || 'tts',
	pg_db: process.env.TTS_PGSQL_DB || 'tts',
	pg_sslmode: process.env.TTS_PG_REQUIRE_SSL || false,

	azure_tts: {
		//List of languages supported in app state name must match. State names can be found on here https://docs.microsoft.com/cs-cz/azure/cognitive-services/speech-service/language-support
		//Language names must be in english
		languages: ['Czech', 'English', 'German']
	},

	files_output: {
		extension: 'wav'
	},

	/**
	 * Record visibility mode changes which records can users access.
	 * Available modes are 'all' or 'peruser'
	 */
	record_visibility_mode: 'all'
}

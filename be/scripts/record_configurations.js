const {express, ApiError} = require("./utils/aexpress");
const SQLBuilder = require("./utils/SQLBuilder");
const {validateId, validateStringNotEmpty} = require("./utils/validations");
const {validateType} = require("./utils/validations.js");
const {TextToSpeech} = require("./textToSpeech");

const db = new SQLBuilder();
const app = express();

async function prepareRecordConfiguration(data) {
	let {language_id, speaker_id, name, rate, pitch} = data;

	validateStringNotEmpty(name)
	validateType(language_id, 'number');
	validateType(speaker_id, 'number');
	validateType(pitch, 'number');
	validateType(rate, 'number');

	await validateId(speaker_id, 'speech_records_voices');
	await validateId(language_id, 'speech_records_languages');
	await TextToSpeech.validateLanguageSpeakerMatch(language_id, speaker_id);

	return {language_id, speaker_id, rate, pitch, name}
}

async function validateAccessRecordConfiguration(req) {
	const configuration = await validateId(req.params.id, 'record_configuration');

	if (configuration.owner !== req.session.id) {
		throw new ApiError(401)
	}

	return configuration;
}

function getRecordConfigurationQuery() {
	return db.select()
		.fields('rc.*, srl.language AS language_name, srv.speaker AS speaker_name')
		.from(
			'record_configuration AS rc',
			'INNER JOIN speech_records_languages AS srl ON srl.id = rc.language_id',
			'INNER JOIN speech_records_voices AS srv ON srv.id = rc.speaker_id'
		);
}

app.post_json('/record-configuration', async req => {
	const data = await prepareRecordConfiguration(req.body);
	const con = await db.insert('record_configuration', {...data, owner: req.session.id}).oneOrNone()
	return await getRecordConfigurationQuery().where('rc.id = ?', con.id).oneOrNone();
});

app.post_json('/record-configuration/:id([0-9]+)', async req => {
	const configuration = await validateAccessRecordConfiguration(req);
	const data = await prepareRecordConfiguration(req.body);
	await db.update('record_configuration')
		.set(data)
		.whereId(configuration.id)
		.oneOrNone();
	return await getRecordConfigurationQuery().where('rc.id = ?', configuration.id).oneOrNone();
});

app.delete_json('/record-configuration/:id([0-9]+)', async req => {
	const configuration = await validateAccessRecordConfiguration(req);
	await db.deleteById('record_configuration', configuration.id);
});

app.get_json('/record-configuration', async req =>
	await getRecordConfigurationQuery().where('owner = ?', req.session.id).getList()
);


module.exports = {app}
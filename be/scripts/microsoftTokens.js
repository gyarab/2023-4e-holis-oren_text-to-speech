const {validateStringNotEmpty} = require('./utils/validations.js');
const express = require('express');
const SQLBuilder = require("./utils/SQLBuilder.js");
const {ApiError} = require("./utils/aexpress");
const {TextToSpeech} = require('./textToSpeech');

let app = express();
const db = new SQLBuilder();

async function checkTokenExistence() {
	const token = await db.select('microsoft_tokens')
		.where('id IS NOT NULL')
		.oneOrNone();

	if (!token) {
		throw new ApiError(404, 'Token not found');
	}

	return token;
}

app.get_json('/mc-token/info', async () => {
	return await checkTokenExistence();
});

app.post_json('/mc-token', async req => {
	const {token, region} = req.body;

	validateStringNotEmpty(token, 'Token');
	validateStringNotEmpty(region, 'Region');

	let tokenExist;
	try {
		tokenExist = await checkTokenExistence();
	} catch (ex) {}

	await TextToSpeech.validateToken(token, region);

	if (tokenExist) {
		await db.update('microsoft_tokens')
			.set({
				token,
				region
			})
			.where('id IS NOT NULL')
			.run()
	} else {
		await db.insert('microsoft_tokens', {
			token,
			region
		})
		.run();
	}

	await TextToSpeech.saveEnvironmentLanguages();
});

app.delete_json('/mc-token', async () => {
	await checkTokenExistence();

	await db.delete('microsoft_tokens')
		.where('id IS NOT NULL')
		.run();
})

module.exports = {app, checkTokenExistence}
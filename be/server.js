const {ApiError, express, FallThrough} = require('./scripts/utils/aexpress.js');
const cookieParser = require('cookie-parser');
const http = require('http');
const path = require('path');
const sessions = require('./scripts/sessions.js');
const env = require('./scripts/env.js');
const users = require('./scripts/users.js');
const textToSpeech = require('./scripts/textToSpeech');
const microsoftTokens = require('./scripts/microsoftTokens')
const statistics = require('./scripts/statistics');
const fs = require("fs");
const SQLBuilder = require("./scripts/utils/SQLBuilder");
const {checkTokenExistence} = require("./scripts/microsoftTokens");

const db = new SQLBuilder();

async function reset() {
	const args = process.argv.slice(2);

	if (args.includes('reset')) {
		const deleteTableData = async tableName => {
			await db.delete(tableName)
				.run();
		}

		const speeches = await db.select('speech_records')
			.getList();

		for (const speech of speeches) {
			try {
				fs.unlinkSync(speech.path);
			} catch (ex) {
				console.log(`Files delete cannot be performed because file path is not absolute,
				 or file server.js isn't ran from root directory of the app.`)
			}
		}

		await deleteTableData('microsoft_tokens');
		await deleteTableData('users');
		await deleteTableData('speech_records_languages');

		const passwordHash1 = await sessions.hash_password('adminBC');

		await db.insert("users", {
			username: 'adminBC',
			password: passwordHash1,
			active: true
		})
		.run();

		const passwordHash2 = await sessions.hash_password('bcadmin@localhost.local');

		await db.insert("users", {
			username: 'bcadmin@localhost.local',
			password: passwordHash2,
			active: true
		})
		.run();

		console.log('App has been reseted suffecfully')
	}
}
(async () => {
	await reset();
})();

const app = express();
const server = http.createServer(app);

server.listen(env.port, env.host, () => console.log(`Listening on ${env.url}`));

app.use(cookieParser());
app.use(express.json());

app.use('/api', sessions.app);


/* ALL OTHER MODULES NEED SESSION */

app.all_json('/api/*', async req => {
	req.session = await sessions.getSessionUser(req.cookies['tts-session']);

	if (!req.session.active) {
		throw new ApiError(401, 'Your account must be active')
	}

	if (!req.session) {
		throw new ApiError(401, 'You must be authenticated to perform this operation');
	}

	return FallThrough;
});

app.use('/api', textToSpeech.app);
app.use('/api', statistics.app);
app.get_json('/api/users/companies', async req => await db.select('companies').getList());

// This route is not protected but works only as a checking if token is uploaded and records can be created
app.get_json('/api/mc-token', async () => {
	return (await checkTokenExistence()) !== null;
});

app.all_json('/api/*', async req => {
	if (req.session.role !== 'A') {
		throw new ApiError(401, 'Your role is too low to perform this operation');
	}

	return FallThrough;
})

app.use('/api', users.app)
app.use('/api', microsoftTokens.app);

const options = {
	lastModified: true,
	redirect: '/'
}

app.use(express.static(path.join(path.resolve(), 'gen/fe'), options))
app.use(express.static(path.join(path.resolve(), 'fe'), options));

let icons = fs.readFileSync(path.join(__dirname, '../gen/fe/icon-symbols.svg'));
app.get('*', (req, res) => {
	res.set('Content-Type', 'text/html;charset=utf-8');
	res.set('Cache-Control', 'private, must-revalidate, max-age=60');
	res.send(`<!DOCTYPE html>
	<head>
		<meta charset=utf-8>
		<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
		<link rel="stylesheet" type="text/css" href="./main.css">
	
		<script src="/vendor/wavesurfer.js"></script>
		<script src="./main.build.js"></script>
	
		<title>Text to speech</title>

		${icons}
	</head>
	<body></body>
`);
});

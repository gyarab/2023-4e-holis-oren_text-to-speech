const SQLBuilder = require("./utils/SQLBuilder");
const {express} = require("./utils/aexpress.js");
const copyTo = require('pg-copy-streams').to
const { Pool } = require('pg')
const env = require("./env.js");
const fs = require('fs');
const {formatPostgresTimestamp, parseId} = require("./utils/utils");
const {ApiError} = require("./utils/aexpress");

const db = new SQLBuilder();
const app = express();
const pool = new Pool({
	host: env.pg_host,
	port: env.pg_port,
	database: env.pg_db,
	user: env.pg_user,
	password: env.pg_pass
})


app.get_json('/statistics/:year([0-9]+)/:month([0-9]+)', async req => {
	const date = new Date(req.params.year, req.params.month);
	const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);

	const statistics = db.select()
		.fields('date, SUM(count) AS count, users.username, users.id')
		.from(
			'records_generated_count',
			'INNER JOIN users ON records_generated_count."user" = users.id'
		)
		.where('date >= ? AND date <= ?', date, lastDay)
		.more('GROUP BY username, date, users.id ORDER BY username');

	if (req.session.role === 'U') {
		statistics.where('"user" = ?', req.session.id);
	}

	return await statistics.getList();
});


function formatStaticsSql(sql) {
	sql.fields('date, count, users.username, sr.name AS record_name, cm.name AS company_name')
		.from(
			'records_generated_count AS rgc',
			'INNER JOIN users ON rgc."user" = users.id',
			'LEFT JOIN companies AS cm ON cm.id = rgc.company',
			'LEFT JOIN speech_records AS sr ON sr.id = rgc.record',
		)
		.more('ORDER BY username')

	let {queryCommand, values} = sql.makeSqlQuestion();

	for (let i = 0; i < values.length; i++) {
		const regex = new RegExp('\\$' + (i + 1));
		queryCommand = queryCommand.replace(regex, `${values[i]}`)
	}

	return queryCommand;
}

async function prepareSendStatistics(sql, res) {
	const client = await pool.connect();
	const out = fs.createWriteStream('data.csv')

	const query = client.query(copyTo(`COPY (${sql}) TO STDOUT csv HEADER DELIMITER ';'`));

	query.pipe(out);

	query.on('end', () => {
		out.close();
		const csvFile = fs.createReadStream('data.csv');

		res.writeHead(200, {
			'Cache-Control': 'no-cache',
			'Content-Type': 'text/csv',
			'Content-Disposition': `attachment; filename=data.csv`
		});

		csvFile.pipe(res);
	})
}

app.get_file('/stats/alltime', async (req, res) => {
	const sql = db.select()

	if (req.session.role === 'U') {
		sql.where('rgc."user" = ?', `'${req.session.id}'`);
	}

	const sqlFormatted = formatStaticsSql(sql);
	await prepareSendStatistics(sqlFormatted, res);
});

app.get_file('/stats/:id/:year([0-9]+)/:month([0-9]+)', async (req, res) => {
	const id = req.params.id === 'all' ? req.params.id : parseId(req.params.id);
	const sql = db.select();

	if (req.session.role === 'U') {
		if (id === 'all') {
			throw new ApiError(401);
		} else if (req.session.id !== id) {
			throw new ApiError(401)
		} else {
			sql.where('rgc."user" = ?', `'${req.session.id}'`);
		}
	} else {
		if (id !== 'all') {
			sql.where('rgc."user" = ?', `'${id}'`);
		}
	}

	const date = new Date(req.params.year, req.params.month);
	const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);

	sql.where('date >= ? AND date <= ?', `'${formatPostgresTimestamp(date)}'::timestamp`, `'${formatPostgresTimestamp(lastDay)}'::timestamp`);

	const sqlFormatted = formatStaticsSql(sql);
	await prepareSendStatistics(sqlFormatted, res);
})

module.exports = {app};
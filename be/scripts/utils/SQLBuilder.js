const Pool = require('pg').Pool;
const env = require('../env.js');
const {ApiError} = require("./aexpress.js");

class DBError extends Error {
	constructor(msg, sqlCommand, sqlValues, reason) {
		super(msg);

		this.sqlCommand = sqlCommand;
		this.sqlValues = sqlValues;
		this.reason = reason;
	}
}

class SQLBuilder {
	constructor() {
		this.commandValues = [];
		this.conditions = [];
		this.sets = [];
		this.moreText = '';

		//new
		this.keyOperation = '';
		this.fieldsClause = '';
		this.fromClause = '';

		this.pool = new Pool({
			host: env.pg_host,
			port: env.pg_port,
			database: env.pg_db,
			user: env.pg_user,
			password: env.pg_pass
		});
	}

	select(tableName) {
		this.checkKeyOperationDuplicity('SELECT');

		this.keyOperation = 'SELECT';

		if (tableName) {
			this.fromClause = this.escapeIdentifier(tableName);
		}

		return this;
	}

	insert(tableName, values) {
		this.checkKeyOperationDuplicity('INSERT');

		this.keyOperation = 'INSERT INTO';

		let columnNames = '(';
		let valuesCommand = 'VALUES(';
		const keyValues = Object.keys(values);
		for (const [key, val] of Object.entries(values)) {
			this.commandValues.push(val);
			valuesCommand += '$' + this.commandValues.length + (keyValues[keyValues.length - 1] === key ? ')' : ', ');
			columnNames += this.escapeIdentifier(key) + (keyValues[keyValues.length - 1] === key ? ') ' : ', ');
		}

		this.fromClause = this.escapeIdentifier(tableName) + columnNames + valuesCommand;
		return this;
	}

	update(tableName) {
		this.checkKeyOperationDuplicity('UPDATE');

		this.keyOperation = 'UPDATE';

		this.fromClause = this.escapeIdentifier(tableName);
		return this;
	}

	delete(tableName) {
		this.checkKeyOperationDuplicity('DELETE');

		this.keyOperation = 'DELETE FROM';

		this.fromClause = this.escapeIdentifier(tableName);
		return this;
	}

	fields(fields) {
		this.fieldsClause += this.fieldsClause + fields;
		return this;
	}

	from(...tables) {
		this.fromClause = tables.join(' ');
		return this;
	}

	set(columnName, value) {
		if (this.sets.length === 0) {
			this.sets.push('SET')
		}
		if (typeof columnName === "object") {
			for (const [key, val] of Object.entries(columnName)) {
				this.createSet(key, val);
			}
		} else {
			this.createSet(columnName, value);
		}

		return this;
	}

	where(condition, ...conditionValues) {
		if (condition.length > 0) {
			const conditionEdited = this.replaceQuestionMarkWithValue(
				condition,
				conditionValues,
				(this.conditions.length !== 0 ? ' AND ' : 'WHERE ')
			);

			this.conditions.push(conditionEdited)
		}

		return this;
	}

	minMax(limit, offset) {
		this.commandValues.push(limit);
		this.commandValues.push(offset);
		this.moreText += ' LIMIT $' + (this.commandValues.length - 1) + ' OFFSET $' + this.commandValues.length;

		return this;
	}

	in(column, values) {
		let questionsMarks = '(';

		values.forEach((b, i) => {
			questionsMarks += i + 1 === values.length ? '?)' : '?, ';
		});

		this.where(column + ' IN ' + questionsMarks, ...values);

		return this;
	}

	more(command, ...values) {
		const conditionEdited = values.length > 0 ? this.replaceQuestionMarkWithValue(
			command,
			values,
			''
		) : command;

		this.moreText += ' ' + conditionEdited;

		return this;
	}

	/**
	 * Database transaction is used on many db queries connected to each other. When one fails other results of before
	 * queries will be discharged.
	 *
	 * @param {function} fn - Function which will be called in transaction. First parameter is given client. This client
	 * arg must be set as a parameter of run, oneOrNone or getList functions in transaction function.
	 * @returns {Promise<ApiError|*>}
	 */
	async transaction(fn) {
		const client = await this.pool.connect()
		let res, ex;
		try {
			await client.query('BEGIN')
			res = await fn(client);
			await client.query('COMMIT')
		} catch (e) {
			await client.query('ROLLBACK');
			ex = new ApiError(e.status, e.message);
		} finally {
			client.release()
		}

		if (ex) {
			throw ex;
		}

		return ex || res;
	}

	/**
	 * Run sql query
	 *
	 * @param {Pool} clientTx - necessary in transaction
	 * @returns {Promise<*|*[]>}
	 */
	async run(clientTx) {
		let {queryCommand, values} = this.makeSqlQuestion();

		if (!queryCommand.includes('SELECT') && !queryCommand.includes('DELETE')) {
			queryCommand += " RETURNING *";
		}

		const query = [queryCommand, values];

		const client = clientTx || await this.pool.connect();

		let result;
		try {
			result = await client
				.query(
					...query
				);
		} catch(err) {
			console.log(query);
			console.error(err.stack)
		}

		if (!clientTx) {
			await client.release();
		}

		return {result, queryCommand};
	}

	//Data retrieves
	/**
	 * Gets list of result rows
	 *
	 * @param {Pool} client - necessary in transaction
	 * @returns {Promise<*|*[]>}
	 */
	async getList(client) {
		const {result, queryCommand} = await this.run(client);

		return (result.rows || []);
	}

	/**
	 * Gets one result row
	 *
	 * @param {Pool} client - necessary in transaction
	 * @returns {Promise<*|*[]>}
	 */
	async oneOrNone(client) {
		const {result, queryCommand} = await this.run(client);

		if (result.rows.length > 1) {
			throw new DBError(
				'Your sql command is wrong or you call wrong function. ' +
				'Expected number of results 1 or 0 got ' + result.rows.length,
				queryCommand,
				this.commandValues
			)
		}

		return (result.rows[0] || null)
	}

	/**
	 * Gets count of result rows
	 *
	 * @param {Pool} client - necessary in transaction
	 * @returns {Promise<*|*[]>}
	 */
	async count(client) {
		const {result, queryCommand} = await this.run(client);

		return (result.rows[0].count || 0)
	}

	//Utils
	replaceQuestionMarkWithValue(command, values, presetCommand) {
		const conditionSplit = command.split('?');

		if (conditionSplit.length !== values.length + 1) {
			throw new DBError(
				'Wrong number of ? or values',
				command,
				values
			);
		}

		let commandEdited = command;

		for (let i = 0; i + 1 < conditionSplit.length; i++) {
			this.commandValues.push(values[i]);
			commandEdited = commandEdited.replace('?', '$' + this.commandValues.length);
		}

		return presetCommand + commandEdited;
	}

	makeSqlQuestion() {
		if (this.fromClause === '') {
			throw new DBError('From clause is not defined');
		}

		if (this.keyOperation === '') {
			throw new DBError('DB key operation is not defined');
		}

		let queryCommand = '';
		if (this.keyOperation === 'SELECT'){
			queryCommand = this.keyOperation + ' ' + (this.fieldsClause || '*') + ' FROM ' + this.fromClause + ' ';
		} else  {
			queryCommand = this.keyOperation + ' ' + this.fromClause + ' ';
		}

		queryCommand += this.sets.join('');
		queryCommand += this.conditions.join('');
		queryCommand += ' ' + this.moreText;

		const values = this.commandValues;

		this.reset();
		return {queryCommand, values};
	}

	escapeIdentifier(str) {
		return '"' + str.replace(/"/g, '""') + '"'
	}

	createSet(columnName, value) {
		this.commandValues.push(value);
		this.sets.push(
			(this.sets.length > 1 ? ', ' : ' ') +
			(this.escapeIdentifier(columnName) + ' = $' + this.commandValues.length + ' ')
		);
	}

	reset() {
		this.commandValues = [];
		this.conditions = [];
		this.sets = [];
		this.moreText = '';

		//new
		this.keyOperation = '';
		this.fieldsClause = '';
		this.fromClause = '';
	}

	//Checkings
	checkKeyOperationDuplicity(operation) {
		if (this.keyOperation !== '') {
			throw new DBError(
				'Cannot define key operation twice. ' +
				'Original key operation ' + this.keyOperation + ' new key operation ' + operation,
				this.keyOperation
			);
		}
	}

	async createTable(command) {
		const client = await this.pool.connect();

		let result;
		try {
			result = await client
				.query(
					command
				);
		} catch(err) {
			console.error(err.stack)
		}

		await client.release();
	}
}
module.exports = SQLBuilder

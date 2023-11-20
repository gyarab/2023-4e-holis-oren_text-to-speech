const {validateStringNotEmpty} = require('./utils/validations.js');
const {ApiError} = require("./utils/aexpress.js");
const {promisify} = require('util');
const crypto = require('crypto');
const express = require('express');
const {random_bytes} = require("./utils/utils.js");
const SQLBuilder = require("./utils/SQLBuilder.js");

let app = express();
const db = new SQLBuilder();

// {{{ Password hasing

async function hash_password(pw) {
	let opts = {
		N: 16384,
		r: 8,
		p: 1,
	};

	let salt = await random_bytes(16);
	let key = (await promisify(crypto.scrypt)(Buffer.from(pw.normalize()), salt, 32, opts));

	return JSON.stringify({
		a: 'scrypt',
		o: opts,
		s: salt.toString('base64'),
		k: key.toString('base64')
	});
}

async function verify_password(hash, pw) {
	let h = JSON.parse(hash);

	if (h.a == 'plain') {
		return crypto.timingSafeEqual(Buffer.from(pw.normalize()), Buffer.from(h.p));
	}

	if (h.a != 'scrypt') {
		throw new Error('Unknown password hash algorithm');
	}
	if (typeof h.o != 'object' || !h.o) {
		throw new Error('Missing options');
	}
	if (typeof h.o.N != 'number' || typeof h.o.r != 'number' || typeof h.o.p != 'number') {
		throw new Error('Invalid scrypt options');
	}

	let salt = Buffer.from(h.s, 'base64');
	let key = Buffer.from(h.k, 'base64');
	let test_key = (await promisify(crypto.scrypt)(pw.normalize(), salt, 32, h.o));

	return crypto.timingSafeEqual(key, test_key);
}

/*
 * Most of the data fetching functions accept req which is
 * a request context that is expected to contain some basic
 * properties:
 *
 * - db - pg-promise DB object
 * - sid - session ID associated with the current request context
 * - _, _n, _c, _nc - translation functions bound to a language
 *   configured for the current context
 */
async function getSessionUser(sessionId) {
	const session = await db.select()
		.fields('users.username, users.id, users.active, users.role, company')
		.from('sessions', 'INNER JOIN users ON users.id = sessions.user')
		.where('sessions.session_id = ?', sessionId)
		.oneOrNone();

	if (!session) {
		throw new ApiError(401, 'You must be authenticated to perform this operation');
	}

	return session;
}

async function getUserByUsername(username) {
	return await db.select('users')
		.where("username = ?", username)
		.oneOrNone();
}

async function getUserInternal(id) {
	return await db.select('users')
		.where("id = ?", id)
		.oneOrNone();
}

app.post_json('/session', async (req, res) => {
	const {username, password} = req.body;

	validateStringNotEmpty(username, 'Username');
	validateStringNotEmpty(password, 'Password');

	const user = await db.select('users')
		.where('username = ?', username)
		.oneOrNone();

	if (!user) {
		throw new ApiError(404, 'User not found');
	}

	if (!user.active) {
		throw new ApiError(400, 'User is deactivated');
	}

	const passValidated = await verify_password(user.password, password);
	if (!passValidated) {
		throw new ApiError(401, 'Invalid password');
	}

	const sessionId = (await random_bytes(24)).toString('hex');

	await db.insert('sessions', {
			session_id: sessionId,
			user: user.id
		})
		.run();

	res.cookie('tts-session', sessionId, {maxAge: 1000 * 60 * 60 * 24 * 31, httpOnly: true, secure: false, sameSite: 'strict'});

	return await getSessionUser(sessionId);
});

app.get_json('/session', async (req) => {
	return await getSessionUser(req.cookies['tts-session']);
});

app.delete_json('/session', async (req, res) => {
	await db.delete('sessions')
		.where('session_id = ?', req.cookies['tts-session'])
		.run();

	res.clearCookie('tts-session', {maxAge: 1000 * 60 * 60 * 24 * 31, httpOnly: true});
});

module.exports = {
	app,
	getSessionUser,
	hash_password,
	verify_password,
	getUserInternal,
	getUserByUsername
}
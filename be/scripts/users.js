const express = require('express');
const {validateStringNotEmpty, validateType} = require("./utils/validations.js");
const {ApiError} = require("./utils/aexpress.js");
const sessions = require("./sessions.js");
const {parseId} = require("./utils/utils.js");
const SQLBuilder = require("./utils/SQLBuilder.js");

const app = express();
const db = new SQLBuilder();

async function checkUserExistence(id) {
	const user = await sessions.getUserInternal(id);

	if (!user) {
		throw new ApiError(404, 'User not found');
	}

	return user
}

async function validateCompanyExists(id) {
	const company = await db.select('companies')
		.where('id = ?', id)
		.oneOrNone();

	if (!company) {
		throw new ApiError(404, 'Company not found');
	}

	return company;
}

app.post_json('/users/create', async req => {
	const {username, password, role, company} = req.body;

	validateStringNotEmpty(username, 'Username');
	validateStringNotEmpty(password, 'Password');
	await validateCompanyExists(company);

	if (role !== 'A' && role !== 'U' && role !== 'C') {
		throw new ApiError(404, 'Role not found');
	}

	const existingUser = await sessions.getUserByUsername(username);

	if (existingUser) {
		throw new ApiError(409, 'Account already exists ' + username);
	}

	const passwordHash = await sessions.hash_password(password);

	const id = (await db.insert("users", {
		password: passwordHash,
		username,
		role,
		company
	}).oneOrNone()).id;

	return await db.select('users')
		.fields('id, username, role, company, active')
		.where('id = ?', id)
		.oneOrNone();
})

app.post_json('/users/user-edit/:id', async req => {
	const id = parseId(req.params.id);
	const {username, password, role, company} = req.body;

	validateStringNotEmpty(username, 'Username');
	validateStringNotEmpty(role, 'Role');
	await validateCompanyExists(company);

	if (role !== 'A' && role !== 'U' && role !== 'C') {
		throw new ApiError(404, 'Role not found');
	}

	const user = await checkUserExistence(id)

	if (user.role === 'C' && role === 'C' && user.company !== company) {
		throw new ApiError(400, 'Cannot change company of client', 'client_change_company')
	}

	const duplicateUsername = await sessions.getUserByUsername(username);

	if (user.username !== username && duplicateUsername) {
		throw new ApiError(400, 'Username is already used')
	}

	const update = db.update('users')
		.set('username', username)
		.set('role', role)
		.fields('id, username, active, company')
		.where('id = ?', id);

	if (password) {
		validateStringNotEmpty(password, 'New password');
		const passwordHash = await sessions.hash_password(password);

		update.set('password', passwordHash)
	}

	if (company && company !== user.company) {
		update.set('company', company);
	}

	return await update.oneOrNone();
});

app.post_json('/users/activate/:id', async req => {
	const id = parseId(req.params.id);
	const {active} = req.body;

	validateType(active, 'boolean');
	const user = await checkUserExistence(id)

	if (user.active === active) {
		throw new ApiError(400, 'Cannot change user activity to same state')
	}

	await db.update('users')
		.set('active', active)
		.where('id = ?', id)
		.run();

	if (!active) {
		await db.delete('sessions')
			.where('"user" = ?', id)
			.run();
	}
});

app.get_json('/users/list/:state', async req => {
	const state = req.params.state;

	if (state === 'active' && state === 'deactivated') {
		throw new ApiError(400, 'Wrong user state')
	}

	return await db.select('users')
		.fields('id, username, active, role, company')
		.where('active = ?', state === 'active')
		.getList();
});

app.post_json('/users/companies', async req => {
	const {name} = req.body;

	validateStringNotEmpty(name, 'Name');

	const duplicateName = await db.select('companies')
		.where('name = ?', name)
		.oneOrNone();

	if (duplicateName) {
		throw new ApiError(401, `Duplicate company name ${name}`, 'duplicate_name');
	}

	return await db.insert('companies', {
		name
	}).oneOrNone()
});

module.exports = {
	app
}
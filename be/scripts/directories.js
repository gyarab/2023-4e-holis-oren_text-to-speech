const {express, ApiError} = require("./utils/aexpress");
const SQLBuilder = require("./utils/SQLBuilder");
const {validateStringNotEmpty, validateId} = require("./utils/validations");

const db = new SQLBuilder();
const app = express();

async function validateRightToFolder(userId, directoryId) {
	const rights = await db.runQuery(`
        WITH RECURSIVE
            DirectoryPath AS (
                SELECT id, parent_id
                FROM directories
                WHERE id = $2
                UNION ALL
                SELECT d.id, d.parent_id
                FROM directories d
                         JOIN DirectoryPath dp ON d.id = dp.parent_id
            ),
            UserPermissions AS (
                SELECT directory_id, dr.permission
                FROM DirectoryPath dp
                         JOIN directory_rights dr ON dp.id = dr.directory_id
                WHERE dr.user_id = $1
            )
        SELECT *
        FROM UserPermissions
        WHERE permission = 'WRITE';
	`, [userId, directoryId])

	if (!rights.length) {
		throw new ApiError(401);
	}

	return rights;
}

async function getSubsidiaryDirectories(directoryId) {
	return await db.runQuery(`
        WITH RECURSIVE DirectoryPath AS (
            SELECT id, parent_id
            FROM directories
            WHERE id = $1
            UNION ALL
            SELECT d.id, d.parent_id
            FROM directories d
                     JOIN DirectoryPath dp ON d.parent_id = dp.id
        )
        SELECT *
        FROM DirectoryPath;
	`, [directoryId])
}


app.post_json('/directory', async req => {
	const data = req.body;

	validateStringNotEmpty('name');

	if (data.parent_id) {
		const dir = await validateId(data.parent_id, 'directories');
		await validateRightToFolder(req.session.id, dir.id);
	} else {
		data.parent_id = null;
	}

	const directory = await db.insert('directories', {
		name: data.name,
		parent_id: data.parent_id,
		type: 'directory',
		owner: req.session.id
	}).oneOrNone();

	await db.insert('directory_rights', {
		directory_id: directory.id,
		user_id: req.session.id,
		permission: 'WRITE'
	}).run();

	return directory;
});

app.post_json('/directory/:id([0-9]+)', async req => {
	const directory = await validateId(req.params.id, 'directories');
	await validateRightToFolder(req.session.id, directory.id);

	const data = req.body;

	validateStringNotEmpty('name');

	if (data.parent_id) {
		const dir = await validateId(data.parent, 'directories');
		await validateRightToFolder(req.session.id, dir.id);
	} else {
		data.parent_id = null;
	}

	return await db.update('directories')
		.set({
			name: data.name,
			parent_id: data.parent_id
		})
		.whereId(directory.id)
		.oneOrNone();
});

app.delete_json('/directory/:id([0-9]+)', async req => {
	const directory = await validateId(req.params.id, 'directories');
	await validateRightToFolder(req.session.id, directory.id);

	if (req.query.moveDirectoriesToRoot === 'true') {
		const directories = await getSubsidiaryDirectories(directory.id);

		await db.update('directories')
			.set('parent_id', null)
			.in('id', directories.map(d => d.id))
			.run();
	}

	await db.delete('directories')
		.whereId(directory.id)
		.oneOrNone();
});

app.get_json('/directory/:id([0-9]+)', async req => {
	const directory = await validateId(req.params.id, 'directories');
	await validateRightToFolder(req.session.id, directory.id);

	return await db.select('directories')
		.where('id = ?', directory.id)
		.oneOrNone();
});

async function validateUserDirectoryPermission(req) {
	const directory = await validateId(req.params.id, 'directories');
	await validateRightToFolder(req.session.id, directory.id);

	const data = req.body;
	const user = await validateId(data.user_id, 'users');
	validateStringNotEmpty(data.permission);

	if (!['READ', 'WRITE'].includes(data.permission)) {
		throw new ApiError(404, 'Unknown permission');
	}

	if (req.session.id === directory.owner && data.permission === 'READ') {
		throw new ApiError(409, 'Cannot decrease right of owner');
	}

	return {userId: user.id, permission: data.permission, directory}
}

app.post_json('/directory/:id([0-9]+)/permissions', async req => {
	const data = await validateUserDirectoryPermission(req);

	const alreadyAdded = await db.select('directory_rights')
		.where('user_id = ?', data.userId)
		.where('directory_id = ?', data.directory.id)
		.oneOrNone();

	if (alreadyAdded) {
		return await db.insert('directory_rights', {
			permission: data.permission,
		}).oneOrNone();

	} else {
		return await db.insert('directory_rights', {
			permission: data.permission,
			user_id: data.userId,
			directory_id: data.directory.id
		}).oneOrNone();
	}
});

app.delete_json('/directory/:id([0-9]+)/permissions', async req => {
	const data = await validateUserDirectoryPermission(req);

	await db.delete('directory_rights')
		.where('user_id = ?', data.userId)
		.where('directory_id = ?', data.directory.id)
		.run();
});


module.exports = {app, validateRightToFolder, getSubsidaryDirectories: getSubsidiaryDirectories}
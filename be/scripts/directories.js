const {express, ApiError} = require("./utils/aexpress");
const SQLBuilder = require("./utils/SQLBuilder");
const {validateStringNotEmpty, validateId} = require("./utils/validations");
const {parseId} = require("./utils/utils");

const db = new SQLBuilder();
const app = express();

async function validateRightToFolder(userId, directoryId, permissions = ['WRITE']) {
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
        WHERE permission IN (${permissions.map(p => `'${p}'`).join(', ')}) AND directory_id = $2;
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
	await validateRightToFolder(req.session.id, directory.id, ['READ', 'WRITE']);

	return await db.select()
		.fields('d.*, dr.permission')
		.from(
			'directories d',
			'INNER JOIN directory_rights dr ON dr.directory_id = d.id',
		)
		.where('id = ?', directory.id)
		.where('user_id = ?', req.session.id)
		.oneOrNone();
});

app.post_json('/directory/append/:movedDirId([0-9]+)', async req => {
	let directoryToId = null;

	if (req.query.id) {
		const directoryTo = await validateId(req.query.id, 'directories');
		await validateRightToFolder(req.session.id, directoryTo.id);

		if (directoryTo.type !== 'directory') {
			throw new ApiError(400, 'Cannot move directory under file');
		}

		directoryToId = directoryTo.id;
	}

	const directoryMoved = await validateId(req.params.movedDirId, 'directories');
	await validateRightToFolder(req.session.id, directoryMoved.id);

	await db.update('directories')
		.set('parent_id', directoryToId)
		.whereId(directoryMoved.id)
		.run();
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

	if (user.id === directory.owner && data.permission === 'READ') {
		throw new ApiError(409, 'Cannot decrease right of owner');
	}

	return {userId: user.id, permission: data.permission, directory}
}

app.get_json('/directory/:id([0-9]+)/users', async req => {
	const id = parseId(req.params.id);
	await validateRightToFolder(req.session.id, id);

	return await db.select()
		.fields('d.id, dr.permission, dr.user_id, u.username')
		.from(
			'directories d',
			'INNER JOIN directory_rights dr ON dr.directory_id = d.id',
			'INNER JOIN users u ON u.id = dr.user_id'
		)
		.where('d.id = ?', id)
		.getList();
});

app.get_json('/directory/users/minified', async req => await db.select('users').fields('username, id').getList());

app.post_json('/directory/:id([0-9]+)/permissions', async req => {
	const data = await validateUserDirectoryPermission(req);

	const parentDirectories = await db.runQuery(`
        WITH RECURSIVE parent_folders AS (
            SELECT id, name, parent_id
            FROM directories
            WHERE id = $1
            UNION ALL
            SELECT d.id, d.name, d.parent_id
            FROM directories d
                     JOIN parent_folders pf ON d.id = pf.parent_id
        )
        SELECT *
        FROM parent_folders;
	`, [data.directory.id]);

	for (const d of parentDirectories) {
		await db.insert('directory_rights', {
			permission: 'READ',
			user_id: data.userId,
			directory_id: d.id
		}).more('ON CONFLICT (directory_id, user_id) DO NOTHING').run();
	}

	return await db.insert('directory_rights', {
		permission: data.permission,
		user_id: data.userId,
		directory_id: data.directory.id
	}).more('ON CONFLICT (directory_id, user_id) DO UPDATE SET permission = EXCLUDED.permission').run();
});

app.delete_json('/directory/:id([0-9]+)/permissions/:userId([0-9]+)', async req => {
	const directory = await validateId(req.params.id, 'directories');
	await validateRightToFolder(req.session.id, directory.id);
	const user = await validateId(req.params.userId, 'users');

	if (user.id === directory.owner) {
		throw new ApiError(409, 'Cannot decrease right of owner');
	}

	await db.delete('directory_rights')
		.where('user_id = ?', user.id)
		.where('directory_id = ?', directory.id)
		.run();
});


module.exports = {app, validateRightToFolder, getSubsidaryDirectories: getSubsidiaryDirectories}
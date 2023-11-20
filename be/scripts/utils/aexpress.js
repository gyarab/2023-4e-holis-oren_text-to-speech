const express = require('express');
//const env = require('./env');

/*
 * Extend express with easier to use handlers for handling JSON
 * REST APIs, so that we don't have to sprinkle middleware wrappers
 * everywhere, because this one will be on all the JSON enpoints,
 * anyway.
 */

class ApiError extends Error {
	constructor(status, msg, code, detail) {
		super(msg);

		this.status = status;
		this.code = code;
		this.detail = detail;
	}
}

// use explicit signalling for API endpoint fallthrough, otherwise
// we're in for a world of hurt
const FallThrough = Symbol('api-fall-through');

function handle_error(err, res) {
	let status = 500;
	let error = {
		error: 'Internal error',
	};

	// unified error returning interface for JSON endpoints
	if (err instanceof ApiError) {
		status = err.status;
		error.error = err.message;
		error.code = err.code;
		error.detail = err.detail;
	} else if (err instanceof Error) {
		error.error = err.message;
	}

	// don't cache error responses
	res.set('Cache-Control', 'no-store');
	res.status(status);
	res.json(error);
	
	/**if (env.debug) {
		console.log(`${res.req.method} ${res.req.originalUrl}:\n`, err);
	}*/
}

function async_json_middleware(fn) {
	return function(req, res, next) {
		try {
			// some defaults for JSON endpoints
			req.res.set('Cache-Control', 'no-store');

			Promise.resolve(fn(req, res)).then(data => {
				if (data === undefined) {
					res.json(null);
				} else if (data === FallThrough) {
					next();
				} else {
					res.json(data);
				}
			}, err => handle_error(err, res));
		} catch(err) {
			return handle_error(err, res);
		}
	};
}

['get', 'post', 'put', 'delete', 'all'].forEach(function(m) {
	express.application[m + '_json'] = function(path, fn) {
		this[m](path, async_json_middleware(fn));
	}
});

express.application.get_file = function (path, fn) {
	this.get(path, async (req, res, next) => {
		req.res.set('Cache-Control', 'no-store');

		try {
			await fn(req, res, next);
		} catch (ex) {
			handle_error(ex, res);
		}
	});
}

module.exports = {express, ApiError, FallThrough};

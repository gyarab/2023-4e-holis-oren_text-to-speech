if (!window.AbortError) {
	window.AbortError = class extends Error {
		constructor() {
			super('Aborted');
		}
	}
}

class RESTError extends Error { }

let REST = {
	prefix: '',
	
	getURL(path) {
		return REST.prefix + path;
	},

	getExtraHeaders(method, path) {
		return {};
	},

	async request({path, body, method, headers, nonJsonOk, signal}) {
		try {
			let res = await fetch(REST.getURL(path), {
				method,
				mode: 'same-origin',
				headers: {
					Accept: 'application/json',
					'X-Anti-CSRF': '1',
					...this.getExtraHeaders(method, path),
					...headers,
				},
				body,
				cache: 'default',
				signal,
			});

			if (res.ok) {
				try {
					return await res.json();
				} catch (ex) {
					if (!nonJsonOk) {
						throw new RESTError(`${method} ${path} failed to parse response JSON`);
					}
				}
			} else {
				let errData = {};
				try {
					errData = await res.json();
				} catch (ex) {}

				let err = new RESTError((errData || {}).error || `${method} ${path} failed with status: ${res.status}`);
				err.status = res.status;
				err.detail = (errData || {}).detail;
				err.reason = (errData || {}).reason;
				err.serverError = (errData || {}).error;
				err.code = (errData || {}).code;
				throw err;
			}
		} catch (ex) {
			if (ex instanceof DOMException) {
				throw new AbortError();
			}

			if (ex instanceof RESTError) {
				throw ex;
			}

			throw new RESTError(`${method} ${path} ${ex.message}`);
		}
	},

	GET(path, params, opts) {
		if (params) {
			params = {...params};

			for (let [k, v] of Object.entries(params)) {
				if (v === null || v === undefined) {
					delete params[k];
				}
			}
		}

		let up = params ? new URLSearchParams(params) : null;

		return REST.request({
			method: 'GET',
			path: path + (up ? '?' + up.toString() : ''),
			...opts,
		});
	},

	POST(path, data, opts) {
		return REST.request({
			method: 'POST',
			path,
			headers: {
				'Content-Type': 'application/json;charset=utf-8',
			},
			body: JSON.stringify(data),
			...opts,
		});
	},

	PUT(path, data, opts) {
		return REST.request({
			method: 'PUT',
			path,
			headers: {
				'Content-Type': 'application/json;charset=utf-8',
			},
			body: JSON.stringify(data),
			...opts,
		});
	},

	DELETE(path, opts) {
		return REST.request({
			method: 'DELETE',
			path,
			nonJsonOk: true,
			...opts,
		});
	},
};

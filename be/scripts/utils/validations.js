const {ApiError} = require("./aexpress.js");

function validateType(value, type) {
	if (type === 'Array' && Array.isArray(value)) {
		return;
	}

	if (typeof value !== type) {
		throw new ApiError(400, 'Does not match type');
	}
}

function validateStringNotEmpty(text, label) {
	validateType(text, 'string');
	if (text == null || text.length === 0 || text.match(/^\s*$/)) {
		throw new ApiError(400, (label || 'Text') + ' cannot be empty.');
	}
}

function validateObjectNotEmpty(obj, label) {
	validateType(obj, 'object');
	if (obj == null || Object.keys(obj).length === 0) {
		throw new ApiError(400, (label || 'Object') + ' cannot be empty.');
	}
}

function validateArrayNotEmpty(arr, label) {
	validateType(arr, 'Array');
	if (arr == null || arr.length === 0) {
		throw new Error((label || 'Array') + ' cannot be empty.');
	}
}

function validateValuesAreUnique(arr, label) {
	const unique = arr.length === new Set(arr).size;

	if (!unique) {
		throw new Error((label || 'Array') + ' contains duplicate values');
	}
}

function isNotNull(val, label) {
	if (val == null) {
		throw new Error((label || 'Value') + ' cannot be empty.');
	}
}

module.exports = {
	validateValuesAreUnique,
	validateObjectNotEmpty,
	validateStringNotEmpty,
	validateArrayNotEmpty,
	validateType,
	isNotNull
}
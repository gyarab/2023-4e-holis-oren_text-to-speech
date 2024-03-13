const {promisify} = require("util");
const crypto = require("crypto");
const {Readable} = require("stream");

function parseId(num) {
	const numParsed = Number(num);

	if (isNaN(numParsed) || !numParsed && typeof numParsed !== 'number') {
		throw new Error('Wrong data type');
	}

	return numParsed;
}

/*
 * Get hex encoded string with `bytes` of entropy.
 */
async function random_bytes(bytes) {
	return await promisify(crypto.randomBytes)(bytes);
}

function replaceSpecialLetters(word) {
	const letters = {
		'A': '[AaáÁàâãäåæ]',
		'B': '[Bb]',
		'C': '[CcčČç]',
		'D': '[DdĎď]',
		'E': '[EeéÉěĚèêë]',
		'F': '[Ff]',
		'G': '[Gg]',
		'H': '[Hh]',
		'I': '[IiíÍìîï]',
		'J': '[Jj]',
		'K': '[Kk]',
		'L': '[Ll]',
		'M': '[Mm]',
		'N': '[NnňŇñ]',
		'O': '[OoóÓòôöõø]',
		'P': '[Pp]',
		'Q': '[Qq]',
		'R': '[RrŘř]',
		'S': '[SsŠš]',
		'T': '[TtŤť]',
		'U': '[UuÚúůŮüÜùû]',
		'V': '[Vv]',
		'W': '[Ww]',
		'X': '[Xx]',
		'Y': '[YyýÝÿ]',
		'Z': '[ZzŽž]'
	};

	const charArr = word.split("");

	for (let i = 0; i < charArr.length; i++) {
		for (const [k, v] of Object.entries(letters)) {
			if (v.includes(charArr[i])) {
				charArr[i] = k;
			}
		}
	}

	return charArr.join("").toLowerCase();
}

function formatMillisecondsToTimestamp(ms) {
	const dateObj = new Date(ms);
	const formatTwoDigit = method => {
		return (dateObj[method]() + '').length === 1 ? '0' + dateObj[method]() : dateObj[method]()
	};
	const month = (dateObj.getMonth() + 1 + '').length === 1 ? '0' + (dateObj.getMonth() + 1) : dateObj.getMonth() + 1;
	const date = dateObj.getFullYear() + '-' + month + '-' + formatTwoDigit('getDate');
	const time = formatTwoDigit('getHours') + ':' + formatTwoDigit('getMinutes') + ':' + formatTwoDigit('getSeconds');

	return date + ' ' + time;
}

function formatTimeTwoDigit(n) {
	return n < 10 ? '0' + n : n
}

function formatPostgresTimestamp(date) {
	return date.getFullYear() + '-' + formatTimeTwoDigit(date.getMonth() + 1) + '-' + formatTimeTwoDigit(date.getDate());
}

function arrayToMap(arr, key) {
	const map = new Map();

	for (const a of arr) {
		map.set(a[key], a);
	}

	return map;
}

const TextUtils = {
	// map unaccented uppercase letter to all accented versions
	accentMap: {
		'A': '[AaáÁ]',
		'B': '[Bb]',
		'C': '[CcčČ]',
		'D': '[DdĎď]',
		'E': '[EeéÉěĚ]',
		'F': '[Ff]',
		'G': '[Gg]',
		'H': '[Hh]',
		'I': '[IiíÍ]',
		'J': '[Jj]',
		'K': '[Kk]',
		'L': '[Ll]',
		'M': '[Mm]',
		'N': '[NnňŇ]',
		'O': '[OoóÓ]',
		'P': '[Pp]',
		'Q': '[Qq]',
		'R': '[RrŘř]',
		'S': '[SsŠš]',
		'T': '[TtŤť]',
		'U': '[UuÚúůŮ]',
		'V': '[Vv]',
		'W': '[Ww]',
		'X': '[Xx]',
		'Y': '[YyýÝ]',
		'Z': '[ZzŽž]'
	},

	/**
	 * @method
	 * Transliterate czech characters into their non-accented versions.
	 * @param {String} v Input value.
	 * @return {String} Transliterated string.
	 */
	unaccent: (function() {
		const from = "áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ".split("");
		const to = "acdeeinorstuuyzACDEEINORSTUUYZ".split("");
		const map = {};
		let i;

		for (i = 0; i < from.length; i++) {
			map[from[i]] = to[i];
		}

		const re = new RegExp(from.join("|"), "g");

		return function(v) {
			return String(v).replace(re, function(c) {
				return map[c];
			});
		};
	})(),

	/**
	 * Escape string for safe use within regular expression.
	 * @param {String} str String to be escaped.
	 * @return {String} Escaped string.
	 *
	 * Specials: \ ^ $ * + ? . ( ) | { } [ ]
	 * More: / -
	 */
	escapeRegexp: function(str) {
		return String(str).replace(/[|()\[\]{}.+*?^$\\\/-]/g, "\\$&");
	},

	/**
	 * Create regular expression that will loosely match accented text even
	 * if `str` is not accented.
	 * @param {String} str String to match.
	 * @return {RegExp} Regular expression object.
	 */
	unaccentedRegexp: function(str) {
		return TextUtils.escapeRegexp(TextUtils.unaccent(str)).replace(/\S/g, function(chr) {
			return TextUtils.accentMap[chr.toUpperCase()] || chr;
		});
	},

	/**
	 * Split query string into words and create array of regex fragments
	 * that match each word in the query regardless of case or accent.
	 * @param {String} query Query string.
	 * @return {String[]} regex fragments.
	 */
	splitQuery: function(query) {
		return String(query).split(/\s+/u).filter(v => v).sort(function(a, b) {
			return b.length - a.length;
		}).map(TextUtils.unaccentedRegexp);
	},

	/**
	 * Create function that will tokenize `query` string and return true if
	 * __any__ of the tokens match string passed to the function.
	 * @param {String} query Query string.
	 * @return {Function} Matcher function.
	 * @return {String} return.str String to test for the match.
	 */
	createMatchAny: function(query) {
		const words = TextUtils.splitQuery(query);
		if (words.length === 0) {
			return function() {
				return true;
			};
		}

		const regexp = new RegExp('(^|\\s)(' + words.join("|") + ')', 'g');
		return function(v) {
			return String(v).match(regexp);
		};
	},

	/**
	 * Create function that will tokenize `query` string and return true if
	 * __all__ of the tokens match string passed to the function.
	 * @param {String} query Query string.
	 * @return {function(*=): this is RegExp[]} Matcher function.
	 * @return {String} return.str String to test for the match.
	 */
	createMatchAll: function(query) {
		const words = TextUtils.splitQuery(query);
		if (words.length === 0) {
			return function() {
				return true;
			};
		}

		const regexps = words.map(function(word) {
			return new RegExp('(' + word + ')', 'g');
		});

		return function(v) {
			v = String(v);

			return regexps.every(function(r) {
				return v.match(r);
			});
		};
	},
};

function cleanObjectOfNullValues(values) {
	const cleaned = {};

	for (const k of Object.keys(values)) {
		if (values[k] != null) {
			cleaned[k] = values[k];
		}
	}

	return cleaned;
}

function getUpdatedFields(actual, update) {
	let fieldsChanged = [];

	for (const f of Object.keys(update)) {
		if (actual[f] !== update[f]) {
			fieldsChanged.push(f);
		}
	}

	return fieldsChanged;
}

function getBasicAuthenticationToken(username, password) {
	return 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
}

function replaceHTMLEntities(text) {
	return text.replace(/&lt;|&gt;|&amp;|&quot;|&apos;|&cent;|&pound;|&yen;|&euro;|&copy;|&reg;/g, function(match) {
		switch (match) {
			case '&lt;': return '<';
			case '&gt;': return '>';
			case '&amp;': return '&';
			case '&quot;': return '"';
			case '&apos;': return "'";
			case '&cent;': return '¢';
			case '&pound;': return '£';
			case '&yen;': return '¥';
			case '&euro;': return '€';
			case '&copy;': return '©';
			case '&reg;': return '®';
			default: return match;
		}
	});
}

const formatNum2Tenths = num => Math.round(num * 100) / 100;


module.exports = {
	formatNum2Tenths,
	replaceHTMLEntities,
	getBasicAuthenticationToken,
	getUpdatedFields,
	cleanObjectOfNullValues,
	formatMillisecondsToTimestamp,
	replaceSpecialLetters,
	formatPostgresTimestamp,
	formatTimeTwoDigit,
	random_bytes,
	parseId,
	arrayToMap,
	TextUtils
}
/**
 * @singleton
 * Helper functions for working with text.
 */
TextUtils = {
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
		var from = "áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ".split("");
		var   to = "acdeeinorstuuyzACDEEINORSTUUYZ".split("");
		var  map = {}, i;

		for (i = 0; i < from.length; i++) {
			map[from[i]] = to[i];
		}

		var re = new RegExp(from.join("|"), "g");

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
		var words = TextUtils.splitQuery(query);
		if (words.length == 0) {
			return function() {
				return true;
			};
		}

		var regexp = new RegExp('(^|\\s)(' + words.join("|") + ')', 'g');
		return function(v) {
			return String(v).match(regexp);
		};
	},

	/**
	 * Create function that will tokenize `query` string and return true if
	 * __all__ of the tokens match string passed to the function.
	 * @param {String} query Query string.
	 * @return {Function} Matcher function.
	 * @return {String} return.str String to test for the match.
	 */
	createMatchAll: function(query) {
		var words = TextUtils.splitQuery(query);
		if (words.length == 0) {
			return function() {
				return true;
			};
		}

		var regexps = words.map(function(word) {
			return new RegExp('(^|\\s)(' + word + ')', 'g');
		});

		return function(v) {
			v = String(v);

			return regexps.every(function(r) {
				return v.match(r);
			});
		};
	},
};

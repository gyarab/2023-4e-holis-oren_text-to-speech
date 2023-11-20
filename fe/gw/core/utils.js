/**
 * @class GW
 * @singleton
 */

Object.assign(GW, {
	/**
	 * @method uniqueId
	 * Gererate unique ID with given prefix.
	 * @param {String} prefix ID prefix.
	 * @return {String} Unique ID.
	 */
	uniqueId: (function() {
		var idCounter = 0;

		return function(prefix) {
			idCounter++;

			return (typeof prefix == 'string' ? prefix : '') + idCounter;
		};
	})(),

	/**
	 * Call function when/if document is loaded.
	 * @param {Function} fn Function to call.
	 */
	ready: function(fn) {
		if (document.readyState == 'loading') {
			document.addEventListener("DOMContentLoaded", function(event) {
				fn();
			});
		} else {
			fn();
		}
	},

	isPlainObject: function(o) {
		return (typeof o == 'object' || typeof o == 'function') && !!o;
	},

	/**
	 * Escape special HTML characters.
	 * @param {String} str String.
	 * @return {String} HTML safe code.
	 */
	htmlEncode: function(str) {
		return String(str).replace(/&/g, "&amp;").replace(/>/g, "&gt;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
	},
});

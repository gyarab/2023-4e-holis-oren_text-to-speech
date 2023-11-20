Utils = {
	// {{{ Unique id

	uniqueId: function() {
		let id = 1;
		return function(prefix) {
			if (prefix) {
				return prefix + (id++);
			}

			return id++;
		};
	}(),

	// }}}
	// {{{ DOM manipulation

	selectListItem(ct, itemSel, selectedCls, filterFn) {
		ct.querySelectorAll(`${itemSel}.${selectedCls}`).forEach(i => i.classList.remove(selectedCls));

		return Array.from(ct.querySelectorAll(`${itemSel}`)).find(i => {
			if (filterFn && filterFn(i)) {
				i.classList.add(selectedCls);
				return true;
			}
		});
	},

	syncRenderList({ct, id, eq, list, onRemove, onAdd, onUpdate, removeForeign = false, debug = false, keepSelection = true}) {
		let currentItemsMap = Array.from(ct.children).reduce((m, i, idx) => {
			if (i.$syncId) {
				m[i.$syncId] = i;
			}
			return m;
		}, {});
		let restoreSel = keepSelection ? Utils.saveSelection(ct) : null;
		let formerChildSet = new Set(ct.childNodes);
		let newChildList = [];

		debug && console.group('sync', ct);

		id = id || (i => i.id);
		eq = eq || function(a, b) {
			return a === b || JSON.stringify(a) == JSON.stringify(b);
		};

		list.forEach((ni, idx) => {
			let niId = id(ni);
			let el = currentItemsMap[niId];
			if (el) {
				delete currentItemsMap[el.$syncId];

				if (!eq(el.$syncItem, ni)) {
					if (!onUpdate || onUpdate(el, ni, el.$syncItem) === false) {
						let tmp = el;
						el = onAdd(ni);
						tmp.replaceWith(el);
					}
					debug && console.log('updated', el, ni);
				} else {
					debug && console.log('kept', el, ni);
				}
			} else {
				el = onAdd(ni);
				debug && console.log('added', el, ni);
			}

			el.$syncId = niId;
			el.$syncItem = ni;

			newChildList.push(el);
			formerChildSet.delete(el);
		});

		for (let el of Object.values(currentItemsMap)) {
			if (onRemove) {
				onRemove(el);
			} else {
				el.remove();
			}
			debug && console.log('removed', el, el.$syncItem);
		}

		if (removeForeign) {
			for (let el of formerChildSet) {
				el.remove();
				debug && console.log('removed foreign', el);
			}
		}

		// re-order children elements to match the new order
		newChildList.forEach((el, idx) => {
			debug && console.log('cur', ct.children[idx], 'should be', el);
			if (ct.children[idx] !== el) {
				debug && console.log('reordering', el, 'before', ct.children[idx]);
				ct.insertBefore(el, ct.children[idx]);
			}
		});

		debug && console.groupEnd();

		keepSelection && restoreSel();
	},

	// }}}
	// {{{ Array helpers

	orderByKeyList(list, keyOrder, keyProp = 'id') {
		let out = [];
		let order = keyOrder || [];
		let map = list.reduce((m, i) => {
			m[i[keyProp]] = i;
			return m;
		}, {});

		order.forEach(id => {
			let p = map[id];
			if (p) {
				out.push(p);
				delete map[id];
			}
		});

		let rest = list.filter(i => map[i[keyProp]]);

		return [out, rest];
	},

	/**
	 * Replace item in the array with a new version, creating a new array.
	 *
	 * Used to update list of objects that are uniquely identified by
	 * `idProp`.
	 */
	replaceArrayItem(arr, newItem, idProp = 'id') {
		let idx = arr.findIndex(i => i[idProp] === newItem[idProp]);
		if (idx < 0) {
			return arr.concat([newItem]);
		}

		arr = arr.slice();
		arr.splice(idx, 1, newItem);

		return arr;
	},

	// }}}
	// {{{ Timing helpers

	isOlderThan(loadTime, timeout) {
		return !loadTime || (loadTime + timeout) < performance.now();
	},

	// }}}
	// {{{ Key event herlpers

	describeKeyEvent(ev) {
		return (ev.ctrlKey ? 'Ctrl_' : '') + (ev.altKey ? 'Alt_' : '') + (ev.shiftKey ? 'Shift_' : '') + ev.key;
	},

	// }}}
	// {{{ Local storage

	setLocalState(sel, value) {
		let key = Object.entries(sel);

		key.sort((a, b) => {
			return a[0].localeCompare(b[0]);
		});

		if (typeof value == 'undefined') {
			localStorage.clearItem(JSON.stringify(key));
		} else {
			localStorage.setItem(JSON.stringify(key), JSON.stringify(value));
		}
	},

	getLocalState(sel, defaultValue) {
		let key = Object.entries(sel);

		key.sort((a, b) => {
			return a[0].localeCompare(b[0]);
		});

		try {
			let v = localStorage.getItem(JSON.stringify(key));
			if (v === null) {
				return defaultValue;
			}

			return JSON.parse(v);
		} catch(ex) {
			return defaultValue;
		}
	},

	// }}}
	// {{{ Icons

	iconsFile: '',

	useIcon(name, config) {
		if (!name) {
			return null;
		}

		let svgNs = 'http://www.w3.org/2000/svg';
		let svg = document.createElementNS(svgNs, 'svg');
		let use = svg.appendChild(document.createElementNS(svgNs, 'use'));
		let vb = ICON_SIZES[name];
		let c = config || {};

		svg.classList.add('icon');
		svg.dataset.name = name;

		if (vb) {
			svg.setAttribute('viewBox', vb[0]);
			svg.setAttribute('width', vb[1] + 'px');
			svg.setAttribute('height', vb[2] + 'px');
			svg.style = '--width:' + vb[1] + 'px;--height:' + vb[2] + 'px';
		}

		if (c.cls) {
			svg.classList.add(c.cls);
		}

		use.setAttribute('href', Utils.iconsFile + '#icon-' + name);

		return svg;
	},

	// }}}
	// {{{ Abort control

	abort(ref, name) {
		name = '__abort__' + name;

		if (ref[name]) {
			ref[name].abort();
			delete ref[name];
		}
	},

	abortAndRetry(ref, name) {
		name = '__abort__' + name;

		if (ref[name]) {
			ref[name].abort();
			delete ref[name];
		}

		ref[name] = new AbortController();

		return ref[name].signal;
	},

	// }}}
	// {{{ Periodic callbacks

	interval(ref, name, time, cb) {
		let timeout;

		name = '__interval__' + name;

		function schedule() {
			timeout = ref[name] = setTimeout(async () => {
				try {
					await cb();
				} finally {
					// was aborted
					if (ref[name] !== timeout) {
						return;
					}

					schedule();
				}
			}, time);
		}

		schedule();
	},

	abortInterval(ref, name) {
		name = '__interval__' + name;

		if (ref[name]) {
			clearTimeout(ref[name]);
			delete ref[name];
		}
	},

	// }}}
	// {{{ One shot timers

	timer(ref, name, time, cb) {
		name = '__timer__' + name;

		clearTimeout(ref[name]);
		ref[name] = setTimeout(() => {
			cb();
			delete ref[name];
		}, time);
	},

	abortTimer(ref, name) {
		name = '__timer__' + name;

		if (ref[name]) {
			clearTimeout(ref[name]);
			delete ref[name];
		}
	},

	// }}}
	// {{{ Local data caching

	async cache(ref, name, timeout, cb, ...args) {
		name = '__cache__' + name;
		let cache = ref[name];
		let now = performance.now();
		let fresh = false;
		let argsTag = JSON.stringify(args);

		if (!cache || cache.until < now || argsTag != cache.argsTag) {
			cache = ref[name] = {
				argsTag,
				until: now + timeout,
				data: await cb(...args),
			};

			fresh = true;
		}

		return [cache.data, fresh];
	},

	clearCache(ref, name) {
		if (!name) {
			for (let [k, v] of Object.entries(ref)) {
				if (k.startsWith('__cache__')) {
					delete ref[k];
				}
			}
		}

		delete ref['__cache__' + name];
	},

	// }}}
	// {{{ Focus helpers

	isFocussed(el) {
		let a = document.activeElement;

		return a && (el.contains(a) || el.isSameNode(a));
	},

	saveSelection(ct) {
		let sel = getSelection();
		let range = sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
		if (range && (!ct || ct.contains(range.startContainer))) {
			range = {
				startContainer: range.startContainer,
				endContainer: range.endContainer,
				startOffset: range.startOffset,
				endOffset: range.endOffset,
			};
		} else {
			range = null;
		}

		return function() {
                        // preserve selection
                        if (range) {
                                sel.removeAllRanges();

                                let r = new Range();
                                r.setStart(range.startContainer, range.startOffset);
                                r.setEnd(range.endContainer, range.endOffset);
                                sel.addRange(r);
                        }
		};
	},

	// }}}
	// {{{ Promise helpers

	/*
	 * This creates a promise object with resolve and reject functions
	 * attached to the promise object.
	 */
	makeCompleter() {
		let _res, _rej;
		let p = new Promise((res, rej) => {
			_res = res;
			_rej = rej;
		});
		p.resolve = _res;
		p.reject = _rej;
		return p;
	},

	timeoutPromise(ms) {
		return new Promise(res => {
			setTimeout(res, ms);
		});
	},

	// }}}
	// {{{ URL helpers

	/*
	 * Take malformed URL and add http:// in front. Also sanititze URL
	 * schema if it is provided, to avoid XSS via javascript:. links
	 */
	formatUrl(s) {
		s = String(s).trim();

		// avoid javascript urls completely
		if (s.match(/^javascript\s*:/i)) {
			return 'javascript:alert("JavaScript link blocked")';
		}

		let m = s.match(/^([a-zA-Z0-9+.-]+):/);
		if (!m) {
			// strings with no schema get translated to http://
			return 'http://' + s.replace(/^\/\//, '');
		}

		// allow all other schemas
		return s;
	},

	// }}}
	// {{{ Browser sniffing

	isHomeScreenView() {
		return ["fullscreen", "standalone", "minimal-ui"].some(v => 
			window.matchMedia('(display-mode: ' + v + ')').matches
		);
	},

	isMobileSafari() {
		var ua = navigator.userAgent || '';

		return ua.match(/iP[ao]d|iPhone/i) && ua.match(/WebKit/i);
	},

	isSafari() {
		var v = navigator.vendor || '';

		return v.match(/apple/i);
	},

	// }}}
	// {{{ Date/time

	parseDateIso(date, utc) {
		if (date instanceof Date) {
			return date;
		}

		if (typeof date == 'number') {
			return new Date(1000 * date);
		}

		if (typeof date != 'string') {
			return null;
		}

		var m = date.match(/^(\d{4})-(\d{2})-(\d{2})(?:(?:\s+|T)(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?)?(Z)?/), i;
		if (m) {
			for (i = 1; i <= 6; i++) {
				m[i] = m[i] ? Number(m[i]) : 0;
			}

			if (utc == null) {
				if (m[7] == 'Z') {
					utc = true;
				} else {
					utc = false;
				}
			}

			let d = new Date;
			if (utc) {
				d.setUTCHours(m[4], m[5], m[6], 0);
				d.setUTCFullYear(m[1], m[2] - 1, m[3]);
			} else {
				d.setHours(m[4], m[5], m[6], 0);
				d.setFullYear(m[1], m[2] - 1, m[3]);
			}

			return d;
		}

		return null;
	},

	formatDateIso(d, time = false) {
		d = Utils.parseDateIso(d);
		if (!d) {
			return d;
		}

		function p(n, len = 2) {
			return String(n).padStart(len, '0');
		}

		return p(d.getFullYear(), 4) + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
			(time ? ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()) : '');
	},

	formatUTCDateIso(d, time = false) {
		d = Utils.parseDateIso(d);
		if (!d) {
			return d;
		}

		function p(n, len = 2) {
			return String(n).padStart(len, '0');
		}

		return p(d.getUTCFullYear(), 4) + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate()) +
			(time ? ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()) + ':' + p(d.getUTCSeconds()) + 'Z' : '');
	},

	getElapsedTime(start) {
		let interval = Math.floor((new Date() - Utils.parseDateIso(start)) / 1000);
		let m = Math.floor(interval / 60);
		let s = interval % 60;

		return String(m).padStart(1, '0') + ':' + String(s).padStart(2, '0');
	},

	secondsToHoursMinutes(seconds) {
		var date = new Date(null);
		date.setSeconds(seconds);
		return date.toISOString().substr(11, 8);
	},

	// }}}
	// {{{ Scrolling

	scrollIntoView(el, opts = {behavior: 'smooth'}) {
		let eb = el.getBoundingClientRect();
		let op = el.parentNode;
		while (op && op.scrollHeight == op.clientHeight) {
			op = op.parentNode;
		}

		if (!op) {
			return;
		}

		let vb = op.getBoundingClientRect();
		if (eb.top < vb.top || eb.bottom > vb.bottom) {
			el.scrollIntoView(opts);
		}
	},

	// }}}
        // {{{ CSS

	getStyleRootProperty(name) {
		if (!this.cachedStyle) {
			this.cachedStyle = getComputedStyle(document.documentElement);
		}

		return this.cachedStyle.getPropertyValue(name);
	},

	resolveCSSVar(str) {
		if (typeof str != 'string') {
			return null;
		}

		let m = str.match(/^\s*var\((--[0-9a-z-]+)(?:\s*,([^)]+))?\)\s*$/i);
		if (!m) {
			return str;
		}

		return this.getStyleRootProperty(m[1]) || (m[2] != null ? m[2].trim() : null);
	},

	// }}}
};

URLSearchParams.prototype.setOrDelete = function(k, v) {
	if (v == null) {
		this.delete(k);
	} else {
		this.set(k, v);
	}
};

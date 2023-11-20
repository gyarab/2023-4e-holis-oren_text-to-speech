i18n.LANGUAGES = [{
	id: 'cs',
	lang: 'cs-CZ',
	name: 'Česky',
}, {
	id: 'en',
	lang: 'en-US',
	name: 'English',
}];

function prepFormat(valPrep, fmt, postProc = v => v) {
	return v => {
		if (v != null) {
			v = valPrep(v);

			return postProc(fmt.format(v));
		}

		return '';
	};
}

Formats = ((lang) => ({
	
	time: prepFormat(v => new Date(v * 1000), new Intl.DateTimeFormat(lang, { hour: 'numeric', minute: 'numeric', second: 'numeric' })),
	
	date: prepFormat(v => new Date(v * 1000), new Intl.DateTimeFormat(lang, { year: 'numeric', month: 'numeric', day: 'numeric' })),
	date_utc: prepFormat(v => new Date(v * 1000), new Intl.DateTimeFormat(lang, { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' })),
	datetime: prepFormat(v => new Date(v * 1000), new Intl.DateTimeFormat(lang, { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric'})),

	date_weekday: prepFormat(v => new Date(v * 1000), new Intl.DateTimeFormat(lang, { weekday: 'short', year: 'numeric', month: 'numeric', day: 'numeric' })),
	
	date_or_datetime: v => {
		if (v == null) {
			return '';
		}

		let vd = new Date(v * 1000);
		if (vd.getHours() == 0 && vd.getMinutes() == 0 && vd.getSeconds() == 0) {
			return Formats.date(v);
		} else {
			return Formats.datetime(v);
		}
	},

	input_date: v => {
		let d = new Date(v * 1000);

		if (lang == 'cs-CZ') {
			return d.getDate() + '.' + (d.getMonth() + 1) + '.' + d.getFullYear();
		} else {
			return (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear();
		}
	},

	input_datetime: v => {
		let d = new Date(v * 1000);
		let has_time = (d.getHours() + d.getMinutes() + d.getSeconds() + d.getMilliseconds()) > 0;

		function p(number) {
			return number < 10 ? '0' + number : number;
		}

		return Formats.input_date(v) + (has_time ? ' ' + d.getHours() + ':' + p(d.getMinutes()) : '');
	},

	percent: v => {
		if (v === null || v === undefined) {
			return '';
		}
		v = Math.round(v * 100);
		return v + '\u2009%';
	},

	bool: v => {
		return v ? 'Ano' : 'Ne';
	},

	call_direction: v => {
		return {
			internal: 'Interní',
			'in': 'Příchozí',
			'out': 'Odchozí',
		}[v] || v;
	},

	call_result: v => {
		return {
			connected: 'Spojený',
			abandoned: 'Opuštěný',
			rejected: 'Odmítnutý',
			missed: 'Zmeškaný',
			busy: 'Obsazený',
		}[v] || 'Neuskutečněný';
	},
	
	duration: v => {
		if (v === null || v === undefined) {
			return '';
		}
		v = Math.floor(v / 1000);
		return [
			(v / 60 / 60) | 0,
			(v / 60 % 60) | 0,
			(v % 60) | 0,
		]
			.join(":")
			.replace(/\b(\d)\b/g, "0$1");
	}
}))({
	cs: 'cs-CZ',
	en: 'en-US',
}[i18n.lang]);

let Uploads = {
	fileSelect(accept) {
		return new Promise((res, rej) => {
			let fileEl = document.gwCreateElement({
				nodeName: 'input',
				type: 'file',
				accept,
				capture: 'environment',
				'style:display': 'none',
				'on:change': ev => {
					res(fileEl.files[0]);
					fileEl.remove();
				}
			});

			// iOS Safari requires file input to be in the DOM
			document.body.appendChild(fileEl);
			fileEl.click();
		});
	},

	uploadFile(path, file, {signal, progress, headers} = {}) {
		return new Promise((res, rej) => {
			let xhr = new XMLHttpRequest();

			if (signal instanceof AbortSignal) {
				signal.onabort = () => {
					rej(new AbortError);
					xhr.abort();
				};
			}

			xhr.open('POST', path, true);
			xhr.timeout = 60 * 60 * 1000; // 1 hour
			xhr.responseType = 'json';
			xhr.setRequestHeader('X-Anti-CSRF', '1');
			for (let [k, v] of Object.entries(headers || {})) {
				xhr.setRequestHeader(k, v);
			}

			xhr.onabort = ev => {
				rej(new AbortError);
			};

			xhr.ontimeout = ev => {
				rej(new Error('Nahrání selhalo - vypršel časový limit'))
			};

			xhr.onerror = ev => {
				rej(new Error('Nahrání selhalo - neznámá chyba'))
			};

			xhr.upload.onprogress = ev => {
				if (ev.lengthComputable) {
					progress && progress(ev);
				}
			};

			xhr.onload = ev => {
				if (xhr.status >= 200 && xhr.status < 300) {
					res(xhr.response);
				} else {
					let err = new Error(xhr.response ? xhr.response.error : 'Neznámá chyba');
					err.xhr = xhr;
					rej(err);
				}
			};

			xhr.send(file);
		});
	},
};

let Charts = (() => {
	
	// callbacks to run on library load
	let libraryOnLoad = [];
	
	function loadLibrary() {
		if (typeof Chart !== 'undefined') {
			// already loaded or loading
			return;
		}
		const s = document.createElement('script');
		s.src = '/vendor/chart-3.6.0.min.js';
		s.onload = function () {
			if (typeof Chart === 'function') {
				for (let callback of libraryOnLoad) {
					callback();
				} 
			} else {
				console.error('No Chart object available after loading chart library. Charts will not be drawn');
			}
			libraryOnLoad = null;
		}
		s.onerror = function (e) {
			console.warn("Could not load chart library", e);
			libraryOnLoad = null;
		}
		document.body.appendChild(s);
		Chart = true; // set Chart to avoid parallel loading
	}
	
	function runOnLoaded(cb) {
		if (libraryOnLoad) {
			libraryOnLoad.push(cb);
		} else if (typeof Chart === 'function') {
			// chart library loaded, run callback directly
			cb();
		}
	}

	function makeChart(el, label, config) {
		el.dataset.format = config.type; // for CSS styling

		let canvas = el.gwCreateChild({
			nodeName: 'canvas',
			style: 'display: inline-block',
			width: 34,
			height: 34,
		});

		if (label) {
			el.gwCreateChild({
				nodeName: 'span',
				textContent: label,
			});
		}

		runOnLoaded(() => new Chart(canvas.getContext('2d'), config));
	}
	
	return {
		loadLibrary,

		/*
		 * make doughnut chart, independent on used library
		 * - el
		 * - groups: doughnut graph groups
		 *   - label
		 *   - color
		 *   - value
		 * - label
		 */
		makeDoughnut(el, groups, label) {
			let colors = groups.map(g => Utils.resolveCSSVar(g.color));
			let labels = groups.map(g => g.label);

			makeChart(el, label, {
				type: 'doughnut',
				data: {
					labels,
					datasets: [{
						data: groups.map(g => g.value),
					}],
				},
				options: {
					responsive: false,
					maintainAspectRatio: false,
					animation: false,
					backgroundColor: colors,
					cutout: '42%',
					borderWidth: 1,
					borderColor: Utils.getStyleRootProperty('--graph-border-color'),
					events: [],
					plugins: {
						legend: {display: false},
						tooltip: {enabled: false}
					},
				},
			});
		},
	}
	
})();
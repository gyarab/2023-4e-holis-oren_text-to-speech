// {{{ Startup

GW.ready(function() {
	// check for stylesheet changes and reload styles automatically
	function reloadStyles() {
		document.querySelectorAll('link[rel=stylesheet]').forEach(el => {
			if (!el.origHref) {
				el.origHref = el.href;
			}

			el.href = el.origHref + '?_ts=' + new Date().getTime();
		});
	}

	window.addEventListener('keydown', ev => {
		if (ev.key == 'F4') {
			ev.preventDefault();
			reloadStyles();
		}
	}, true);

	window.onerror = function(msg, url, line, pos, err) {
		//XXX: log error to the server (and avoid duplicit reports)
	};

	window.onunhandledrejection = ev => {
		/*
		 * We don't want to report REST API aborts caused by a signal.
		 */
		if (ev.reason instanceof AbortError) {
			return;
		}

		if (ev.reason instanceof RESTError) {
			Application.notify({
				kind: 'error',
				text: ev.reason.serverError ? ev.reason.serverError : 'Server error' + ': ' + ev.reason.message,
				priority: 5,
				timeout: 5000,
			});
		} else if (ev.reason instanceof Error) {
			Application.notify({
				kind: 'error',
				text: 'Unhandled rejection' + ': ' + ev.reason.message,
				priority: 5,
				timeout: 5000,
			});
		}

		//console.error('unhandled rejection:', ev.reason);
	};

	Application.run();
});

// }}}

GW.define('GW.Application', 'GW.Component', {
	routes: [],
	inits: [],
	broadcastWatches: [],
	nextZIndex: 100,
	priv: Symbol('app-data'),

	initComponent() {
		this.el = document.gwCreateElement({
			className: 'application'
		});

		document.head.gwCreateChild({
			nodeName: 'style',
			textContent: `
				.application > :not(:first-child) {
					display: none;
				}
			`
		});
	},

	activateCard(c) {
		document.documentElement.dataset.appcardid = c.id || '';
		document.documentElement.dataset.appcardtype = c.constructor.__className__;
		c.activate && c.activate();
	},

	/**
	 * Shows a card
	 * @param xtype {string} Type of card
	 */
	show(config) {
		for (let el of Array.from(this.el.children)) {
			let c = el.gwComponent;
			if (c && config.id && c.id === config.id) {
				this.activateCard(c);
				return c;
			} else if (c) {
				c.destroy();
			} else {
				el.remove();
			}
		}

		let c = GW.create(config);

		this.el.prepend(c.el);
		this.activateCard(c);

		document.body.scrollTop = 0;
		return c;
	},

	showOver(config) {
		let c = GW.create(config);
		c[this.priv] = 'overlay';

		this.el.prepend(c.el);
		this.activateCard(c);

		document.body.scrollTop = 0;
		return c;
	},

	closeOver() {
		for (let el of Array.from(this.el.children)) {
			let c = el.gwComponent;
			if (c && c[this.priv] == 'overlay') {
				c.destroy();
			}
		}

		for (let el of Array.from(this.el.children)) {
			let c = el.gwComponent;
			if (c) {
				this.activateCard(c);
				break;
			}
		}
	},

	addInit(cb) {
		this.inits.push(cb);
	},

	// {{{ Routing

	addRoute(r) {
		let captures = [];
		let re = r.path.replace(/\//g, '\\/').replace(/\{([a-z_0-9-]+)(?::([a-z]+))?\}/g, function(m, name, type) {
			captures.push({
				name,
				type: type || 'int'
			});

			if (!type || type == 'int') {
				return '([0-9]+)';
			} else if (type == 'str') {
				return '([A-Za-z0-9-]+)';
			} else if (type == 'rest') {
				return '(.*)';
			} else {
				throw new Error('Invalid endpoint capture type: ' + type);
			}
		});

		re = new RegExp('^' + re + '$');

		let match = function(pathname) {
			re.lastIndex = 0;

			let m = re.exec(pathname);
			if (!m) {
				return false;
			}

			let out = {};

			captures.forEach((c, idx) => {
				let v = m[idx + 1];

				if (c.type == 'int') {
					v = Number(v);
				}

				out[c.name] = v;
			});

			return out;
		};

		this.routes.push({
			...r,
			match,
		});
	},

	addRoutes(list) {
		list.forEach(r => this.addRoute(r));
	},

	async route({path = location.pathname, paramsFn = p => p, resolve = true, mode = 'replace'} = {}) {
		path = path.replace(/\/{2,}/, '/').replace(/\/$/, '') || '/';

		let params = paramsFn(new URLSearchParams(location.search));
		let paramsStr = params.toString();
		let url = new URL(path + (paramsStr ? '?' + paramsStr : ''), location.href);

		if (mode == 'push') {
			history.pushState({}, '', url.toString());
		} else if (mode == 'replace') {
			history.replaceState({}, '', url.toString());
		}

		if (resolve) {
			await this.resolveRoute(url);
		}
	},

	// simple route() helpers
	pushRoute(path) {
		return this.route({
			path,
			paramsFn: () => new URLSearchParams(),
			mode: 'push',
		});
	},

	replaceRoute(path) {
		return this.route({
			path,
			paramsFn: () => new URLSearchParams(),
		});
	},

	async resolveCurrentRoute() {
		await this.resolveRoute(new URL(location.href));
	},

	findRouteForURL(url) {
		let path = url.pathname.replace(/\/{2,}/, '/').replace(/\/$/, '') || '/';

		for (let route of this.routes) {
			let captures = route.match(path);
			if (captures) {
				return {
					path,
					captures,
					params: url.searchParams,
					route,
				};
			}
		}
	},

	async commonRouteHandler(match) {
	},

	async missingRouteHandler(url) {
		this.show({
			id: '__missing_route__',
			initComponent() {
				this.el = document.gwCreateElement({
					textContent: 'Missing route for ' + url.pathname,
				});
			},
		});
	},

	async resolveRoute(url) {
		let match = this.findRouteForURL(url);
		if (match) {
			this.routePath = match.path;
			this.routeGroup = match.route.group;
			this.routeMatch = match;

			document.documentElement.dataset.routegroup = this.routeGroup || '';

			if (await this.commonRouteHandler(match))
				return;

			await match.route.handler(match);
			return;
		}

		await this.missingRouteHandler(url);
	},

	isRouteGroup(group) {
		return this.routeGroup == group;
	},

	getCurrentRoute() {
		return this.routeMatch && this.routeMatch.route;
	},

	onDocumentClick(ev) {
		if (ev.button !== 0) {
			return;
		}

		// handle left mouse clicks on internal links with app routing mechanism
		// if possible
		let a = ev.target.closest('a');
		if (a && !ev.defaultPrevented) {
			let href = a.getAttribute('href');
			if (!href || (!href.startsWith('/') && !href.startsWith('?'))) {
				return;
			}

			let url = new URL(href, location.href);
			if (!this.findRouteForURL(url)) {
				return;
			}

			ev.stopPropagation();
			ev.preventDefault();

			this.route({
				path: url.pathname,
				paramsFn: () => url.searchParams,
				mode: 'push',
			});
		}
	},

	// }}}
	// {{{ Mobile UI

	isMobileUIDetected() {
		// if user can't hover or has thick fingers, then we show mobile UI
		return matchMedia('(hover: none)').matches
			|| matchMedia('(pointer: coarse)').matches;
	},

	isMobileUI() {
		return this.isMobileUIValue;
	},

	getForcedUIVariant() {
		return localStorage.getItem('ui-variant');
	},

	forceUIVariant(variant) {
		if (variant) {
			localStorage.setItem('ui-variant', variant);
		} else {
			localStorage.removeItem('ui-variant');
		}

		location.reload();
	},

	getVersion() {
		return VERSION;
	},

	// }}}
	// {{{ Local broadcasts

	setupClientId() {
		let bid = new Uint8Array(16);
		window.crypto.getRandomValues(bid);
		let chars = "0123456789abcdef";
		let id = '';
		for (let v of bid) {
			id += chars[(v >> 4) & 0xf];
			id += chars[v & 0xf];
		}
		this.clientId = id;
	},

	onBroadcastMessage(msg) {
		if (typeof msg == 'object' && msg) {
			for (let w of this.broadcastWatches) {
				w(msg);
			}
		}
	},

	addBroadcastWatch(cb) {
		this.broadcastWatches.push(cb);
	},

	broadcastMessage(msg) {
		if (this.broadcastChannel) {
			this.broadcastChannel.postMessage(msg);
		} else {
			let msgKey = '--msg--' + this.clientId + '-' + (this.nextMsgId++);
			localStorage.setItem(msgKey, JSON.stringify(msg));
			localStorage.removeItem(msgKey);
		}
	},

	setupBroadcastChannel() {
		this.setupClientId();

		if (window.BroadcastChannel) {
			this.broadcastChannel = new BroadcastChannel('app');
			this.broadcastChannel.onmessage = ev => {
				this.onBroadcastMessage(ev.data);
			};
		} else {
			window.addEventListener('storage', ev => {
				let m = (ev.key || '').match(/^--msg--([a-f0-9]+)/);
				if (m && m[1] != this.clientId && ev.newValue) {
					this.onBroadcastMessage(JSON.parse(ev.newValue));
				}
			});

			this.nextMsgId = 1;
		}
	},

	// }}}
	// {{{ UI Notifications

	showNotification(n) {
		let me = this;

		if (this.notifyEl) {
			this.notifyEl.remove();
		}

		if (!n) {
			return;
		}

		function runCallback(cb, event) {
			cb({
				event,
				close() {
					me.notifyRemove(n);
				},
				notification: n
			});
		}

		let icon = {
			success: 'check',
		}[n.kind];

		this.notifyEl = document.body.gwCreateChild({
			className: 'notify-bar',
			'attr:data-kind': n.kind,
			children: [icon ? {
				className: 'status-icon',
				children: [Utils.useIcon(icon)],
			} : undefined, {
				className: 'text',
				textContent: n.text,
				innerHTML: n.html,
				children: n.children,
				'on*:click': ev => {
					let a = ev.target.closest('a');
					if (a && this.notifyEl.contains(a)) {
						let action = a.dataset.action;
						if (action) {
							ev.preventDefault();

							let cb = (n.actions || {})[action];
							if (cb) {
								runCallback(cb, ev);
							}
						}
					}
				},
			}, {
				nodeName: 'a',
				className: 'close',
				href: '#',
				title: _('close'),
				textContent: '✕',
				'on:click': ev => {
					ev.preventDefault();

					let cb = (n.actions || {}).close;
					if (cb) {
						runCallback(cb, ev);
					} else {
						this.notifyRemove(n);
					}
				},
			}],
		});

		let nb = this.notifyEl.getBoundingClientRect();
		if (this.isMobileUI()) {
			Object.assign(this.notifyEl.style, {
				left: ((window.innerWidth - nb.width) / 2) + 'px',
				'z-index': Application.nextZIndex++,
			});
		} else {
			Object.assign(this.notifyEl.style, {
				left: ((window.innerWidth - nb.width) / 2) + 'px',
				'z-index': Application.nextZIndex++,
			});
		}
	},

	initNotifications() {
		Utils.interval(this, 'notify_remove', 500, () => {
			// pop notifications periodically
			let now = performance.now();
			let list = this.notifications || [];
			if (list.length > 0 && list[0].expires < now) {
				this.notifyRemove();
			}
		});
	},

	/*
	 * This maintains a stack of notifications
	 *
	 * if notificatin is exclusive, it will replace previously
	 * existing notification
	 */
	notify(config) {
		if (!this.__notify_index__) {
			this.__notify_index__ = 1;
		}

		let notification = {
			exclusive: config.exclusive, // exclusive id
			text: config.text,
			html: config.html,
			children: config.children,
			actions: config.actions,
			kind: config.kind || 'error',
			timeout: config.timeout,
			priority: config.priority || 10,
			added: performance.now(),
			index: this.__notify_index__++,
		};

		// if the notification is exclusive, remove the existing one
		// with the same 'exclusive' id first
		let notifications = this.notifications || [];
		if (notification.exclusive) {
			notifications = notifications.filter(n => n.exclusive !== notification.exclusive);
		}

		notifications = notifications.concat([notification]);

		// sort the notifications, so that those with highest priority
		// are first, if priority is equal, sort by time of addition
		notifications.sort((a, b) => {
			let pdiff = b.priority - a.priority;
			if (pdiff == 0) {
				return a.index - b.index;
			}

			return pdiff;
		});

		// set expiry on the topmost notification if not set already
		if (notifications.length > 0 && !notifications[0].expires) {
			notifications[0].expires = performance.now() + (notifications[0].timeout || Infinity);
		}

		this.notifications = notifications;
		this.showNotification(this.notifications[0]);
	},

	notifyRemove(notification) {
		let notifications = this.notifications;

		if (notification) {
			if (notification.exclusive) {
				notifications = notifications.filter(n => n.exclusive !== notification.exclusive);
			} else {
				notifications = notifications.filter(n => n !== notification);
			}
		} else {
			// remove top notification if nothing else is not specified
			notifications = notifications.slice(1);
		}

		// reset expiry time for the new topmost notification
		if (notifications.length > 0) {
			notifications[0].expires = performance.now() + (notifications[0].timeout || Infinity);
		}

		this.notifications = notifications;
		this.showNotification(this.notifications[0]);
	},

	notifyClearAll() {
		this.notifications = [];
	},

	// }}}
	// {{{ Keys

	onKeyDown(ev) {
		let prop = '$key_' + Utils.describeKeyEvent(ev);

		let el = ev.target;
		while (el) {
			let c = el.gwComponent;

			if (c && c[prop] && c[prop](ev)) {
				break;
			}

			if (c && c.$key_any && c.$key_any(ev)) {
				break;
			}

			if (el[prop] && el[prop](ev)) {
				break;
			}

			if (el.$key_any && el.$key_any(ev)) {
				break;
			}

			el = el.parentNode;
		}
	},

	// }}}
	// {{{ DnD

	initFileDnD() {
		document.addEventListener('dragover', ev => {
			let el = ev.target.closest('.drop-zone');
			for (let c of document.querySelectorAll('.drop-zone-active')) {
				if (c !== el) {
					c.classList.remove('drop-zone-active');
				}
			}

			if (el) {
				el.classList.add('drop-zone-active');
			}

			ev.preventDefault();
		});

		document.addEventListener('dragleave', ev => {
			if (!ev.fromElement || ev.fromElement.matches('.drop-zone-active')) {
				for (let c of document.querySelectorAll('.drop-zone-active')) {
					c.classList.remove('drop-zone-active');
				}
			}
		}, true);

		document.addEventListener('drop', ev => {
			ev.preventDefault();

			for (let c of document.querySelectorAll('.drop-zone-active')) {
				c.classList.remove('drop-zone-active');
			}

			let el = ev.target.closest('.drop-zone');
			if (el) {
				let files = [];
				if (ev.dataTransfer.items) {
					for (let i = 0; i < ev.dataTransfer.items.length; i++) {
						if (ev.dataTransfer.items[i].kind === 'file') {
							files.push(ev.dataTransfer.items[i].getAsFile())
						}
					}
				} else {
					for (let i = 0; i < ev.dataTransfer.files.length; i++) {
						files.push(ev.dataTransfer.files[i]);
					}
				}

				el.dispatchEvent(new CustomEvent("dropfiles", {
					detail: {
						files,
					},
				}));
			}
		});
	},

	// }}}

	run() {
		// detect mobile UI
		this.isMobileUIValue = this.isMobileUIDetected();

		let variant = this.getForcedUIVariant();
		if (variant == 'mobile') {
			this.isMobileUIValue = true;
		} else if (variant == 'desktop') {
			this.isMobileUIValue = false;
		}

		document.body.appendChild(this.el);
		document.documentElement.classList.add(this.isMobileUI() ? 'mobile-ui' : 'desktop-ui');

		this.monDom(window, 'popstate', ev => this.resolveCurrentRoute());
		this.monDom(document, 'click', this.onDocumentClick.bind(this));
		this.monDom(document, 'keydown', this.onKeyDown.bind(this), true);

		this.setupBroadcastChannel();

		if (Utils.isSafari()) {
			document.body.classList.add('safari');
		}

		this.initNotifications();
		this.initFileDnD();

		// run init functions
		for (let cb of this.inits) {
			cb();
		}

		this.resolveCurrentRoute();
	},
});

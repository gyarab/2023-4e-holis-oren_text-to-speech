Object.assign(Document.prototype, {
	gwCreateElement: function(config, refs) {
		if (config instanceof Element) {
			return config;
		} else if (typeof config == 'string') {
			return document.createTextNode(config);
		} else if (typeof config != 'object' || !config) {
			return null;
		}

		if (config[':skip']) {
			return null;
		}

		if (config.xtype) {
			var c = GW.create(config);
			if (refs && c.ref) {
				refs[c.ref] = c;
			}

			return c.el;
		}

		var el = this.createElement(config.nodeName || 'div');
		refs = refs || el;

		for (var k in config) {
			if (!config.hasOwnProperty(k)) {
				continue;
			}

			var v = config[k];
			if (v === undefined) {
				continue;
			}

			var colonIndex = k.indexOf(':'), sk;
			if (colonIndex >= 0) {
				sk = k.substr(colonIndex + 1);
				k = k.substr(0, colonIndex + 1);
			}

			switch (k) {
			case 'nodeName':
			case 'children':
				break;

			case 'style':
				if (typeof config[k] == 'string') {
					el.setAttribute('style', v);
				} else if (typeof v == 'object' && v) {
					Object.assign(el.style, v);
				}
				break;

			case 'ref':
				if (refs) {
					refs[v] = el;
				}
				break;

			case 'attributes':
				for (var ak in v) {
					if (v.hasOwnProperty(ak)) {
						el.setAttribute(ak, v[ak]);
					}
				}
				break;

			case 'attr:':
				el.setAttribute(sk, v);
				break;

			case 'on:':
				el.addEventListener(sk, v);
				break;

			case 'on*:':
				el.addEventListener(sk, v, true);
				break;

			case 'style:':
				el.style[sk] = v;
				break;

			default:
				el[k] = v;
			}
		}

		if (Array.isArray(config.children)) {
			config.children.forEach(function(config) {
				el.gwCreateChild(config, refs);
			});
		}

		return el;
	}
});

Object.assign(Element.prototype, {
	gwCreateChild: function(config, refs) {
		var child = document.gwCreateElement(config, refs);
		if (child) {
	                this.appendChild(child);
                }

		return child;
	},

	gwReplaceChildren: function(children, refs) {
		this.textContent = '';

		children.forEach(function(c) {
			this.gwCreateChild(c, refs);
		}, this);
	},
});

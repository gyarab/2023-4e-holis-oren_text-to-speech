GW.define('PopupManager', 'GW.Object', {
	singleton: true,

	initObject() {
		this.popups = [];
		this.popupDataSymbol = Symbol('popup-data');

		let clickHandler = ev => {
                        // check if it's a toggle click
			let inToggle = this.popups.find(p => {
				let toggleEl = p.config && p.config.toggleEl;

				return p.el.parentNode && toggleEl instanceof Element && toggleEl.contains(ev.target);
			});

			if (inToggle) {
				ev.preventDefault();
				ev.stopPropagation();
				this.hideDownTo(inToggle);
				this.hide(inToggle.popup);
				return;
			}

			let inPopup = this.popups.find(p => p.el.contains(ev.target));
			if (!inPopup) {
				this.hideAll();
			} else {
				this.hideDownTo(inPopup);

				if (ev.target.matches('.mobile-mask-overlay')) {
					ev.target.addEventListener('mouseup', ev => {
						this.hide(inPopup.popup);
					});
				}
			}
		};

		document.addEventListener('mousedown', clickHandler, true);

		document.addEventListener('scroll', ev => {
			if (Application.isMobileUI()) {
				return;
			}

			let inPopup = this.popups.find(p => p.el.contains(ev.target));
			if (!inPopup) {
				this.hideAll(p => !p.config.ignoreScroll);
			} else {
				this.hideDownTo(inPopup, p => !p.config.ignoreScroll);
			}
		}, true);
	},

	/**
	 * Position the element.
	 *
	 * By default the element is positioned automatically to a position
	 * that touches the anchor and where the center of the popup is closest
	 * to the center of the screen and fits the viewport.
	 *
	 * If it can't fit, the most fitting position (that obscures the popup
	 * the least) will be selected.
	 *
	 * Optionally, you can opt in to automatic resizing of the popup. The
	 * code will set max-width and max-height so that popup can be placed
	 * on the screen.
	 *
	 * It is also possible to limit the evaluated set of anchor point
	 * combinations. This can be useful for combos and autocompletes, where
	 * the popup to the side would feel out of place.
	 *
	 * It is also possible to enable the arrow that will point to the anchor.
	 *
	 * TODO: anchor arrow
	 *
	 * @param {Element} el Element to position.
	 * @param {Object} config Confguration.
	 * @param {Element} config.anchorEl Anchor to the reference element.
	 * @param {Object} config.anchorBBox Anchor to the reference bounding
	 * box (x, y, width, height).
	 * @param {Event} config.anchorEvent Anchor to the event X/Y point.
	 *
	 * @param {String} config.forceAxis This forces the popup to be attached
	 * to the top/bottom of the anchor (vertical axis), or left/right of
	 * the anchor (horizontal axis).
	 * @param {Boolean} config.preferReadingOrder This increases the fitness
	 * for placing the popup in the reading order = require('the anchor (to the
	 * right or to the bottom). Useful for combos/autocompletes.
	 * @param {Boolean} config.resizeNotFitting This sets max-width and 
	 * max-height no the popup if it is necessary to place it on the screen.
	 * Popup should have overflow auto in such a case.
	 */
	updatePosition(el, config) {
		let anchorEl = config.anchorEl;
		let anchorEvent = config.anchorEvent;
		let anchorBBox = config.anchorBBox;
		let forceAxis = config.forceAxis;
		let preferReadingOrder = config.preferReadingOrder;
		let nextz = Application.nextZIndex++;
		let distance = config.distance || 0;

		el.style['max-width'] = '';
		el.style['max-height'] = '';

		if (el.parentNode !== document.body) {
			document.body.appendChild(el);
		}

		if (config.noLayout) {
			el.style['z-index'] = nextz;
			return;
		}

		if (config.fixed) {
			for (let p of ['top', 'left', 'right', 'bottom']) {
				if (typeof config[p] == 'number') {
					el.style[p] = config[p] + 'px';
				} else if (typeof config[p] == 'string') {
					el.style[p] = config[p];
				}
			}

			Object.assign(el.style, {
				position: 'fixed',
				'z-index': nextz,
			});

			if (config.arrowAnchor instanceof Element) {
				let bba = config.arrowAnchor.getBoundingClientRect();
				let center = bba.x + bba.width / 2;
				let bb = el.getBoundingClientRect();

				if (!el.popupArrow) {
					el.popupArrow = el.gwCreateChild({
						className: 'popup-top-arrow-white',
					});
				}

				let off = center - bb.x - el.popupArrow.offsetWidth / 2;

				el.popupArrow.style.left = off + 'px';
			}

			return;
		}

		if (anchorEl instanceof Element) {
			anchorBBox = anchorEl.getBoundingClientRect();
		} else if (anchorEvent instanceof Event) {
			anchorBBox = {
				x: anchorEvent.clientX,
				y: anchorEvent.clientY,
				width: 0,
				height: 0,
			};
		}

		// enumerate valid attachemnt combinations (non-overlapping)
		let oposite = { t: 'b', b: 't', l: 'r', r: 'l' };
		let points = [];
                for (let s1 of ['l', 'c', 'r']) {
			for (let s2 of ['t', 'c', 'b']) {
				if (s1 != s2) {
					points.push([s1, s2]);
				}
			}
		}

		let attachments = [];
		for (let p1 of points) {
			for (let p2 of points) {
				let cornerTouch = p1[0] == oposite[p2[0]] && p1[1] == oposite[p2[1]];

				if ((p1[0] == oposite[p2[0]] || p1[1] == oposite[p2[1]]) && !cornerTouch) {
					if (forceAxis == 'vertical') {
						if (p1[0] == p2[0]) {
							attachments.push([p1, p2]);
						}
					} else if (forceAxis == 'horizontal') {
						if (p1[1] == p2[1]) {
							attachments.push([p1, p2]);
						}
					} else {
						attachments.push([p1, p2]);
					}
				}
			}
		}

		// get layer size
		let layerBBox = el.getBoundingClientRect();
		let lw = layerBBox.width, lh = layerBBox.height;
		let aw = anchorBBox.width, ah = anchorBBox.height;
		let ax = anchorBBox.x, ay = anchorBBox.y;
		let sw = window.innerWidth, sh = window.innerHeight;

		let anchorY = {
			t: ay - distance,
			c: ay + ah / 2,
			b: ay + ah + distance,
		};
		let anchorX = {
			l: ax - distance,
			c: ax + aw / 2,
			r: ax + aw + distance,
		};
		let layerOffX = {
			l: 0,
			c: -lw / 2,
			r: -lw,
		};
		let layerOffY = {
			t: 0,
			c: -lh / 2,
			b: -lh,
		};

		// assign parameters to combinations of attachments
		attachments = attachments.map(([ap, lp]) => {
			let apx = anchorX[ap[0]];
			let apy = anchorY[ap[1]];
			let lx = apx + layerOffX[lp[0]];
			let ly = apy + layerOffY[lp[1]];

			let fits = lx >= 0 && lx + lw <= sw && ly >= 0 && ly + lh <= sh;
			let hasReadingOrder = (forceAxis == 'horizontal' && lx >= apx)
				|| (forceAxis == 'vertical' && ly >= apy)
				|| (!forceAxis && ly >= apy && lx >= apx);
			let screenCenterDistance = Math.sqrt(
				Math.pow(lx + lw / 2 - sw / 2, 2) + Math.pow(ly + lh / 2 - sh / 2, 2)
			);

			return {
				fits,
				hasReadingOrder,
				screenCenterDistance,
				lx,
				ly,
				ap,
				lp
			};
		});

		attachments.sort((a, b) => {
			return a.screenCenterDistance - b.screenCenterDistance;
		});

                let a = attachments.find(a => a.fits && (!preferReadingOrder || a.hasReadingOrder));
		if (!a && preferReadingOrder) {
			// we couldn't find a fitting attachment that respects
			// the reading order, retry with any fitting attachment
			a = attachments.find(a => a.fits);
		}

		if (!a) {
			// we couldn't find any fitting attachment, just use the
			// best one
			a = attachments[0];
		}

		// we try to slide the popup along the anchor
		// edge to try to fit it to the screen
		if (!a.fits && config.slideToFit) {
			if ((a.lp[0] == 'l' || a.lp[0] == 'r') && (a.ap[0] == 'l' || a.ap[0] == 'r')) {
				// vertical axis
				if (a.ly < 0) {
					a.ly = 0;
				} else if (a.ly + lh > sh) {
					a.ly = Math.max(0, a.ly - (a.ly + lh - sh));
				}
			}
		}

		if (config.resizeNotFitting) {
			let maxLayerWidth, maxLayerHeight;
			if (a.lx < 0) {
				maxLayerWidth = lw + a.lx;
				a.lx = 0;
			} else if (a.lx + lw > sw) {
				maxLayerWidth = Math.max(0, sw - a.lx);
			}

			if (a.ly < 0) {
				maxLayerHeight = lh + a.ly;
				a.ly = 0;
			} else if (a.ly + lh > sh) {
				maxLayerHeight = Math.max(0, sh - a.ly);
			}

			if (typeof maxLayerWidth == 'number') {
				el.style.maxWidth = maxLayerWidth + 'px';
			}

			if (typeof maxLayerHeight == 'number') {
				el.style.maxHeight = maxLayerHeight + 'px';
			}
		}

		Object.assign(el.style, {
			top: a.ly + 'px',
			left: a.lx + 'px',
			position: 'fixed',
			'z-index': nextz,
		});
	},

	showMobileUIPopover(p, el, config) {
		let mask = el.$mobilePopoverMask || document.body.gwCreateChild({
			'style:will-change': 'opacity',
			className: 'mobile-mask-overlay',
		});

		let align = config.alignMobileUI || 'bottom';
		mask.className = 'mobile-mask-overlay align-' + align;
		mask.style['z-index'] = Application.nextZIndex++;

		el.style['will-change'] = 'transform';
		el.style['padding-bottom'] = '30px';
		el.$mobilePopoverMask = mask;
		mask.appendChild(el);

		if (align == 'bottom') {
			el.style.transform = 'translate(0, ' + el.offsetHeight + 'px)';
			mask.style.opacity = 0;
			mask.offsetWidth;
			el.gwAnimate({
				transform: 'translate(0, 0)',
				duration: 0.4,
				timing: 'ease-out',
			});
			mask.gwAnimate({
				opacity: 1,
				duration: 0.4,
				timing: 'ease-out',
			});
		} else if (align == 'left') {
			el.style.transform = 'translate(-' + el.offsetWidth + 'px, 0)';
			mask.style.opacity = 0;
			mask.offsetWidth;
			el.gwAnimate({
				transform: 'translate(0, 0)',
				duration: 0.4,
				timing: 'ease-out',
			});
			mask.gwAnimate({
				opacity: 1,
				duration: 0.4,
				timing: 'ease-out',
			});
		} else if (align == 'fullscreen') {
			mask.style.opacity = 0;
			mask.offsetWidth;
			mask.gwAnimate({
				opacity: 1,
				duration: 0.4,
				timing: 'ease-out',
			});
		}

		const targetEl = p.el || p;
		if(targetEl && typeof targetEl.querySelector === "function") {
			let closeButtonEl = targetEl.querySelector('.popup-button-close');
			if(!closeButtonEl) {
				const closeButtonEl = document.createElement('button');
				closeButtonEl.setAttribute('type', 'button');
				closeButtonEl.setAttribute('class', 'popup-button-close');
				closeButtonEl.innerHTML = '&times;';
				closeButtonEl.addEventListener('click', () => this.hide(p));
				targetEl.prepend(closeButtonEl);				
			}
		} else {
			console.warn('Unable to render close button in popup.', p, mask);
		}

		let popupData = {
			el: mask,
			popup: p,
			config,
			async animateHide() {
				if (align == 'bottom') {
					await Promise.all([
						el.gwAnimate({
							transform: 'translate(0, ' + el.offsetHeight + 'px)',
							duration: 0.4,
							timing: 'ease-out',
						}),
						mask.gwAnimate({
							opacity: 0,
							duration: 0.4,
							timing: 'ease-out',
						})
					]);
				} else if (align == 'left') {
					await Promise.all([
						mask.gwAnimate({
							opacity: 0,
							duration: 0.4,
							timing: 'ease-out',
						}),
						el.gwAnimate({
							transform: 'translate(-' + el.offsetWidth + 'px, 0)',
							duration: 0.4,
							timing: 'ease-out',
						}),
					]);
				} else if (align == 'fullscreen') {
					await Promise.all([
						mask.gwAnimate({
							opacity: 0,
							duration: 0.4,
							timing: 'ease-out',
						}),
					]);
				}
			},
			remove() {
				mask.remove();
				delete el.$mobilePopoverMask;
			}
		};

		popupData.popup[this.popupDataSymbol] = popupData;

		this.popups.push(popupData);
		this.refreshPopups();
	},

	async show(p, config = {}) {
		if (p instanceof GW.Component) {
			if (!p.el) {
				p.render();
			}

			p.on('destroy', c => {
				popupData = p[this.popupDataSymbol];
				if (popupData) {
					popupData.remove && popupData.remove();
				}

				this.popups = this.popups.filter(_p => _p.popup !== p);
			});
		}

		let el = this.getPopupLayerElement(p);
		if (el) {
			if (Application.isMobileUI() && !config.disableMobileUIPopover) {
				if (p.loadData) {
					await p.loadData();
				}

				this.showMobileUIPopover(p, el, config);
				return;
			}

			if (p.loadData) {
				p.loadData();
			}

			this.updatePosition(el, config);

			let popupData = {
				el,
				popup: p,
				config,
			};

			popupData.popup[this.popupDataSymbol] = popupData;

			this.popups.push(popupData);
			this.refreshPopups();
		}

		if (p.focus && config.focus !== false) {
			p.focus();
		}
	},

	refreshPopups() {
		document.documentElement.classList.toggle('has-popups', this.popups.length > 0);
	},

	getPopupLayerElement(p) {
		if (p instanceof GW.Component) {
			p = p.el;
		}

		if (p instanceof Element) {
			return p;
		}
	},

	async hide(p) {
		let popupData = p[this.popupDataSymbol];
		if (popupData && popupData.animateHide) {
			try {
				await popupData.animateHide();
			} catch(ex) {
			}
		}

		if (p.hidePopup) {
			p.hidePopup();

			if (popupData && popupData.remove) {
				popupData.remove();
			}
		} else if (p.destroy) {
			p.destroy();
		} else if (p.remove) {
			p.remove();
		}

		this.popups = this.popups.filter(_p => _p.popup !== p && _p.el !== p);
		this.refreshPopups();
	},

	hideAll(filter) {
		this.popups.filter(p => !filter || filter(p)).forEach(p => this.hide(p.popup));
		this.refreshPopups();
	},

	// hide all popups displayed above the ref popup
	hideDownTo(ref, filter) {
		let refIdx = this.popups.findIndex(p => p === ref || p.popup === ref || p.el === ref);
		if (refIdx < 0) {
			return;
		}

		let remove = [];
		for (let i = refIdx + 1; i < this.popups.length; i++) {
			if (!filter || filter(this.popups[i])) {
				remove.push(this.popups[i].popup);
			}
		}

		remove.forEach(p => this.hide(p));
	},
});

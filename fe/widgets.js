// {{{ PopupMenu

/**
 * Popup menu for use with PopupManager
 */
GW.define('PopupMenu', 'GW.Component', {
	/**
	 * Menu options:
	 *   - iconName (use a new style SVG symbol icon)
	 *   - text
	 *   - cls
	 *   - handle
	 */
	options: [],

	initComponent() {
		let hasIcons = this.options.some(o => !o.hidden && o.iconName);

		this.el = document.gwCreateElement({
			className: 'popup-menu popup-arrow' + (hasIcons ? '' : ' no-icons'),
			children: this.renderOptions(),
			tabIndex: '0',
			'on*:click': ev => {
				let optionEl = ev.target.closest('.option');
				if (optionEl) {
					this.onOptionClick(optionEl, ev);
				}
			},
		});

		// gate this on mobile, because it causes stutter mid-animation
		if (!Application.isMobileUI()) {
			Utils.timer(this, 'focus', 100, () => {
				this.el.focus();
			});
		}
	},

	'before:releaseComponent'() {
		Utils.abortTimer(this, 'focus');
	},

	renderOptions() {
		return this.options.filter(o => o && !o.hidden).map((option, idx) => {
			return {
				$option: option,
				nodeName: 'a',
				href: option.href || '#',
				target: option.href ? '_blank' : undefined,
				className: 'option ' + (option.cls || ''),
				children: [{
					className: 'option-icon',
					children: [option.iconName ? Utils.useIcon(option.iconName) : null]
				}, {
					className: 'option-text',
					textContent: option.text,
				}, {
					':skip': !option.rightIconName,
					className: 'option-icon-right',
					children: [option.rightIconName ? Utils.useIcon(option.rightIconName) : null]
				}, {
					':skip': !option.submenu,
					className: 'option-submenu',
					children: [Utils.useIcon('arrow-simple-right')],
				}]
			};
		});
	},

	onOptionClick(option, ev) {
		let o = option.$option;
		if (o.submenu) {
			let popup = new PopupMenu({
				options: o.submenu,
			});

			PopupManager.show(popup, {
				anchorEl: option,
				forceAxis: 'horizontal',
				preferReadingOrder: true,
			});
			return;
		}

		if (o.handle) {
			ev.preventDefault();
			o.handle();
		}

		this.destroy();
	},

	$key_ArrowUp(ev) {
		this.focusPrev();
	},

	$key_ArrowDown(ev) {
		this.focusNext();
	},

	$key_Tab(ev) {
		if (ev.shiftKey) {
			this.focusPrev();
		} else {
			this.focusNext();
		}

		ev.preventDefault();
	},

	$key_Escape(ev) {
		this.destroy();
	},

	focusNext() {
		let cur = this.el.querySelector('.option:focus');
		if (cur && cur.nextElementSibling) {
			to = cur.nextElementSibling;
		} else {
			to = this.el.querySelector('.option:first-child');
		}

		to.focus();
	},

	focusPrev() {
		let cur = this.el.querySelector('.option:focus');
		if (cur && cur.previousElementSibling) {
			to = cur.previousElementSibling;
		} else {
			to = this.el.querySelector('.option:last-child');
		}

		to.focus();
	}
});

// }}}
// {{{ SmartTable

GW.define('SmartTable', 'GW.Component', {
	selectable: false,
	emptyText: 'Žádné výsledky',
	sort: null,

	getColumns() {
		return [];
	},

	'after:initComponent'() {
		this.el = document.gwCreateElement({
			className: 'smart-table',
			children: [{
				nodeName: 'table',
				children: [{
					nodeName: 'thead',
					ref: 'head',
					children: [{
						ref: 'headRow',
						nodeName: 'tr',
					}],
					'on*:click': ev => {
						let th = ev.target.closest('th');
						if (th && th.$col) {
							if (th.$col.filter) {
								this.onFilterSelect(th, th.$col);
							}
							if (th.$col.sortable) {
								let newSort = '<' + th.$col.id;
								if (newSort == this.sort) {
									newSort = '>' + th.$col.id;
								}

								this.onSortChange(newSort);
							}
						}
					},
				}, {
					nodeName: 'tbody',
					ref: 'body',
					'on*:click': ev => {
						let tr = ev.target.closest('tr');
						if (tr && tr.$data) {
							this.onRowClick(tr.$data, tr, ev);
						}
					},
				}],
			}, {
				className: 'empty-message',
				textContent: this.emptyText,
				ref: 'msgEl',
			}]
		}, this);

		this.el.classList.toggle('selectable', !!this.selectable);
		this.renderHeaderRow(!this.rows || !this.rows.length);

		if (this.extraClass) {
			this.el.classList.add(...this.extraClass.split(/\s+/));
		}

		if (this.rows) {
			this.setData(this.rows);
		}

		if (this.monitorOverflow) {
			this.initOverflowMonitor();
		}
	},

	'before:destroy'() {
		if (this.resizeObserver) {
			this.resizeObserver.disconnect();
			this.resizeObserver = null;
		}
	},

	initOverflowMonitor() {
		let update = () => {
			this.el.dataset.overflowed = this.el.clientWidth < this.el.scrollWidth ? '1' : '0';
		};

		this.resizeObserver = new ResizeObserver(entries => {
			update();
		});

		this.resizeObserver.observe(this.el);
		update();
	},

	renderHeaderRow(empty) {
		this.headRow.classList.toggle('no-data', empty);
		this.headRow.gwReplaceChildren(this.getColumns().map(c => {
			let filterIcon = c.filter ? Utils.useIcon( this.isFilterActive(c) ? 'filled-true' : 'filled-false', {cls: 'filter-icon'} ) : null;

			let sortShown = this.sort && this.sort.substring(1) == c.id;
			let sortIcon;
			if (sortShown) {
				sortIcon = Utils.useIcon(this.sort[0] == '<' ? 'arrow-up' : 'arrow-down', {cls: 'sort-icon'});
			}

			return {
				$col: c,
				nodeName: 'th',
				className: (c.align || '') + (this.isFilterActive(c) ? ' filtered' : '') + (sortShown ? ' sorted' : '') + (c.sortable ? ' sortable' : '') + (filterIcon ? ' filterable' : ''),
				children: [c.name || '', filterIcon, sortIcon],
				'attr:data-col': c.id,
			};
		}));
	},

	setSort(sort) {
		this.sort = sort;
	},

	renderCell(td, r, c) {
		if (c.format && Formats[c.format]) {
			td.textContent = Formats[c.format](r[c.id]);
		} else if (c.formatCell) {
			c.formatCell(td, r[c.id], r);
		} else {
			td.textContent = r[c.id];
		}
	},

	setData(rows) {
		let columns = this.getColumns();

		this.renderHeaderRow(rows.length <= 0);

		this.body.textContent = '';
		this.msgEl.classList.toggle('hidden', rows.length > 0);

		for (let r of rows) {
			let tr = this.body.gwCreateChild({
				$data: r,
				nodeName: 'tr',
				children: columns.map(c => {
					let td = document.gwCreateElement({
						nodeName: 'td',
						'attr:data-col': c.id,
						className: c.align || undefined,
					});

					this.renderCell(td, r, c);

					return td;
				}),
			});

			this.renderRow(tr, r);
		}
	},

	renderRow(tr, row) {
	},

	onSortChange(sort) {
	},

	onFilterSelect(th, column) {
	},

	isFilterActive(column) {
		return false;
	},

	onRowClick(row, tr, ev) {
	},

	selectRow(fn) {
		this.body.querySelectorAll('tr').forEach(tr => tr.classList.toggle('selected', !!fn(tr.$data, tr)));
	},
});

// }}}
// {{{ SmartTable.Filter

GW.define('SmartTableFilter', 'GW.Component', {

	initComponent() {
		this.el = document.gwCreateElement({
			className: 'popup-menu',
			children: [{
				ref: 'contentEl',
			}, {
				className: 'filter-buttons',
				children: [{
					nodeName: 'button',
					className: 'secondary small',
					textContent: 'Zrušit filtry',
					'on:click': () => {
						this.fire('filterChanged', null);
						this.resetState();
						this.popupHide();
					},
				}, {
					nodeName: 'button',
					className: 'primary small',
					textContent: 'Hotovo',
					'on:click': () => {
						let value = this.getValue();
						if (JSON.stringify(value) === JSON.stringify(this.getDefaultValue())) {
							value = null;
						}
						this.fire('filterChanged', value);
						this.popupHide();
					},
				}]
			}]
		}, this);
	},

	popupShow(th) {
		this.el.classList.remove('hidden');
		PopupManager.show(this, {
			anchorEl: th,
			forceAxis: 'vertical',
			preferReadingOrder: true,
		});
	},

	popupHide() {
		PopupManager.hide(this);
	},

	hidePopup() {
		// called in PopupManager.hide()
		this.el.classList.add('hidden');
	},

	setValue(value) {},

	resetState() {},

	getValue() {},
});

// }}}
// {{{ Filters

const Filters = {

	'options': {

		matches: (data_val, filter_val) => filter_val.includes(data_val),

		render: (data, filter, column) => {
			/**
			 * return formatted value using SmartTable.renderCell() and simulating <td> element to pass to it
			 * @TODO avoid creating temporary <td> and "row" value using {[id]: val}, refactor SmartTable.renderCell()?
			 */
			const formatVal = val => {
				let td = document.gwCreateElement({
					nodeName: 'td',
				});
				SmartTable.prototype.renderCell(td, {[column.id]: val}, column);
				return td.textContent;
			};

			const options = filter.options || [...new Set(data)].sort().map(val => ({
				value: val,
				title: formatVal(val),
			}));

			const defaultValue = options.map(option => option.value);

			return new SmartTableFilter({

				options,

				value: defaultValue,

				getDefaultValue() {
					return defaultValue;
				},

				resetState() {
					if (!this.inputSearch) {
						// search is not enabled, no need to do anything
						return;
					}
					this.inputSearch.value = '';
					this.updateCheckboxes(); // update all checkboxes including its state
				},

				setValue(value) {
					this.value = value || this.getDefaultValue();
					this.updateCheckboxesState(); // update only state
				},

				getValue() {
					return this.getCheckboxes(true).map(el => el.$value);
				},

				'after:initComponent'() {
					const id = GW.uniqueId('input-');
					this.contentEl.classList.add('filter-options');
					this.contentEl.gwReplaceChildren([{
						':skip': !filter.showSearch,
						ref: 'inputSearch',
						nodeName: 'input',
						type: 'search',
						className: 'small',
						placeholder: 'Hledat',
						'on:input': ev => {
							this.updateCheckboxes();
						},
					},{
						className: 'check check-all',
						children: [{
							className: 'filter-check-all small',
							nodeName: 'input',
							type: 'checkbox',
							ref: 'checkboxAll',
							id,
							'on:input': ev => {
								this.getCheckboxes().forEach(el => el.checked = ev.target.checked);
							},
						}, {
							nodeName: 'label',
							htmlFor: id,
							children: ['Vybrat vše'],
						}],
					}, {
						ref: 'checkboxes',
						className: 'filter-options-items',
					}], this);
					this.updateCheckboxes();
					if(filter.showSearch) {
						setTimeout(() => this.inputSearch.focus(), 0);
					}
				},

				getCheckboxes(onlyChecked) {
					let selector = 'input[type=checkbox]:not(.filter-check-all)';
					if (onlyChecked) {
						selector += ':checked';
					}
					return [...this.el.querySelectorAll(selector)];
				},

				updateCheckboxesState() {
					for (let input of this.getCheckboxes()) {
						input.checked = this.value.includes(input.$value);
					}
					this.checkboxAll.checked = this.getCheckboxes().every(el => el.checked);
				},

				updateCheckboxes() {
					const match = this.inputSearch ? TextUtils.createMatchAll(this.inputSearch.value) : () => true;
					this.checkboxes.gwReplaceChildren(this.options.map((option, i) => {
						const id = GW.uniqueId('input-');
						return {
							':skip': !match(option.title),
							className: 'check',
							children: [{
								nodeName: 'input',
								className: 'small',
								type: 'checkbox',
								$value: option.value,
								id,
								'on:input': e => {
									this.checkboxAll.checked = this.getCheckboxes().every(el => el.checked);
								},
							}, {
								nodeName: 'label',
								htmlFor: id,
								textContent: option.title,
							}],
						};
					}));
					this.updateCheckboxesState();
				},
			});
		}
	},

	'duration': {

		matches: (data_val, [from, to]) => data_val >= from && data_val <= to,

		render(data, filter) {
			const durations = data;
			const min = Math.min(...durations);
			const max = Math.max(...durations);
			return new SmartTableFilter({

				min,
				max,

				getDefaultValue() {
					return [this.min, this.max];
				},

				setValue(value) {
					value = value || this.getDefaultValue();
					let [from, to] = value;
					from /= 1000;
					to /= 1000;
					this.fromMinutes.value = Math.floor(from / 60);
					this.fromSeconds.value = Math.floor(from % 60);
					this.toMinutes.value = Math.floor(to / 60);
					this.toSeconds.value = Math.floor(to % 60);
				},

				getValue() {
					return [
						(this.fromMinutes.value * 60 * 1000) + (this.fromSeconds.value * 1000),
						(this.toMinutes.value * 60 * 1000) + (this.toSeconds.value * 1000),
					]
				},

				'after:initComponent'() {
					const selectAllOnClick = ev => ev.target.select();
					this.contentEl.classList.add('filter-duration');
					this.contentEl.gwReplaceChildren([{
						className: 'filter-duration-item',
						children: [{
							textContent: 'Od',
							className: 'label',
						}, {
							className: 'input-group',
							children: [{
								className: 'input-label-inset',
								children: [{
									nodeName: 'input',
									className: 'small',
									type: 'number',
									ref: 'fromMinutes',
									'on:click': selectAllOnClick,
								}, {
									nodeName: 'label',
									textContent: 'Minut'
								}]
							}, {
								className: 'input-label-inset',
								children: [{
									nodeName: 'input',
									className: 'small',
									type: 'number',
									ref: 'fromSeconds',
									'on:click': selectAllOnClick,
								}, {
									nodeName: 'label',
									textContent: 'Sekund'
								}]
							}],
						}],
					}, {
						className: 'filter-duration-item',
						children: [{
							textContent: 'Do',
							className: 'label',
						}, {
							className: 'input-group',
							children: [{
								className: 'input-label-inset',
								children: [{
									nodeName: 'input',
									className: 'small',
									type: 'number',
									ref: 'toMinutes',
									'on:click': selectAllOnClick,
								}, {
									nodeName: 'label',
									textContent: 'Minut'
								}]
							}, {
								className: 'input-label-inset',
								children: [{
									nodeName: 'input',
									className: 'small',
									type: 'number',
									ref: 'toSeconds',
									'on:click': selectAllOnClick,
								}, {
									nodeName: 'label',
									textContent: 'Sekund'
								}]
							}],
						}],
					}], this);
					setTimeout(() => this.fromMinutes.select(), 0);
				},
			});
		}
	}

}

// }}}
// {{{ FilterableSmartTable

GW.define('FilterableSmartTable', 'SmartTable', {

	data: null, // non filtered dataset

	filter: {}, // current active filters with its value(s)

	filterEls: {}, // cached GW components to save its state if shown again

	onFilterSelect(th, column) {
		const gwFilter = this.renderFilter(column);
		if (gwFilter) {
			gwFilter.popupShow(th);
		}
	},

	isFilterActive(column) {
		return !!this.filter[column.id];
	},


	setData(data) {
		this.data = data;
		this.resetFilters();
		this.updateData();
	},

	updateData() {
		const data = this.data.filter(this.applyFilter.bind(this));
		SmartTable.prototype.setData.call(this, data);
	},

	filterMatches(row, c, filter) {
		if (this.filter[c.id] && filter.type in Filters) {
			// use defined 'matches' function or the filter default 'matches' function
			const matches = filter.matches || Filters[filter.type].matches;
			return matches(row[c.id], this.filter[c.id]);
		}
		return true;
	},

	applyFilter(row) {
		for (let c of this.getColumns()) {
			if (c.filter) {
				if (!this.filterMatches(row, c, c.filter)) {
					return false;
				}
			}
		}
		return true;
	},

	renderFilter(column) {
		if (!this.data) {
			// no data, filters dependent on the data (currently both of them) are not able to render without it
			return null;
		}

		const filter = column.filter;

		let tableFilter;

		if (!this.filterEls[column.id] && filter.type in Filters) {
			const data = this.data.map(r => r[column.id]);
			// TODO remove third argument 'column' the filter should not need that
			this.filterEls[column.id] = Filters[filter.type].render(data, filter, column);

			this.filterEls[column.id].on('filterChanged', (c, value) => {
				this.filter[column.id] = value;
				this.updateData();
			});
		}

		tableFilter = this.filterEls[column.id];

		if (tableFilter) {
			tableFilter.setValue(this.filter[column.id]);
		}

		return tableFilter;
	},

	resetFilters() {
		for (let id in this.filterEls) {
			this.filterEls[id].destroy();
			delete this.filterEls[id];
		}
		for (let id in this.filter) {
			delete this.filter[id];
		}
	},

	releaseComponent() {
		this.resetFilters();
	},

});

// }}}
// {{{ PropertyTable

GW.define('PropertyTable', 'GW.Component', {
	properties: [],

	getProperties() {
		return this.properties;
	},

	'after:initComponent'() {
		this.el = document.gwCreateElement({
			className: 'property-table',
		}, this);

		if (this.value) {
			this.setValue(this.value);
		}
	},

	renderProperty(ct, def, data) {
		if (def.format && Formats[def.format] && data[def.id] != null) {
			ct.textContent = Formats[def.format](data[def.id]);
		} else if (def.formatCell) {
			return def.formatCell(ct, data[def.id], data);
		} else if (data[def.id] != null) {
			ct.textContent = data[def.id];
		} else {
			return false;
		}
	},

	setValue(data) {
		this.el.textContent = '';

		for (let def of this.getProperties()) {
			let ct = document.gwCreateElement({className: 'value'});
			if (this.renderProperty(ct, def, data) === false) {
				continue;
			}

			this.el.gwCreateChild({
				className: 'property',
				'attr:data-name': def.id,
				children: [{
					className: 'label',
					textContent: def.name,
				}, ct],
			});
		}
	},
});

// }}}
// {{{ Main.Dialog

GW.define('Main.Dialog', 'GW.Component', {
	title: '',
	subtitle: '',

	initComponent() {
		this.el = document.gwCreateElement({
			className: 'admin-dialog-mask',
			tabIndex: '-1',
			$key_Escape: () => {
				PopupManager.hideDownTo(this);
				PopupManager.hide(this);
			},
			children: [{
				ref: 'dlgEl',
				className: 'admin-dialog',
				...this.getExtraDailogProps(),
				children: [{
					ref: 'headerEl',
					className: 'header',
					children: [{
						ref: 'titleEl',
						nodeName: 'h1',
						textContent: this.title,
					}, {
						ref: 'headerCenterCt',
						className: 'center',
					}, {
						':skip': !this.allowCloseButton,
						className: 'close',
						children: [Utils.useIcon('close')],
						'on:click': ev => {
							PopupManager.hideDownTo(this);
							PopupManager.hide(this);
						},
					}],
				}, {
					':skip': !this.subtitle,
					className: 'subtitle',
					textContent: this.subtitle,
				}, {
					ref: 'bodyEl',
					className: 'body',
				}, {
					ref: 'footerEl',
					className: 'footer',
				}],
			}],
		}, this);

		PopupManager.show(this, {
			noLayout: true,
			ignoreScroll: true,
		});

		this.focus();
	},

	getExtraDailogProps() {
		return {};
	},

	focus() {
		this.el.focus();
	},
});

// }}}
// {{{ Main.FormDialog

GW.define('Main.FormDialog', 'Main.Dialog', {
	title: '',
	subtitle: '',
	confirmText: '',
	cancelText: '',

	getExtraDailogProps() {
		return {
			nodeName: 'form',
			noValidate: true,
			'on:submit': ev => {
				ev.preventDefault();
				this.onSubmit();
			},
		};
	},

	'after:initComponent'() {
		this.el.classList.add('form');

		this.bodyEl.gwCreateChild({
			children: this.renderFormFields().concat({
				className: 'form-buttons',
				children: this.renderFormButtons(),
			}),
		}, this);

		this.focus();
	},

	renderFormButtons() {
		return [{
			nodeName: 'button',
			type: 'button',
			className: 'secondary',
			textContent: this.cancelText || 'Zavřít',
			'on:click': ev => {
				ev.preventDefault();
				this.destroy();
			},
		}, {
			nodeName: 'button',
			type: 'submit',
			className: 'primary',
			textContent: this.confirmText || 'Potvrdit',
		}];
	},

	renderFormFields() {
		return [];
	},

	focus() {
		for (let f of this.el.querySelectorAll('input,select,textarea')) {
			if (!f.disabled) {
				f.focus();
				break;
			}
		}
	},

	async onSubmit() {
		if (!this.reportFormValid()) {
			return;
		}

		let data = this.getFormFieldsData();

		try {
			this.setFormDisabled(true);

			this.fire('aftersave', await this.onSave(data));

			this.destroy();
		} catch(ex) {
			this.setFormDisabled(false);
			throw ex;
		}
	},

	onSave(data) {
	},

	...FormMixin,
});

// }}}
// {{{ Main.ConfirmDialog

GW.define('Main.ConfirmDialog', 'Main.Dialog', {
	title: '',
	subtitle: '',

	confirmText: 'Ano',
	cancelText: 'Ne',

	getExtraDailogProps() {
		return {
			nodeName: 'form',
			noValidate: true,
			'on:submit': ev => {
				ev.preventDefault();
				this.onSubmit();
			},
		};
	},

	'after:initComponent'() {
		this.el.classList.add('form');

		this.bodyEl.gwCreateChild({
			className: 'form-buttons',
			children: this.renderFormButtons(),
		});

		this.focus();
	},

	renderFormButtons() {
		return [{
			nodeName: 'button',
			type: 'button',
			className: this.cancelCls || 'secondary',
			textContent: this.cancelText,
			'on:click': ev => {
				ev.preventDefault();
				this.destroy();
			},
		}, {
			nodeName: 'button',
			type: 'submit',
			className: this.confirmCls || 'primary',
			textContent: this.confirmText,
		}];
	},

	focus() {
		for (let f of this.el.querySelectorAll('button')) {
			if (!f.disabled) {
				f.focus();
			}
		}
	},

	async onSubmit() {
		if (!this.reportFormValid()) {
			return;
		}

		try {
			this.el.querySelectorAll('button').forEach(b => b.disabled = true);

			this.fire('aftersave', await this.onSave());

			this.destroy();
		} catch(ex) {
			this.el.querySelectorAll('button').forEach(b => b.disabled = false);
			throw ex;
		}
	},

	onSave() {
	},

	...FormMixin,
});

// }}}
// {{{ Main.NotesDialog

GW.define('Main.NotesDialog', 'Main.FormDialog', {
	title: 'Poznámky',
	allowCloseButton: true,

	'after:initComponent'() {
		this.reload();
	},

	renderFormFields() {
		return [{
			className: 'comment-box',
			children: [{
				ref: 'noteField',
				xtype: 'TextareaField',
				placeholder: 'Zapište poznámku',
				$key_Ctrl_Enter: ev => {
					this.saveNote();
				},
			}, {
				className: 'buttons',
				children: [{
					ref: 'sendButton',
					nodeName: 'button',
					type: 'button',
					className: 'primary',
					textContent: 'Přidat',
					'on:click': ev => {
						this.saveNote();
					},
				}],
			}],
		}, {
			ref: 'notes',
			className: 'notes-list',
		}];
	},

	renderNotes(list) {
		this.notes.gwReplaceChildren(list.map(n => {
			return {
				className: 'note',
				children: [{
					className: 'header',
					children: [{
						className: 'author',
						textContent: n.user,
					}, {
						className: 'time',
						textContent: Formats.datetime(n.ts),
					}]
				}, {
					className: 'body',
					textContent: n.text,
				}]
			};
		}));
	},

	renderFormButtons() {
		return [{
			nodeName: 'button',
			type: 'button',
			className: 'secondary',
			textContent: 'Zavřít',
			'on:click': ev => {
				ev.preventDefault();
				this.destroy();
			},
		}];
	},

	async saveNote() {
		let text = this.noteField.getValue();
		if (text) {
			await this.onSave(text);

			this.noteField.setValue();
			this.reload();
		}
	},

	async reload() {
		let signal = Utils.abortAndRetry(this, 'reload');

		this.renderNotes(await this.loadData(signal));
	},

	onSave(text) {
	},

	loadData(signal) {
		return [];
	},
});

// }}}
// {{{ Widgets.ItemSwitcher

GW.define('Widgets.ItemSwitcher', 'GW.Component', {
	cls: undefined,
	itemCls: 'item',
	items: [],

	initComponent() {
		this.el = document.gwCreateElement({
			className: this.cls,
			'on*:click': ev => {
				let itemEl = ev.target;
				while (itemEl && itemEl.parentNode !== this.el) {
					itemEl = itemEl.parentNode;
				}

				if (!itemEl) {
					return;
				}

				let i = itemEl.$data;
				if (i.href && i.href != '#') {
					return;
				}

				ev.preventDefault();

				if (i.handle) {
					i.handle(i);
				}

				this.fire('beforeselect', i);
			},
		}, this);

		this.setItems(this.items);
	},

	getItems() {
		return Array.from(this.el.children).filter(el => el.$data).map(el => el.$data);
	},

	renderItem(i) {
		return {
			$data: i,
			'attr:data-item-id': i.id,
			nodeName: i.href ? 'a' : 'button',
			disabled: !!i.disabled || !!this.disabled,
			className: [this.itemCls, i.cls].filter(v => v).join(' '),
			href: i.href || '#',
			children: [i.icon ? Utils.useIcon(i.icon) : undefined, {
				nodeName: 'span',
				className: 'title',
				textContent: i.title,
			}],
		};
	},

	setItems(items) {
		let sel = this.getSelected();

		this.el.gwReplaceChildren(items.map(i => this.renderItem(i)));

		this.setSelected(sel);
	},

	setSelected(id) {
		for (let el of this.el.children) {
			el.classList.toggle('active', el.$data.id === id);
		}
	},

	getSelected() {
		for (let el of this.el.children) {
			if (el.classList.contains('active')) {
				return el.$data.id;
			}
		}

		return null;
	},

	getSelectedItemData() {
		for (let el of this.el.children) {
			if (el.classList.contains('active')) {
				return el.$data;
			}
		}

		return null;
	},

	setDisabled(disabled) {
		this.disabled = !!disabled;

		for (let el of this.el.children) {
			el.disabled = !!el.$data.disabled || !!this.disabled;
		}
	},
});

// }}}
// {{{ Widgets.TabSwitcher

GW.define('Widgets.TabSwitcher', 'Widgets.ItemSwitcher', {
	cls: 'tab-switcher',
	itemCls: 'tab',
});

// }}}
// {{{ Widgets.ButtonSwitcher

GW.define('Widgets.ButtonSwitcher', 'Widgets.ItemSwitcher', {
	cls: 'button-switcher small',
});

// }}}
// {{{ Widgets.CardSwitcher

/*
 * Component that keeps track of several subcomponents and allows switching
 * between them.
 */
GW.define('Widgets.CardSwitcher', 'GW.Component', {
	initComponent() {
		this.el = document.gwCreateElement({
			className: 'card-switcher',
		}, this);

		this.lastActivation = Symbol('last-activation');
	},

	activateCard(c, config) {
		this.el.dataset.cardid = c.id || '';
		this.el.dataset.cardtype = c.constructor.__className__;

		c[this.lastActivation] = performance.now();

		if (this.el.firstElementChild !== c.el) {
			this.el.prepend(c.el);
		}

		if (c.applyParams) {
			return c.applyParams(config.params);
		}
	},

	/*
	 * This either activates the existing subcomponent or instantiates a new
	 * one. Only components with id are preserved in the
	 * background. Components with no id set are considered transient.
	 *
	 * Activation process:
	 * - configure new values for data-cardid, data-cardtype on the
	 *   container
	 * - call applyParams(config.params)
	 */
	async show(config) {
		for (let el of Array.from(this.el.children)) {
			let c = el.gwComponent;
			if (c && config.id && c.id === config.id) {
				await this.activateCard(c, config);
				return c;
			} else if (c && !c.id) {
				c.destroy();
			} else if (!c) {
				el.remove();
			}
		}

		let c = GW.create(config);

		await this.activateCard(c, config);

		return c;
	},

	/*
	 * Destroy all non-visible subcomponents.
	 */
	prune() {
		for (let el of Array.from(this.el.children).slice(1)) {
			if (el.gwComponent) {
				el.gwComponent.destroy();
			} else {
				el.remove();
			}
		}
	},
});

// }}}
// {{{ Widgets.DateRangeInput

GW.define('Widgets.DateRangeInput', 'GW.Component', {

	rangesOptions: [{
		value: 'today',
		text: 'Dnes',
		getRange() {
			let now = new Date;
			let since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
			return [since];
		},
	}, {
		value: 'yesterday',
		text: 'Včera',
		getRange() {
			let now = new Date;
			let until = new Date(now.getFullYear(), now.getMonth(), now.getDate());
			until.setDate(until.getDate() - 1);
			let since = new Date(until);
			return [since, until];
		},
	}, {
		value: 'thisweek',
		text: 'Tento týden',
		getRange() {
			let now = new Date;
			let since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
			since.setDate(since.getDate() - (since.getDay() || 7) + 1);
			return [since];
		},
	}, {
		value: 'lastweek',
		text: 'Minulý týden',
		getRange() {
			let now = new Date;
			let until = new Date(now.getFullYear(), now.getMonth(), now.getDate());
			until.setDate(until.getDate() - (until.getDay() || 7));
			let since = new Date(until);
			since.setDate(since.getDate() - 6);
			return [since, until];
		},
	}, {
		value: 'last7days',
		text: 'Posledních 7 dnů',
		getRange() {
			let now = new Date;
			let since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
			since.setDate(since.getDate() - 6); // 7 days including today
			return [since];
		},
	}, {
		value: 'thismonth',
		text: 'Tento měsíc',
		getRange() {
			let now = new Date;
			let since = new Date(now.getFullYear(), now.getMonth(), 1);
			return [since];
		},
	}, {
		value: 'lastmonth',
		text: 'Minulý měsíc',
		getRange() {
			let now = new Date;
			let until = new Date(now.getFullYear(), now.getMonth(), 1);
			until.setDate(until.getDate() - 1);
			let since = new Date(until);
			since.setDate(1);
			return [since, until];
		},
	}, {
		value: 'last30days',
		text: 'Posledních 30 dnů',
		getRange() {
			let now = new Date;
			let since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
			since.setDate(since.getDate() - 29); // 30 days including today
			return [since];
		},
	}, {
		value: 'thisyear',
		text: 'Tento rok',
		getRange() {
			let now = new Date;
			let since = new Date(now.getFullYear(), 0, 1);
			return [since];
		},
	}, {
		value: 'lastyear',
		text: 'Minulý rok',
		getRange() {
			let now = new Date;
			let until = new Date(now.getFullYear(), 0, 1)
			until.setDate(until.getDate() - 1);
			let since = new Date(until);
			since.setMonth(0);
			since.setDate(1);
			return [since, until];
		},
	}
	],

	initComponent() {
		this.el = document.gwCreateElement({
			className: 'date-range-input',
			children: [{
				ref: 'rangeField',
				xtype: 'SelectField',
				extraClass: 'small',
				label: 'Období',
				autofocus: true,
				options: [
					{
						value: 'custom',
						text: 'Vlastní',
						getRange: () => [],
					},
					...this.rangesOptions
				],
				'on:change': c => {
					this.setTimesForSelectedOption();
					this.fire('change');
				},
			}, {
				ref: 'sinceField',
				xtype: 'TextField',
				extraClass: 'small',
				type: 'date',
				label: 'Od',
				optional: true,
				'on:change': c => {
					this.rangeField.setValue('custom');
					this.updateTimeFields();
					this.fire('change');
				},
			}, {
				ref: 'sinceTimeField',
				xtype: 'TextField',
				extraClass: 'small time',
				type: 'time',
				label: '',
				optional: true,
				'on:change': c => {
					this.rangeField.setValue('custom');
					this.fire('change');
				},
			}, {
				ref: 'untilField',
				xtype: 'TextField',
				extraClass: 'small',
				type: 'date',
				label: 'Do',
				optional: true,
				'on:change': c => {
					this.rangeField.setValue('custom');
					this.updateTimeFields();
					this.fire('change');
				},
			}, {
				ref: 'untilTimeField',
				xtype: 'TextField',
				extraClass: 'small time',
				type: 'time',
				label: '',
				optional: true,
				'on:change': c => {
					this.rangeField.setValue('custom');
					this.fire('change');
				},
			}]
		}, this);
	},


	setRangeOption(range) {
		this.rangeField.setValue(range || 'custom');
		this.setTimesForSelectedOption();
	},

	/*
	 * Call this when date field is updated, to update the state of related
	 * time fields.
	 */
	updateTimeFields() {
		this.sinceTimeField.setDisabled(!this.sinceField.getValue());
		if (!this.sinceField.getValue()) {
			this.sinceTimeField.setValue(null);
		}

		this.untilTimeField.setDisabled(!this.untilField.getValue());
		if (!this.untilField.getValue()) {
			this.untilTimeField.setValue(null);
		}
	},

	/*
	 * Call this to fill date/time fields based on the symbolic range select.
	 */
	setTimesForSelectedOption() {
		let option = this.rangeField.getSelectedOption();
		let getRange = option && option.getRange;
		if (getRange) {
			let [since, until] = getRange();

			this.setTimeRange(since, until);
		}
	},

	getTimeRange() {
		let since_date = this.sinceField.getValue();
		let until_date = this.untilField.getValue();
		let since_time = this.sinceTimeField.getValue();
		let until_time = this.untilTimeField.getValue();

		function format_datetime(date, time) {
			if (!date) {
				return null;
			}
			if (time && time.match(/^\d+:\d+$/)) {
				// add seconds to conform ISO
				time += ':00';
			}
			return date + (time ? ('T' + time) : '');
		}

		return [
			format_datetime(since_date, since_time),
			format_datetime(until_date, until_time),
		];
	},

	getRange() {
		return this.rangeField.getValue();
	},

	setTimeRange(since, until) {
		since = since ? Utils.parseDateIso(since) : null;
		until = until ? Utils.parseDateIso(until) : null;

		this.sinceField.setValue(since ? Utils.formatDateIso(since) : null);
		this.untilField.setValue(until ? Utils.formatDateIso(until) : null);

		const p = n => String(n).padStart(2, '0');

		function formatTime(time) {
			if (!time) {
				return null;
			}
			let s = p(time.getHours()) + ':' + p(time.getMinutes());
			if (time.getSeconds()) {
				s += ':' + p(time.getSeconds());
			}

			return s === '00:00' ? null : s;
		}

		this.sinceTimeField.setValue(formatTime(since));
		this.untilTimeField.setValue(formatTime(until));

		this.updateTimeFields();
	},

});
// }}}

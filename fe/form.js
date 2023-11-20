// {{{ FormMixin

FormMixin = {
	getFormFieldsData() {
		let data = {};

		this.traverseChildren(function(f) {
			if (f.name && f.getValue && (f.isDisabled && !f.isDisabled())) {
				data[f.name] = f.getValue();
				return 'skip';
			}

			return null;
		});

		return data;
	},

	setFormFieldsData(data) {
		this.traverseChildren(function(f) {
			if (f.name && f.setValue) {
				f.setValue(data[f.name]);
				return 'skip';
			}

			return null;
		});
	},

	setFormDisabled(dis) {
		this.traverseChildren(function(f) {
			if (f.name && f.setDisabled) {
				f.setDisabled(!!dis);
				return 'skip';
			}

			return null;
		});

		this.el.querySelectorAll('button').forEach(b => {
			b.disabled = !!dis;
		});
	},

	/* this updates the field validation status in the DOM */
	validateForm(updateFields = true) {
		let valid = true;

		this.traverseChildren(function(f) {
			if (f.validate) {
				if (!f.validate(updateFields)) {
					valid = false;
				}

				return 'skip';
			}

			return null;
		});

		return valid;
	},

	reportFormValid() {
		if (!this.validateForm()) {
			Application.notify({
				kind: 'error',
				text: 'Please fill the form correctly.',
				priority: 5,
				timeout: 3000,
			});

			return false;
		}

		return true;
	},
};

// }}}
// {{{ FormField

GW.define('FormField', 'GW.Component', {
	requiredErrorMessage: 'This field is required',
	extraClass: null,

	initComponent() {
		if (this.label != null) {
			this.el = document.gwCreateElement({
				className: 'form-field',
				'attr:data-name': this.name,
				children: [{
					ref: 'labelEl',
					':skip': !this.label,
					nodeName: 'label',
					textContent: this.label,
				}, {
					ref: 'inputCt',
					className: 'input-ct',
					children: [this.renderInput()],
				}, {
					ref: 'msgCt',
					className: 'message hidden',
				}],
			}, this);
		} else {
			this.el = document.gwCreateElement(this.renderInput(), this);
		}

		if (this.extraClass) {
			this.el.classList.add(...this.extraClass.split(/\s+/));
			this.input.classList.add(...this.extraClass.split(/\s+/));
		}

		if (this.value != null) {
			this.setValue(this.value);
		}
	},

	setLabel(text) {
		this.label = text;

		if (this.labelEl) {
			this.labelEl.textContent = text || '';
		}
	},

	isDisabled() {
		return false;
	},

	setDisabled(v) {
	},

	getViolation() {
		let val = this.getValue();

		if (typeof this.getOptional == 'function') {
			this.optional = !!this.getOptional();
		}

		if (!this.optional) {
			if (val == null || (typeof val == 'string' && val.match(/^\s*$/))) {
				return this.requiredErrorMessage;
			}
		}

		return null;
	},

	validate(updateMsg) {
		if (this.isDisabled()) {
			this.setError();
			return true;
		}

		let msg = this.getViolation();
		if (updateMsg) {
			this.setError(msg);
		}

		return !msg;
	},

	setError(msg) {
		if (this.msgCt) {
			this.msgCt.classList.toggle('hidden', !msg);
			this.msgCt.textContent = msg;
		}

		this.el.classList.toggle('error', !!msg);
	},
});

// }}}
// {{{ TextField

GW.define('TextField', 'FormField', {
	type: 'text',
	enforcePasswordRules: false,
	autocomplete: undefined,
	tooLongMessage: 'Text is too long',
	tooShortMessage: 'Text is too short',

	renderInput() {
		return {
			ref: 'input',
			nodeName: 'input',
			type: this.type,
			step: ['number', 'time', 'range'].includes(this.type) ? (this.step || 'any') : undefined,
			min: this.min,
			max: this.max,
			minLength: this.minLength,
			maxLength: this.maxLength,
			pattern: this.pattern,
			required: !this.optional,
			disabled: this.disabled,
			readOnly: this.readOnly,
			tabIndex: this.disabled ? '-1' : '0',
			autocomplete: this.autocomplete,
			autofocus: this.autofocus,
			placeholder: this.placeholder,
			'on:input': ev => this.fire('change', ev.target.value),
			'on:blur': ev => this.fixup(),
		};
	},

	isDisabled() {
		return this.input.disabled;
	},

	setDisabled(v) {
		this.input.disabled = !!v;
		this.input.tabIndex = v ? '-1' : '0';
	},

	getViolation() {
		let val = this.getValue();

		if (typeof this.getOptional == 'function') {
			this.optional = !!this.getOptional();
		}

		if (!this.optional) {
			if (val == null || (typeof val == 'string' && val.match(/^\s*$/))) {
				return 'This field is required';
			}
		}

		if (this.type == 'password' && this.enforcePasswordRules) {
			if (val && val.length < 12) {
				return 'Password needs to be at least 12 characters long.';
			}
		}

		if (this.type == 'date') {
			if (val == 'invalid') {
				return 'Invalid date format. Use d.m.y, or m/d/y.';
			}
		}

		if (this.type == 'datetime-local') {
			if (val == 'invalid') {
				return 'Invalid date/time format. Use d.m.y H:M, or m/d/y. H:M';
			}
		}

		if (this.type == 'text') {
			if (this.input.validity && this.input.validity.tooLong) {
				return this.tooLongMessage;
			}

			if (this.input.validity && this.input.validity.tooShort) {
				return this.tooShortMessage;
			}
		}

		if (this.input.type == 'number') {
			if (this.input.validity && this.input.validity.rangeOverflow) {
				return this.getOverflowErrorMessage();
			}

			if (this.input.validity && this.input.validity.rangeUnderflow) {
				return this.getUnderflowErrorMessage();
			}

			if (!this.input.validity.valid) {
				return 'Invalid number.';
			}
		}

		if (this.input.type == 'email') {
			if (!this.input.validity.valid) {
				return 'Invalid e-mail address.';
			}
		}

		if (this.input.validity && !this.input.validity.valid) {
			return 'Invalid value.';
		}

		return null;
	},

	getUnderflowErrorMessage() {
		return 'Value is too low';
	},

	getOverflowErrorMessage() {
		return 'Value is too high';
	},

	setValue(value) {
		if (this.type == 'date') {
			if (Number.isInteger(value)) {
				// if specifying unix time, we need to make sure
				// value Date object will be in local time
				value = Utils.formatUTCDateIso(value);
			}

			value = Utils.parseDateIso(value);

			if (value instanceof Date) {
				if (this.input.type == 'date') {
					this.input.value = Utils.formatDateIso(value);
					return;
				}

				value = Formats.input_date(value);
			} else {
				value = '';
			}
		}

		if (this.type == 'datetime-local') {
			if (Number.isInteger(value)) {
				if (this.input.type == 'datetime-local') {
					let d = new Date(value * 1000);
					this.input.valueAsNumber = d.getTime() - d.getTimezoneOffset() * 1000 * 60;
					return;
				}

				value = Formats.input_datetime(value);
			} else {
				value = '';
			}
		}
		
		if (this.type == 'number') {
			if (value == null) {
				this.input.value = '';
			} else {
				this.input.value = Number(value);
			}
			return;
		}

		this.input.value = value == null ? '' : value;
	},

	fixup() {
		if (['date', 'datetime-local', 'time'].includes(this.type)) {
			this.setValue(this.getValue());
		}

		this.fire('blur');
	},

	parseUserDate(s) {
		let d = new Date();
		let ymd, m;

		d.setHours(0, 0, 0, 0);

		if (s == '') {
			return null;
		} else if (m = s.match(/^(\d+)\.(\d+)\.(\d+)$/)) {
			ymd = [Number(m[3]), Number(m[2]) - 1, Number(m[1])];
		} else if (m = s.match(/^(\d+)\/(\d+)\/(\d+)$/)) {
			ymd = [Number(m[3]), Number(m[1]) - 1, Number(m[2])];
		} else if (m = s.match(/^(\d+)\/(\d+)$/)) {
			ymd = [d.getFullYear(), Number(m[1]) - 1, Number(m[2])];
		} else if (m = s.match(/^(\d+)\.(\d+)\.?$/)) {
			ymd = [d.getFullYear(), Number(m[2]) - 1, Number(m[1])];
		} else if (m = s.match(/^(\d+)[\.\/]?$/)) {
			ymd = [d.getFullYear(), d.getMonth(), Number(m[1])];
		} else {
			return 'invalid';
		}

		d.setFullYear(...ymd);

		if (d.getFullYear() != ymd[0] || d.getMonth() != ymd[1] || d.getDate() != ymd[2]) {
			return 'invalid';
		}

		return Math.floor(d.getTime() / 1000);
	},

	parseUserDateTime(s) {
		let me = this;
		let now = new Date(), match;
		let parts = s.split(/\s+/);

		function matchTime(s) {
			if (match = s.match(/^(\d{1,2}):(\d{0,2})$/)) {
				let [whole, h, m] = match;

				now.setHours(Number(h), Number(m), 0, 0);
				return true;
			}

			return false;
		}

		function matchDate(s) {
			let date = me.parseUserDate(s);
			if (date != null && date != 'invalid') {
				let d = new Date(date * 1000);
				now.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
				return true;
			}

			return false;
		}

		function exit(v) {
			return Math.floor(v.getTime() / 1000);
		}

		now.setHours(0, 0, 0, 0);

		if (parts.length == 1) {
			if (parts[0] === '') {
				return null;
			}

			// parse out time or date
			if (matchTime(parts[0]) || matchDate(parts[0])) {
				return exit(now);
			}
		} else if (parts.length == 2) {
			// first try date time and time date variants
			if (matchTime(parts[0]) && matchDate(parts[1])) {
				return exit(now);
			}

			if (matchTime(parts[1]) && matchDate(parts[0])) {
				return exit(now);
			}

			// now try to parse out at least the date
			now.setHours(0, 0, 0, 0);

			if (matchDate(parts[0]) || matchDate(parts[1])) {
				return exit(now);
			}
		}

		return 'invalid';
	},

	getValue() {
		if (this.type == 'date') {
			// valueAsDate return UTC date
			if (this.input.valueAsDate) {
				return Utils.formatUTCDateIso(this.input.valueAsDate);
			}

			// our parsing function returns local date
			return Utils.formatDateIso(this.parseUserDate(this.input.value.trim()));
		}

		if (this.type == 'datetime-local') {
			if (this.input.valueAsNumber) {
				let d = new Date(this.input.value);

				return Math.floor(d.getTime() / 1000);
			}

			return this.parseUserDateTime(this.input.value.trim());
		}

		if (this.type == 'number') {
			if (!this.input.value.trim()) {
				return null;
			}

			let num = Number(this.input.value);

			return isNaN(num) ? 'invalid' : num;
		}

		if (this.input.value.trim() === '') {
			return null;
		}

		return this.input.value;
	},
});

// }}}
// {{{ SelectField

GW.define('SelectField', 'FormField', {
	options: [],

	renderInput() {
		return {
			ref: 'input',
			nodeName: 'select',
			'on:input': ev => this.fire('change'),
			disabled: this.disabled,
			tabIndex: this.disabled ? '-1' : '0',
			autofocus: this.autofocus,
			className: this.className,
			children: this.options.map(o => {
				return {
					nodeName: 'option',
					value: o.value,
					textContent: o.text,
					$data: o,
				};
			}),
		};
	},

	setOptions(opts) {
		this.input.gwReplaceChildren(opts.map(o => {
			return {
				nodeName: 'option',
				textContent: o.text,
				value: o.value,
				$data: o,
			};
		}));
	},

	isDisabled() {
		return this.input.disabled;
	},

	setDisabled(v) {
		this.input.disabled = !!v;
		this.input.tabIndex = v ? '-1' : '0';
	},

	setValue(value) {
		this.input.value = value == null ? '' : value;
	},

	getValue() {
		return this.input.value;
	},

	getSelectedOption() {
		let option = this.input.selectedOptions[0];

		return option && option.$data;
	},
});

// }}}
// {{{ TextareaField

GW.define('TextareaField', 'FormField', {
	renderInput() {
		return {
			ref: 'input',
			nodeName: 'textarea',
			disabled: this.disabled,
			tabIndex: this.disabled ? '-1' : '0',
			autofocus: this.autofocus,
			placeholder: this.placeholder,
			'on:input': ev => this.fire('change'),
		};
	},

	isDisabled() {
		return this.input.disabled;
	},

	setDisabled(v) {
		this.input.disabled = !!v;
		this.input.tabIndex = v ? '-1' : '0';
	},

	setValue(value) {
		this.input.value = value == null ? '' : value;
	},

	getValue() {
		if (this.input.value.trim() === '') {
			return null;
		}

		return this.input.value;
	},
});

// }}}
// {{{ BinarySwitchField

GW.define('BinarySwitchField', 'FormField', {
	renderInput() {
		return {
			ref: 'input',
			className: 'bin-switch',
			children: [{
				className: 'bullet',
			}],
			'on:click': ev => this.toggle(),
		};
	},

	toggle() {
		this.input.dataset.state = this.input.dataset.state == "on" ? "off" : "on";
		this.fire('change');
	},

	setValue(value) {
		this.input.dataset.state = value ? "on" : "off";
	},

	getValue() {
		return this.input.dataset.state == "on";
	},
});

// }}}
// {{{ ImageUploadField

GW.define('ImageUploadField', 'FormField', {
	requiredErrorMessage: 'This photo is required',

	renderInput() {
		return {
			ref: 'input',
			className: 'image-upload-field drop-zone',
			'on:drop': ev => {
				let file = this.fileDropHandler(ev);
				if (file) {
					if (file.size > 10000000) {
						Application.notify({
							kind: 'error',
							text: 'File size limit is 10MB.',
							priority: 5,
							timeout: 5000,
						});  
						return;
					}

					this.showFile(file);
					this.value = null;
					this.fire('change');
				}
			},
		};
	},

	'after:initComponent'() {
		this.refresh();
	},

	refresh() {
		this.input.textContent = '';

		if (this.fileUrl) {
			this.input.gwCreateChild({
				nodeName: 'img',
				alt: this.label,
				src: this.fileUrl,
			});

			this.input.gwCreateChild({
				className: 'controls',
				children: [{
					nodeName: 'a',
					href: '#',
					textContent: 'Remove photo',
					'on:click': ev => {
						ev.preventDefault();
						this.showFile();
						this.value = null;
						this.fire('change');
					},
				}],
			});
		} else {
			this.input.gwCreateChild({
				nodeName: 'button',
				type: 'button',
				className: 'primary',
				textContent: 'Upload',
				'on:click': ev => {
					this.doSelectFile();
				},
			});
		}
	},

	fileDropHandler(ev) {
		try {
			let files = [];

			ev.preventDefault();

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

			if (files.length != 1) {
				Application.notify({
					kind: 'error',
					text: 'Please drag\'n\'drop just a single photo here.',
					priority: 5,
					timeout: 5000,
				});  
			} else {
				return files[0];
			}
		} catch (ex) {
			console.log(ex);
		}
	},

	chooseFile() {
		return new Promise((res, rej) => {
			let fileEl = document.gwCreateElement({
				nodeName: 'input',
				type: 'file',
				accept: '.jpg,image/*',
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

	showFile(file) {
		if (this.fileUrl) {
			URL.revokeObjectURL(this.fileUrl);
			this.fileUrl = null;
		}

		this.file = file;
		if (file) {
			this.fileUrl = URL.createObjectURL(file);
		}

		this.refresh();
	},

	async doSelectFile(u) {
		let file = await this.chooseFile();
		if (file.size >= 10000000) {
			Application.notify({
				kind: 'error',
				text: 'File size limit is 10MB.',
				priority: 5,
				timeout: 5000,
			});  
			return;
		}

		this.showFile(file);
		this.value = null;
		this.fire('change');
	},

	setValue(data) {
		this.fileUrl = data ? data.url : null;
		this.value = data;

		this.refresh();
	},

	getValue() {
		if (this.value) {
			return this.value;
		}

		if (this.file) {
			return {
				file: this.file,
			};
		}

		return null;
	},
});

// }}}
// {{{ AckCheckboxField

GW.define('AckCheckboxField', 'FormField', {
	shortText: '',
	longText: '',
	label: '',

	renderInput() {
		let id = GW.uniqueId();

		return {
			className: 'ack-checkbox',
			children: [{
				className: 'check',
				children: [{
					ref: 'input',
					nodeName: 'input',
					type: 'checkbox',
					disabled: this.disabled,
					id,
					'on:input': ev => this.fire('change'),
				}, {
					nodeName: 'label',
					htmlFor: id,
					ref: 'labelEl',
					children: this.getLabelContent(),
				}],
			}, {
				':skip': !this.longText,
				className: 'info',
				textContent: this.longText,
			}, {
				':skip': this.getLinks().length == 0,
				className: 'links',
				children: this.getLinks(),
			}]
		};
	},

	isDisabled() {
		return this.input.disabled;
	},

	setDisabled(v) {
		this.input.disabled = !!v;
	},

	getLabelContent() {
		return [this.shortText];
	},

	getLinks() {
		return [];
	},

	toggle() {
		this.input.checked = !this.input.checked;
		this.fire('change');
	},

	setValue(value) {
		this.input.checked = !!value;
	},

	getValue() {
		return this.input.checked;
	},

	getViolation() {
		if (!this.optional && !this.getValue()) {
			return 'You need to agree to continue';
		}

		return null;
	},
});

// }}}
// {{{ FormSegment

GW.define('FormSegment', 'GW.Component', {
	title: '',

	initComponent() {
		this.el = document.gwCreateElement({
			nodeName: 'form',
			noValidate: true,
			'on:submit': ev => {
				ev.preventDefault();
				this.submit();
			},
			className: 'form form-segment',
			'attr:data-status': 'error',
			children: [{
				className: 'header',
				children: [{
					ref: 'statusEl',
					className: 'status',
				}, {
					className: 'title',
					textContent: this.title,
				}, {
					className: 'expand',
					'on:click': ev => {
						if (this.el.classList.contains('collapsible')) {
							this.el.classList.toggle('collapsed');
						}
					},
				}],
			}, {
				className: 'fields',
				children: this.children,
			}, {
				className: 'form-buttons',
				children: [...(this.buttons || []), {
					ref: 'submitBtn',
					nodeName: 'button',
					type: 'submit',
					className: 'primary',
					textContent: 'Uložit změny',
				}],
			}, {
				ref: 'progressEl',
				className: 'form-progress hidden',
				children: [{
					className: 'progress-bar',
					children: [{
						ref: 'progressIndicator',
						className: 'progress-bar-indicator',
					}],
				}],
			}],
		}, this);

		this.on('change', c => {
			this.setCollapsible(false);
			this.setStatus('error');
			this.submitBtn.disabled = false;
			this.changed = true;
		}, this, true);
	},

	/* 0..1 */
	setProgress(progress) {
		if (progress == null) {
			this.progressEl.classList.add('hidden');
		} else {
			this.progressIndicator.style.setProperty('width', Math.round(100 * progress) + '%');
			this.progressEl.classList.remove('hidden');
		}
	},

	async submit() {
		try {
			if (!this.reportFormValid()) {
				return false;
			}

			this.submitBtn.disabled = true;

			return await this.onSubmit(this);;
		} finally {
			this.submitBtn.disabled = false;
		}
	},

	onSubmit(subform) {
		return false;
	},

	collapse() {
		this.el.classList.add('collapsed');
	},

	isCollapsed() {
		return this.el.classList.contains('collapsed');
	},

	setCollapsible(v) {
		this.el.classList.toggle('collapsible', !!v);
	},

	setStatus(s) {
		this.el.dataset.status = s;
		if (s == 'ok') {
			this.setCollapsible(true);
			this.collapse();
			this.submitBtn.disabled = true;
			this.changed = false;
		}

		this.fire('statuschange');
	},

	...FormMixin,
});

// }}}

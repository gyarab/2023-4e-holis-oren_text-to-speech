const APP_NAME = "TTS";
const APP_BASE = "/";
const API_BASE = APP_BASE + "api/";
REST.getURL = function(path) {
	return path.startsWith("/") ? path : API_BASE + path;
};

GW.define('RangeField', 'GW.Component', {
	initComponent() {
		this.outputRef = this.name + 'Output';

		this.el = document.gwCreateElement({
			className: 'range-field',
			children: [{
				className: 'border-value',
				nodeName: 'span',
				textContent: '50'
			}, {
				className: 'input',
				children: [{
					label: this.label,
					xtype: 'TextField',
					name: this.name,
					type: 'range',
					min: '0.5',
					max: '2',
					value: '1',
					'on:change': (obj, v) => this.setValue(Number(v)),
					ref: 'input'
				}, {
					className: 'actual-value',
					nodeName: 'span',
					ref: this.outputRef
				}]
			}, {
				className: 'border-value',
				nodeName: 'span',
				textContent: '200'
			}]
		}, this);
	},

	setValue(value) {
		this[this.outputRef].textContent = Math.floor(Number(value) * 100) + "";
		this.input.setValue(value);
	},

	getValue() {
		return this.input.value;
	}
})

// Public screens:

// {{{ Pubweb.PublicScreen

GW.define('Pubweb.PublicScreen', 'GW.Component', {
	title: APP_NAME,
	subtitle: '',

	initComponent() {
		this.el = document.gwCreateElement({
			className: 'public-screen',
			children: [{
				ref: 'headerEl',
				className: 'header',
				children: [{
					':skip': !this.subtitle,
					nodeName: 'h2',
					textContent: this.subtitle,
				}],
			}, {
				ref: 'bodyEl',
				className: 'body',
			}, {
				ref: 'footerEl',
				className: 'footer',
			}],
		}, this);
	},
});

// }}}
// {{{ Pubweb.MessageScreen

GW.define('Pubweb.MessageScreen', 'Pubweb.PublicScreen', {
	title: '',
	message: '',
	buttonText: '',
	kind: 'info',

	'after:initComponent'() {
		this.bodyEl.gwReplaceChildren([...this.getMessages(), {
			className: 'form-buttons',
			children: this.getButtons(),
		}]);
	},

	getMessages() {
		return [{
			nodeName: 'p',
			className: this.kind,
			textContent: this.message,
		}];
	},

	getButtons() {
		return [{
			nodeName: 'button',
			className: 'primary',
			textContent: this.buttonText,
			'on:click': ev => this.onButtonClick(),
		}];
	},

	onButtonClick() {
	},
});

// }}}
// {{{ Pubweb.FormScreen

GW.define('Pubweb.FormScreen', 'Pubweb.PublicScreen', {
	submitText: 'Potvrdit',

	'after:initComponent'() {
		let links = this.getFormLinks();

		this.bodyEl.gwCreateChild({
			nodeName: 'form',
			noValidate: true,
			'on:submit': ev => {
				ev.preventDefault();
				this.onSubmit();
			},
			className: 'form',
			children: [...this.getFormFields(), {
				className: 'form-message',
				ref: 'formMessage'
			}, {
				className: 'form-buttons',
				children: this.getFormButtons(),
			}, {
				className: 'form-links' + (links.length == 0 ? ' hidden' : ''),
				children: links,
			}],
		}, this);

		setTimeout(() => this.focus(), 0);
	},

	getFormFields() {
		return [];
	},

	getFormButtons() {
		return [{
			nodeName: 'button',
			className: 'primary',
			textContent: this.submitText,
		}];
	},

	getFormLinks() {
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

	showError(text) {
		this.formMessage.gwReplaceChildren([Utils.useIcon('alertcirclefull'), text]);
	},

	hideError() {
		this.formMessage.textContent = '';
	},

	async onSubmit() {
		this.hideError();

		if (!this.validateForm()) {
			this.showError('Please fill the form correctly.');
			return;
		}

		let data = this.getFormFieldsData();

		try {
			this.setFormDisabled(true);

			await this.onSave(data);
		} catch(ex) {
			this.setFormDisabled(false);
			this.showError(ex.message);
		}
	},

	async onSave(data) {
	},

	...FormMixin,
});

// }}}
// {{{ Pubweb.LoginScreen

GW.define('Pubweb.LoginScreen', 'Pubweb.FormScreen', {
	subtitle: 'Přihlášení',
	submitText: 'Přihlásit',

	getFormFields() {
		return [{
			xtype: 'TextField',
			name: 'username',
			type: 'text',
			label: 'Jméno',
			autocomplete: 'username',
			type: 'text'
		}, {
			xtype: 'TextField',
			name: 'password',
			type: 'password',
			enforcePasswordRules: false,
			label: 'Heslo',
			autocomplete: 'current-password'
		}];
	},

	async onSave(data) {
		await App.DataManager.login(data);
		Application.replaceRoute(APP_BASE);
	},
});

// Main app:

// {{{ Main.ModulesSelector

GW.define('Main.ModulesSelector', 'GW.Component', {
	initComponent() {
		this.el = document.gwCreateElement({
			className: 'module-chooser',
			children: this.getAppModules().map(m => this.renderModule(m)),
			'on*:click': ev => {
				if (ev.target.closest('a')) {
					PopupManager.hideAll();
				}
			},
		});
	},

	getAppModules() {
		return [{
			id: 'modules',
			title: 'Rozcestník',
			tagline: 'Kontaktní centrum',
			icon: 'home',
			href: '/',
		}];
	},

	renderModule(m) {
		return {
			className: 'module',
			nodeName: 'a',
			href: m.href,
			target: m.href_target,
			children: [{
				className: 'logo',
				children: [Utils.useIcon(m.icon || 'phone')],
			}, {
				className: 'info',
				children: [{
					className: 'title',
					textContent: m.title,
				}, {
					className: 'tagline',
					textContent: m.tagline,
				}],
			}],
		};
	},
});

GW.define('App.AddNewCompanyDialog', 'Main.FormDialog', {
	title: 'Nová společnost',

	renderFormFields() {
		return [{
			xtype: 'TextField',
			name: 'name',
			optional: false,
			autofocus: true,
			label: 'Název'
		}];
	},

	async onSave(data) {
		const company = await REST.POST('users/companies', data);

		App.DataManager.companies.push(company)

		Application.notify({
			kind: 'success',
			text: 'Společnost byla úspěšně uložena',
			priority: 5,
			timeout: 5000,
		});
	}
})

GW.define('App.UserManagementScreen', 'GW.Component', {
	usersList: [],
	noUsersFoundMessage: false,

	initComponent() {
		this.el = document.gwCreateElement({
			className: 'user-management-screen panel-container',
			children: [{
				className: 'screen-header',
				children: [{
					nodeName: 'h4',
					textContent: 'Správa uživatelů',
				},{
					nodeName: 'input',
					type: 'search',
					className: 'search small',
					'attr:placeholder': 'Hledat',
					'on:input': e => this.renderUsers(e.target.value)
				},{
					nodeName: 'button',
					type: 'button',
					className: 'primary small icon-left',
					children: [Utils.useIcon('plus'),{
						textContent: 'Nová společnost'
					}],
					'on:click': () => new App.AddNewCompanyDialog(document.body)
				},{
					nodeName: 'button',
					type: 'button',
					className: 'primary small icon-left',
					children: [Utils.useIcon('plus'),{
						textContent: 'Nový uživatel'
					}],
					'on:click': () => this.showUserCreateEditScreen(),
				}]
			},{
				className: 'button-switcher small',
				children: [{
					className: 'active',
					nodeName: 'button',
					type: 'button',
					textContent: 'Aktivní',
					'on:click': e => {
						this.loadUsers('active')
						this.changeActiveUserFilter(e.target)
					}
				},{
					nodeName: 'button',
					type: 'button',
					textContent: 'Deaktivovaní',
					'on:click': e => {
						this.loadUsers('deactivated')
						this.changeActiveUserFilter(e.target);
					}
				}]
			},{
				className: 'users-title',
				children: [{
					textContent: 'Uživatelé'
				},{
					textContent: 'Role'
				},{
					textContent: 'Společnost'
				}]
			},{
				className: 'users-list',
				ref: 'users'
			}]
		}, this);

		this.loadUsers('active');
	},

	showUserCreateEditScreen(user) {
		const bind = this;

		const dlg = new Main.FormDialog({
			title: user ? 'Úprava uživatele' : 'Nový uživatel',

			renderFormFields() {
				return [{
					xtype: 'TextField',
					name: 'username',
					optional: false,
					autofocus: true,
					label: 'Jméno (email)',
					autocomplete: 'off'
				},{
					name: 'role',
					label: 'Role',
					xtype: 'SelectField',
					options: [{
						value: 'U',
						text: 'User'
					},{
						value: 'A',
						text: 'Admin'
					},{
						value: 'C',
						text: 'Client'
					}],
					// Disabling only when editing user on creation user can select any company
					'on:change': (obj) => user && user.role === 'C' && this.companySelect.setDisabled(obj.getValue() === 'C')
				},{
					xtype: 'SelectField',
					name: 'company',
					optional: false,
					label: 'Company',
					options: App.DataManager.companies.map(c => ({text: c.name, value: c.id})),
					disabled: !!user && user?.role === 'C',
					ref: 'companySelect'
				},{
					xtype: 'TextField',
					name: 'password',
					type: 'password',
					optional: user,
					label: 'Heslo',
					passwordShow: true,
					autocomplete: 'new-password'
				}];
			},

			async onSave(data) {
				data.company = Number(this.companySelect.getValue());
				const userCreated = await REST.POST(!user?.id ? 'users/create' : `users/user-edit/${user.id}`, data);

				if (!user?.id) {
					if (bind.noUsersFoundMessage) {
						bind.users.innerHTML = '';
						bind.noUsersFoundMessage = false;
					}

					bind.renderUser(userCreated);
					bind.usersList.push(userCreated);
				} else {
					bind['user' + user?.id].childNodes[0].textContent = userCreated.username;
					bind['user' + user?.id].childNodes[1].textContent = bind.getRoleName(userCreated.role);
					bind['user' + user?.id].childNodes[2].textContent = bind.getCompanyName(userCreated.company);
					const userFound = bind.usersList.find(u => u.id === userCreated.id);
					userFound.username = userCreated.username;
					userFound.role = userCreated.role;
					userFound.company = userCreated.company;
				}
			},
		});

		setTimeout(() => {
			dlg.setFormFieldsData(user);
		}, 100);
	},

	getCompanyName(company) {
		return App.DataManager.companies.find(c => c.id === company)?.name
	},

	getRoleName(role) {
		return role === 'A' ? 'Admin' : (role === 'C' ? 'Client' : 'User');
	},

	changeActiveUserFilter(el) {
		const activeEl = el.parentNode.querySelector('.active');

		if (activeEl) {
			activeEl.classList.remove('active');
		}

		el.classList.add('active');
	},

	renderUser(user) {
		this.users.gwCreateChild({
			ref: !!this.title ? '' : 'user' + user.id,
			className: 'user',
			children: [{
				className: 'username',
				textContent: user.username
			},{
				className: 'role',
				textContent: this.getRoleName(user.role)
			},{
				className: 'company',
				textContent: this.getCompanyName(user.company)
			},{
				nodeName: 'button',
				type: 'button',
				className: 'secondary small icon-only',
				title: 'Upravit',
				'on:click': () => {
					if (!user.title) {
						this.showUserCreateEditScreen(user)
					}
				},
				children: [Utils.useIcon('pencil')]
			},{
				nodeName: 'button',
				type: 'button',
				className: 'secondary small icon-only',
				title: 'Deaktivovat',
				'on:click': async () => {
					if (!user.title) {
						user.active = !user.active;
						await REST.POST(`users/activate/${user.id}`, {active: user.active})
						this[`user${user.id}`].remove()
						delete this[`user${user.id}`];
						const idx = this.usersList.findIndex(u => u.id === user.id)

						if (idx >= 0) {
							this.usersList.splice(idx, 1);
						}
					}
				},
				children: [Utils.useIcon('error')]
			}]
		}, this);
	},

	async loadUsers(state) {
		this.usersList = await REST.GET('users/list/' + state);
		this.renderUsers()
	},

	renderUsers(search) {
		this.users.innerHTML = '';
		let match = TextUtils.createMatchAll(search || '');

		for (const k of Object.keys(this)) {
			if (/[a-z]+[0-9]/.test(k)) {
				delete this[k];
			}
		}

		const usersFiltered = this.usersList.filter(c => match(c.username))

		if (usersFiltered.length) {
			for (const user of usersFiltered) {
				this.renderUser(user);
			}
		} else {
			this.noUsersFoundMessage = true;
			this.users.gwCreateChild({
				textContent: 'Uživatel nebyl nalezen',
				className: 'user text-muted',
			});
		}
	}
})

GW.define('App.MicrosoftTokenScreen', 'GW.Component', {
	initComponent() {
		this.el = document.gwCreateElement({
			children: [{
				className: 'token-form panel-container',
				children: [{
					className: 'screen-header',
					children: [{
						nodeName: 'h4',
						textContent: 'Správa tokenů'
					},{
						nodeName: 'a',
						className: 'button secondary icon-right small',
						href: 'https://portal.azure.com',
						'attr:target': '_blank',
						children: [{
							nodeName: 'span',
							textContent: 'Generovat Microsoft token'
						}, Utils.useIcon('export')]
					}]
				},{
					className: 'panel-content',
					children: [{
						xtype: 'FormSegment',
						ref: 'form',
						children: [{
							xtype: 'TextField',
							label: 'Token',
							placeholder: 'Např. 5156d0c0709a4879a7ac754eca501d38',
							name: 'token',
							optional: false
						},{
							xtype: 'TextField',
							label: 'Region',
							placeholder: 'Např. westeurope',
							name: 'region',
							optional: false
						}],
						buttons: [{
							nodeName: 'button',
							className: 'error-secondary icon-left',
							children: [Utils.useIcon('delete'), {nodeName: 'span', textContent: 'Smazat token'}],
							type: 'reset',
							'on:click': async () => {
								try {
									await REST.DELETE('mc-token');
								} catch (ex) {
									Application.notify({
										kind: 'error',
										text: ex,
										priority: 5,
										timeout: 3000,
									});
								}
							}
						}],
						async submit() {
							const data = this.getFormFieldsData();
							const setTokenError = msg => {
								this.traverseChildren(function(f) {
									if (f.name === 'token') {
										f.setError(msg);
										return 'skip';
									}

									return null;
								});
							}

							try {
								await REST.POST('mc-token', data);

								Application.notify({
									kind: 'success',
									text: 'Váš token byl úspěšně uložen',
									priority: 5,
									timeout: 3000,
								})
								setTokenError('');
							} catch (ex) {
								if (ex.serverError === 'Invalid token or region') {
									setTokenError('Neplatný token');
								} else {
									Application.notify({
										kind: 'error',
										text: 'Je nám líto, ale něco se pokazilo.',
										priority: 5,
										timeout: 3000,
									});
								}
							}
						}
					}],
				}],
			}, {
				className: 'panel-container',
				children: [{
					className: 'panel-content',
					children: [{
						nodeName: 'h4',
						textContent: 'Návod na získání tokenu'
					},{
						nodeName: 'ol',
						children: [{
							nodeName: 'li',
							textContent: `Přihlásíte se na stránkách Microsoft Azure.`
						},{
							nodeName: 'li',
							textContent: 'Dostanete se na obrazovku Služba Speech'
						},{
							nodeName: 'li',
							textContent: `V levém panelu kliknete na záložku Služba Speech. Kliknete na vytvořít a objeví se 
							vám formulář pro založení speech service. Pokud už tento bod máte přeskočte na bod 6.`
						},{
							nodeName: 'li',
							textContent: `Ve formuláři vyberete správné předplatné a skupinu prostředků (pokud ji nemáte 
							vytvořte ji). Vyberte oblast a pojmenujte service. Poté už jen vyberte cenovou úroveň, podle cenové
							úrovně se liší služby, které je tato aplikace schopna nabízet, jako je například automatická detekce 
							jazyku, proto vyberte nejvyšší dostupnou úroveň.`
						},{
							nodeName: 'li',
							textContent: `Stiskněte zkontrolovat a vytvořit. A po ověřění ještě jednou vytvořit. Po vytvoření 
							se dostanete na obrazovku se servicem.`
						},{
							nodeName: 'li',
							textContent: `Otevřete service z jejich přehledu nebo pokud jste ho nově vytvářeli už se zde nacházíte`
						},{
							nodeName: 'li',
							textContent: `V levém panelu klikněte na záložku Klíče a koncové body. Z této obrazovky vykopírujte 
							klíč a region, které vložíte do aplikace.`
						}]
					}],
				}],
			}],
		}, this)
	},

	async 'after:initComponent'() {
		let token = {};
		try {
			token = await REST.GET('mc-token/info');
		} catch (ignored) {}

		this.form.setFormFieldsData(token);
	}
})

GW.define('AudioPlay', 'GW.Component', {
	mode: 'play',
	staticAudio: null,
	audio: null,

	initComponent() {
		this.el = document.gwCreateElement({
			nodeName: 'button',
			type: 'button',
			ref: 'playButton',
			className: 'secondary icon-only ' + this.className,
			children: [Utils.useIcon('play')],
			'on:click': async () => {
				if (this.staticAudio) {
					const audio = new Audio(`/api/tts/record/play/${this.staticAudio}?time=${Date.now()}`);
					this.setAudio(audio);
					this.staticAudio = null;
				}

				if (this.mode === 'play') {
					App.DataManager.setRunningAudio(this.audio, () => {
						this.changeButtonMode();
						this.audio.pause();
					});
				} else {
					App.DataManager.setRunningAudio(null);
				}

				this.audio[this.mode]();

				this.changeButtonMode();
			},
		}, this);
	},

	setAudio(audio) {
		this.audio = audio;

		audio.addEventListener('ended', () => {
			App.DataManager.setRunningAudio(null);
			this.mode = 'play';
			this.playButton.gwReplaceChildren([Utils.useIcon('play')])
		})
	},

	changeButtonMode() {
		this.mode = this.mode === 'play' ? 'pause' : 'play';
		this.playButton.gwReplaceChildren([Utils.useIcon(this.mode)])
	}
})

GW.define('AudioWaveform', 'GW.Component', {
	wavesurfer: null,

	initComponent() {
		this.el = document.gwCreateElement({
			children: [{
				ref: 'waveform',
				className: 'waveform',
			}, {
				ref: 'time',
				className: 'time',
			}]
		});

		this.wavesurfer = WaveSurfer.create({
			container: this.el.waveform,
			backend: 'MediaElement',
			height: 40,
			barGap: 3,
			barWidth: 2,
			barRadius: 3,
			normalize: true,
			responsive: true,
			cursorColor: 'transparent',
			removeMediaElementOnDestroy: false,
			waveColor: Utils.getStyleRootProperty('--primary-disabled'),
			progressColor: Utils.getStyleRootProperty('--primary-active'),
		});
	},

	setAudio(audio) {
		if (audio) {
			const getTimeFromSeconds = (secondsFloat) => {
				return secondsFloat !== Infinity ? (Math.floor(secondsFloat / 60) + ":") +
					("" + ((secondsFloat - (Math.floor(secondsFloat / 60) * 60)).toFixed(0)).padStart(2, '0')) :
					'-:--'
			};

			audio.ontimeupdate =     (e) => this.el.time.textContent = getTimeFromSeconds(e.target.currentTime);
			audio.ondurationchange = (e) => this.el.time.textContent = getTimeFromSeconds(e.target.duration);
			audio.ononloadedmetadata = (e) => this.el.time.textContent = getTimeFromSeconds(e.target.duration);

			this.wavesurfer.load(audio);
		}
	}
});

GW.define('App.RecordCreateForm', 'GW.Component', {
	async initComponent() {
		const bind = this;
		const configurations = await REST.GET(`record-configuration`)

		const dlg = new Main.FormDialog({
			title: !bind.data ? 'Nový záznam' : 'Upravit záznam',
			cancelText: 'Zrušit',
			confirmText: 'Uložit',

			renderFormFields() {
				return [{
					label: 'Název záznamu',
					xtype: 'TextField',
					ref: 'nameInput',
					name: 'name',
					validate() {return true}
				},{
					label: 'Text',
					xtype: 'TextareaField',
					'on:change': () => {
						this.generateButton.disabled = !this.textInput.getValue();
						this.validateSaveButton();
					},
					validate() {
						return !!this.getValue();
					},
					name: 'text',
					ref: 'textInput'
				},{
					label: 'Konfigurace',
					xtype: 'SelectField',
					options: [{text: 'Nevybráno', value: ''}].concat(configurations.map(c => ({text: c.name, value: c.id}))),
					ref: 'configurationSelect',
					name: 'record_configuration_id',
					optional: true,
					'on:change': e => {
						const id =  Number(e.getValue());
						if (id) {
							const configuration = configurations.find(c => c.id === id);
							this.setFormFieldsData({
								...this.getFormFieldsData(),
								language_id: configuration.language_id,
								voice: configuration.speaker_id,
								pitch: configuration.pitch,
								rate: configuration.rate
							})
						}
					}
				},{
					className: 'form-field-span',
					children: [{
						label: 'Jazyk',
						xtype: 'SelectField',
						options: App.DataManager.ttsLanguages,
						ref: 'languageSelect',
						'on:change': () => {
							this.validateSaveButton();
							this.showSpeakers(this.languageSelect.getValue())
						},
						name: 'language_id'
					},{
						label: 'Mluvčí',
						xtype: 'SelectField',
						options: [],
						ref: 'speakerSelect',
						name: 'voice',
						'on:change': () => this.validateSaveButton(),
					}],
				},{
					className: 'form-field-span',
					children: [{
						xtype: 'RangeField',
						label: 'Výška hlasu',
						name: 'pitch',
						ref: 'pitchOutput'
					},{
						xtype: 'RangeField',
						label: 'Rychlost mluvení',
						name: 'rate',
						ref: 'rateOutput'
					}]
				}, {
					className: 'form-field',
					children: [{
						nodeName: 'button',
						className: 'primary icon-left button-block',
						ref: 'generateButton',
						disabled: !bind.data?.id,
						type: 'button',
						'on:click': async () => {
							if ((this.textInput.getValue() || '').length === 0) {
								this.textInput.setError('Toto pole je povinné');
								return;
							}

							this.textInput.setError('');

							const data = this.getFormFieldsData();
							this.generateButton.classList.add('active');
							this.generateButton.gwReplaceChildren([Utils.useIcon('loading', {cls: 'icon-rotate'})])
							await this.generateRecord(data);
							this.generateButton.classList.remove('active');
							this.generateButton.gwReplaceChildren([Utils.useIcon('plus'), {
								nodeName: 'span',
								textContent: 'Generovat'
							}]);
							this.loadRecordAudio(bind.data?.id);
							this.validateSaveButton();
						},
						children: [Utils.useIcon('plus'), {
							nodeName: 'span',
							textContent: 'Generovat'
						}]
					}],
				},{
					ref: 'generated',
					className: 'form-field form-field-span ' + (!bind.data?.id ? 'hidden' : ''),
					children: [{
						xtype: 'AudioPlay',
						ref: 'audioPlay'
					}, {
						xtype: 'AudioWaveform',
						ref: 'audioWaveForm',
					}, {
						nodeName: 'a',
						className: 'button primary icon-left',
						ref: 'downloadButton',
						href: bind.data?.id ? `/api/tts/record/download/${bind.data.id}` : '',
						'attr:download': bind.data?.name || '',
						children: [Utils.useIcon('download'),{
							textContent: 'Stáhnout'
						}]
					}]
				},{
					textContent: 'Po každé změně v nahrávce je potřeba nahrávku přegenerovat.'
				}];
			},

			validateSaveButton() {
				const confirmButton = this.el.querySelector('.form-buttons > button[type="submit"]');

				const data = this.getFormFieldsData();
				const validation = this.validateChanges(data)
				const disabled = !(!validation || validation === 'name');
				confirmButton.disabled = disabled;

				this.downloadButton.classList.toggle('disabled', disabled);

				if (disabled) {
					this.downloadButton.removeAttribute('href');
				} else if (bind.data?.id) {
					this.downloadButton.setAttribute('href', `/api/tts/record/download/${bind.data.id}`);
				}
			},

			loadRecordAudio(id) {
				const audio = new Audio(`/api/tts/record/play/${id}?time=${Date.now()}`);

				this.audioPlay.setAudio(audio);
				this.audioWaveForm.setAudio(audio);
			},

			async 'after:initComponent'() {
				await this.showSpeakers(bind.data?.language_id || this.languageSelect.getValue());

				setTimeout(() => {
					bind.originalData = bind.data || {
						name: null,
						text: null,
						language: this.languageSelect.getValue(),
						voice: this.speakerSelect.getValue(),
						pitch: 1,
						rate: 1,
						record_configuration_id: ''
					}

					this.pitchOutput.setValue(bind.originalData.pitch);
					this.rateOutput.setValue(bind.originalData.rate);

					if (bind.data?.id) {
						this.loadRecordAudio(bind.data?.id);
					}
				}, 1);
			},

			async showSpeakers(langId) {
				const speakers = await REST.GET(`tts/speakers/${langId}`);

				const speakersOptimized = [];

				for (const speaker of speakers) {
					speakersOptimized.push({
						text: speaker.speaker,
						value: speaker.id
					})
				}

				this.speakerSelect.setOptions(speakersOptimized);
			},

			async generateRecord(data) {
				data.pitch = Number(data.pitch);
				data.rate = Number(data.rate);

				bind.data = await this.saveRecord(data);
				bind.originalData = {
					...bind.originalData,
					...bind.data
				};

				if (!bind.data) {
					return;
				}

				this.generated.classList.remove('hidden');
				this.downloadButton.href = `/api/tts/record/download/${bind.data.id}`;
				this.downloadButton.setAttribute('download', bind.data.name);
			},

			async onSave(data) {
				const unsavedChanges = this.validateChanges(data);

				if (unsavedChanges === 'all') {
					Application.notify({
						kind: 'error',
						text: 'Máte nepřegenerované změny!',
						priority: 5,
						timeout: 3000,
					});
					return;
				}

				if (!bind.data?.id) {
					bind.data = await this.saveRecord(data);
				}

				if (!bind.data) {
					return;
				}

				bind.data = await this.saveRecordName(data);

				bind.originalData = {
					...bind.originalData,
					...bind.data
				};
				bind.onSaveSuccess();
			},

			async saveRecordName(data) {
				if (!bind.data) {
					return;
				}

				return await REST.POST(`tts/${bind.data.id}`, {
					name: data.name
				})
			},

			async saveRecord(data) {
				try {
					return await REST.POST(`tts`, {
						text: data.text,
						languageId: Number(data.language_id),
						speakerId: Number(data.voice),
						name: data.name,
						id: bind.data?.id,
						pitch: Number(data.pitch),
						rate: Number(data.rate),
						directoryId: bind.directory?.id,
						record_configuration_id: data.record_configuration_id ? Number(data.record_configuration_id) : null
					})
				} catch (ex) {
					let message = 'Je nám líto, ale něco se pokazilo.';
					if (ex.serverError === 'Invalid token or region') {
						message = 'Neplatný microsoft token';
					}
					Application.notify({
						kind: 'error',
						text: message,
						priority: 5,
						timeout: 3000,
					});
				}
			},

			validateChanges(data) {
				const languageChange = Number(data.language_id) !== Number(bind.originalData.language_id);
				const voiceChange = Number(data.voice) !== Number(bind.originalData.voice)

				if ((data.name || languageChange || voiceChange) && !bind.data?.id && !data.text) {
					return;
				}

				let unsavedChanges = false;

				if (data.text !== bind.originalData.text && !(!data.text && bind.data?.id) ||
					languageChange ||
					voiceChange
				) {
					unsavedChanges = 'all';
				}

				if (data.name !== bind.originalData.name) {
					unsavedChanges = unsavedChanges ? unsavedChanges : 'name'
				}

				return unsavedChanges;
			},

			async 'before:destroy'() {
				const data = this.getFormFieldsData();
				const unsavedChanges = this.validateChanges(data);

				if (unsavedChanges) {
					const me = this;
					new Main.ConfirmDialog({
						title: 'Neuložené změny',
						subtitle: `Zavíráte záznam s neuloženými změnami.\n\r Chcete změny uložit?`,
						allowCloseButton: false,
						confirmText: _( unsavedChanges === 'name' ? 'Uložit změny' : 'Přegenerovat a uložit záznam'),
						cancelText: _('Zahodit změny'),

						async 'after:destroy'() {
							if (bind.data?.pregenerated) {
								await REST.DELETE(`tts/${bind.data?.id}`);
							}
						},

						async onSave() {
							if (unsavedChanges === 'all'){
								bind.data = await me.saveRecord(data);
							}

							bind.data = await me.saveRecordName(data)
							bind.onSaveSuccess();
							this.destroy()
						}
					});
				} else {
					bind.onSaveSuccess();
				}


				if (bind.data?.pregenerated && !unsavedChanges) {
					await REST.DELETE(`tts/${bind.data.id}`);
				}
			}
		});

		setTimeout(() => {
			if (this.data) {
				dlg.setFormFieldsData(this.data);
			}
		}, 100);
	}
});

GW.define('App.RecordsScreen', 'GW.Component', {
	records: [],

	async initComponent() {
		try {
			App.DataManager.tokenActive = !!(await REST.GET('mc-token'))
		} catch (ex) {
			App.DataManager.tokenActive = false;
		}

		await this.reloadTable();

		if (this.records.length === 0 && !App.DataManager.tokenActive) {
			this.noTokenScreen();
		}
	},

	recordsScreen() {
		const me = this;
		this.el.innerHTML = '';

		this.el.gwCreateChild({
			'on:drop': async e => {
				if (this.directory) {
					e.stopPropagation();
					const id = Number(e.dataTransfer.getData("dir-id"));
					await REST.POST(`directory/append/${id}?id=${this.directory.parent_id || ''}`);
					me.table.setData(me.records.filter(r => r.id !== id));
				}
			},
			className: 'panel-container',
			children: [{
				className: 'screen-header',
				children: [{
					nodeName: 'h4',
					textContent: 'Záznamy'
				},{
					nodeName: 'input',
					type: 'search',
					className: 'search small',
					'attr:placeholder': 'Hledat',
					'on:input': e => this.filterRecords(e.target.value)
				},{
					nodeName: 'button',
					type: 'button',
					className: 'primary icon-left small',
					children: [Utils.useIcon('arrow-left'), {
						nodeName: 'span',
						textContent: 'Zpět'
					}],
					'on:click': async () => {
						if (this.directory?.id) {
							me.directory = !this.directory.parent_id ?
								null :
								await REST.GET(`directory/${this.directory.parent_id}`);
							Application.pushRoute(`/text-to-speech?directory=${me.directory?.id || ''}`)
						}
					}
				},{
					nodeName: 'button',
					type: 'button',
					className: 'primary icon-left small',
					'on:click': () => {
						if (!App.DataManager.tokenActive) {
							Application.notify({
								kind: 'warning',
								text: 'Token nenalezen.',
								priority: 5,
								timeout: 3000,
							});
							return;
						}

						this.openRecordForm()
					},
					children: [Utils.useIcon('plus'), {
						nodeName: 'span',
						textContent: 'Nový záznam'
					}]
				},{
					nodeName: 'button',
					type: 'button',
					className: 'primary icon-left small',
					'on:click': () => this.openCreateFolderDialog(),
					children: [Utils.useIcon('plus'), {
						nodeName: 'span',
						textContent: 'Nová složka'
					}]
				}]
			},{
				xtype: 'SmartTable',
				ref: 'table',
				renderRow(tr, row) {
					tr.setAttribute('draggable', true);
					tr.setAttribute('dir-id', row.id)
					tr.ondragstart = e => e.dataTransfer.setData("dir-id", row.id);


					tr.ondrop = async e => {
						e.stopPropagation();

						if (!row.record_id) {
							const id = Number(e.dataTransfer.getData("dir-id"));
							await REST.POST(`directory/append/${id}?id=${row.id}`);
							me.table.setData(me.records.filter(r => r.id !== id));
						} else {
							Application.notify({
								kind: 'info',
								text: 'Cannot move directory under file',
								priority: 5,
								timeout: 3000,
							});
						}
					}
				},
				getColumns: () => {
					const openSettings = (ev, row) => this.showSettingsPopup(ev, row);

					return [{
						name: 'Název',
						// filter: true,
						id: 'name',
						formatCell(td, v, row) {
							if (!row.record_id) {
								td.classList.add('directory')
								td.gwCreateChild({
									nodeName: 'a',
									textContent: v,
									'on:click': () => {
										me.directory = row;
										Application.pushRoute(`/text-to-speech?directory=${me.directory?.id || ''}`)
									}
								});
							} else {
								td.textContent = v;
							}
						}
					},{
						name: 'Jazyk',
						// filter: true,
						id: 'language'
					},{
						name: 'Mluvčí',
						// filter: true,
						id: 'speaker'
					},{
						name: 'Text',
						// filter: true,
						id: 'text'
					},{
						id: 'ctl',
						name: '',
						formatCell(td, v, row) {
							if (!row.record_id) {
								td.gwCreateChild({
									nodeName: 'button',
									type: 'button',
									className: 'secondary icon-only small',
									children: [Utils.useIcon('delete')],
									'on:click': async () => me.deleteDirectoryDialog(row)
								})
								return;
							}

							td.gwCreateChild({
								xtype: 'AudioPlay',
								staticAudio: row.id,
								className: 'small',
							});

							td.gwCreateChild({
								nodeName: 'a',
								className: 'button secondary icon-only small',
								href: `/api/tts/record/download/${row.id}`,
								'attr:download': row.name,
								children: [Utils.useIcon('download')]
							});

							td.gwCreateChild({
								nodeName: 'button',
								type: 'button',
								className: 'secondary icon-only small',
								'on:click': ev => openSettings(ev, row),
								children: [Utils.useIcon('moreoptions')]
							});
						}
					}]
				}
			}]
		}, this)
	},

	deleteDirectoryDialog(directory) {
		const me = this;

		new Main.FormDialog({
			title: 'Smazat složku',
			subtitle: 'Smazání složky smažene všechna data data v ní',

			renderFormFields() {
				return [{
					xtype: 'AckCheckboxField',
					name: 'moveDirectoriesToRoot',
					shortText: 'Smazat slořku a obsah zachovat?',
					optional: true,
					autofocus: true
				}];
			},

			async onSave(data) {
				await REST.DELETE(`directory/${directory.id}?moveDirectoriesToRoot=${data.moveDirectoriesToRoot}`);
				me.records = await REST.GET(`tts/record/list?directoryId=${me.directory?.id || ''}`);
				me.table.setData(me.records);
			}
		})
	},

	openCreateFolderDialog() {
		const me = this;

		new Main.FormDialog({
			title: 'Nová složka',
			subtitle: 'Složka bude založna pod aktuální složkou',

			renderFormFields() {
				return [{
					xtype: 'TextField',
					name: 'name',
					optional: false,
					autofocus: true,
					label: 'Název'
				}];
			},

			async onSave(data) {
				const directory = await REST.POST('directory', {
					...data,
					parent_id: me.directory?.id
				});
				me.records.push(directory)
				me.table.setData(me.records);
			}
		})
	},

	noTokenScreen() {
		this.el.innerHTML = '';

		const screenText = App.DataManager.session.role === 'U' ?
			'Je nám líto, ale v tuto chvíli\n\r není možné generovat nahrávky.\n\r Požádejte administrátora o přidání tokenu.' :
			'Pro vytvoření záznamů nejprve\n\r vygenerujte a zadejte token.'

		this.el.gwCreateChild({
			className: 'empty-screen',
			children: [{
				nodeName: 'img',
				src: '../../img/missing-token.svg'
			},{
				nodeName: 'h5',
				textContent: 'Zatím nebyl nahrán token'
			},{
				nodeName: 'p',
				textContent: screenText,
				className: 'text-muted',
			}].concat(App.DataManager.session.role === 'U' ? [] : [{
				nodeName: 'button',
				type: 'button',
				className: 'primary small',
				textContent: 'Správa tokenů',
				'on:click': () => Application.replaceRoute(APP_BASE + 'microsoft-token')
			}])
		})
	},

	anyRecordsScreen() {
		this.el.innerHTML = '';
		delete this.table;

		this.el.gwCreateChild({
			className: 'empty-screen',
			children: [{
				nodeName: 'img',
				src: '../../img/missing-token.svg'
			},{
				nodeName: 'h5',
				textContent: 'Je tu prázdno,\n\r pojďme vytvořit první záznam'
			}, {
				nodeName: 'button',
				type: 'button',
				className: 'primary icon-left small',
				children: [Utils.useIcon('plus'), {
					nodeName: 'span',
					textContent: 'Nový záznam'
				}],
				'on:click': () => this.openRecordForm()
			}]
		})
	},

	async reloadTable() {
		const url = new URL(window.location.href);
		if (url.searchParams.get('directory')) {
			const id = Number(url.searchParams.get('directory'));
			if (!isNaN(id)) {
				this.directory = await REST.GET(`directory/${id}`)
			}
		}

		this.records = await REST.GET(`tts/record/list?directoryId=${this.directory?.id || ''}`);

		if (this.records.length === 0 && !this.directory) {
			this.anyRecordsScreen()
		} else if (!this.table) {
			this.recordsScreen();
		}

		if (this.table) {
			setTimeout(() => {
				this.table.setData(this.records);
			}, 2)
		}
	},

	filterRecords(search) {
		let match = TextUtils.createMatchAll(search || '');

		const matchFields = ['name', 'language', 'speaker', 'text'];
		const recordsFiltered = this.records.filter(r => match(matchFields.map(f => r[f]).join(' ')))
		recordsFiltered.sort((a, b) => a.name === b.name ? 0 : (a.name > b.name ? 1 : -1));

		this.table.setData(recordsFiltered);
	},

	openRecordForm(record) {
		let bind = this;

		new App.RecordCreateForm({
			onSaveSuccess() {
				bind.reloadTable();
			},
			data: record,
			directory: bind.directory
		})
	},

	async deleteRow(id) {
		await REST.DELETE(`tts/${id}`)
		this.records = this.records.filter(r => r.id !== id);
		this.table.setData(this.records)
	},

	showSettingsPopup(ev, row) {
		const bind = this;

		let popup = new PopupMenu({
			options: [{
				iconName: 'edit',
				text: 'Upravit',
				cls: 'edit',
				handle: async () => {
					if (!row.editable) {
						Application.notify({
							kind: 'error',
							text: `Je nám líto, ale tato nahrávka nebyla vytvořena v regionu aktuálního klíče. 
								Tento záznam byl vytvořen pod regionem ${row.region}`,
							priority: 5,
							timeout: 3000,
						})
						return;
					}

					const data = await REST.GET(`tts/record/${row.id}`);

					bind.openRecordForm(data)
				}
			},{
				iconName: 'duplicate',
				text: 'Duplikovat',
				cls: 'duplicate',
				handle: async () => {
					const record = await REST.POST(`tts/duplicate/${row.id}`);
					const idx = bind.records.findIndex(r => r.id === row.id);
					bind.records.splice(idx, 0, record);

					bind.table.setData(this.records);
				}
			},{
				iconName: 'delete',
				text: 'Smazat',
				cls: 'delete',
				handle: async () => await bind.deleteRow(row.id)
			}],
		});

		PopupManager.show(popup, {
			anchorEl: ev.target,
			forceAxis: 'vertical',
			preferReadingOrder: true,
		});
	}
});

GW.define('StatisticsMonthSelector', 'GW.Component', {
	month: 0,
	year: 0,

	getMonthName() {
		return ["Leden", "Únor", "Březen", "Duben",
			"Květen", "Červen", "Červenec", "Srpen", "Září",
			"Říjen", "Listopad", "Prosinec"][this.month];
	},

	changeMonth(mode) {
		if (mode === 'up') {
			const date = new Date();
			if (this.month + 1 > date.getMonth() && this.year === date.getFullYear()) {
				Application.notify({
					kind: 'warning',
					text: 'Není možné vyhledávat výsledky v budoucnosti.',
					priority: 5,
					timeout: 3000,
				});
				return;
			} else if (this.month + 1 > 11) {
				this.year++;
				this.month = 1;
			} else {
				this.month++;
			}
		} else {
			if (this.month - 1 < 0) {
				this.year--;
				this.month = 11;
			} else {
				this.month--;
			}
		}

		this.yearEl.textContent = this.year;
		this.monthEl.textContent = this.getMonthName();
		this.fire('date-change', this.year, this.month);
	},

	initComponent() {
		const date = new Date();
		this.month = date.getMonth();
		this.year = date.getFullYear();

		this.el = document.gwCreateElement({
			className: 'month-selector',
			children: [{
				'on:click': () => this.changeMonth('down'),
				children: [Utils.useIcon('arrow-left')]
			},{
				ref: 'yearEl',
				textContent: this.year
			},{
				ref: 'monthEl',
				textContent: this.getMonthName(),
			}, {
				'on:click': () => this.changeMonth('up'),
				children: [Utils.useIcon('arrow-right')]
			}]
		}, this);

		this.fire('date-change', this.year, this.month);
	},

	getDate() {
		return [this.year, this.month];
	}
})

GW.define('App.RecordConfigurations', 'GW.Component', {
	initComponent() {
		const me = this;

		this.el = document.gwCreateElement({
			className: 'panel-container',
			children: [{
				className: 'screen-header',
				children: [{
					nodeName: 'h4',
					textContent: 'Konfigurace nahrávek'
				},{
					nodeName: 'input',
					type: 'search',
					className: 'search small',
					'attr:placeholder': 'Hledat',
					'on:input': e => {
						let match = TextUtils.createMatchAll(e.target.value || '');

						const matchFields = ['language_name', 'speaker_name'];
						const recordsFiltered = this.data.filter(r => match(matchFields.map(f => r[f]).join(' ')))
						recordsFiltered.sort((a, b) => a.name === b.name ? 0 : (a.name > b.name ? 1 : -1));

						this.table.setData(recordsFiltered);
					}
				},{
					nodeName: 'button',
					type: 'button',
					className: 'primary icon-left small',
					'on:click': () => this.openConfigurationDialog(),
					children: [Utils.useIcon('plus'), {
						nodeName: 'span',
						textContent: 'Nová konfigurace'
					}]
				}]
			},{
				xtype: 'SmartTable',
				ref: 'table',
				getColumns: () => {
					return [{
						name: 'Název',
						id: 'name'
					},{
						name: 'Jazyk',
						id: 'language_name'
					},{
						name: 'Mluvčí',
						id: 'speaker_name'
					},{
						name: 'Výška',
						id: 'pitch',
						formatCell(td, v, row) {
							td.textContent = me.formatPercentage(v);
						}
					},{
						name: 'Rychlost',
						id: 'rate',
						formatCell(td, v, row) {
							td.textContent = me.formatPercentage(v);
						}
					},{
						id: 'ctl',
						name: '',
						formatCell(td, v, row) {
							td.gwCreateChild({
								nodeName: 'button',
								type: 'button',
								className: 'secondary icon-only small',
								children: [Utils.useIcon('pencil')],
								'on:click': async () => me.openConfigurationDialog(row)
							})

							td.gwCreateChild({
								nodeName: 'button',
								type: 'button',
								className: 'secondary icon-only small',
								children: [Utils.useIcon('delete')],
								'on:click': async () => me.deleteConfigurationDialog(row)
							})
						}
					}]
				}
			}]
		}, this);
	},

	deleteConfigurationDialog(row) {
		const me = this;

		new Main.ConfirmDialog({
			title: 'Smazat konfiguraci',
			subtitle: `Tato akce je nevratná. Chcete ji provést?`,
			allowCloseButton: false,
			confirmText: _( 'Smazat'),
			cancelText: _('Zrušit'),

			async onSave() {
				await REST.DELETE(`record-configuration/${row.id}`);
				me.table.setData(me.data.filter(r => r.id !== row.id));
			}
		});
	},

	formatPercentage(value) {
		return Math.floor(Number(value) * 100) + "";
	},

	async 'after:initComponent'() {
		const data = await REST.GET('record-configuration');
		this.data = data;
		this.table.setData(data);
	},

	openConfigurationDialog(row) {
		const me = this;

		const dlg = new Main.FormDialog({
			title: !row ? 'Nová konfigurace' : 'Upravit konfiguraci',
			cancelText: 'Zrušit',
			confirmText: 'Uložit',

			renderFormFields() {
				return [{
					className: 'form-field-span',
					children: [{
						label: 'Název',
						xtype: 'TextField',
						name: 'name'
					},{
						label: 'Jazyk',
						xtype: 'SelectField',
						options: App.DataManager.ttsLanguages,
						ref: 'languageSelect',
						'on:change': () => {
							this.showSpeakers(this.languageSelect.getValue())
						},
						name: 'language_id'
					},{
						label: 'Mluvčí',
						xtype: 'SelectField',
						options: [],
						ref: 'speakerSelect',
						name: 'speaker_id'
					}],
				},{
					className: 'form-field-span',
					children: [{
						xtype: 'RangeField',
						label: 'Výška hlasu',
						name: 'pitch',
						ref: 'pitchOutput'
					},{
						xtype: 'RangeField',
						label: 'Rychlost mluvení',
						name: 'rate',
						ref: 'rateOutput'
					}]
				}];
			},

			async 'after:initComponent'() {
				await this.showSpeakers(row?.language_id || this.languageSelect.getValue());

				setTimeout(() => {
					this.originalData = row || {
						name: '',
						language_id: this.languageSelect.getValue(),
						speaker_id: this.speakerSelect.getValue(),
						pitch: 1,
						rate: 1
					}

					this.setFormFieldsData(this.originalData);

					this.pitchOutput.setValue(this.originalData.pitch);
					this.rateOutput.setValue(this.originalData.rate);
				}, 1);
			},

			async showSpeakers(langId) {
				const speakers = await REST.GET(`tts/speakers/${langId}`);

				const speakersOptimized = [];

				for (const speaker of speakers) {
					speakersOptimized.push({
						text: speaker.speaker,
						value: speaker.id
					})
				}

				this.speakerSelect.setOptions(speakersOptimized);
			},

			async onSave(data) {
				data = {
					name: data.name,
					language_id: Number(data.language_id),
					speaker_id: Number(data.speaker_id),
					pitch: Number(data.pitch),
					rate: Number(data.rate)
				}

				if (row?.id) {
					const res = await REST.POST(`record-configuration/${row.id}`, data);
					const idx = me.data.findIndex(r => r.id === row.id);
					me.data[idx] = res;
				} else {
					const configuration = await REST.POST(`record-configuration`, data);
					me.data.push(configuration);
				}

				me.table.setData(me.data);

				this.saved = true;
			},

			validateChanges(data) {
				const prev = this.originalData;

				const languageChange = Number(data.language_id) !== Number(prev.language_id);
				const voiceChange = Number(data.voice) !== Number(prev.voice)

				return prev.name !== data.name || languageChange || voiceChange || data.pitch !== prev.pitch || data.pitch !== prev.pitch;
			},

			async 'before:destroy'() {
				if (this.saved) {
					return;
				}

				const data = this.getFormFieldsData();
				const unsavedChanges = this.validateChanges(data);

				if (unsavedChanges) {
					const bind = this;
					new Main.ConfirmDialog({
						title: 'Neuložené změny',
						subtitle: `Zavíráte záznam s neuloženými změnami.\n\r Chcete změny uložit?`,
						allowCloseButton: false,
						confirmText: _( 'Uložit změny'),
						cancelText: _('Zahodit změny'),

						async onSave() {
							bind.onSave();
						}
					});
				}
			}
		});
	}
})

GW.define('App.StatisticsScreen', 'GW.Component', {
	statistics: [],

	initComponent() {
		const bind = this;

		this.el = document.gwCreateElement({
			className: 'panel-container',
			children: [{
				className: 'screen-header',
				children: [{
					nodeName: 'h4',
					textContent: 'Statistiky'
				},{
					nodeName: 'input',
					type: 'search',
					className: 'search small',
					'attr:placeholder': 'Hledat',
					'on:input': e => this.filterStatistics(e.target.value)
				},{
					xtype: 'StatisticsMonthSelector',
					'on:date-change': (obj, year, month) => this.reloadTable(year, month),
					ref: 'monthSelector'
				}]
			},{
				children: [{
					nodeName: 'a',
					className: 'button secondary icon-only small statistics-download-button',
					href: `/api/stats/alltime`,
					'attr:download': 'data.csv',
					children: [Utils.useIcon('download'), {
						textContent: 'Stáhnout všechny historické statistiky'
					}]
				}].concat(App.DataManager.session.role === 'U' ? [] : [{
					nodeName: 'a',
					className: 'button secondary icon-only small statistics-download-button',
					'attr:download': 'data.csv',
					children: [Utils.useIcon('download'), {
						textContent: 'Stáhnout všechny statistiky tento měsíc'
					}],
					ref: 'monthlyStatisticsDownload'
				}])
			},{
				xtype: 'SmartTable',
				ref: 'table',
				getColumns: () => {
					return [{
						name: 'Uživatel',
						id: 'username'
					},{
						name: 'Počet generací',
						id: 'count'
					},{
						id: 'ctl',
						name: '',
						formatCell(td, v, row) {
							const [year, month] = bind.monthSelector.getDate();

							td.gwCreateChild({
								nodeName: 'a',
								className: 'button secondary icon-only small',
								href: `/api/stats/${row.id}/${year}/${month}`,
								'attr:download': 'data.csv',
								children: [Utils.useIcon('download')]
							});
						}
					}]
				}
			}]
		}, this);
	},

	filterStatistics(search) {
		let match = TextUtils.createMatchAll(search || '');

		const recordsFiltered = this.statistics.filter(r => match(r.username + ' ' + r.count));

		this.table.setData(recordsFiltered);
	},

	async reloadTable(year, month) {
		try {
			this.statistics = await REST.GET(`statistics/${year}/${month}`);

			if (App.DataManager.session.role === 'A') {
				this.monthlyStatisticsDownload.href = `/api/stats/all/${year}/${month}`;
			}

			this.table.setData(this.statistics);
		} catch (ex) {
			Application.notify({
				kind: 'error',
				text: `Je nám líto, ale něco se pokazilo.`,
				priority: 5,
				timeout: 3000,
			})
		}
	}
});

// }}}
// {{{ Main.Screen

GW.define('Main.Screen', 'GW.Component', {
	initComponent() {
		this.el = document.gwCreateElement({
			className: 'main-screen js-msgbus',
			children: [{
				ref: 'headerEl',
				className: 'header',
				children: [{
					className: 'modules',
					ref: 'modulesEl',
					children: [Utils.useIcon('apps')],
					'on:click': ev => this.showModulesPopup(ev),
				}, {
					className: 'logo',
					ref: 'logoEl',
					textContent: 'LOGO',
					'on:click': ev => Application.replaceRoute(APP_BASE),
				}, {
					className: 'title',
					ref: 'titleEl',
					children: [(this.titleIcon ? Utils.useIcon(this.titleIcon) : undefined), {
						textContent: 'Text to speech'
					}],
				}, {
					className: 'group-selection',
					ref: 'groupSelection',
				}, {
					className: 'server-status',
					ref: 'serverStatus',
				}, {
					className: 'profile',
					children: [{
						className: 'icon',
					}, {
						className: 'name',
						ref: 'userNameEl',
					}],
					'on:click': ev => this.showProfilePopup(ev),
				}],
			}, {
				className: 'admin-body page-centered-container',
				children: [{
					ref: 'bodyEl',
					className: 'body',
				}, {
					ref: 'sidebarEl',
					className: 'sidebar hidden',
				}],
			}, {
				ref: 'footerEl',
				className: 'footer hidden',
			}],
		}, this);

		this.userNameEl.textContent = App.DataManager.session.username;

		this.updateSidebarMenu();
	},

	showModulesPopup(ev) {
		let modsEl = ev.target.closest('.modules');
		let popup = new Main.ModulesSelector();

		PopupManager.show(popup, {
			fixed: true,
			top: this.headerEl.offsetHeight,
			left: 0,
			toggleEl: modsEl,
		});
	},

	getSidebarMenu() {
		return [{
			nodeName: 'a',
			className: 'item',
			href: APP_BASE + 'text-to-speech',
			children: [ Utils.useIcon('texttospeech'),  { textContent: 'Záznamy' } ],
			screen: 'App.RecordsScreen'
		},{
			nodeName: 'a',
			className: 'item',
			href: APP_BASE + 'statistics',
			children: [Utils.useIcon('chart'), {textContent: 'Statistiky'}],
			screen: 'App.StatisticsScreen'
		},{
			nodeName: 'a',
			className: 'item',
			href: APP_BASE + 'record-configurations',
			children: [Utils.useIcon('settings'), {textContent: 'Konfigurace'}],
			screen: 'App.RecordConfigurations'
		}].concat(App.DataManager.session.role === 'U' ? [] : [{
			nodeName: 'a',
			className: 'item',
			href: APP_BASE + 'microsoft-token',
			children: [ Utils.useIcon('usercheckmark'), { textContent: 'Správa tokenů' } ],
			screen: 'App.MicrosoftTokenScreen'
		},{
			nodeName: 'a',
			className: 'item',
			href: APP_BASE + 'users',
			children: [ Utils.useIcon('users'), { textContent: 'Správa uživatelů' } ],
			screen: 'App.UserManagementScreen'
		}]);
	},

	//XXX: call on activate() to update selected item
	updateSidebarMenu() {
		let menu = this.getSidebarMenu();
		if (menu.length == 0) {
			return;
		}

		for (const item of menu) {
			item['on:click'] = e => {
				e.preventDefault();
				this.bodyEl.innerHTML = '';

				this.bodyEl.gwCreateChild({
					xtype: item.screen
				})

				Application.replaceRoute(APP_BASE + item.href);
			}

			if (this.screenUrl === item.href.replace('/', '')) {
				this.bodyEl.gwCreateChild({
					xtype: item.screen
				})
			}
		}

		this.sidebarEl.gwCreateChild({
			className: 'vertical-menu',
			children: menu,
		});

		this.sidebarEl.classList.remove('hidden');

		for (let a of this.sidebarEl.querySelectorAll('a')) {
			let match = Application.routePath.startsWith(a.getAttribute('href') + '/')
				|| Application.routePath == a.getAttribute('href');

			a.classList.toggle('active', match);
		}
	},

	showProfilePopup(ev) {
		function setTheme(theme) {
			Application.setDocumentTheme(theme);
			PopupManager.hideAll();
		}

		let popup = new PopupMenu({
			options: [{
				iconName: 'user',
				text: App.DataManager.session.username,
				cls: 'name'
			},{
				iconName: 'moon',
				text: _('Vzhled'),
				submenu: [{
					rightIconName: !Application.getDocumentTheme() ? 'check' : null,
					cls: !Application.getDocumentTheme() ? 'active' : undefined,
					iconName: 'sunmoon',
					text: _('Automatický'),
					handle: () => setTheme(),
				}, {
					rightIconName: Application.getDocumentTheme() == 'light' ? 'check' : null,
					cls: Application.getDocumentTheme() == 'light' ? 'active' : undefined,
					iconName: 'sun',
					text: _('Světlý motiv'),
					handle: () => setTheme('light'),
				}, {
					rightIconName: Application.getDocumentTheme() == 'dark' ? 'check' : null,
					cls: Application.getDocumentTheme() == 'dark' ? 'active' : undefined,
					iconName: 'moon',
					text: _('Tmavý motiv'),
					handle: () => setTheme('dark'),
				}],
			},{
				iconName: 'logout',
				text: 'Odhlásit',
				cls: 'logout',
				handle: async c => {
					await App.DataManager.logout();
					await Application.replaceRoute('/login');
				},
			}],

			'after:initComponent'() {
				this.el.classList.add('profile-popup');
			},
		});

		PopupManager.show(popup, {
			anchorEl: ev.target.closest('.profile'),
			forceAxis: 'vertical',
			preferReadingOrder: true,
		});
	}
});


// }}}
// {{{ Routes

Application = new GW.Application({
	async commonRouteHandler(match) {
		if (match.route.group === 'app') {
			return;
		}

		const session = App.DataManager.session || await App.DataManager.initSession();

		if (!session && match.route.path !== '/signup') {
			Application.show({
				xtype: 'Pubweb.LoginScreen'
			});
			return true;
		}
	},

	updateThemeTinting() {
		if (!document.body) {
			// too soon
			return;
		}

		/*
		 * Determine the current color of the nav header (it's affected by
		 * dark/light mode setting and themes) and set it to mask-icon
		 * and theme-color meta vars.
		 */
		if (!this.sourceHeaderElement) {
			this.sourceHeaderElement = document.body.gwCreateChild({
				style: 'display: none; background-color: var(--nav-header-bg)',
			});
		}

		let themeEl = document.querySelector('meta[name="theme-color"]');
		let maskIconEl = document.querySelector('link[rel="mask-icon"]');
		let targetColor = getComputedStyle(this.sourceHeaderElement).getPropertyValue('background-color');
		if (targetColor) {
			if (themeEl && targetColor !== themeEl.getAttribute('content')) {
				themeEl.setAttribute('content', targetColor);
			}

			if (maskIconEl && targetColor !== maskIconEl.getAttribute('color')) {
				maskIconEl.setAttribute('color', targetColor);
			}
		}
	},

	setDocumentTheme(theme) {
		if (!theme) {
			delete document.documentElement.dataset.theme
			localStorage.removeItem('ui-theme');
		} else {
			document.documentElement.dataset.theme = theme;
			localStorage.setItem('ui-theme', theme);
		}

		this.updateThemeTinting();
	},

	getDocumentTheme() {
		return document.documentElement.dataset.theme;
	},

	'before:run'() {
		let theme = localStorage.getItem('ui-theme');
		if (theme && ['light', 'dark'].includes(theme)) {
			document.documentElement.classList.toggle('no-transitions', true);
			document.documentElement.dataset.theme = theme;
			requestAnimationFrame(() => {
				document.documentElement.classList.toggle('no-transitions', false);
			});
		}

		// Removes meta "theme-color" from HTML head as soon as possible
		// to prevent flickering of Safari color tinting while using
		// non-default theme
		const metaThemeColorElement = document.querySelector('meta[name="theme-color"]');
		if (metaThemeColorElement) {
			metaThemeColorElement.setAttribute('content', '');
		}

		this.updateThemeTinting();
	},
});

Application.addRoutes([{
	group: 'public',
	path: '/',
	async handler({params}) {
		Application.replaceRoute(APP_BASE + 'text-to-speech');
	}
},{
	group: 'public',
	path: '/login',
	async handler({params}) {
		Application.show({
			xtype: 'Pubweb.LoginScreen'
		});
	}
},{
	group: 'auth',
	path: '/{screen:str}',
	async handler({params, captures}) {
		Application.show({
			xtype: 'Main.Screen',
			screenUrl: captures.screen
		});
	}
}]);

// }}}
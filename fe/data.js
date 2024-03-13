/**
 * Spravuje veškerá data v aplikaci
 *
 * Pro čtení/ukládání dat používá kombinaci REST API serveru a localStorage
 *
 * @fires @event login - Po přihlášení uživatele nebo při objevení již existující session
 * @fires @event logout - Po odhlášení uživatele
 * @class App.DataManager
 */
GW.define('App.DataManager', 'GW.Object', {
	singleton: true,
	session: null,
	ttsLanguages: [],
	tokenActive: null,
	runningAudio: null,
	companies: [],

	async init() {
		await this.getLanguages();
		this.companies = await REST.GET(`users/companies`);
	},

	setRunningAudio(audio, stopAudio) {
		if (!audio) {
			this.runningAudio = null;
			return;
		}

		if (this.runningAudio) {
			this.runningAudio.stopAudio();
		}

		this.runningAudio = {
			audio,
			stopAudio
		};
	},

	async getLanguages() {
		const langs = await REST.GET('tts/languages');

		this.ttsLanguages = [];

		for (const lang of langs) {
			this.ttsLanguages.push({
				text: `${lang.language} (${lang.language_key})`,
				value: lang.id
			})
		}

	},

	/**
	 * Přihlašuje uživatele
	 *
	 * @param {object} data - Přihlašovací údaje
	 * @param {string} data.email - Email uživatele
	 * @param {string} data.password - Heslo uživatele
	 * @return {Promise<object>} Údaje vytvořené session
	 * @throws RESTError V případě selhání API komunikace
	 */
	async login(data) {
		this.session = await REST.POST('session', data);
		await this.init();
		return this.session;
	},

	async userCreate(data) {
		const user = await REST.POST('users/create', data);
		this.fire('user-create', user);
	},

	async userEdit(data) {
		const user = await REST.POST(`users/user-edit/${data.id}`, data);
		this.fire('user-edited', user);
	},

	/**
	 * Vrací aktuální session
	 *
	 * @return {object} Údaje existující session nebo null pokud session neexistuje
	 */
	getSession() {
		return this.session;
	},

	/**
	 * Vrací informaci, zda-li existuje aktuální session
	 *
	 * @return {boolean} True právě když existuje session
	 */
	hasSession() {
		return this.session != null;
	},

	/**
	 * Odhlašuje uživatele
	 *
	 * @return {Promise}
	 * @throws RESTError V případě selhání API komunikace
	 */
	async logout() {
		await REST.DELETE('session');
		this.session = null;
		this.fire('logout');
	},

	/**
	 * Zjišťuje a inicializuje aktuální session
	 *
	 * @return {Promise<object>} Údaje existující session nebo null pokud session neexistuje (nebo se jí nepodařilo zjistit)
	 */
	async initSession() {
		try {
			this.session = await REST.GET('session');
			this.fire('login', this.session);
			await this.init();
		} catch (ignored) {}

		return this.session;
	}
});
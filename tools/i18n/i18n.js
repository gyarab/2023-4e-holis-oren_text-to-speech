// This file is generated, don't edit manually!
i18n = typeof i18n == 'undefined' ? {} : i18n;
i18n.langs = {};
i18n.langs.cs = {
	"File size limit is 10MB.": "Limit velikosti je 10MB.",
	"Invalid date format. Use d.m.y, or m/d/y.": "Chybný formát datumu. Použijte d.m.r nebo m/d/r",
	"Invalid date/time format. Use d.m.y H:M, or m/d/y. H:M": "Chybný formát datumu a času. Použijte d.m.r h:m nebo m/d/r h:m",
	"Invalid e-mail address.": "Chybná e-mailová adresa.",
	"Invalid format": "Chybná hodnota.",
	"Invalid number.": "Musí být číslo.",
	"Invalid value.": "Chybná hodnota.",
	"Login": "Přihlášení",
	"Logout": "Odhlášení",
	"Nelze objednat {n} kus.": [
		"Nelze objednat {n} kus.",
		"Nelze objednat {n} kusy.",
		"Nelze objednat {n} kusů."
	],
	"Password": "Heslo",
	"Password needs to be at least 10 characters long.": "Heslo musí musí být dlouhé alespoň 10 znaků.",
	"Please drag'n'drop just a single photo here.": "Přetáhnout lze pouze jednu fotografii.",
	"Please fill the form correctly.": "Prosím vyplňte formulář správně",
	"Remove photo": "Odstranit foto",
	"Save changes": "Uložit změny",
	"Skladem už je pouze {n} kus.": [
		"Skladem už je pouze {n} kus.",
		"Skladem už jsou pouze {n} kusy.",
		"Skladem už je pouze {n} kusů."
	],
	"Skladem {n} kus": [
		"Skladem {n} kus",
		"Skladem {n} kusy",
		"Skladem {n} kusů"
	],
	"This field is required": "Toto políčko je vyžadované",
	"This photo is required": "Foto je vyžadované",
	"Unhandled rejection": "Neošetřená výjimka",
	"Upload": "Nahrát",
	"V košíku máte {n} kus": [
		"V košíku máte {n} kus",
		"V košíku máte {n} kusy",
		"V košíku máte {n} kusů"
	],
	"You need to agree to continue": "Aby jste mohli pokračovat musíte souhlasit s podmínkami",
	"{n} dnů": [
		"{n} den",
		"{n} dny",
		"{n} dnů"
	],
	"{n} hodin": [
		"{n} hodina",
		"{n} hodiny",
		"{n} hodin"
	],
	"{n} minut": [
		"{n} minuta",
		"{n} minuty",
		"{n} minut"
	],
	"__plural": function(n) { return (n==1) ? 0 : ((n>=2 && n<=4) ? 1 : 2); },
	"__nplurals": 3
};
i18n.langs.en = {
	"Nelze objednat {n} kus.": [
		"",
		""
	],
	"Skladem už je pouze {n} kus.": [
		"",
		""
	],
	"Skladem {n} kus": [
		"",
		""
	],
	"V košíku máte {n} kus": [
		"",
		""
	],
	"{n} dnů": [
		"",
		""
	],
	"{n} hodin": [
		"",
		""
	],
	"{n} minut": [
		"",
		""
	],
	"__plural": function(n) { return (n != 1); },
	"__nplurals": 2
};

for (let entries of Object.values(i18n.langs)) {
	entries.__get_plural_index = entries.__plural;
}

function _l(lang, msgid) {
	return _lc(lang, msgid);
}

function _lc(lang, msgid, context) {
	lang = 'cs';
	let translation = i18n.langs[lang][(typeof context != 'undefined' ? context + '|' : '') + msgid];

	return typeof translation == 'string' ? translation : msgid;
}

function _ln(lang, n, msgid) {
	return _lnc(lang, n, msgid);
}

function _lnc(lang, n, msgid, context) {
	let translation = i18n.langs[lang][(typeof context != 'undefined' ? context + '|' : '') + msgid];
	if (translation) {
		msgid = translation[i18n.langs[lang].__get_plural_index(n)] || msgid;
	}

	return msgid.replace(/{n}/, n);
}

function _(msgid) {
	return _lc(i18n.lang, msgid);
}

function _c(msgid, context) {
	return _lc(i18n.lang, msgid, context);
}

function _n(n, msgid) {
	return _lnc(i18n.lang, n, msgid);
}

function _nc(n, msgid, context) {
	return _lnc(i18n.lang, n, msgid, context);
}

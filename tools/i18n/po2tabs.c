#include <glib.h>
#include <gettext-po.h>
#include "sjson.h"
#include <locale.h>
#include <string.h>

static void my_xerror(int severity, po_message_t message, const char *filename, size_t lineno, size_t column, int multiline_p, const char *message_text)
{
	g_printerr("ERROR: %s\n", message_text);

	if (severity == PO_SEVERITY_FATAL_ERROR)
		exit(1);
}

static void my_xerror2(int severity, po_message_t message1, const char *filename1, size_t lineno1, size_t column1, int multiline_p1, const char *message_text1, 
		                     po_message_t message2, const char *filename2, size_t lineno2, size_t column2, int multiline_p2, const char *message_text2)
{
	g_printerr("ERROR: %s, %s\n", message_text1, message_text2);

	if (severity == PO_SEVERITY_FATAL_ERROR)
		exit(1);
}

static const struct po_xerror_handler my_xerror_handler = {
	my_xerror,
	my_xerror2
};

static gchar* output;
static gchar* code;
static gboolean verbose = FALSE;

static GOptionEntry entries[] =
{
	{ "output",  'o',   0, G_OPTION_ARG_STRING,  &output,    "Output file",  "PATH" },
	{ "code",    'c',   0, G_OPTION_ARG_STRING,  &code,      "PHP | JS",     "CODE" },
	{ "verbose", 'v',   0, G_OPTION_ARG_NONE,    &verbose,   "Be verbose",   NULL   },
	{ NULL }
};

struct entry {
	gchar* key;
	GSList* values;
	gboolean is_plural;
};

struct table {
	gchar* language;
	gchar* plural_expr;
	gint nplurals;
	GSList* entries;
};

struct table* parse_po(const gchar* path, GError** err)
{
	g_return_val_if_fail(path != NULL, NULL);
	g_return_val_if_fail(err == NULL || *err == NULL, NULL);

	po_file_t file = po_file_read(path, &my_xerror_handler);
	if (file == NULL) {
		g_set_error(err, 1, 0, "Couldn't open the PO file %s", path);
		return NULL;
	}

        struct table* t = g_new0(struct table, 1);

	t->plural_expr = g_strdup("n != 1");
	t->nplurals = 2;

	const char* const *domains = po_file_domains(file);
	po_message_iterator_t iterator = po_message_iterator(file, domains[0]);
	po_message_t message = po_next_message(iterator);

	while (message) {
		if (!po_message_is_obsolete(message)) {
			const char* msgid = po_message_msgid(message);
			const char* msgstr = po_message_msgstr(message);

			if (!msgid[0]) {
				GMatchInfo* mi = NULL;
				GRegex* re = g_regex_new("Plural-Forms:\\s*nplurals\\s*=\\s*(\\d+)\\s*;\\s*plural\\s*=\\s*([^;]+);", 0, 0, NULL);
				if (g_regex_match(re, msgstr, 0, &mi)) {
					gchar* nplurals_str = g_match_info_fetch(mi, 1);
					t->nplurals = atoi(nplurals_str);
					g_free(nplurals_str);

					g_free(t->plural_expr);
					t->plural_expr = g_match_info_fetch(mi, 2);
				}
				g_clear_pointer(&re, g_regex_unref);
				g_clear_pointer(&mi, g_match_info_unref);

				re = g_regex_new("Language:\\s*([a-z]+)", 0, 0, NULL);
				if (g_regex_match(re, msgstr, 0, &mi)) {
					g_free(t->language);
					t->language = g_match_info_fetch(mi, 1);
				}
				g_clear_pointer(&re, g_regex_unref);
				g_clear_pointer(&mi, g_match_info_unref);
			} else {
				const char* pluralid = po_message_msgid_plural(message);
				const char* ctx = po_message_msgctxt(message);

				if (msgstr[0] || pluralid) {
					struct entry* e = g_new0(struct entry, 1);
					e->key = ctx ? g_strdup_printf("%s|%s", ctx, msgid) : g_strdup(msgid);

					if (pluralid) {
						int i = 0;
						const char* pl = po_message_msgstr_plural(message, i);
						while (pl) {
							e->values = g_slist_append(e->values, g_strdup(pl));
							i++;
							pl = po_message_msgstr_plural(message, i);
						}
						
						e->is_plural = TRUE;
					} else {
						e->values = g_slist_append(e->values, g_strdup(msgstr));
					}

					t->entries = g_slist_append(t->entries, e);
				}
			}
		}

		message = po_next_message(iterator);
	}

	po_message_iterator_free(iterator);
	po_file_free(file);

	return t;
}

static void g_string_append_escaped(GString *out, const char *in)
{
	g_string_append_c(out, '\'');
	
	while (*in != '\0') {
		if ((*in == '\'') || *in == '\\')
			g_string_append_c(out, '\\');
		
		g_string_append_c(out, *in);
		in++;
	}
	
	g_string_append_c(out, '\'');
}

int main(int ac, char* av[])
{
	GError *error = NULL;
	GOptionContext *context;
	enum {PHP, JS} code_type;

	setlocale(LC_ALL, "");

	context = g_option_context_new("- PO tables generator tool");
	g_option_context_add_main_entries(context, entries, NULL);
	if (!g_option_context_parse(context, &ac, &av, &error)) {
		g_printerr("ERROR: Option parsing failed: %s\n", error->message);
		return 1;
	}

	if (!code) {
		g_printerr("ERROR: You must specify --code option\n");
		return 1;
	}

	if (!strcmp(code, "php")) {
		code_type = PHP;
	} else if (!strcmp(code, "js")) {
		code_type = JS;
	} else {
		g_printerr("ERROR: You specified invalid --code option\n");
		return 1;
	}

	if (ac <= 1) {
		g_printerr("ERROR: You must specify some input PO files\n");
		return 1;
	}

	GString* c = g_string_sized_new(2048);

	if (code_type == PHP) {
//		g_string_append(c, "<?php\n");
//		g_string_append(c, "// This file is generated, don't edit manually!\n");
		g_string_append(c, "i18n::$langs = [];\n");
	} else if (code_type == JS) {
		g_string_append(c, "// This file is generated, don't edit manually!\n");
		g_string_append(c, "i18n = typeof i18n == 'undefined' ? {} : i18n;\ni18n.langs = {};\n");
	}

        for (int i = 1; i < ac; i++) {
		struct table* t = parse_po(av[i], &error);
		if (t == NULL) {
			g_printerr("ERROR: Failed parsing %s: %s\n", av[i], error->message);
			return 1;
		}

		GSList *iter, *iter2;

		if (code_type == JS) {
			g_string_append_printf(c, "i18n.langs.%s = ", t->language);

			SJsonGen* g = s_json_gen_new();
			s_json_gen_start_object(g);

			for (iter = t->entries; iter; iter = iter->next) {
				struct entry* e = iter->data;

				if (g_slist_length(e->values) > 1 || e->is_plural) {
					s_json_gen_member_array(g, e->key);
					for (iter2 = e->values; iter2; iter2 = iter2->next)
						s_json_gen_string(g, iter2->data);
					s_json_gen_end_array(g);
				} else {
					s_json_gen_member_string(g, e->key, e->values->data);
				}
			}

			s_json_gen_member_string(g, "__plural", t->plural_expr);
			s_json_gen_member_int(g, "__nplurals", t->nplurals);

			s_json_gen_end_object(g);
			gchar* str = s_json_gen_done(g);
			str = s_json_pretty(str);
			g_string_append(c, str);
			g_string_append(c, ";\n");
		} else if (code_type == PHP) {
			g_string_append_printf(c, "i18n::$langs['%s'] = [\n", t->language);

			for (iter = t->entries; iter; iter = iter->next) {
				struct entry* e = iter->data;

				g_string_append(c, "\t");
				g_string_append_escaped(c, e->key);
				g_string_append(c, " => ");

				if (g_slist_length(e->values) > 1 || e->is_plural) {
					g_string_append(c, "[");
					for (iter2 = e->values; iter2; iter2 = iter2->next) {
						g_string_append_escaped(c, iter2->data);

						if (iter2->next)
							g_string_append(c, ", ");
					}
					g_string_append(c, "]");
				} else {
					g_string_append_escaped(c, e->values->data);
				}

				g_string_append(c, ",\n");
			}

			g_string_append(c, "\t'__plural' => function($n) { return (int)(");

			GRegex* re = g_regex_new("\\bn\\b", 0, 0, NULL);
			gchar* expr = g_regex_replace_literal(re, t->plural_expr, -1, 0, "$n", 0, NULL);

			g_string_append(c, expr);
			g_string_append(c, "); },\n");

			g_string_append_printf(c, "\t'__nplurals' => %d\n", t->nplurals);

			g_string_append(c, "];\n");
		}
	}

	if (output) {
		if (!g_file_set_contents(output, c->str, c->len, &error)) {
			g_printerr("ERROR: Failed writing %s: %s\n", output, error->message);
			return 1;
		}
	} else {
		g_print("%s", c->str);
	}

	return 0;
}

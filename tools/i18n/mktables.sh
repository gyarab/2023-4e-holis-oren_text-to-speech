#!/bin/bash

set -e

# If executed as a child process of build script use exported SED_EXEC var
SED_EXEC=${SED_EXEC:-`which gsed 2>/dev/null || which sed`}

TOOL_DIR="$(dirname $(realpath "$0"))"

if ! test -x "$TOOL_DIR/po2tabs" ; then
	gcc -O1 -o "$TOOL_DIR/po2tabs" "$TOOL_DIR/po2tabs.c" "$TOOL_DIR/sjson.gen.c" \
		"-I$TOOL_DIR" `pkg-config --libs --cflags glib-2.0` -lgettextpo
fi

TMP=`mktemp -d`
for mod in $I18N_MODULES
do
	# generate pot files
	MOD="$(echo "${mod}" | tr '[a-z]' '[A-Z]')"
	TYPE_V="I18N_${MOD}_TYPE"
	FILES_V="I18N_${MOD}_FILES"
	OUTPUT_V="I18N_${MOD}_OUTPUT"
	TYPE="${!TYPE_V}"
	FILES="${!FILES_V}"
	OUTPUT="${!OUTPUT_V}"
	POT_FILE="$TMP/$mod.pot"

	case $TYPE in
	js|nodejs)
		XGETTEXT_OPTS="-L JavaScript \
				-k -k_ -k_n:2,2 -k_nc:2,2,3c -k_c:1,2c \
			   	-k_l:2 -k_ln:3,3 -k_lnc:3,3,4c -k_lc:2,3c"
		;;
	php)
		XGETTEXT_OPTS="-L PHP \
				-k -k_t -k_tn:2,2 -k_tnc:2,2,3c -k_tc:1,2c \
				-k_tl:2 -k_tln:3,3 -k_tlnc:3,3,4c -k_tlc:2,3c"
		;;
	*)
		echo "ERROR: Unknown type $TYPE"
		exit 1
		;;
	esac

	xgettext \
		--force-po \
		--foreign-user \
		--package-name=$mod \
		--package-version=1.0 \
		--msgid-bugs-address="$AUTHOR" \
		--copyright-holder="$AUTHOR" \
		-cTRAN -n \
		--from-code=utf-8 \
		--no-location \
		--sort-output \
		$XGETTEXT_OPTS \
		-o "$POT_FILE" \
		$FILES

	$SED_EXEC -i '/POT-Creation-Date/d' "$POT_FILE"

	PO_FILES=
	for lang in $I18N_LANGUAGES ; do
		PO_FILE="$I18N_TABLES_DIR/$mod-$lang.po"
		PO_FILES="$PO_FILES $PO_FILE"
		if test -f "$PO_FILE" ; then
			msgmerge -q -o "$PO_FILE" "$PO_FILE" "$POT_FILE"
		else
			cp "$POT_FILE" "$PO_FILE"
		fi
	done

	# generate JS and PHP tables

	case $TYPE in
	js)
		"$TOOL_DIR/po2tabs" -c js -o "$OUTPUT" $PO_FILES
		cat "$TOOL_DIR/i18n.js" >> "$OUTPUT"
		$SED_EXEC -Ei 's/"__plural": "([^"]+)"/"__plural": function(n) { return \1; }/' "$OUTPUT"
		;;
	nodejs)
		"$TOOL_DIR/po2tabs" -c js -o "$OUTPUT" $PO_FILES
		cat "$TOOL_DIR/i18n.js" >> "$OUTPUT"
		$SED_EXEC -Ei 's/"__plural": "([^"]+)"/"__plural": function(n) { return \1; }/' "$OUTPUT"
		echo "module.exports = {i18n, _, _n, _c, _nc, _l, _lc, _ln, _lnc};" >> "$OUTPUT"
		;;
	php)
		cat "$TOOL_DIR/i18n.php" > "$OUTPUT"
		"$TOOL_DIR/po2tabs" -c php $PO_FILES >> "$OUTPUT"
		;;
	esac
done


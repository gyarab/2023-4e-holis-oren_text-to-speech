#!/bin/sh
BASE_DIR=`basename \`pwd\``
if [ $BASE_DIR != "icons" ]; then
    echo
    echo "Please, execute this script = require('inside the '[project root]/tools/icons' directory."
    echo
fi
TARGET_DIR=$(grealpath "../../fe/icons")
SED_EXEC=`which gsed 2>/dev/null || which sed`
echo
if ! [[ -d "$TARGET_DIR" ]]
then
    echo "$TARGET_DIR NOT exist on your filesystem."
    echo
    exit
else
    # shellcheck disable=SC2164
    cd "$TARGET_DIR"
fi
IFS=$'\n'; set -f
for i in $(find . -type f -name '*.svg'); do
    [ -f "$i" ] || break
    $SED_EXEC -i 's/#04123B/var(--color, currentColor)/gI' "$i"
    FILENAME=${i%".svg"}
    SLUG=$(echo "$FILENAME" | iconv -t ascii//TRANSLIT | $SED_EXEC -r s/[^a-zA-Z0-9]+/-/g | $SED_EXEC -r s/^-+\|-+$//g | tr A-Z a-z)
    mv "$i" "$SLUG.svg"
done
unset IFS; set +f
echo "Press [ENTER] to recursively clean-up empty directories in following path:"
echo
echo "\t"$TARGET_DIR""
#!/bin/bash

set -e

export AUTHOR="Oren Holiš"

export ICONS_DIR=fe/icons
export ICONS_OUT_JS=gen/fe/icon-data.js
export ICONS_OUT_SVG=gen/fe/icon-symbols.svg
export ICONS_OUT_SASS=gen/fe/_icon-data.sass

export SED_EXEC=`which gsed 2>/dev/null || which sed`

##########################################################################

rm -rf gen/{fe,be}
mkdir -p gen/{fe,be}

# build icons
php tools/icons/generate.php

# build js files

GW_CORE=(
	fe/gw/core/class.js
	fe/gw/core/utils.js
	fe/gw/core/object.js
	fe/gw/core/component.js
	fe/gw/core/dom.js
	fe/gw/comm/rest.js
	fe/gw/comm/socket.js
	fe/gw/app/utils.js
	fe/gw/app/app.js
	fe/gw/app/popupmgr.js
	fe/gw/text/text.js
	fe/gw/dom/anim.js
)

SHARED=(
  tools/i18n/i18n.js
	gen/fe/icon-data.js
	fe/form.js
	fe/shared.js
	fe/widgets.js
)

MAIN_PKG=(
	"${GW_CORE[@]}"
	"${SHARED[@]}"
  fe/data.js
	fe/main.js
	fe/startup.js
)

npx uglifyjs --source-map includeSources,url=main.build.js.map "${MAIN_PKG[@]}" -o gen/fe/main.build.js

# build css files
cp tools/icons/_icons.sass gen/fe/
sassc -t compact -Igen/fe -mauto fe/style/style.sass gen/fe/main.css
$SED_EXEC -i 's#../../fe/##' gen/fe/main.css.map
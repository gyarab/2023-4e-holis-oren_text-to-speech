#!/bin/bash

HOST=
BRANCH=`git branch --show-current`
test -n "$1" && BRANCH=$1

set -x -e

TMP=`mktemp -d`

tar x -f Archive/$BRANCH-latest.tar.gz -C "$TMP"

rsync --progress --stats -v -r --delete-after \
	--perms --executability \
	--exclude /config.json \
	"$TMP/" $HOST:/srv/tts

echo "$(date '+%F %T') Deployed to live: $(realpath Archive/$BRANCH-latest.tar.gz)" >> Archive/deploy.log
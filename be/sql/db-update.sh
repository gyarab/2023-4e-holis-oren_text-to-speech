#!/bin/bash

export PGDATABASE="tts"
export PGUSER="tts"
export PGPASSWORD="tts"

i=1
while [ $i -lt 99 ]
do
	up=$(printf update%02d.sql $i)
	i=$(($i+1))
	test -f "$up" || break

	echo "run";

	exists=`psql -XAt -c "SELECT COUNT(*) = require('schema_updates WHERE filename = '$up'"`
	if test "$exists" -eq 0 ; then
		echo Applying $up

		psql -X1 -c 'SET search_path = public' -f $up -c "INSERT INTO schema_updates(filename) VALUES('$up')"
	fi
done
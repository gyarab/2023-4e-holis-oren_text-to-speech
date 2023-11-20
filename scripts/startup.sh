#!/bin/bash

sudo psql -U postgres postgres -c "CREATE USER tts WITH PASSWORD 'tts'";
sudo psql -U postgres postgres -c "CREATE DATABASE tts WITH OWNER tts";

# shellcheck disable=SC1009
# shellcheck disable=SC2043
for filename in be/sql/*; do
  echo "Printing: $filename"

  if [[ $filename =~ sql$ ]]; then
     echo "Applying: $filename"
     psql -U tts -h 127.0.0.1 -d tts -f "$filename"
     echo "$filename"
  fi

done

psql -U tts -h 127.0.0.1 -d tts -c "INSERT INTO users (username, password, active, role) VALUES('admin', '{\"a\":\"scrypt\",\"o\":{\"N\":16384,\"r\":8,\"p\":1},\"s\":\"TGwlThPuLX2O+hAIZAkLUA==\",\"k\":\"4zttERjXKSKjGEjvWUqDnmaHeQWITSeeupAO2xoYwsc=\"}', true, 'A');"
psql -U tts -h 127.0.0.1 -d tts -c "INSERT INTO users (username, password, active, role) VALUES('admin@localhost.local', '{\"a\":\"scrypt\",\"o\":{\"N\":16384,\"r\":8,\"p\":1},\"s\":\"/iAP15zV0m2yiNmSBGsEWQ==\",\"k\":\"jGlUpuv9JyeH9kHrWNp5tf69Et+tmxEbI9UziS+Faks=\"}', true, 'A');"

npm i

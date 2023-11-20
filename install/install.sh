#!/bin/bash

./../scripts/startup.sh

sudo chown -R tts /srv/tts

sudo systemctl enable /srv/tts/bin/tts.service
sudo systemctl start tts

echo "App has been started"

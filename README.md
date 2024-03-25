# 2023-4e-holis-oren_text-to-speech

This file describes dependencies of project and how install and start project.

## Dependencies

- nodejs 16.0.0+
- Postgresql 11.0+
- environment for running .sh scripts

## Install

Install project from Github. After that run script startup.sh, which can be found in
folder `scripts`.

This script downloads all dependencies, creates database user `tts` with his database
and applies all `sql` scripts which are currently in project.

Script only requirement is you have user `postgres` with database `postgres`

Production installation is more described in `install/install.md`.

## Scripts

All `sh` scripts which can be found in `scripts` folder must be run in root of project.

## Environment

Environment file can be found in `be/scripts/env.js`. Here you can configure:

- host
- port
- url
- datadir - folder where will be speech record files stored
- postgres params - these you don't have to change if you have used script `startup.sh`
  and postgres settings are default
- azure_tts - subscription key, region and languages which you want to use (their name must be in EN)
- file_output - experimental setting of configurable file_output extension
- record_visibility_mode - sets if all users can see all records or records are private and can only be shared

# Návod na instalaci

## Závislosti

1. nodejs 12.0.0+  (node -v)
2. npm   (npm -v)
3. Postgresql 12.0+ (psql --version)
4. Debian 10.0+

Postgres musí být nastaven na přihlašování credentials místo root.
Nastavení naleznete zde: nano /etc/postgresql/{version}/main/pg_hba.conf

Postgres v souboru `pg_hba.conf` změnte řádky na:
# Database administrative login by Unix domain socket
local   all             postgres                                trust

# TYPE  DATABASE        USER            ADDRESS                 METHOD

# "local" is for Unix domain socket connections only
local   all             all                                     trust
# IPv4 local connections:
host    all             all             127.0.0.1/32            trust
# IPv6 local connections:
host    all             all             ::1/128                 md5
# Allow replication connections from localhost, by a user with the
# replication privilege.
local   replication     all                                     md5

## Instalace

1. Vytvořte systémového uživatele - `sudo adduser --system --home /srv/tts tts`
2. Přidejte do této složky zazipovanou aplikaci a rozbalte ji
3. Upravte konfiguraci `bin/environment.env`, `localhost` je potřeba nahradit `0.0.0.0` (pokud neni NGINX)
   pokud má být aplikace veřejně dostupná, `datadir` by měla být přenastavena na místo kam checete ukládat konfigurace
4. Upravte v souboru `bin/tts.service` cesty k souborům. Zjištění cesty k node `which node`
5. Spusťte script install.sh z této složky, soubour musí být "executable" a je nutné přidat `chown +x install.sh`

## Reset

1. Pokud je aplikaci potřeba resetovat stačí zastavit servicu pomocí:
`sudo systemctl stop tts`
2. Spustit `node be/server.js reset` z root adresáře aplikace
3. Stisknout Ctrl+C na ukončení procesu
4. Znovu spustit service pomocí: `sudo systemctl start tts`

Aplikace bude restována do výchozího stavu. Smažou se veškeré záznamy a 
uživatelé. Jediní uživatelé, kteří zůstanou jsou **adminBC** a 
**bcadmin@localhost.local** a i tito uživatelé jsou resetováni do výchozího nastavení.
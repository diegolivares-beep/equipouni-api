#!/bin/sh
set -e
# El superusuario se crea o actualiza en cada arranque desde variables de
# entorno, para no dejar credenciales escritas en el repositorio.
if [ -n "$PB_ADMIN_EMAIL" ] && [ -n "$PB_ADMIN_PASS" ]; then
  /pb/pocketbase superuser upsert "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASS" || true
fi
exec /pb/pocketbase serve --http=0.0.0.0:8090

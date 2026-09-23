# Backend de EquipoUni: PocketBase, un solo binario con base de datos,
# autenticacion, subida de archivos y envio de correo incluidos.
FROM alpine:3.20
ARG PB_VERSION=0.40.4
RUN apk add --no-cache ca-certificates unzip wget
RUN wget -q https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip -O /tmp/pb.zip \
 && unzip /tmp/pb.zip -d /pb && rm /tmp/pb.zip

# Las colecciones viven como migraciones versionadas: se aplican solas al
# arrancar, asi el esquema se puede reconstruir desde cero en cualquier parte.
COPY pb_migrations /pb/pb_migrations
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8090
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s \
  CMD wget -q -O /dev/null http://127.0.0.1:8090/api/health || exit 1
ENTRYPOINT ["/entrypoint.sh"]

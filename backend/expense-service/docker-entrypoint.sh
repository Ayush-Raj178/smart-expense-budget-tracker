#!/bin/sh
set -eu

if [ -n "${DB_CA_CERTIFICATE:-}" ]; then
  ca_path=/tmp/aiven-mysql-ca.pem
  truststore_path=/tmp/aiven-mysql-truststore.jks
  truststore_password="${DB_TRUSTSTORE_PASSWORD:-changeit}"

  printf '%s\n' "$DB_CA_CERTIFICATE" > "$ca_path"
  rm -f "$truststore_path"
  keytool -importcert -noprompt -trustcacerts \
    -alias aiven-mysql-ca \
    -file "$ca_path" \
    -keystore "$truststore_path" \
    -storepass "$truststore_password"
  rm -f "$ca_path"

  export DB_TRUSTSTORE_URL="file:$truststore_path"
  export DB_TRUSTSTORE_TYPE=JKS
  export DB_TRUSTSTORE_PASSWORD="$truststore_password"
fi

exec java -jar app.jar

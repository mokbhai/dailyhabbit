#!/bin/sh
set -e

./node_modules/.bin/prisma migrate deploy --schema=./node_modules/@workspace-starter/db/prisma/schema.prisma

exec node dist/main

#!/bin/sh
# Fly.io: the volume at /data belongs to root; give it to `node`, then run
# the project's own start script as `node`.
set -eu
chown node:node /data
exec runuser -u node -- ./start.sh

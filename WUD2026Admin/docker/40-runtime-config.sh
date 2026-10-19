#!/bin/sh
set -eu
# Only public values; jq handles quoting safely and never inspects other env variables.
config=$(jq -cn --arg api "${PUBLIC_API_URL:-/api}" --arg site "${PUBLIC_SITE_URL:-/}" '{publicApiUrl:$api,publicSiteUrl:$site}')
printf 'window.__FILHARMONIA_CONFIG__ = %s;\n' "$config" > /usr/share/nginx/html/admin/runtime-config.js

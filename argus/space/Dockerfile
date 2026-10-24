# Iris API Space: the upstream God's Eye View dev server (it IS the API: every provider runs as
# Vite middleware), built at the commit pinned in upstream.json, behind gate.mjs on port 7860.
# Only the argus Worker calls it; the globe itself is still served from Cloudflare.
FROM node:24-slim
ENV PUPPETEER_SKIP_DOWNLOAD=1 \
    NODE_ENV=development \
    OVERPASS_UPSTREAMS=https://overpass-api.de/api/interpreter,https://overpass.private.coffee/api/interpreter,https://maps.mail.ru/osm/tools/overpass/api/interpreter
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates jq && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY upstream.json /tmp/upstream.json
RUN git init -q . \
 && git remote add origin "$(jq -r .repo /tmp/upstream.json)" \
 && git fetch -q --depth 1 origin "$(jq -r .commit /tmp/upstream.json)" \
 && git checkout -q FETCH_HEAD \
 && rm -rf functions/api/debug .git \
 && npm ci --no-audit --no-fund
COPY gate.mjs /gate/gate.mjs
# HF runs the container as uid 1000 and Vite writes its dep cache
RUN chown -R 1000:1000 /app
USER 1000
EXPOSE 7860
CMD ["sh", "-c", "npx vite --host 127.0.0.1 --port 5173 --strictPort & exec node /gate/gate.mjs"]

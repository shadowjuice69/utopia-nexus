FROM node:22-bookworm-slim AS bgutil-build

WORKDIR /opt/bgutil
RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates \
    && git clone --depth 1 --branch 1.3.1 https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git . \
    && cd server \
    && npm ci --no-audit --no-fund \
    && npx tsc \
    && npm prune --omit=dev \
    && rm -rf /var/lib/apt/lists/*

FROM eclipse-temurin:21-jre

ARG LAVALINK_VERSION=4.2.2
WORKDIR /opt/lavalink

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates python3 python3-pip libatomic1 libcairo2 libpango-1.0-0 libjpeg62-turbo libgif7 librsvg2-2 \
    && curl -fsSL -o Lavalink.jar "https://github.com/lavalink-devs/Lavalink/releases/download/${LAVALINK_VERSION}/Lavalink.jar" \
    && curl -fsSL -o /usr/local/bin/yt-dlp "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp" \
    && chmod +x /usr/local/bin/yt-dlp \
    && python3 -m pip install --break-system-packages --no-cache-dir "bgutil-ytdlp-pot-provider==1.3.1" \
    && /usr/local/bin/yt-dlp --version \
    && rm -rf /var/lib/apt/lists/*

COPY --from=bgutil-build /usr/local/bin/node /usr/local/bin/node
COPY --from=bgutil-build /opt/bgutil/server/build /opt/bgutil/server/build
COPY --from=bgutil-build /opt/bgutil/server/node_modules /opt/bgutil/server/node_modules
COPY lavalink/application-ytdlp.yml ./application.yml
COPY lavalink/start-lavalink.sh /opt/lavalink/start-lavalink.sh
RUN chmod +x /opt/lavalink/start-lavalink.sh

EXPOSE 10000
ENTRYPOINT ["/opt/lavalink/start-lavalink.sh"]

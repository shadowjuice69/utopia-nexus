FROM eclipse-temurin:21-jre

ARG LAVALINK_VERSION=4.2.2
WORKDIR /opt/lavalink

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && curl -fsSL -o Lavalink.jar "https://github.com/lavalink-devs/Lavalink/releases/download/${LAVALINK_VERSION}/Lavalink.jar" \
    && curl -fsSL -o /usr/local/bin/yt-dlp "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp" \
    && chmod +x /usr/local/bin/yt-dlp \
    && /usr/local/bin/yt-dlp --version \
    && apt-get purge -y --auto-remove curl \
    && rm -rf /var/lib/apt/lists/*

COPY lavalink/application-ytdlp.yml ./application.yml

EXPOSE 10000
ENTRYPOINT ["java", "-jar", "Lavalink.jar"]

FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY docker/dev-entrypoint.sh /usr/local/bin/dev-entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/dev-entrypoint.sh \
  && chmod +x /usr/local/bin/dev-entrypoint.sh

EXPOSE 4020

ENTRYPOINT ["dev-entrypoint.sh"]
CMD ["npm", "run", "start:dev"]

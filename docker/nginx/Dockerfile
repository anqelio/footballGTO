FROM nginx:1.31.4-alpine3.24-slim

ARG LOCAL_USER_ID_ARG=82
ARG LOCAL_GROUP_ID_ARG=82

COPY cert/* /etc/ssl/gto/

COPY config/default.conf /etc/nginx/templates/default.conf.template

RUN apk add --no-cache --update shadow \
    && mkdir -p /var/www/static \
    && groupmod -g ${LOCAL_GROUP_ID_ARG} nginx && usermod -u ${LOCAL_USER_ID_ARG} -g ${LOCAL_GROUP_ID_ARG} nginx \
    && chown -R ${LOCAL_USER_ID_ARG}:${LOCAL_GROUP_ID_ARG} /var/www

EXPOSE 443
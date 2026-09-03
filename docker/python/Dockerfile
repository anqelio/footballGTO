FROM python:3.14.7-slim-trixie

ARG LOCAL_USER_ID_ARG=1000
ARG LOCAL_GROUP_ID_ARG=1000

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends build-essential libpq-dev && rm -rf /var/lib/apt/lists/* \
    && groupadd -g ${LOCAL_GROUP_ID_ARG} app \
    && useradd -m -u ${LOCAL_USER_ID_ARG} -g ${LOCAL_GROUP_ID_ARG} app

COPY requirements.txt .

RUN pip install -r requirements.txt

COPY --chown=app:app . .

USER app
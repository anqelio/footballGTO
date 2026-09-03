# Футбольное ГТО

## Запуск проекта

1. Скопируйте файл `.env.example` в `.env`. После этого отредактируйте переменные окружения в файле `.env` в соответствии с вашим окружением.
   ```shell
   cp .env.example .env
   ```
2. Настройка HTTPS. Для создания локального SSL-сертификата используется [mkcert](https://github.com/FiloSottile/mkcert).
   Установите `mkcert`, следуя [официальной инструкции](https://github.com/FiloSottile/mkcert#installation).
   После установки создайте и добавьте локальный центр сертификации в доверенные сертификаты системы:
   ```shell
   mkcert -install
   ```
   Для создания SSL-сертификата из корневой директории проекта выполните:
   ```shell
   mkcert -cert-file docker/nginx/cert/crt.pem -key-file docker/nginx/cert/key.pem gto.ekb.football.test
   ```
   где `gto.ekb.football.test` - это используемый домен, который еще указывается в `.env` в `APP_DOMAIN`.
   В директории docker/nginx/cert будут созданы два файла:  
   docker/nginx/cert/  
   ├── crt.pem  
   └── key.pem  
   `crt.pem` — SSL-сертификат;  
   `key.pem` — приватный ключ сертификата.  
   Сертификат создается отдельно каждым разработчиком, а также на боевом сервере и в каждом случае свой.
3. Добавьте используемый домен в `/etc/hosts`:

   ```shell
   echo "127.0.0.1 gto.ekb.football.test" | sudo tee -a /etc/hosts
   ```

   где `gto.ekb.football.test` — домен, указанный в `.env` в переменной `APP_DOMAIN`.
4. Соберите и запустите контейнеры:
   ```shell
   docker compose up -d
   ```
5. Собираем статику
   ```shell
   docker compose exec web python manage.py collectstatic --noinput
   ```
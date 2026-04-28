# Déploiement — Beauté & Élégance

Guide pour déployer le stack complet (Postgres + FastAPI + Vite/nginx)
sur un serveur Linux qui héberge **déjà** un autre site React/Vite.

> Serveur cible : `187.127.250.26`
> Domaine prévu : `boteakelegans.com` (en attente de disponibilité)

---

## 1. Prérequis sur le serveur

```bash
ssh root@187.127.250.26
sudo apt update && sudo apt install -y docker.io docker-compose-plugin git
```

Vérifiez :
```bash
docker --version
docker compose version
```

---

## 2. Cloner le dépôt

```bash
cd /opt
sudo git clone https://github.com/Mike5449/aura-adorn.git carat-couleur
cd carat-couleur
sudo chown -R $USER:$USER .
```

---

## 3. Configurer les secrets

```bash
cp .env.example .env
nano .env
```

Remplissez **au minimum** :
- `POSTGRES_PASSWORD` — mot de passe Postgres
- `SECRET_KEY` & `REFRESH_SECRET_KEY` — générer avec :
  ```bash
  python3 -c "import secrets; print(secrets.token_hex(32))"
  ```
- `MONCASH_CLIENT_ID` & `MONCASH_CLIENT_SECRET` — depuis le portail Digicel
- `MONCASH_RETURN_URL=https://boteakelegans.com/checkout/return`
- `CORS_ORIGINS=https://boteakelegans.com,https://www.boteakelegans.com`

---

## 4. Lancer le stack

```bash
docker compose up -d --build
```

**Cohabitation avec le site existant** : par défaut le `WEB_PORT=8080`.
Le serveur expose donc le frontend Beauté & Élégance sur `127.0.0.1:8080`,
**sans toucher** au port 80/443 utilisé par votre site React/Vite actuel.

Vérifiez :
```bash
docker compose ps
curl -I http://127.0.0.1:8080/
curl http://127.0.0.1:8080/api/health
```

---

## 5. Initialiser la base (première fois)

```bash
# Créer un compte admin
docker compose exec backend bash -c \
  'ADMIN_USERNAME=admin ADMIN_EMAIL=admin@boteakelegans.com ADMIN_PASSWORD="Adm!nC0uleur2026" python scripts/seed_admin.py'

# Importer le catalogue de démarrage (bijoux + Stephie Beauty)
docker compose exec backend python scripts/seed_catalog.py
```

Connectez-vous ensuite sur `https://boteakelegans.com/login` (ou `http://127.0.0.1:8080/login` en attendant le DNS).

---

## 6. Brancher le reverse proxy de l'hôte

Le serveur a déjà un **nginx** (ou Caddy / Traefik) pour le site existant.
Il faut lui ajouter un **virtual host** qui pointe `boteakelegans.com` vers
notre conteneur sur `127.0.0.1:8080`.

### Option A — nginx (la plus probable)

Créez `/etc/nginx/sites-available/boteakelegans.com` :

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name boteakelegans.com www.boteakelegans.com;

    # ACME challenge (certbot)
    location /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name boteakelegans.com www.boteakelegans.com;

    # SSL — remplir après le `certbot --nginx`
    ssl_certificate     /etc/letsencrypt/live/boteakelegans.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/boteakelegans.com/privkey.pem;

    client_max_body_size 12M;

    location / {
        proxy_pass         http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        $connection_upgrade;
        proxy_read_timeout 60s;
    }
}
```

Activez et rechargez :
```bash
sudo ln -s /etc/nginx/sites-available/boteakelegans.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### Option B — Caddy

Ajoutez à `/etc/caddy/Caddyfile` :

```caddyfile
boteakelegans.com, www.boteakelegans.com {
    encode gzip
    reverse_proxy 127.0.0.1:8080
}
```

```bash
sudo systemctl reload caddy
```

---

## 7. HTTPS (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d boteakelegans.com -d www.boteakelegans.com
```

> Le DNS `A boteakelegans.com → 187.127.250.26` doit déjà pointer.

---

## 8. Mise à jour future (CI manuel)

```bash
cd /opt/carat-couleur
git pull
docker compose up -d --build
docker image prune -f
```

---

## 9. Sauvegarde Postgres

```bash
# Backup
docker compose exec db pg_dump -U postgres carat_couleur > /backup/cc-$(date +%F).sql

# Restore
cat /backup/cc-2026-04-28.sql | docker compose exec -T db psql -U postgres carat_couleur
```

Volumes à sauvegarder :
- `postgres_data` (DB)
- `backend_uploads` (images uploadées par l'admin)

---

## Dépannage rapide

| Symptôme | Solution |
|---|---|
| `502` quand on ouvre boteakelegans.com | Vérifier `docker compose ps`, `curl -I http://127.0.0.1:8080/` |
| Le port 8080 est déjà pris | Modifier `WEB_PORT=8081` dans `.env`, `docker compose up -d` |
| Erreur CORS dans la console navigateur | Ajouter le domaine à `CORS_ORIGINS` dans `.env`, `docker compose up -d backend` |
| Build du frontend échoue (`No build output found`) | Voir la sortie de `docker compose build web` — adapter `frontend/Dockerfile` selon le dossier produit (`.output/public`, `dist/client`, `dist`) |
| Logs : `docker compose logs -f --tail=200` | Voir tout en temps réel |

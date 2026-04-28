# Maison — Bijoux & Beauté de Luxe

E-commerce complet (boutique + administration) avec paiement **MonCash** (Digicel).

- Backend : FastAPI + SQLAlchemy + PostgreSQL + Alembic + JWT/RBAC
- Frontend : React 19 + TanStack Router + Vite + Tailwind v4 + shadcn/ui
- Paiement : MonCash (sandbox / production)

## Fonctionnalités

### Storefront (public)
- Page d'accueil, boutique avec filtres (section / catégorie), fiche produit, panier
- **Badge de disponibilité** sur les fiches : `Disponible` ou `À venir`
- **Sélecteur de taille** sur les bagues — le client choisit le numéro qui correspond à son doigt
- Checkout invité (pas de compte requis) avec paiement MonCash
- Page de retour `/checkout/return` qui vérifie la transaction et confirme la commande

### Administration (`/admin` — réservée aux rôles `admin` & `manager`)
- Tableau de bord
- CRUD **Produits** : créer / modifier, marquer comme `disponible` / `à venir`, gérer les tailles, le stock, les best-sellers, la visibilité
- CRUD **Catégories** : par section (Bijoux / Beauté), ordre d'affichage
- **Commandes** : liste filtrable, fiche détaillée, mise à jour du statut (en attente → payée → expédiée → livrée)

---

## Prise en main rapide

### 1. Base de données

```bash
docker compose up -d
```

### 2. Backend

```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env             # ⚠️ remplir les valeurs (clé JWT, MonCash, etc.)

# Migrer la base
alembic upgrade head

# Créer un compte admin (à changer en production !)
ADMIN_PASSWORD='Adm!nMaison2026' python scripts/seed_admin.py

# Importer le catalogue de démarrage
python scripts/seed_catalog.py

# Lancer l'API
uvicorn main:app --reload
```

L'API tourne sur **http://localhost:8000** ; documentation interactive : **http://localhost:8000/docs**.

### 3. Frontend

```bash
cd frontend
npm install         # ou bun install
npm run dev
```

L'app tourne sur **http://localhost:5173**.

Le frontend lit `VITE_API_URL` (défini dans `frontend/.env.development`, défaut `http://localhost:8000`).

### 4. Premier login admin

Allez sur **http://localhost:5173/login** et utilisez les identifiants de `seed_admin.py`. Vous pouvez ensuite gérer le catalogue depuis **http://localhost:5173/admin**.

---

## Modèle de données

| Table | Rôle |
|---|---|
| `users`, `roles`, `permissions`, `role_permissions` | Auth + RBAC (existant) |
| `categories` | Catégories du catalogue, regroupées par `section` (`jewelry` / `beauty`) |
| `products` | Produits — champs clés : `status` (`available` / `coming_soon`), `has_sizes`, `is_bestseller`, `is_active`, `stock` |
| `product_sizes` | Une ligne par numéro de bague (ou taille) avec son propre stock |
| `orders` | Commandes ; total, méthode de paiement, statuts |
| `order_items` | Lignes d'une commande (snapshot du nom + taille au moment de l'achat) |
| `payments` | Trace des transactions MonCash |

## RBAC

| Rôle | Accès |
|---|---|
| `admin` | Tout |
| `manager` | Lecture & création / modification produits, modification catégories, gestion des commandes & paiements |
| `staff` | Lecture catalogue + son propre profil |

## Endpoints publics (extrait)

```
GET    /products/                       — liste catalogue (filtres section, category_id, status)
GET    /products/{id}                   — fiche produit (par id)
GET    /products/slug/{slug}            — fiche produit (par slug, utilisé par le frontend)
GET    /categories/                     — liste des catégories
POST   /orders/                         — créer une commande (invité ou authentifié)
POST   /orders/{id}/pay/moncash         — démarrer un paiement MonCash → renvoie redirect_url
POST   /orders/{id}/pay/moncash/verify  — vérifier la transaction au retour
GET    /orders/by-number/{n}            — consulter une commande par son numéro
```

## MonCash

1. Demandez vos identifiants `client_id` / `client_secret` sur https://moncashbutton.digicelgroup.com/Moncash-business
2. Renseignez `MONCASH_CLIENT_ID`, `MONCASH_CLIENT_SECRET`, `MONCASH_MODE` (`sandbox` ou `production`) dans `.env`
3. Configurez `MONCASH_RETURN_URL` (par défaut `http://localhost:5173/checkout/return`) dans le portail MonCash et dans le `.env`

Le flux côté boutique :

1. Le client remplit le panier puis ses coordonnées sur `/cart`
2. Le frontend appelle `POST /orders` puis `POST /orders/{id}/pay/moncash`
3. Le client est redirigé vers le portail MonCash
4. Au retour, MonCash redirige vers `/checkout/return?transactionId=…` qui appelle `POST /orders/{id}/pay/moncash/verify`
5. Le backend interroge MonCash, marque la commande `paid` et décrémente le stock

## Scripts utilitaires

| Script | Description |
|---|---|
| `backend/scripts/seed_admin.py` | Crée un compte admin |
| `backend/scripts/seed_rbac.py` | (Re)peuple les rôles/permissions |
| `backend/scripts/seed_catalog.py` | Catégories + produits de démonstration |

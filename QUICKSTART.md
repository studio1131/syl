# 🚀 Quick Start Guide - SYLHERA

## Installation en 5 Minutes

### Étape 1 : Uploader sur GitHub

```bash
# Dans le terminal
cd sylhera-website

# Initialiser Git
git init

# Ajouter tous les fichiers
git add .

# Premier commit
git commit -m "Initial commit - SYLHERA complete website"

# Connecter à GitHub (remplacer VOTRE-USERNAME)
git remote add origin https://github.com/VOTRE-USERNAME/sylhera-website.git

# Push
git push -u origin main
```

### Étape 2 : Déployer sur Vercel

1. Aller sur **vercel.com**
2. **Sign Up with GitHub**
3. **New Project** → Importer `sylhera-website`
4. **Deploy** (ne rien changer dans la config)
5. ✅ **Site en ligne !**

### Étape 3 : Configurer Sanity (Optionnel)

```bash
cd sanity
npm install
sanity init
sanity deploy
```

### Étape 4 : Variables d'Environnement

Dans Vercel → Settings → Environment Variables :

```
SANITY_PROJECT_ID = [votre project id]
SANITY_DATASET = production
SANITY_WRITE_TOKEN = [votre token]
```

## ✅ Vérification

Testez votre site :
- ✅ Playground → Audio players visibles
- ✅ Fragments → Articles listés
- ✅ Totems → Modal s'ouvre

## 📞 Support

Questions ? Consultez le README.md complet.

---

**Temps total : ~5 minutes** ⚡

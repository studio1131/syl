# SYLHERA - Personal Creative Gallery

Digital gallery showcasing sound, vision, and objects.

## 🎯 Features

- 🎵 Interactive audio players (Playground)
- 📝 Blog system (Fragments)
- 🛍️ E-commerce with request forms (Totems)
- 🌙 Dark/light mode toggle
- 📱 Fully responsive design
- 🔐 Secure backend with Sanity CMS

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Sanity

```bash
cd sanity
npm install
sanity init
```

### 3. Deploy to Vercel

```bash
vercel --prod
```

### 4. Environment Variables

Add these in Vercel Dashboard:

```
SANITY_PROJECT_ID=your_project_id
SANITY_DATASET=production
SANITY_WRITE_TOKEN=your_token
```

## 📁 Project Structure

```
sylhera-website/
├── index.html                    # Main HTML file
├── sylhera-enhancements.js      # Audio, blog, modals
├── sylhera-enhancements.css     # Styles
├── api/
│   └── submit-request.js        # Backend API
├── sanity/
│   └── schemas/                 # CMS schemas
├── vercel.json                  # Deployment config
└── package.json                 # Dependencies
```

## 🎨 Customization

### Colors

Edit CSS variables in `index.html`:

```css
:root {
  --bg: #f5f3ee;
  --ink: #0c0b09;
  --accent: #c4a882;
}
```

### Content

- **Blog articles**: Edit `ARTICLES` array in `sylhera-enhancements.js`
- **Products**: Edit `PRODUCTS` array in `sylhera-enhancements.js`
- **Audio tracks**: Edit `TRACKS` array in `sylhera-enhancements.js`

## 📝 License

All rights reserved. Personal creative space.

## 🔗 Links

- Live site: [Your Vercel URL]
- Sanity Studio: [Your Sanity URL]

---

© 2024 SYLHERA

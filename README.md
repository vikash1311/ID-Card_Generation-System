# 🪪 ID Card Generation System

A web-based ID card management platform for schools and colleges. Supports multi-role access (Super Admin, Org Admin, and Users), photo uploads via Cloudinary, and real-time data storage with Firebase — enabling organizations to generate, manage, and download professional ID cards at scale.

---

## ✨ Features

- **Multi-Role Access** — Super Admin manages organizations; Org Admins manage their own users; Users fill and submit their profile
- **Dynamic ID Card Generation** — auto-generates printable ID cards from form data
- **Photo Upload** — profile photos uploaded and hosted via Cloudinary
- **Real-Time Database** — Firestore for live data sync across roles
- **Firebase Storage** — secure file storage with custom rules
- **Public Submission Form** — users fill in their details without needing an account
- **Admin Dashboard** — manage members, review submissions, download/print cards
- **Responsive UI** — works on desktop and mobile browsers

---

## 🏗️ Architecture

```
Public Form (User)         Org Admin Panel       Super Admin Panel
       │                         │                       │
       └─────────────────────────┼───────────────────────┘
                                 ▼
                     React + Vite (Frontend)
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
             Firebase Firestore         Firebase Storage
             (user data, orgs)          (photos, assets)
                                         │
                                    Cloudinary
                                 (image hosting & CDN)
```

---

## 🛠️ Tech Stack

| Layer        | Technology                          |
|--------------|-------------------------------------|
| Frontend     | React.js, Vite                      |
| Styling      | Tailwind CSS                        |
| Database     | Firebase Firestore                  |
| File Storage | Firebase Storage + Cloudinary       |
| Auth         | Firebase Authentication             |
| Hosting      | Firebase Hosting                    |

---

## 👥 Roles & Permissions

| Role        | Capabilities                                                    |
|-------------|-----------------------------------------------------------------|
| Super Admin | Create/manage organizations, assign Org Admins                  |
| Org Admin   | Manage users within their org, review submissions, export cards |
| User        | Fill public form, upload photo, view/download own ID card       |

---

## 🚀 Getting Started

### Prerequisites

- Node.js v18+
- Firebase project with Firestore, Storage, and Authentication enabled
- Cloudinary account

### Setup

```bash
# Clone the repository
git clone https://github.com/vikash1311/ID-Card_Generation-System.git
cd ID-Card_Generation-System

# Install dependencies
npm install

# Configure environment
cp env.example .env
```

Add your credentials to `.env`:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_CLOUDINARY_CLOUD_NAME=
VITE_CLOUDINARY_UPLOAD_PRESET=
```

### Run

```bash
npm run dev
```

### Deploy

```bash
firebase deploy
```

---

## 📁 Project Structure

```
ID-Card_Generation-System/
├── public/               # Static assets
├── src/
│   ├── components/       # Reusable UI components
│   ├── pages/            # Route-level pages (Admin, User, Public Form)
│   ├── hooks/            # Custom React hooks
│   ├── firebase/         # Firebase config & helpers
│   └── main.jsx          # App entry point
├── firestore.rules       # Firestore security rules
├── storage.rules         # Firebase Storage security rules
├── firebase.json         # Firebase config
├── tailwind.config.js
├── vite.config.js
└── README.md
```

---

## 🔮 Roadmap

- [ ] PDF export of ID cards (print-ready layout)
- [ ] QR code on each ID card linking to profile
- [ ] Bulk import members via CSV
- [ ] Card template customization per organization
- [ ] Email delivery of ID cards to members

---

## 👨‍💻 Author

**Vikash Gautam**
[GitHub](https://github.com/vikash1311) · [LinkedIn](https://linkedin.com/in/vikash2808) · [Portfolio](https://vikash-gautam.netlify.app)

---

## 📄 License

MIT

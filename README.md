# ⚖️ Legal Advisor — AI-Powered Legal Assistant

An intelligent full-stack web application that provides users with instant, AI-generated legal guidance through a conversational chat interface. Built using React.js, Node.js, and the Gemini API, Legal Advisor makes legal information accessible and easy to understand for everyone.

---

## 🚀 Features

- 💬 **AI Chat Interface** — Ask legal questions in plain language and receive clear, structured responses
- 🔐 **User Authentication** — Secure JWT-based login and registration with Bcrypt password hashing
- 📂 **Conversation History** — All chat sessions stored per user in MongoDB for future reference
- 🤖 **Gemini API Integration** — Context-aware legal guidance powered by Google's Gemini LLM
- 📱 **Responsive UI** — Clean, mobile-friendly interface built with React.js and Tailwind CSS
- 🛡️ **Role-based Access** — Separate routes and permissions for users and admins

---

## 🛠️ Tech Stack

| Layer       | Technology                          |
|-------------|--------------------------------------|
| Frontend    | React.js, Tailwind CSS               |
| Backend     | Node.js, Express.js                  |
| Database    | MongoDB (Mongoose ODM)               |
| AI Engine   | Gemini API (Google Generative AI)    |
| Auth        | JWT, Bcrypt, Refresh Tokens          |
| Deployment  | Vercel (Frontend), Render (Backend)  |

---

## 📁 Project Structure
Legal_Advisor/
├── client/                  # React frontend
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Login, Register, Chat
│   │   ├── context/         # Auth context (JWT handling)
│   │   └── App.jsx
│   └── package.json
│
├── server/                  # Express backend
│   ├── routes/
│   │   ├── auth.js          # Register / Login / Refresh
│   │   └── chat.js          # AI query + history endpoints
│   ├── models/
│   │   ├── User.js          # User schema
│   │   └── Conversation.js  # Chat history schema
│   ├── middleware/
│   │   └── authMiddleware.js # JWT verification
│   ├── controllers/
│   │   ├── authController.js
│   │   └── chatController.js
│   └── server.js
│
├── .env.example
└── README.md

---

## ⚙️ Getting Started

### Prerequisites
- Node.js v18+
- MongoDB (local or Atlas)
- Gemini API key — [Get it here](https://makersuite.google.com/app/apikey)

### Installation

```bash
# Clone the repository
git clone https://github.com/virendra0817/Legal_Advisor.git
cd Legal_Advisor
```

### Backend Setup

```bash
cd server
npm install
```

Create a `.env` file in the `server/` directory:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret
GEMINI_API_KEY=your_gemini_api_key
```

```bash
npm run dev
```

### Frontend Setup

```bash
cd client
npm install
```

Create a `.env` file in `client/`:

```env
VITE_API_URL=http://localhost:5000
```

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

---

## 🔗 API Endpoints

### Auth Routes — `/api/auth`
| Method | Endpoint    | Description         |
|--------|-------------|---------------------|
| POST   | `/register` | Register a new user |
| POST   | `/login`    | Login, returns JWT  |
| POST   | `/refresh`  | Refresh access token|

### Chat Routes — `/api/chat`
| Method | Endpoint    | Description                      |
|--------|-------------|----------------------------------|
| POST   | `/query`    | Send a legal question to Gemini  |
| GET    | `/history`  | Fetch user's conversation history|
| DELETE | `/history`  | Clear conversation history       |

---

## 💡 How It Works

1. User registers/logs in and receives a JWT access token
2. User types a legal question into the chat interface
3. The query is sent to the Express backend with the auth token
4. Backend validates the JWT and forwards the query to Gemini API with a system prompt engineered for legal context
5. Gemini's response is parsed and returned to the frontend
6. The conversation is saved to MongoDB under the user's profile
7. Users can revisit past sessions anytime from their dashboard

---

## 📸 Screenshots

> *(Add screenshots of Login page, Chat interface, and History page here)*

---

## 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

## 👤 Author

**Virendra Vikram Singh**
- GitHub: [@virendra0817](https://github.com/virendra0817)
- Email: virendrasingh6011@gmail.com

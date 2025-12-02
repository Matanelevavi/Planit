# Planit - Your AI Investment Guide 🚀

<div align="center">
  <img src="./frontend/src/assets/logo.png" alt="Planit Logo" width="500"/>
</div>


![Status](https://img.shields.io/badge/Status-In%20Development-yellow)
![Security](https://img.shields.io/badge/Security-OAuth2%20%7C%20JWT-red)
![Stack](https://img.shields.io/badge/Full%20Stack-FastAPI%20%2B%20React-blue)

**Planit** is a next-generation financial planning platform designed to bridge the gap between static excel sheets and complex trading apps. It uses **Dynamic Goal-Based Logic** to keep users on track toward their life targets (Housing, Retirement, Education).

Unlike traditional tools that focus on *market speculation*, Planit focuses on *behavioral consistency* and *algorithmic course correction*.

## ⚡ Key Features

* **🎯 Goal-Centric Architecture:** Manage multiple financial silos with distinct time horizons and risk profiles.
* **🧠 Dynamic Calibration Engine:** Real-time recalculation of required monthly contributions (PMT) based on portfolio performance.
* **🛡️ Cyber-First Security:**
    * Stateless Authentication using **JWT (JSON Web Tokens)**.
    * **Argon2** hashing for password storage (industry gold standard).
    * Input sanitization via **Pydantic** to prevent Injection attacks.
* **📊 Data Visualization:** Interactive "Tunnel" charts powered by **Recharts** to visualize safe zones vs. critical drifts.

## 🛠️ Technology Stack

We utilize a modern, scalable, and type-safe stack used by top-tier tech companies.

### Backend (Python & Data)
* **Core:** [FastAPI](https://fastapi.tiangolo.com/) (High-performance Async Framework)
* **Data Processing:** `Pandas` & `NumPy` for financial modeling and simulations.
* **Validation:** `Pydantic` for strict data schemas.
* **Database:** PostgreSQL with SQLAlchemy ORM.

### Frontend (Client)
* **Framework:** React 18 + TypeScript (Strict Mode).
* **Build Tool:** Vite (Next-gen frontend tooling).
* **Styling:** Tailwind CSS for responsive, mobile-first design.
* **State Management:** React Query (TanStack) + Context API.

### DevOps & Infrastructure
* **Containerization:** Docker & Docker Compose.
* **Version Control:** Git & GitHub Actions (CI/CD pipeline planned).

## 🚀 Getting Started

### Prerequisites
* Node.js (v18+)
* Python (3.10+)
* PostgreSQL (Local or Docker)

### Installation

1.  **Clone the repository**
    ```bash
    git clone [https://github.com/Matanelevavi/Planit.git](https://github.com/Matanelevavi/Planit.git)
    cd Planit
    ```

2.  **Setup Backend**
    ```bash
    cd backend
    python -m venv venv
    source venv/bin/activate  # Windows: venv\Scripts\activate
    pip install -r requirements.txt
    uvicorn app.main:app --reload
    ```

3.  **Setup Frontend**
    ```bash
    cd frontend
    npm install
    npm run dev
    ```

---
*Developed by Matanel levavi - Full Stack, Data & Cyber Security Developer*
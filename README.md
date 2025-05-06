# SmartConstruct Project Management System

A modern project management system built with Vite, React, TailwindCSS, and Express.js.

## Project Structure

- `frontend-smartproject/`: Vite + React frontend application
- `backend-smartproject/`: Express.js backend application

## Technology Stack

### Frontend
- Vite
- React
- TailwindCSS
- React Query
- Shadcn UI Components
- TypeScript

### Backend
- Express.js
- PostgreSQL
- TypeScript
- Zod (Schema Validation)

### Infrastructure
- AWS Amplify (Frontend Hosting)
- AWS Elastic Beanstalk (Backend Hosting)
- AWS RDS (PostgreSQL Database)

## Development Setup

### Frontend
```bash
cd frontend-smartproject
npm install
npm run dev
```

### Backend
```bash
cd backend-smartproject
npm install
npm run dev
```

## Deployment

### Frontend (AWS Amplify)
The frontend is automatically deployed through AWS Amplify using the configuration in `amplify.yml`.

### Backend (AWS Elastic Beanstalk)
The backend is deployed to AWS Elastic Beanstalk with a connection to RDS PostgreSQL instance.

## Environment Variables

### Frontend
Create a `.env` file in the frontend directory with:
```
VITE_API_URL=your_backend_url
```

### Backend
Create a `.env` file in the backend directory with:
```
DATABASE_URL=your_postgres_connection_string
PORT=8080
```

## Features
- Project Management
- Work Breakdown Structure (WBS)
- Task Management
- Cost Control
- Gantt Charts
- Reports and Analytics 
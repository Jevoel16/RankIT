# RankIT Frontend (frontend-react)

This app is the React dashboard for RankIT and is connected to the Express backend.

## Backend Connection

The frontend calls the backend API URL from REACT_APP_API_URL.

1. Create a .env file in frontend-react.
2. Add this value:

REACT_APP_API_URL=http://localhost:5000/api

If REACT_APP_API_URL is not set, the app defaults to http://localhost:5000/api.

## Run Order

1. Start backend first from backend folder.
2. Start frontend from frontend-react folder.

Backend command:

npm run dev

Frontend command:

npm start

Open http://localhost:3000.

## Useful Scripts (frontend-react)

npm start
Runs the app in development mode.

npm test
Runs the test suite once in watch mode.

npm run build
Creates a production build.

## Notes

- Login and role routing depend on backend JWT responses.
- Tabulator view polls backend every 5 seconds for gatekeeper unlock state.
- Tallier submit button locks after successful score submission to prevent duplicate entry.

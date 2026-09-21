# Racing Scheduler - React

* React project that schedules a sailing team racing event using either a round-robin HSL scheduling system or a swiss-league system.
* Stores teams, events, races and results on a database.
* Records Results to a database and shows results from past races.
* Shows overall results.
* Can filter by team and predicts time of each race.


# Running the Project

This project was bootstrapped with Vite and React.

## Available Scripts

In the project directory, you can run:

### `npm install`
This must be done first to install node modules.

### `npm run dev`
Runs the app in development mode.

### `npm run build`
Builds the app for production.

### `npm run preview`
Previews the production build locally.

## While running

* Can toggle *admin* mode to change between competitor's view and admin's view.

# Tech Stack
- **Frontend:** React
- **Backend:** Supabase
- **Language:** JavaScript

# How It Works

### Event Creation

An administrator creates an event and adds the participating teams.

### Schedule Generation

When the event begins, the application generates a round-robin
schedule using a custom scheduling algorithm.

The algorithm ensures that each team:
1. Races twice consecutively
2. Takes a break
3. Returns for its next pair of races

### Results

After each race, the administrator enters the finishing positions.
The results are stored in Supabase and the standings are updated automatically.

 

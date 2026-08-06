import { useState } from 'react'
import { useEffect } from 'react'
import RaceList from './Components/RaceList';
import ResultsTable from './Components/ResultsTable';
import { supabase } from './supabaseClient';

function App() {
  // Admin  mode for adding results and changing schedule
  const [admin, setAdmin] = useState(true);
  const [scheduleType, setScheduleType] = useState("round-robin");

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("schedule");

  const [events, setEvents] = useState([
    {
      id: 1,
      name: "default",
      location: "default",
      date: "09-08-2025",
      status: "default", // "live" or "completed"
      teams: [],
      races: [] // will be filled once event goes live
    }
  ]);

  const flights = [{
    id: 0,
    team_1: "Yellow jib",
    team_2: "Red jib"
  },
  {
    id: 1,
    team_1: "Pink Striped",
    team_2: "Black Striped"
  },
  {
    id: 2,
    team_1: "Blue jib",
    team_2: "Gray Jib"
  }]


  const [selectedEventId, setSelectedEventId] = useState(1);

  // Load from supabase database on first render
  useEffect(() => {
    async function fetchEvents() {
      let { data, error } = await supabase.from("events").select("*"); // gets data from events database
      if (error) console.error("Error fetching events:", error.message); // returns error if failure

      const eventWithTeams = await Promise.all( // Gets data from teams database
        data.map(async event => {
          let { data: teams, teamError } = await supabase
            .from("teams")
            .select("*")
            .eq("event_id", event.id);

          if (teamError) {
            console.error("Error fetching teams:", teamError.message);
            teams = [];
          }
          let races = []
          return { ...event, teams, races };
        })
      );


      const eventWithTeamsAndRaces = await Promise.all( // Loads all data from races database
        eventWithTeams.map(async event => {
          let { data: races, raceError } = await supabase
            .from("races")
            .select("*")
            .eq("event_id", event.id)
            .order("racenumber", { ascending: true });
          if (raceError) {
            console.error("Error fetching races: ", raceError.message);
            races = [];
          }
          const racesWithDefaultResults = races.map(race => { // fills default results to avoid index out of bounds errors
            const default_result = [0, 0, 0];
            return { ...race, team1_result: default_result, team2_result: default_result }
          });
          return { ...event, races: racesWithDefaultResults }

        })
      );
      const eventWithTeamsAndRacesAndResults = await Promise.all( // loads all data from results database
        eventWithTeamsAndRaces.map(async event => {
          let { data: results, resultError } = await supabase
            .from("results")
            .select("*")
            .eq("event_id", event.id);
          if (resultError) {
            console.error("Error fetching results: ", resultError.message);
            results = [];
          }
          const updatedRaces = event.races.map(race => // results are stored in the races objects
          {
            const raceResults = results.filter(result => result.race_id === race.id);

            const team1_result = [...race.team1_result];
            const team2_result = [...race.team2_result];


            raceResults.forEach(result => {
              if (result.team_id === race.team1_id) {
                team1_result[team1_result.indexOf(0)] = result.placement;
              } else if (result.team_id === race.team2_id) {
                team2_result[team2_result.indexOf(0)] = result.placement;
              }
            });
            return { ...race, team1_result, team2_result }
          });
          return { ...event, races: updatedRaces }

        })

      );


      setEvents(eventWithTeamsAndRacesAndResults);
      setLoading(false);
    }
    fetchEvents();

  }, []);


  // Updates events database when events is changed
  async function updateEvents() {
    const eventsToUpsert = events.map(({ id, name, date, location, status }) => ({
      id, name, date, location, status
    }));
    const { data, error } = await supabase
      .from("events")
      .upsert(eventsToUpsert) // upsert will insert new rows or update existing ones based on primary key
      .select();

    if (error) console.error("Error updating events:", error.message);
    else console.log("Events updated:", data);
  }

  // Updates races database when races are changed
  async function updateRaces() {
    const dataToUpsert = events.flatMap(event =>
      event.races.map(race => ({
        id: race.id,
        event_id: event.id,
        team1_id: race.team1_id,
        team2_id: race.team2_id,
        racenumber: race.racenumber,
        status: race.status,
        flight_id: race.flight_id,
        finish_time: race.finish_time
      }))
    );
    const { data, error } = await supabase
      .from("races")
      .upsert(dataToUpsert) // upsert will insert new rows or update existing ones based on primary key
      .select();

    if (error) console.error("Error updating races:", error.message);
  }

  // Updates results database when events is changed
  async function updateResults(team_id, placement, race_id, boat_id, result_id = null) {
    if (result_id === null) { // result id is made fresh unless it is specifically referenced
      result_id = boat_id + race_id + selectedEventId;
    }
    const resultsToUpsert = { id: result_id, team_id, placement, race_id, event_id: selectedEventId }
    const { data, error } = await supabase
      .from("results")
      .upsert(resultsToUpsert) // upsert will insert new rows or update existing ones based on primary key
      .select();

    if (error) console.error("Error updating results:", error.message);

  }




  // Adds event to database
  async function addEvent(name, date) {
    const { data, error } = await supabase
      .from("events")
      .insert([{ name, date }]);

    if (error) console.error(error);
    else console.log("Event added:", data);
  }

  // Adds a team to database
  async function addTeam(name, eventId) {
    const { data, error } = await supabase
      .from("teams")
      .insert([{ name: name, event_id: eventId }]);

    if (error) console.error(error);

  }

  // Adds a race to database
  async function addRace(eventId, team1Id, team2Id, orderNum) {
    const { data, error } = await supabase
      .from("races")
      .insert([
        { event_id: eventId, team1_id: team1Id, team2_id: team2Id, order_num: orderNum }
      ]);
    if (error) console.error(error);
  }

  function getTotalPoints(result_array) { // returns total points of a team from a race
    return result_array.reduce((acc, curr) => acc + curr, 0);
  }

  function getTeamRaces(team_id) { // returns total wins for a given team
    let raceCounter = 0;

    selectedEvent.races.forEach(race => {
      if (race.status !== "completed") return;
      if (race.team1_id !== team_id && race.team2_id !== team_id) return;
      raceCounter += 1;
    })
    return raceCounter;
  }



  function getTeamRaceWins(team_id) { // returns total wins for a given team
    let winCounter = 0;

    selectedEvent.races.forEach(race => {
      let winner_id = null;
      if (race.status !== "completed") return;
      if (getTotalPoints(race.team1_result) < getTotalPoints(race.team2_result)) {
        winner_id = race.team1_id;
      } else {
        winner_id = race.team2_id;
      }

      if (winner_id === team_id) {
        winCounter += 1;
      }
    })
    return winCounter;
  }

  function getRaceWinner(race_id) { // returns id of the winning team of a race
    let raceWinner = null;
    selectedEvent.races.forEach(race => {
      if (race.status !== "completed") return;
      if (race.id !== race_id) return;
      if (getTotalPoints(race.team1_result) < getTotalPoints(race.team2_result)) {
        raceWinner = race.team1_id;
      } else {
        raceWinner = race.team2_id;
      }
    });
    return raceWinner;
  }


  // Generates schedule
  function generateSchedule() {
    console.log("Entering loop");
    let races = [];
    let team_matches_played = selectedEvent.teams.reduce((obj, team) => {
      obj[team.id] = 0;
      return obj;
    }, {});

    let team_match_intervals = selectedEvent.teams.reduce((obj, team) => {
      obj[team.id] = -1;
      return obj;
    }, {});

    let rounds_played= 0;

    if (scheduleType === "round-robin") {

      // Applies round-robin scheduling algorithm to the event with eventId provided
      const NUM_RACES = 92
      const RACE_INTERVAL = 15;
      let i = 0;

      let raceNum = 0;

      function record_match(team1, team2, races) {
        if (team1.id === team2.id) {
          return false;
        }
        const raceExists = races.some(race =>
          race.team1_id === team1.id && race.team2_id === team2.id
        );
        // In JS, arrays use .includes() instead of Python's 'in'
        if (raceExists === true) {
          return false;
        }
        if (team_matches_played[team1.id] > rounds_played || (team_match_intervals[team1.id] !== -1 && team_match_intervals[team1.id] < RACE_INTERVAL)) {
          return false;
        }
        if (team_matches_played[team2.id] > rounds_played || (team_match_intervals[team2.id] !== -1 && team_match_intervals[team2.id] < RACE_INTERVAL)) {
          return false;
        }
        // Sort and join to make a unique string matchup key
        let matchupId = team1.id < team2.id
          ? team1.id.toString() + team2.id.toString()
          : team2.id.toString() + team1.id.toString();

        // Increment matches played
        team_matches_played[team1.id] +=1;
        team_matches_played[team2.id] +=1;

        // Reset interavl
        team_match_intervals[team1.id] = 0;

        races.push({
          id: raceNum.toString() + matchupId,
          racenumber: raceNum + 1,
          team1_id: team1.id,
          team2_id: team2.id,
          status: "pending",
          team1_result: [0, 0, 0],
          team2_result: [0, 0, 0],
          flight_id: raceNum % 3,
          finish_time: null
        });
        raceNum += 1;
        return true;

      }

      let attempts = 0;
      let attempts2 = 0;
      let prev_i = [];

      while (races.length < NUM_RACES) {
        if (attempts > 500) {
            break;
          }
        attempts += 1;
        let matchup_found = false;
        attempts2 = 0;
        while (matchup_found === false) {
          if (attempts2 > 500) {
            break;
          }
          attempts2 += 1;
          do {
          i = Math.floor(Math.random() * selectedEvent.teams.length);
          } while (prev_i.includes(i));
          if (prev_i.length < flights.length) {
            matchup_found = record_match(selectedEvent.teams[Math.floor(Math.random() * selectedEvent.teams.length)], selectedEvent.teams[i], races);
            if (matchup_found === true) {
              break;
            }
          } else {
            matchup_found = record_match(selectedEvent.teams[prev_i[0]], selectedEvent.teams[i], races);
            if (matchup_found === true) {
              break;
            }
          }
        }
        prev_i.push(i);
        if (prev_i.length > flights.length) {
          prev_i.shift();
        }

        const values = Object.values(team_matches_played);
        const roundComplete = values.every(val => val >= rounds_played);
        if (roundComplete) {
          rounds_played += 2;
        }
                // Age the resting teams
        for (const team of selectedEvent.teams) {
          if (team !== selectedEvent.teams[prev_i[-1]] && team !== selectedEvent.teams[i]) {
            if (team_match_intervals[team.id] !== -1) {
              team_match_intervals[team.id] += 1;
            }
          }
        }
      }



    } else if (scheduleType === "swiss-league") {

      // Generate races where first always races second and so on
      let raceNum;
      if (selectedEvent.races.length === 0) {
        raceNum = 0;
      } else {
        raceNum = selectedEvent.races[selectedEvent.races.length - 1].racenumber
      }
      let teamCounter = 0;
      const newTeams = newTeamList();
      while (teamCounter < selectedEvent.teams.length) {
        races.push({
          id: raceNum.toString() + newTeams[teamCounter].id.toString() + newTeams[teamCounter + 1].id.toString(),
          racenumber: raceNum + 1,
          team1_id: newTeams[teamCounter].id,
          team2_id: newTeams[teamCounter + 1].id,
          status: "pending",
          team1_result: [0, 0, 0],
          team2_result: [0, 0, 0],
          flight_id: raceNum % 3,
          finish_time: 0
        });
        raceNum += 1;
        teamCounter += 2;
      }
    }

    const updatedRaces = [...selectedEvent.races, ...races];
    setEvents(prev =>
      prev.map(event => {
        if (event.id !== selectedEventId) return;
        return { ...event, races: updatedRaces, status: "live" }
      })
    );
    
  }


  function addToStack(stack, item) {
    if (stack.includes(item) === false) {
      stack.push(item);
      if (stack.length > 4) {
        stack.shift();
      }
    }
    return stack;
  }

  function isAlreadyRace(team1_id, team2_id, races) {
    let foundRace = false;
    races.forEach(race => {
      if ((race.team1_id === team1_id && race.team2_id === team2_id) || (race.team2_id === team1_id && race.team1_id === team2_id) || (race.team1_id === team2_id && race.team2_id === team1_id)) {
        foundRace = true;
      }
    })
    return foundRace;
  }

  function newTeamList() {
    let swapped;
    let n = selectedEvent.teams.length
    let teams = selectedEvent.teams.slice();
    do {
      swapped = false;
      // Get order in terms of race wins first
      for (let i = 0; i < n - 1; i++) {
        if (getTeamRaceWins(teams[i].id) < getTeamRaceWins(teams[i + 1].id)) {
          let temp = teams[i];
          teams[i] = teams[i + 1];
          teams[i + 1] = temp;
          swapped = true;
        }
      }
      n--;
    } while (swapped);

    // Now deal with tie breakers in the order given - number of races against teams with higher place
    do {
      swapped = false;
      for (let i = 0; i < n - 1; i++) {
        if (getNumRacesAgainstHigherPlace(teams[i].id, teams) < getNumRacesAgainstHigherPlace(teams[i + 1].id, teams)) {
          let temp = teams[i];
          teams[i] = teams[i + 1];
          teams[i + 1] = temp;
          swapped = true;
        } else if (getNumRacesAgainstLowerPlaces(teams[i].id, teams) > getNumRacesAgainstLowerPlaces(teams[i + 1].id, teams)) { // number of races against teams with lower place
          let temp = teams[i];
          teams[i] = teams[i + 1];
          teams[i + 1] = temp;
          swapped = true;
        } else if (getSumOfPlacesTiedTeamsHaveBeaten(teams[i].id, teams) > getSumOfPlacesTiedTeamsHaveBeaten(teams[i + 1].id, teams)) { // number of races against teams with lower place
          let temp = teams[i];
          teams[i] = teams[i + 1];
          teams[i + 1] = temp;
          swapped = true;
        } else if (getSumOfPlacesTiedTeamsHaveLost(teams[i].id, teams) > getSumOfPlacesTiedTeamsHaveLost(teams[i + 1].id, teams)) { // number of races against teams with lower place
          let temp = teams[i];
          teams[i] = teams[i + 1];
          teams[i + 1] = temp;
          swapped = true;
        } else if (getHighestPlaceTeamHasBeaten(teams[i].id, teams) > getHighestPlaceTeamHasBeaten(teams[i + 1].id, teams)) { // number of races against teams with lower place
          let temp = teams[i];
          teams[i] = teams[i + 1];
          teams[i + 1] = temp;
          swapped = true;
        } else if (getLowestPlaceTeamHasLost(teams[i].id, teams) > getLowestPlaceTeamHasLost(teams[i + 1].id, teams)) { // number of races against teams with lower place
          let temp = teams[i];
          teams[i] = teams[i + 1];
          teams[i + 1] = temp;
          swapped = true;
        }
      }
      n--;
    } while (swapped);
    return teams;
  }

  function findRaceId(team1_id, team2_id) {
    let foundRace;
    selectedEvent.races.forEach(race => {
      if ((race.team1_id === team1_id && race.team2_id === team2_id) || (race.team2_id === team1_id && race.team1_id === team2_id) || (race.team1_id === team2_id && race.team2_id === team1_id)) {
        if (foundRace) {
          if (race.racenumber > foundRace.racenumber) {
            foundRace = race;
          }
        }
      }
    })
    if (foundRace) {
      return foundRace.id;
    } else {
      return null;
    }
  }

  function getHighestPlaceTeamHasBeaten(team_id, teams) {
    let highestPlace = 1000;
    const opponents = getTeamsOpponents(team_id);
    for (let i = 0; i < opponents.length; i++) {
      if (teams.indexOf(teams.find((team) => team.id === (opponents[i]))) < highestPlace && getRaceWinner(findRaceId(opponents[i], team_id)) === team_id) {
        highestPlace = teams.indexOf(teams.find((team) => team.id === (opponents[i])));
      }
    }
    return highestPlace;
  }

  function getLowestPlaceTeamHasLost(team_id, teams) {
    let lowestPlace = -1000;
    const opponents = getTeamsOpponents(team_id);
    for (let i = 0; i < opponents.length; i++) {
      if (teams.indexOf(teams.find((team) => team.id === (opponents[i]))) > lowestPlace && getRaceWinner(findRaceId(opponents[i], team_id)) !== team_id) {
        lowestPlace = teams.indexOf(teams.find((team) => team.id === (opponents[i])));
      }
    }
    return lowestPlace;
  }

  function getSumOfPlacesTiedTeamsHaveBeaten(team_id, teams) {
    const opponents = getTeamsOpponents(team_id);
    let sum = 0;
    selectedEvent.races.forEach(race => {
      for (let i = 0; i < opponents.length; i++) {
        if ((race.team1_id === opponents[i] && race.team2_id === team_id) || (race.team2_id === opponents[i] && race.team1_id === team_id)) {
          if (getRaceWinner(race.id) === team_id) {
            sum += teams.indexOf(teams.find((team) => team.id === (opponents[i])));
          }
        }
      }
    });
    return sum;
  }

  function getSumOfPlacesTiedTeamsHaveLost(team_id, teams) {
    const opponents = getTeamsOpponents(team_id);
    let sum = 0;
    selectedEvent.races.forEach(race => {
      for (let i = 0; i < opponents.length; i++) {
        if ((race.team1_id === opponents[i] && race.team2_id === team_id) || (race.team2_id === opponents[i] && race.team1_id === team_id)) {
          if (getRaceWinner(race.id) === opponents[i]) {
            sum += teams.indexOf(teams.find((team) => team.id === (opponents[i])));
          }
        }
      }
    });
    return sum;
  }

  function getTeamsOpponents(team_id) {
    let opponents = []
    selectedEvent.races.forEach(race => {
      if (race.team1_id == team_id || race.team2_id == team_id) {
        if (race.team1_id == team_id) {
          opponents.push(race.team2_id);
        } else {
          opponents.push(race.team1_id);
        }
      }
    });
    return opponents;
  }

  function getNumRacesAgainstHigherPlace(team_id, teams) {
    const opponents = getTeamsOpponents(team_id);
    let numRaces = 0;
    for (let i = 0; i < opponents.length; i++) {
      if (teams.indexOf(teams.find((team) => team.id === (opponents[i]))) < teams.indexOf(teams.find((team) => team.id === team_id))) {
        numRaces++;
      }
    }
    return numRaces;
  }

  function getNumRacesAgainstLowerPlaces(team_id, teams) {
    const opponents = getTeamsOpponents(team_id);
    let numRaces = 0;
    for (let i = 0; i < opponents.length; i++) {
      if (teams.indexOf(teams.find((team) => team.id === (opponents[i]))) > teams.indexOf(teams.find((team) => team.id === team_id))) {
        numRaces++;
      }
    }
    return numRaces;
  }

  function getNumberOfRacesCompleted() {
    let completedRaces = 0;
    selectedEvent.races.forEach(race => {
      if (race.status !== "completed") return;
      completedRaces += 1;
    })
    return completedRaces;
  }


  const selectedEvent = events.find(event => event.id === selectedEventId);
  // Generates schedule after events load
  useEffect(() => {
    if (selectedEvent.name !== "default") {
      if (((scheduleType === "swiss-league" && getNumberOfRacesCompleted() == selectedEvent.races.length)) || selectedEvent.races.length === 0) {
        generateSchedule();
      }
      //updateRaces();
      setLoading(false);
    }
  }, [selectedEvent]);

  function isIntegerString(value) {
    return /^-?\d+$/.test(value);
  }


  // Adds result to results
  function handleAddResult(raceId, result, resultIndex) {
    if (result > 6 || result < 0 || !isIntegerString(result)) return;
    setEvents(prev =>
      prev.map(event => {

        if (event.id !== selectedEventId) return event; // ignores all other events

        const updatedRaces = event.races.map(race => { // creates a new races array with the new updated result
          if (race.id !== raceId) return race; // ignores other races

          const new_team1_result = race.team1_result; // copies existing result
          const new_team2_result = race.team2_result;

          if (new_team1_result.includes(result) || new_team2_result.includes(result)) { // checks if result has already been entered
            return race;
          }

          if (resultIndex < 3) { // adds new result to correct index
            new_team1_result[resultIndex] = result;
            updateResults(race.team1_id, result, raceId, resultIndex);
          } else {
            new_team2_result[resultIndex - 3] = result;
            updateResults(race.team2_id, result, raceId, resultIndex);
          }
          let newStatus = "pending";
          let finishTime;
          if (!(new_team1_result.includes(0) || new_team2_result.includes(0))) {
            newStatus = "completed";
            if (race.status !== "completed") {
              finishTime = new Date().getTime();
            } else {
              finishTime = race.finish_time;
            }
          }

          return { ...race, team1_result: new_team1_result, team2_result: new_team2_result, status: newStatus, finish_time: finishTime };
        });
        return { ...event, races: updatedRaces };
      })
    )

  }


  if (loading) return <div>Loading...</div>;

  return (
    <>
      <div className="TitleBar">
        <h1>{selectedEvent.name}</h1>
      </div>

      <div className="tabs-panel">
        <button className="tab" onClick={() => setActiveTab("schedule")}>Schedule</button>
        <button className="tab" onClick={() => setActiveTab("race_results")}>Race Results</button>
        <button className="tab" onClick={() => setActiveTab("results_table")}>Results Table</button>
      </div>

      {(activeTab === "schedule" || activeTab === "race_results") && <RaceList getNumberOfRacesCompleted={getNumberOfRacesCompleted} flights={flights} mode={activeTab} raceWinner={getRaceWinner} teams={selectedEvent.teams} races={selectedEvent.races} onAddResult={handleAddResult} adminMode={admin} />}
      {(activeTab === "results_table") && <ResultsTable getTeamRaces={getTeamRaces} getTeamWins={getTeamRaceWins} teams={selectedEvent.teams} />}
      <footer>
        <p>&copy; 2025 All rights reserved</p>
        <p>By Harry Rowlands</p>
      </footer>
    </>
  )
}

export default App;

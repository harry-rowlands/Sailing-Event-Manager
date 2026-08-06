import { useState } from "react";



function RaceList({ getNumberOfRacesCompleted, flights, mode, raceWinner, teams, races, onAddResult, adminMode }) {

    const [selectedTeam, setSelectedTeam] = useState(["0"]);
    const [showTeamStats, setShowTeamStats] = useState(false);


    function getTeam1(race) {
        return teams.find(team => team.id === race.team1_id);

    }

    function getTeam2(race) {
        return teams.find(team => team.id === race.team2_id);
    }




    function getAverageRaceTime() {
        let totalTimeBetweenFinishes = 0;
        let counter = 0;
        let countedRaces = 0;
        while (counter < getNumberOfRacesCompleted() - 1) {
            const difference = races[counter + 1].finish_time - races[counter].finish_time;
            if (difference < 600000) {
                totalTimeBetweenFinishes += difference;
                countedRaces += 1;
            }
            counter += 1;
        }
        return totalTimeBetweenFinishes / countedRaces;
    }

    function getTimeOfRace(race_id) {
        const race = races.find(race => race_id === race.id);
        const racesUntilRace = race.racenumber - getNumberOfRacesCompleted() - 1;
        const millisecondsUntilRace = (getAverageRaceTime() * racesUntilRace);
        const timeOfRace = new Date(new Date().getTime() + millisecondsUntilRace);
        if (isValidDate(new Date().getTime() + millisecondsUntilRace)) {
            return timeOfRace.toLocaleTimeString();
        } else {
            return "";
        }
    }

    function isValidDate(date) {
        const d = new Date(date);
        return !isNaN(d.getTime());
    }



    return (
        <div>
            <div className="top-box">
                <div className="stats">
                    {isValidDate(getAverageRaceTime()) && (<p>Average Race Time: {new Date(getAverageRaceTime()).toLocaleTimeString("en-GB", { minute: "2-digit", second: "2-digit" })}</p>)}
                    <p>Races Completed: {getNumberOfRacesCompleted()}</p>
                </div>
                <div className="sidebar">
                    <label htmlFor="teamSelection">Filter by team: </label>
                    <select id="teamSelection" name="teamSelection" onChange={(e) => setSelectedTeam(Array.from(e.target.selectedOptions, opt => opt.value))}>
                        <option key={0} value={0}>No Filter</option>
                        {teams.map((team) => (
                            <option key={team.id} value={team.id}>{team.name}</option>
                        ))}

                    </select>
                </div>
            </div>
            <ul className="race-list">
                {races.filter(race => {
                        if (mode === "race_results" && race.status === "pending") return false;
                        if (mode === "schedule" && race.status === "completed") return false;
                        if (selectedTeam[0] !== "0") {
                            if (race.team1_id !== Number(selectedTeam[0]) && race.team2_id !== Number(selectedTeam[0])) return false;
                        }
                        return true;
                    })
                    .map((race, index) => {
                        const itemKey = race.id || `race-index-${index}`;
                        const flight = flights[race.flight_id] || { team_1: "TBD", team_2: "TBD" };
                    return (< li key={race.id} className="race-card" >
                        <p className="race-title">{race.racenumber}. {getTeam1(race).name} vs {getTeam2(race).name} </p>
                        <p className="race-info">{flights[race.flight_id].team_1} vs {flights[race.flight_id].team_2}</p>
                        {(race.status !== "completed" && getTimeOfRace(race.id) !== "") && (<p className="race-info">Time Of Race : {getTimeOfRace(race.id)}</p>)}
                        {adminMode ? (
                            <form>
                                <p>Team 1 Score:</p>
                                <input type="text" className="score-input" value={race.team1_result[0]} onChange={e => onAddResult(race.id, e.target.value, 0)} />
                                <input type="text" className="score-input" value={race.team1_result[1]} onChange={e => onAddResult(race.id, e.target.value, 1)} />
                                <input type="text" className="score-input" value={race.team1_result[2]} onChange={e => onAddResult(race.id, e.target.value, 2)} />
                                <p>Team 2 Score:</p>
                                <input type="text" className="score-input" value={race.team2_result[0]} onChange={e => onAddResult(race.id, e.target.value, 3)} />
                                <input type="text" className="score-input" value={race.team2_result[1]} onChange={e => onAddResult(race.id, e.target.value, 4)} />
                                <input type="text" className="score-input" value={race.team2_result[2]} onChange={e => onAddResult(race.id, e.target.value, 5)} />
                            </form>
                        ) : (
                            race.status === "completed" && (
                                <div className="result-card">
                                    <div className={(raceWinner(race.id) === race.team1_id) ? ("result-team-winner") : ("result-team-loser")}>
                                        <p>{getTeam1(race).name}</p>
                                        {(raceWinner(race.id) === race.team1_id) ? (<p>Win</p>) : (<p>Loss</p>)}
                                        <p>{race.team1_result[0]}  {race.team1_result[1]}  {race.team1_result[2]}</p>
                                    </div>
                                    <div className={(raceWinner(race.id) === race.team2_id) ? ("result-team-winner") : ("result-team-loser")}>
                                        <p>{getTeam2(race).name}</p>
                                        {(raceWinner(race.id) === race.team2_id) ? (<p>Win</p>) : (<p>Loss</p>)}
                                        <p>{race.team2_result[0]} {race.team2_result[1]} {race.team2_result[2]}</p>
                                    </div>
                                </div>
                            )
                        )}
                    </li>)
                }
                )}
            </ul >

        </div >
    );
}

export default RaceList;

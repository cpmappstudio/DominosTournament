import React from "react";

const Rules: React.FC = () => {
  return (
    <div className="p-6 max-w-4xl mx-auto text-zinc-900 dark:text-white">
      <h1 className="text-3xl font-bold mb-6">Official Puerto Rican Domino Rules</h1>
      
      <div className="space-y-8">
        {/* Game Modality */}
        <section className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6">
          <h2 className="text-2xl font-semibold mb-4 dark:text-white">Game Modality</h2>
          <div className="space-y-3">
            <p className="dark:text-zinc-200">
              Puerto Rican style domino is traditionally played in teams format, with specific rules that have evolved over generations:
            </p>
            <ul className="list-disc pl-6 space-y-2 dark:text-zinc-200">
              <li>Traditionally played in teams (2 vs 2)</li>
              <li>Partners sit across from each other</li>
              <li>Free-for-all is accepted in individual leagues or ranking phases</li>
              <li>Each player receives 7 dominoes (using a double-six set with 28 tiles)</li>
              <li>Play proceeds counter-clockwise</li>
            </ul>
          </div>
        </section>
        
        {/* Scoring System */}
        <section className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6">
          <h2 className="text-2xl font-semibold mb-4 dark:text-white">Scoring System</h2>
          <div className="space-y-3">
            <p className="dark:text-zinc-200">
              The scoring system in Puerto Rican domino follows these key principles:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                Games are played to a total score:
                <ul className="list-circle pl-6 mt-1">
                  <li>100 points (short game)</li>
                  <li>150 points (standard match)</li>
                  <li>200 points (formal or league matches)</li>
                </ul>
              </li>
              <li>Each round gives points to the winning team based on the total value of remaining tiles in the losing team's hands</li>
              <li>In case of a "lock" (trancado), both teams count their remaining dominoes, and the team with fewer points wins the round</li>
              <li>If both teams have the same count in a lock, no points are awarded</li>
            </ul>
          </div>
        </section>
        
        {/* Rounds / League Format */}
        <section className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6">
          <h2 className="text-2xl font-semibold mb-4 dark:text-white">Rounds / League Format</h2>
          <div className="space-y-3">
            <p className="dark:text-zinc-200">
              Competitive domino is often organized into structured formats:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Games may be organized into match days (round-robin or group stage)</li>
              <li>Teams/players face each other multiple times</li>
              <li>Wins and points accumulate across rounds</li>
              <li>A full league may consist of 5-10 match days</li>
              <li>Teams are typically seated at tables and rotate after each match</li>
            </ul>
          </div>
        </section>
        
        {/* Classification and Tie-break Criteria */}
        <section className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6">
          <h2 className="text-2xl font-semibold mb-4 dark:text-white">Classification and Tie-break Criteria</h2>
          <div className="space-y-3">
            <p className="dark:text-zinc-200">
              Rankings are determined through a hierarchical set of criteria:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                Ranking is based on:
                <ul className="list-circle pl-6 mt-1">
                  <li>Number of games won (primary factor)</li>
                  <li>Total points accumulated (secondary factor)</li>
                  <li>Point differential (tertiary factor)</li>
                </ul>
              </li>
              <li>Ties are resolved via sudden death matches</li>
              <li>In tournaments, head-to-head results may be considered before sudden death</li>
            </ul>
          </div>
        </section>
        
        {/* Penalties */}
        <section className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6">
          <h2 className="text-2xl font-semibold mb-4 dark:text-white">Penalties</h2>
          <div className="space-y-3">
            <p className="dark:text-zinc-200">
              The integrity of the game is maintained through various penalties:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                Penalties may apply for:
                <ul className="list-circle pl-6 mt-1">
                  <li>Slow or delayed play (time violations)</li>
                  <li>Declaring an invalid move</li>
                  <li>Breaking pass or shuffle rules</li>
                  <li>Communication between partners that reveals hand information</li>
                  <li>Improper table talk or unsportsmanlike conduct</li>
                </ul>
              </li>
              <li>Penalties can impact team or player records</li>
              <li>Serious violations may result in match forfeiture</li>
            </ul>
          </div>
        </section>
        
        {/* Final Rounds or Playoffs */}
        <section className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6">
          <h2 className="text-2xl font-semibold mb-4 dark:text-white">Final Rounds or Playoffs</h2>
          <div className="space-y-3">
            <p className="dark:text-zinc-200">
              Top performers advance to culminating phases of competition:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                Top players or teams advance to:
                <ul className="list-circle pl-6 mt-1">
                  <li>Semifinals and Finals</li>
                  <li>Format: single elimination or best-of-three</li>
                </ul>
              </li>
              <li>Championship matches often use the 200-point format</li>
              <li>Special recognition and awards are given to champions</li>
              <li>Official tournaments may qualify winners for regional or national competitions</li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Rules;
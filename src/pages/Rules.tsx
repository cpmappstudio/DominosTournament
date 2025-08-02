import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";

const Rules: React.FC = () => {
  return (
    <div className="p-2 sm:p-4 lg:p-6 w-full lg:max-w-6xl lg:mx-auto text-zinc-900 dark:text-white">
      <h1 className="sr-only">Official Puerto Rican Domino Rules</h1>
      
      <div className="space-y-6">
        {/* Game Modality */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl sm:text-2xl">Game Modality</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-muted-foreground">
                Puerto Rican style domino is traditionally played in teams format, with specific rules that have evolved over generations:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-sm sm:text-base">
                <li>Traditionally played in teams (2 vs 2)</li>
                <li>Partners sit across from each other</li>
                <li>Free-for-all is accepted in individual leagues or ranking phases</li>
                <li>Each player receives 7 dominoes (using a double-six set with 28 tiles)</li>
                <li>Play proceeds counter-clockwise</li>
              </ul>
            </div>
          </CardContent>
        </Card>
        
        {/* Scoring System */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl sm:text-2xl">Scoring System</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-muted-foreground">
                The scoring system in Puerto Rican domino follows these key principles:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-sm sm:text-base">
                <li>
                  Games are played to a total score:
                  <ul className="list-circle pl-6 mt-1 space-y-1">
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
          </CardContent>
        </Card>
        
        {/* Rounds / League Format */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl sm:text-2xl">Rounds / League Format</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-muted-foreground">
                Competitive domino is often organized into structured formats:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-sm sm:text-base">
                <li>Games may be organized into match days (round-robin or group stage)</li>
                <li>Teams/players face each other multiple times</li>
                <li>Wins and points accumulate across rounds</li>
                <li>A full league may consist of 5-10 match days</li>
                <li>Teams are typically seated at tables and rotate after each match</li>
              </ul>
            </div>
          </CardContent>
        </Card>
        
        {/* Classification and Tie-break Criteria */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl sm:text-2xl">Classification and Tie-break Criteria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-muted-foreground">
                Rankings are determined through a hierarchical set of criteria:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-sm sm:text-base">
                <li>
                  Ranking is based on:
                  <ul className="list-circle pl-6 mt-1 space-y-1">
                    <li>Number of games won (primary factor)</li>
                    <li>Total points accumulated (secondary factor)</li>
                    <li>Point differential (tertiary factor)</li>
                  </ul>
                </li>
                <li>Ties are resolved via sudden death matches</li>
                <li>In tournaments, head-to-head results may be considered before sudden death</li>
              </ul>
            </div>
          </CardContent>
        </Card>
        
        {/* Penalties */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl sm:text-2xl">Penalties</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-muted-foreground">
                The integrity of the game is maintained through various penalties:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-sm sm:text-base">
                <li>
                  Penalties may apply for:
                  <ul className="list-circle pl-6 mt-1 space-y-1">
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
          </CardContent>
        </Card>
        
        {/* Final Rounds or Playoffs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl sm:text-2xl">Final Rounds or Playoffs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-muted-foreground">
                Top performers advance to culminating phases of competition:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-sm sm:text-base">
                <li>
                  Top players or teams advance to:
                  <ul className="list-circle pl-6 mt-1 space-y-1">
                    <li>Semifinals and Finals</li>
                    <li>Format: single elimination or best-of-three</li>
                  </ul>
                </li>
                <li>Championship matches often use the 200-point format</li>
                <li>Special recognition and awards are given to champions</li>
                <li>Official tournaments may qualify winners for regional or national competitions</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Rules;
import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import SquareIntegrationTester from '../components/SquareIntegrationTester';

export default function TestSquareIntegration() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLeague, setSelectedLeague] = useState<{ id: string; name: string } | null>(null);
  const [customLeagueId, setCustomLeagueId] = useState('');
  const [customLeagueName, setCustomLeagueName] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Sample leagues for testing
  const sampleLeagues = [
    { id: 'test-league-1', name: 'Test Premium League' },
    { id: 'test-league-2', name: 'Another Test League' },
    { id: 'test-league-3', name: 'Pro Domino League' }
  ];

  const handleLeagueSelect = (leagueId: string) => {
    const league = sampleLeagues.find(l => l.id === leagueId);
    if (league) {
      setSelectedLeague(league);
      setCustomLeagueId('');
      setCustomLeagueName('');
    }
  };

  const handleCustomLeague = () => {
    if (customLeagueId && customLeagueName) {
      setSelectedLeague({ id: customLeagueId, name: customLeagueName });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <p>Please sign in to test the Square integration.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h1 className="text-2xl font-bold mb-2">🧪 Square Payment Integration Test</h1>
          <p className="text-gray-600 mb-6">
            Test the complete payment flow without making real payments
          </p>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Select Test League</label>
                <select 
                  className="w-full p-2 border rounded-md"
                  onChange={(e) => handleLeagueSelect(e.target.value)}
                  value={selectedLeague?.id || ''}
                >
                  <option value="">Choose a test league</option>
                  {sampleLeagues.map((league) => (
                    <option key={league.id} value={league.id}>
                      {league.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-medium">Or Enter Custom League</label>
                <div className="flex gap-2">
                  <input
                    className="flex-1 p-2 border rounded-md text-sm"
                    placeholder="League ID"
                    value={customLeagueId}
                    onChange={(e) => setCustomLeagueId(e.target.value)}
                  />
                  <input
                    className="flex-1 p-2 border rounded-md text-sm"
                    placeholder="League Name"
                    value={customLeagueName}
                    onChange={(e) => setCustomLeagueName(e.target.value)}
                  />
                  <button 
                    onClick={handleCustomLeague}
                    disabled={!customLeagueId || !customLeagueName}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Use
                  </button>
                </div>
              </div>
            </div>

            {selectedLeague && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <p className="text-sm">
                  <strong>Testing with:</strong> {selectedLeague.name} (ID: {selectedLeague.id})
                  <br />
                  <strong>User:</strong> {user.email} (ID: {user.uid})
                </p>
              </div>
            )}
          </div>
        </div>

        {selectedLeague && (
          <SquareIntegrationTester
            leagueId={selectedLeague.id}
            userId={user.uid}
            leagueName={selectedLeague.name}
          />
        )}

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-bold mb-4">🔄 Integration Flow Overview</h2>
          
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-semibold text-green-600">✅ What's Working:</h4>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Square checkout URL generation</li>
                <li>Redirect to Square's secure payment page</li>
                <li>Webhook endpoint configured</li>
                <li>Payment processing simulation</li>
                <li>Membership creation/update logic</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-yellow-600">⏳ Still Needed:</h4>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Square account fully activated for real payments</li>
                <li>Webhook signature key from Square Dashboard</li>
                <li>Real payment testing with activated account</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-blue-600">🔗 Webhook Endpoint:</h4>
              <p className="mt-1 font-mono text-xs bg-gray-100 p-2 rounded">
                https://handlesquarewebhook-ujhrfiueia-uc.a.run.app
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-purple-600">🗂️ Database Collections:</h4>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li><code>payments</code> - Payment records</li>
                <li><code>leagueMemberships</code> - Membership status</li>
                <li><code>membershipEvents</code> - Membership history</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

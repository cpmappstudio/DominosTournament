import React, { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

const TestMembershipAdmin: React.FC = () => {
  const [leagueId, setLeagueId] = useState('');
  const [userId, setUserId] = useState('');
  const [status, setStatus] = useState('inactive');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const setMembershipStatus = httpsCallable(functions, 'setMembershipStatus');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!leagueId.trim() || !userId.trim()) {
      setMessage('Please enter both League ID and User ID');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const result = await setMembershipStatus({
        leagueId: leagueId.trim(),
        userId: userId.trim(),
        status: status
      });

      const data = result.data as any;
      setMessage(`Success: ${data.message}`);
      
      // Clear form
      setLeagueId('');
      setUserId('');
      
    } catch (error: any) {
      console.error('Error changing membership status:', error);
      setMessage(`Error: ${error.message || 'Failed to change membership status'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <h2 className="text-xl font-bold text-yellow-800 mb-2">⚠️ Admin Testing Tool</h2>
        <p className="text-yellow-700 text-sm">
          This is a development tool for testing membership status changes. 
          Use carefully as it directly modifies database records.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold mb-6">Test Membership Status</h1>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">League ID</label>
            <input
              type="text"
              value={leagueId}
              onChange={(e) => setLeagueId(e.target.value)}
              placeholder="Enter league ID"
              className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">User ID</label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Enter user ID"
              className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">New Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 px-4 rounded-md font-medium ${
              loading
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {loading ? 'Changing Status...' : 'Change Membership Status'}
          </button>
        </form>

        {message && (
          <div className={`mt-4 p-3 rounded-md ${
            message.startsWith('Error') 
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-green-50 text-green-700 border border-green-200'
          }`}>
            {message}
          </div>
        )}

        <div className="mt-6 text-sm text-gray-600">
          <h3 className="font-medium mb-2">How to get IDs:</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>League ID: Check the URL when viewing a league (e.g., /leagues/LEAGUE_ID)</li>
            <li>User ID: Open browser dev tools → Console → type `auth.currentUser.uid`</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default TestMembershipAdmin;

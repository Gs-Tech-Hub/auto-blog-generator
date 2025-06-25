import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navigation from './Navigation';
import { useUser } from '../context/UserContext';

const ScheduledPage = () => {
  const { user } = useUser();
  const [scheduledConfigs, setScheduledConfigs] = useState([]);
  const API_BASE = import.meta.env.VITE_API_BASE_URL;
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    const fetchScheduledConfigs = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE}/configs`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (res.status === 401) {
          navigate('/login');
          return;
        }
        const data = await res.json();
        if (data.success) {
          // Filter configs that are scheduled but not yet run
          setScheduledConfigs(data.configs.filter(cfg => cfg.scheduleTime && !cfg.hasRun));
        }
      } catch (err) {
        // handle error
      }
    };
    fetchScheduledConfigs();
  }, [API_BASE, user, navigate]);

  if (!user) return null;

  return (
    <div className="container">
      <Navigation />
      <h2>Scheduled Blog Posts</h2>
      <div className="card">
        {scheduledConfigs && scheduledConfigs.length === 0 ? (
          <p>No scheduled posts found.</p>
        ) : scheduledConfigs && scheduledConfigs.length > 0 ? (
          <ul>
            {scheduledConfigs.map((cfg, idx) => (
              <li key={cfg.id || idx}>
                <strong>{cfg.keywords?.[0] || 'Untitled'}</strong> - Scheduled for: {cfg.scheduleTime}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-400 italic">No data available.</p>
        )}
      </div>
    </div>
  );
};

export default ScheduledPage;

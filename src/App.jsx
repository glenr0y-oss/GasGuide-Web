import { useState } from 'react';
import { VehicleProvider } from './context/VehicleContext';
import { ProProvider, usePro } from './context/ProContext';
import TripCostScreen from './screens/TripCostScreen';
import StationMapScreen from './screens/StationMapScreen';
import VehicleProfileScreen from './screens/VehicleProfileScreen';
import SettingsScreen from './screens/SettingsScreen';
import './theme.css';
import './App.css';

const TABS = [
  { id: 'trip', label: 'Trip Cost', icon: '⛽', Component: TripCostScreen },
  { id: 'map', label: 'Stations', icon: '📍', Component: StationMapScreen },
  { id: 'vehicle', label: 'Vehicle', icon: '🚗', Component: VehicleProfileScreen },
  { id: 'settings', label: 'Settings', icon: '⚙️', Component: SettingsScreen },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('trip');
  const ActiveScreen = TABS.find((t) => t.id === activeTab).Component;

  return (
    <ProProvider>
      <VehicleProvider>
        <AppShell activeTab={activeTab} setActiveTab={setActiveTab} ActiveScreen={ActiveScreen} />
      </VehicleProvider>
    </ProProvider>
  );
}

function AppShell({ activeTab, setActiveTab, ActiveScreen }) {
  const { isPro } = usePro();

  return (
    <div className={`app-shell ${isPro ? 'pro-theme' : ''}`}>
      <header className="app-header">
        <img src="/icon.png" alt="" className="app-logo" />
        <span className="app-title">GasGuide</span>
      </header>

      <main className="app-content">
        <ActiveScreen />
      </main>

      <nav className="tab-bar">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

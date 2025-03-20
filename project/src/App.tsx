import React from 'react';
import { Layout } from './components/Layout';
import { SettingsForm } from './components/SettingsForm';
import { ChapterList } from './components/ChapterList';

function App() {
  const [activeTab, setActiveTab] = React.useState<'settings' | 'chapters'>('settings');

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'settings' ? (
        <SettingsForm />
      ) : (
        <ChapterList />
      )}
    </Layout>
  );
}

export default App;
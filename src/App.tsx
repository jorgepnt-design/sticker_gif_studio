import { useEffect } from 'react';
import { useRoute } from './lib/router';
import { loadSettings, applyTheme } from './lib/settings';
import { ToastProvider } from './components/Toast';
import { BottomNav } from './components/BottomNav';
import { HomePage } from './pages/Home';
import { CreatePage } from './pages/Create';
import { ProjectsPage } from './pages/Projects';
import { TemplatesPage } from './pages/Templates';
import { SettingsPage } from './pages/Settings';
import { CompressPage } from './pages/Compress';
import { EditorPage } from './pages/editor/Editor';

export default function App() {
  const route = useRoute();

  // Theme beim Start und bei Systemwechsel anwenden
  useEffect(() => {
    applyTheme(loadSettings().theme);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme(loadSettings().theme);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Editor läuft im Vollbild ohne untere Navigation
  if (route.path === '/editor') {
    return (
      <ToastProvider>
        <EditorPage params={route.params} />
      </ToastProvider>
    );
  }

  const page = (() => {
    switch (route.path) {
      case '/create':
        return <CreatePage />;
      case '/projects':
        return <ProjectsPage />;
      case '/templates':
        return <TemplatesPage />;
      case '/settings':
        return <SettingsPage />;
      case '/compress':
        return <CompressPage />;
      default:
        return <HomePage />;
    }
  })();

  return (
    <ToastProvider>
      <div className="mx-auto min-h-dvh max-w-lg pb-24">{page}</div>
      <BottomNav current={route.path === '/compress' ? '/create' : route.path} />
    </ToastProvider>
  );
}

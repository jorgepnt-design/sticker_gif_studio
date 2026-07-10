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
import { LibraryPage } from './pages/Library';
import { PackDetailPage } from './pages/PackDetail';
import { Gif2Mp4Page } from './pages/Gif2Mp4';
import { EditorPage } from './pages/editor/Editor';
import { GifStudioPage } from './pages/GifStudio';

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

  // Editor und GIF-Studio laufen im Vollbild ohne untere Navigation
  if (route.path === '/editor') {
    return (
      <ToastProvider>
        <EditorPage params={route.params} />
      </ToastProvider>
    );
  }
  if (route.path === '/gif') {
    return (
      <ToastProvider>
        <GifStudioPage params={route.params} />
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
      case '/library':
        return <LibraryPage />;
      case '/pack':
        return <PackDetailPage params={route.params} />;
      case '/gif2mp4':
        return <Gif2Mp4Page />;
      default:
        return <HomePage />;
    }
  })();

  // Unterseiten dem passenden Tab in der Navigation zuordnen
  const navCurrent =
    route.path === '/compress' || route.path === '/gif2mp4'
      ? '/create'
      : route.path === '/library' || route.path === '/pack'
        ? '/projects'
        : route.path;

  return (
    <ToastProvider>
      <div className="mx-auto min-h-dvh max-w-lg pb-24">{page}</div>
      <BottomNav current={navCurrent} />
    </ToastProvider>
  );
}

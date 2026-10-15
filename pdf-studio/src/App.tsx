import { useRoute } from './lib/router';
import { ToastProvider } from './components/Toast';
import { HomePage } from './pages/Home';
import { ImagesToPdfPage } from './pages/ImagesToPdf';
import { MergePage } from './pages/Merge';
import { OrganizePage } from './pages/Organize';
import { CompressPage } from './pages/Compress';
import { PdfToImagesPage } from './pages/PdfToImages';
import { FillSignPage } from './pages/fill-sign/FillSign';

export default function App() {
  const path = useRoute();
  const page = (() => {
    switch (path) {
      case '/images-to-pdf':
        return <ImagesToPdfPage />;
      case '/merge':
        return <MergePage />;
      case '/organize':
        return <OrganizePage />;
      case '/compress':
        return <CompressPage />;
      case '/pdf-to-images':
        return <PdfToImagesPage />;
      case '/fill-sign':
        return <FillSignPage />;
      default:
        return <HomePage />;
    }
  })();
  // key erzwingt frischen Zustand beim Wechsel des Werkzeugs
  return (
    <ToastProvider>
      <div key={path} className="min-h-dvh">
        {page}
      </div>
    </ToastProvider>
  );
}

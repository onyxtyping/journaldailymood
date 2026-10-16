import { t } from '../i18n/uk';
import { bootError, ready, route } from './store';
import { TabBar } from './components/TabBar';
import { ToastView } from './components/ToastView';
import { UpdateBanner } from './components/UpdateBanner';
import { CaptureScreen } from './screens/CaptureScreen';
import { JournalScreen } from './screens/JournalScreen';
import { PendingScreen } from './screens/PendingScreen';
import { TodayScreen } from './screens/TodayScreen';
import { ReportScreen } from './screens/ReportScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { EditScreen } from './screens/EditScreen';
import { CheckpointScreen } from './screens/CheckpointScreen';
import { CategoriesScreen, CategoryEditScreen } from './screens/CategoriesScreen';
import { DirectoryScreen } from './screens/DirectoryScreen';

export function App() {
  if (bootError.value) {
    return (
      <div class="boot">
        <p>{t.appName}: помилка запуску</p>
        <pre>{bootError.value}</pre>
      </div>
    );
  }
  if (!ready.value) return <div class="boot" />;

  const r = route.value;
  let screen;
  switch (r.name) {
    case 'journal':
      screen = <JournalScreen />;
      break;
    case 'pending':
      screen = <PendingScreen />;
      break;
    case 'today':
      screen = <TodayScreen />;
      break;
    case 'report':
      screen = <ReportScreen />;
      break;
    case 'settings':
      screen = <SettingsScreen />;
      break;
    case 'edit':
      screen = <EditScreen key={r.id} id={r.id ?? ''} />;
      break;
    case 'checkpoint':
      screen = <CheckpointScreen />;
      break;
    case 'categories':
      screen = <CategoriesScreen />;
      break;
    case 'category':
      screen = <CategoryEditScreen key={r.id} id={r.id ?? 'new'} />;
      break;
    case 'directory':
      screen = <DirectoryScreen key={r.id} table={r.id ?? 'people'} />;
      break;
    default:
      screen = <CaptureScreen />;
  }

  return (
    <div class="shell">
      <main class="main">{screen}</main>
      <UpdateBanner />
      <ToastView />
      <TabBar />
    </div>
  );
}

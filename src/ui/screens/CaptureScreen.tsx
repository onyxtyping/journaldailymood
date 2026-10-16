import { t } from '../../i18n/uk';
import { Header } from '../components/Header';
import { CaptureForm } from '../components/CaptureForm';

export function CaptureScreen() {
  return (
    <div class="screen capture">
      <Header title={t.capture.title} />
      <div class="content">
        <CaptureForm draftKey="journal.captureDraft" />
      </div>
    </div>
  );
}

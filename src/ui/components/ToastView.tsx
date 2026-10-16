import { toast } from '../store';

export function ToastView() {
  const tt = toast.value;
  if (!tt) return null;
  return (
    <div class="toast" role="status" key={tt.id}>
      <span>{tt.msg}</span>
      {tt.action && (
        <button
          class="toast-action"
          onClick={() => {
            tt.action!.run();
            toast.value = null;
          }}
        >
          {tt.action.label}
        </button>
      )}
    </div>
  );
}

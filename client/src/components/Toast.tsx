import { useEffect } from 'react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type = 'info', onClose, duration = 5000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const bgColor = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-blue-600',
    warning: 'bg-yellow-600',
  }[type];

  const icon = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️',
  }[type];

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
      <div className={`${bgColor} text-white px-4 py-3 rounded-lg shadow-lg max-w-md flex items-start gap-3`}>
        <span className="text-xl flex-shrink-0">{icon}</span>
        <p className="text-sm flex-1">{message}</p>
        <button
          onClick={onClose}
          className="text-white hover:text-gray-200 flex-shrink-0 text-lg leading-none"
        >
          ×
        </button>
      </div>
    </div>
  );
}

import { useTranslation } from 'react-i18next';

export default function AuthStatusScreen({ message }: { message: string }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex items-center gap-3 text-gray-600">
        <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium">{message || t('common.checkingAccount')}</span>
      </div>
    </div>
  );
}

import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const AuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { fetchUser } = useAuthStore();
  const { t } = useTranslation();

  useEffect(() => {
    const accessToken = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');
    const status = searchParams.get('status');

    if (accessToken && refreshToken) {
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('refresh_token', refreshToken);
      fetchUser().then(() => {
        if (status === 'pending') {
          navigate('/pending-approval');
        } else {
          navigate('/');
        }
      });
    } else {
      navigate('/login');
    }
  }, [searchParams, navigate, fetchUser]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-10 h-10 text-[#F37021] animate-spin mx-auto mb-4" />
        <p className="text-slate-500 font-medium">{t('auth:callback.loading')}</p>
      </div>
    </div>
  );
};

export default AuthCallback;

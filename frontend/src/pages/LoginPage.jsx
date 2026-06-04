import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Terminal, Eye, EyeOff, Loader2 } from 'lucide-react';
import Toast from '../components/Toast';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const onSubmit = async (data) => {
    setLoading(true);
    const result = await login(data.email, data.password);
    setLoading(false);

    if (result.success) {
      navigate('/dashboard');
    } else {
      setToast({ message: result.error, type: 'error' });
    }
  };

  return (
    <div className="relative min-h-screen bg-dark-950 flex flex-col justify-center items-center p-6 text-gray-100 overflow-y-auto">
      {/* Decorative Blur Blobs */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-brand-purple/10 rounded-full blur-[100px] z-0 animate-pulse-slow"></div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Main card */}
      <div className="relative z-10 w-full max-w-md bg-dark-900 border border-white/5 p-8 rounded-2xl shadow-2xl glass">
        {/* Branding header */}
        <div className="flex flex-col items-center mb-8">
          <Link to="/" className="flex items-center gap-2 mb-3">
            <div className="bg-gradient-to-tr from-brand-purple to-brand-violet p-2 rounded-xl text-white shadow-lg">
              <Terminal className="w-5 h-5" />
            </div>
            <span className="text-xl font-bold tracking-tight">
              Dev<span className="text-brand-purple">Sandbox</span>
            </span>
          </Link>
          <h2 className="text-xl font-semibold text-gray-200">Sign in to your account</h2>
          <p className="text-xs text-gray-500 mt-1.5">Welcome back! Please enter your details.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
          {/* Email field */}
          <div className="flex flex-col gap-1.5 text-left">
            <label className="text-xs font-semibold text-gray-400">Email Address</label>
            <input
              type="email"
              placeholder="developer@compiler.com"
              {...register('email', {
                required: 'Email is required',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Invalid email address',
                },
              })}
              className={`w-full px-4 py-3 rounded-xl bg-dark-950 border text-sm focus:outline-none focus:ring-1 transition-all ${
                errors.email
                  ? 'border-rose-500 focus:ring-rose-500 focus:border-rose-500'
                  : 'border-white/10 focus:ring-brand-purple focus:border-brand-purple'
              }`}
            />
            {errors.email && (
              <span className="text-rose-400 text-[10px] font-medium mt-1">
                {errors.email.message}
              </span>
            )}
          </div>

          {/* Password field */}
          <div className="flex flex-col gap-1.5 text-left">
            <label className="text-xs font-semibold text-gray-400">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                {...register('password', {
                  required: 'Password is required',
                  minLength: {
                    value: 6,
                    message: 'Password must be at least 6 characters',
                  },
                })}
                className={`w-full px-4 py-3 rounded-xl bg-dark-950 border text-sm focus:outline-none focus:ring-1 transition-all ${
                  errors.password
                    ? 'border-rose-500 focus:ring-rose-500 focus:border-rose-500'
                    : 'border-white/10 focus:ring-brand-purple focus:border-brand-purple'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3.5 text-gray-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && (
              <span className="text-rose-400 text-[10px] font-medium mt-1">
                {errors.password.message}
              </span>
            )}
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center bg-gradient-to-r from-brand-purple to-brand-violet hover:opacity-95 text-sm font-semibold tracking-wide py-3.5 rounded-xl mt-4 shadow-lg shadow-brand-purple/20 transition-all duration-300 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin text-white" />
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-gray-500">
          Don't have an account?{' '}
          <Link to="/register" className="text-brand-purple hover:underline font-semibold">
            Register for free
          </Link>
        </p>
      </div>
    </div>
  );
}

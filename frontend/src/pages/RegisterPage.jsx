import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Terminal, Eye, EyeOff, Loader2 } from 'lucide-react';
import Toast from '../components/Toast';

export default function RegisterPage() {
  const { register: authRegister } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm();

  const passwordVal = watch('password');

  const onSubmit = async (data) => {
    setLoading(true);
    const result = await authRegister(data.name, data.email, data.password);
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
        <div className="flex flex-col items-center mb-6">
          <Link to="/" className="flex items-center gap-2 mb-3">
            <div className="bg-gradient-to-tr from-brand-purple to-brand-violet p-2 rounded-xl text-white shadow-lg">
              <Terminal className="w-5 h-5" />
            </div>
            <span className="text-xl font-bold tracking-tight">
              Dev<span className="text-brand-purple">Sandbox</span>
            </span>
          </Link>
          <h2 className="text-xl font-semibold text-gray-200">Create your account</h2>
          <p className="text-xs text-gray-500 mt-1.5">Set up your workspace and get coding.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {/* Name field */}
          <div className="flex flex-col gap-1 text-left">
            <label className="text-xs font-semibold text-gray-400">Full Name</label>
            <input
              type="text"
              placeholder="Ada Lovelace"
              {...register('name', {
                required: 'Name is required',
                minLength: {
                  value: 2,
                  message: 'Name must be at least 2 characters',
                },
              })}
              className={`w-full px-4 py-2.5 rounded-xl bg-dark-950 border text-sm focus:outline-none focus:ring-1 transition-all ${
                errors.name
                  ? 'border-rose-500 focus:ring-rose-500 focus:border-rose-500'
                  : 'border-white/10 focus:ring-brand-purple focus:border-brand-purple'
              }`}
            />
            {errors.name && (
              <span className="text-rose-400 text-[10px] font-medium mt-0.5">
                {errors.name.message}
              </span>
            )}
          </div>

          {/* Email field */}
          <div className="flex flex-col gap-1 text-left">
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
              className={`w-full px-4 py-2.5 rounded-xl bg-dark-950 border text-sm focus:outline-none focus:ring-1 transition-all ${
                errors.email
                  ? 'border-rose-500 focus:ring-rose-500 focus:border-rose-500'
                  : 'border-white/10 focus:ring-brand-purple focus:border-brand-purple'
              }`}
            />
            {errors.email && (
              <span className="text-rose-400 text-[10px] font-medium mt-0.5">
                {errors.email.message}
              </span>
            )}
          </div>

          {/* Password field */}
          <div className="flex flex-col gap-1 text-left">
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
                className={`w-full px-4 py-2.5 rounded-xl bg-dark-950 border text-sm focus:outline-none focus:ring-1 transition-all ${
                  errors.password
                    ? 'border-rose-500 focus:ring-rose-500 focus:border-rose-500'
                    : 'border-white/10 focus:ring-brand-purple focus:border-brand-purple'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3 text-gray-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && (
              <span className="text-rose-400 text-[10px] font-medium mt-0.5">
                {errors.password.message}
              </span>
            )}
          </div>

          {/* Confirm Password field */}
          <div className="flex flex-col gap-1 text-left">
            <label className="text-xs font-semibold text-gray-400">Confirm Password</label>
            <input
              type="password"
              placeholder="••••••••"
              {...register('confirmPassword', {
                required: 'Please confirm your password',
                validate: (value) =>
                  value === passwordVal || 'The passwords do not match',
              })}
              className={`w-full px-4 py-2.5 rounded-xl bg-dark-950 border text-sm focus:outline-none focus:ring-1 transition-all ${
                errors.confirmPassword
                  ? 'border-rose-500 focus:ring-rose-500 focus:border-rose-500'
                  : 'border-white/10 focus:ring-brand-purple focus:border-brand-purple'
              }`}
            />
            {errors.confirmPassword && (
              <span className="text-rose-400 text-[10px] font-medium mt-0.5">
                {errors.confirmPassword.message}
              </span>
            )}
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center bg-gradient-to-r from-brand-purple to-brand-violet hover:opacity-95 text-sm font-semibold tracking-wide py-3 rounded-xl mt-3 shadow-lg shadow-brand-purple/20 transition-all duration-300 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin text-white" />
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-500">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-purple hover:underline font-semibold">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}

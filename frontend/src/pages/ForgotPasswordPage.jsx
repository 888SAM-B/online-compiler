import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { Terminal, KeyRound, Mail, Lock, ShieldCheck, Loader2, ArrowRight, RefreshCw } from 'lucide-react';
import Toast from '../components/Toast';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Email, 2: OTP, 3: Reset
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes count
  const [resendDisabled, setResendDisabled] = useState(true);

  const {
    register: emailRegister,
    handleSubmit: handleEmailSubmit,
    formState: { errors: emailErrors },
  } = useForm();

  const {
    register: otpRegister,
    handleSubmit: handleOtpSubmit,
    formState: { errors: otpErrors },
  } = useForm();

  const {
    register: passwordRegister,
    handleSubmit: handlePasswordSubmit,
    watch: passwordWatch,
    formState: { errors: passwordErrors },
  } = useForm();

  const watchNewPassword = passwordWatch('newPassword');

  // Countdown timer for Step 2
  useEffect(() => {
    if (step !== 2) return;
    if (timeLeft <= 0) {
      setResendDisabled(false);
      return;
    }

    // Enable resend button after 1 minute (540 seconds remaining)
    if (timeLeft <= 540) {
      setResendDisabled(false);
    } else {
      setResendDisabled(true);
    }

    const timer = setTimeout(() => {
      setTimeLeft(timeLeft - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [timeLeft, step]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Step 1: Send OTP
  const onEmailSubmit = async (data) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email: data.email });
      setEmail(data.email);
      setToast({ message: res.data.message || 'OTP sent successfully', type: 'success' });
      setStep(2);
      setTimeLeft(600);
      setResendDisabled(true);
    } catch (err) {
      setToast({
        message: err.response?.data?.detail || 'Failed to send OTP. Please try again.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP handler
  const handleResendOtp = async () => {
    if (resendDisabled) return;
    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email });
      setToast({ message: 'A new OTP has been sent to your email.', type: 'success' });
      setTimeLeft(600);
      setResendDisabled(true);
    } catch (err) {
      setToast({
        message: err.response?.data?.detail || 'Failed to resend OTP. Please try again.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const onOtpSubmit = async (data) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/verify-otp', { email, otp: data.otp });
      if (res.data.valid) {
        setOtp(data.otp);
        setToast({ message: 'OTP verified successfully.', type: 'success' });
        setStep(3);
      }
    } catch (err) {
      setToast({
        message: err.response?.data?.detail || 'Invalid or expired OTP.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Reset Password
  const onPasswordSubmit = async (data) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/reset-password', {
        email,
        otp,
        new_password: data.newPassword,
      });
      setToast({ message: res.data.message || 'Password reset successful!', type: 'success' });
      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setToast({
        message: err.response?.data?.detail || 'Failed to reset password.',
        type: 'error',
      });
    } finally {
      setLoading(false);
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
              DYC <span className="text-brand-purple">CODING CAMPUS</span>
            </span>
          </Link>
          <h2 className="text-xl font-semibold text-gray-200">Reset your password</h2>
          <p className="text-xs text-gray-500 mt-1.5 text-center">
            {step === 1 && "Enter your email address and we'll send you an OTP code."}
            {step === 2 && `Enter the 6-digit OTP code sent to ${email}.`}
            {step === 3 && "Create a secure new password for your account."}
          </p>
        </div>

        {/* Step 1: Email Input Form */}
        {step === 1 && (
          <form onSubmit={handleEmailSubmit(onEmailSubmit)} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-xs font-semibold text-gray-400">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 text-gray-500 w-4 h-4" />
                <input
                  type="email"
                  placeholder="developer@compiler.com"
                  {...emailRegister('email', {
                    required: 'Email is required',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Invalid email address',
                    },
                  })}
                  className={`w-full pl-10 pr-4 py-3 rounded-xl bg-dark-950 border text-sm focus:outline-none focus:ring-1 transition-all ${
                    emailErrors.email
                      ? 'border-rose-500 focus:ring-rose-500'
                      : 'border-white/10 focus:ring-brand-purple focus:border-brand-purple'
                  }`}
                />
              </div>
              {emailErrors.email && (
                <span className="text-rose-400 text-[10px] font-medium mt-1">
                  {emailErrors.email.message}
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center bg-gradient-to-r from-brand-purple to-brand-violet hover:opacity-95 text-sm font-semibold tracking-wide py-3.5 rounded-xl mt-4 shadow-lg shadow-brand-purple/20 transition-all duration-300 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin text-white" />
              ) : (
                <>
                  Send OTP
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Step 2: OTP Verification Form */}
        {step === 2 && (
          <form onSubmit={handleOtpSubmit(onOtpSubmit)} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-xs font-semibold text-gray-400">One-Time Password (OTP)</label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-3.5 text-gray-500 w-4 h-4" />
                <input
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  {...otpRegister('otp', {
                    required: 'OTP is required',
                    minLength: { value: 6, message: 'OTP must be exactly 6 digits' },
                    maxLength: { value: 6, message: 'OTP must be exactly 6 digits' },
                    pattern: { value: /^\d+$/, message: 'OTP must contain only numbers' },
                  })}
                  className={`w-full pl-10 pr-4 py-3 rounded-xl bg-dark-950 border text-sm tracking-[4px] font-mono text-center focus:outline-none focus:ring-1 transition-all ${
                    otpErrors.otp
                      ? 'border-rose-500 focus:ring-rose-500'
                      : 'border-white/10 focus:ring-brand-purple focus:border-brand-purple'
                  }`}
                />
              </div>
              {otpErrors.otp && (
                <span className="text-rose-400 text-[10px] font-medium mt-1">
                  {otpErrors.otp.message}
                </span>
              )}
            </div>

            {/* Countdown timer & resend link */}
            <div className="flex items-center justify-between text-xs text-gray-400 px-1">
              <span>
                Expires in: <strong className={timeLeft < 60 ? "text-rose-400" : "text-brand-purple"}>{formatTime(timeLeft)}</strong>
              </span>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendDisabled || loading}
                className={`flex items-center gap-1 font-semibold hover:underline transition ${
                  resendDisabled ? 'text-gray-600 cursor-not-allowed' : 'text-brand-purple'
                }`}
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                Resend OTP
              </button>
            </div>

            <button
              type="submit"
              disabled={loading || timeLeft <= 0}
              className="w-full flex items-center justify-center bg-gradient-to-r from-brand-purple to-brand-violet hover:opacity-95 text-sm font-semibold tracking-wide py-3.5 rounded-xl mt-4 shadow-lg shadow-brand-purple/20 transition-all duration-300 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin text-white" />
              ) : (
                <>
                  Verify OTP
                  <ShieldCheck className="w-4 h-4 ml-1.5" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Step 3: Password Reset Form */}
        {step === 3 && (
          <form onSubmit={handlePasswordSubmit(onPasswordSubmit)} className="flex flex-col gap-4">
            {/* New Password field */}
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-xs font-semibold text-gray-400">New Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 text-gray-500 w-4 h-4" />
                <input
                  type="password"
                  placeholder="••••••••"
                  {...passwordRegister('newPassword', {
                    required: 'New password is required',
                    minLength: {
                      value: 6,
                      message: 'Password must be at least 6 characters',
                    },
                  })}
                  className={`w-full pl-10 pr-4 py-3 rounded-xl bg-dark-950 border text-sm focus:outline-none focus:ring-1 transition-all ${
                    passwordErrors.newPassword
                      ? 'border-rose-500 focus:ring-rose-500'
                      : 'border-white/10 focus:ring-brand-purple focus:border-brand-purple'
                  }`}
                />
              </div>
              {passwordErrors.newPassword && (
                <span className="text-rose-400 text-[10px] font-medium mt-1">
                  {passwordErrors.newPassword.message}
                </span>
              )}
            </div>

            {/* Confirm Password field */}
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-xs font-semibold text-gray-400">Confirm New Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 text-gray-500 w-4 h-4" />
                <input
                  type="password"
                  placeholder="••••••••"
                  {...passwordRegister('confirmPassword', {
                    required: 'Confirm password is required',
                    validate: (value) =>
                      value === watchNewPassword || 'The passwords do not match',
                  })}
                  className={`w-full pl-10 pr-4 py-3 rounded-xl bg-dark-950 border text-sm focus:outline-none focus:ring-1 transition-all ${
                    passwordErrors.confirmPassword
                      ? 'border-rose-500 focus:ring-rose-500'
                      : 'border-white/10 focus:ring-brand-purple focus:border-brand-purple'
                  }`}
                />
              </div>
              {passwordErrors.confirmPassword && (
                <span className="text-rose-400 text-[10px] font-medium mt-1">
                  {passwordErrors.confirmPassword.message}
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center bg-gradient-to-r from-brand-purple to-brand-violet hover:opacity-95 text-sm font-semibold tracking-wide py-3.5 rounded-xl mt-4 shadow-lg shadow-brand-purple/20 transition-all duration-300 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin text-white" />
              ) : (
                'Reset Password'
              )}
            </button>
          </form>
        )}

        {/* Footer Link */}
        <p className="mt-8 text-center text-xs text-gray-500">
          Back to{' '}
          <Link to="/login" className="text-brand-purple hover:underline font-semibold">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}

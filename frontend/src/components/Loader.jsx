import React from 'react';

export default function Loader({ fullScreen = false, size = 'md' }) {
  const sizeClasses = {
    sm: 'w-6 h-6 border-2',
    md: 'w-10 h-10 border-3',
    lg: 'w-16 h-16 border-4',
  };

  const spinner = (
    <div className="relative flex items-center justify-center">
      {/* Outer Glow Spinner */}
      <div className={`rounded-full border-t-brand-purple border-r-brand-violet border-b-transparent border-l-transparent animate-spin ${sizeClasses[size]}`}></div>
      {/* Inner accent ring */}
      <div className={`absolute rounded-full border-t-transparent border-r-transparent border-b-brand-teal border-l-brand-teal animate-spin-reverse opacity-70 ${size === 'lg' ? 'w-10 h-10 border-2' : size === 'md' ? 'w-6 h-6 border-2' : 'w-4 h-4 border'}`}></div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-dark-950/80 backdrop-blur-md">
        {spinner}
        <p className="mt-4 text-sm font-medium tracking-wide text-gray-400 animate-pulse">
          Loading Sandbox environment...
        </p>
      </div>
    );
  }

  return spinner;
}

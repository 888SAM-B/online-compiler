import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Terminal, Shield, Cpu, Zap, ArrowRight, Code } from 'lucide-react';

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="relative min-h-screen bg-dark-950 text-gray-100 overflow-x-hidden flex flex-col justify-between">
      {/* Decorative Blur Blobs */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-purple/10 rounded-full blur-[120px] animate-pulse-slow z-0"></div>
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[500px] h-[500px] bg-brand-teal/5 rounded-full blur-[120px] animate-pulse-slow-reverse z-0"></div>

      {/* Header */}
      <nav className="relative z-10 max-w-7xl mx-auto w-full px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-gradient-to-tr from-brand-purple to-brand-violet p-2 rounded-xl text-white shadow-lg">
            <Terminal className="w-5 h-5" />
          </div>
          <span className="text-xl font-bold tracking-tight">
            DYC <span className="text-brand-purple">CODING CAMPUS</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          {user ? (
            <Link
              to="/dashboard"
              className="bg-brand-purple hover:bg-brand-purple/95 px-5 py-2 rounded-xl text-sm font-semibold tracking-wide shadow-lg shadow-brand-purple/20 transition-all duration-300"
            >
              Console Dashboard
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="text-gray-400 hover:text-white text-sm font-semibold transition"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-xl text-sm font-semibold transition"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 max-w-7xl mx-auto w-full px-6 py-16 flex-1 flex flex-col lg:flex-row items-center justify-center gap-16">
        <div className="flex-1 flex flex-col text-left lg:max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-purple/10 border border-brand-purple/20 text-brand-purple text-xs font-semibold mb-6 self-start">
            <Code className="w-3.5 h-3.5" />
            Isolated Docker Execution Engine
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.15] bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
            Write, Compile & Run Code <span className="bg-gradient-to-r from-brand-purple to-brand-violet bg-clip-text text-transparent">In The Cloud</span>
          </h1>
          <p className="mt-6 text-base sm:text-lg text-gray-400 leading-relaxed">
            Execute Python, Node.js, C, C++, and Java inside fully isolated, resource-constrained container environments. High performance, premium editor experience, and deep admin analytics.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              to={user ? "/dashboard" : "/register"}
              className="group flex items-center gap-2 bg-gradient-to-r from-brand-purple to-brand-violet hover:opacity-95 px-6 py-3.5 rounded-xl font-semibold text-sm shadow-xl shadow-brand-purple/20 transition-all duration-300"
            >
              Get Started Coding
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            {!user && (
              <Link
                to="/login"
                className="flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 px-6 py-3.5 rounded-xl font-semibold text-sm transition"
              >
                Explore Workspace
              </Link>
            )}
          </div>
        </div>

        {/* Floating Mock Editor Card */}
        <div className="flex-1 w-full max-w-lg lg:max-w-none">
          <div className="glass rounded-2xl overflow-hidden border border-white/10 shadow-2xl p-6 relative">
            {/* Window Dots */}
            <div className="flex gap-1.5 mb-4 border-b border-white/5 pb-3">
              <span className="w-3 h-3 rounded-full bg-rose-500/80"></span>
              <span className="w-3 h-3 rounded-full bg-amber-500/80"></span>
              <span className="w-3 h-3 rounded-full bg-emerald-500/80"></span>
              <span className="text-xs text-gray-500 font-mono ml-4">main.cpp — C++20 Sandbox</span>
            </div>
            {/* Editor Code Snippet */}
            <pre className="font-mono text-sm text-gray-300 leading-relaxed overflow-x-auto">
              <span className="text-brand-purple">#include</span> <span className="text-emerald-400">&lt;iostream&gt;</span>{'\n'}
              <span className="text-brand-purple">using namespace</span> std;{'\n\n'}
              <span className="text-brand-purple">int</span> <span className="text-blue-400">main</span>() {'{'}{'\n'}
              {'  '}cout &lt;&lt; <span className="text-amber-400">"Deploying container..."</span> &lt;&lt; endl;{'\n'}
              {'  '}<span className="text-brand-purple">int</span> result = <span className="text-brand-teal">256</span>;{'\n'}
              {'  '}cout &lt;&lt; <span className="text-amber-400">"Memory Limits: "</span> &lt;&lt; result &lt;&lt; <span className="text-amber-400">"MB"</span> &lt;&lt; endl;{'\n'}
              {'  '}<span className="text-brand-purple">return</span> <span className="text-brand-teal">0</span>;{'\n'}
              {'}'}
            </pre>
            {/* Terminal Preview inside code card */}
            <div className="mt-6 border-t border-white/5 pt-4 font-mono text-xs text-brand-green">
              <div className="flex justify-between text-gray-500 mb-1">
                <span>Output Console</span>
                <span>Success (0.015s)</span>
              </div>
              <p className="text-gray-400">$ ./main</p>
              <p>Deploying container...</p>
              <p>Memory Limits: 256MB</p>
            </div>
          </div>
        </div>
      </main>

      {/* Features Grid */}
      <section className="relative z-10 max-w-7xl mx-auto w-full px-6 py-20 border-t border-white/5">
        <h2 className="text-3xl font-bold tracking-tight text-center mb-12">
          Engineered for Secure Code Execution
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="glass p-6 rounded-2xl flex flex-col gap-4">
            <div className="bg-brand-purple/10 text-brand-purple p-3 rounded-xl w-fit">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold">Secure Sandboxing</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Every execution runs in a isolated Docker container with strict CPU quotas, 256MB memory cap, network blocking, and pid restrictions.
            </p>
          </div>
          <div className="glass p-6 rounded-2xl flex flex-col gap-4">
            <div className="bg-brand-teal/10 text-brand-teal p-3 rounded-xl w-fit">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold">Multi-Language Compilation</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Native support for C, C++, Python, Java, and JavaScript. The engine takes care of staging, compilation, and environment configurations.
            </p>
          </div>
          <div className="glass p-6 rounded-2xl flex flex-col gap-4">
            <div className="bg-brand-green/10 text-brand-green p-3 rounded-xl w-fit">
              <Cpu className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold">Developer Analytics</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Built-in dashboards logging system actions, compile outputs, runtime execution history, and language utilization metrics.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 text-center text-xs text-gray-500 relative z-10">
        &copy; {new Date().getFullYear()} DYC CODING CAMPUS Online Compiler. Built with FastAPI, Docker SDK, and React.
      </footer>
    </div>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import 'xterm/css/xterm.css';
import { Play, Square, Trash2, Copy, RefreshCw, Download, Wifi, WifiOff } from 'lucide-react';
import { getWebSocketUrl, stopSession } from '../services/terminalService';

export default function InteractiveTerminal({ sessionId, language, onStop, onRun, isRunningParent }) {
  const terminalRef = useRef(null);
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);
  const socketRef = useRef(null);
  
  const [status, setStatus] = useState('PENDING');
  const [connState, setConnState] = useState('DISCONNECTED'); // CONNECTED, DISCONNECTED, RECONNECTING
  const [outputBuffer, setOutputBuffer] = useState('');

  const connectWebSocket = () => {
    if (!sessionId) return;
    
    setConnState('RECONNECTING');
    setStatus('PENDING');

    if (socketRef.current) {
      socketRef.current.close();
    }

    const wsUrl = getWebSocketUrl(sessionId);
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      setConnState('CONNECTED');
      if (xtermRef.current) {
        xtermRef.current.write('\r\n\x1b[32m--- Terminal connected to sandbox ---\x1b[0m\r\n');
      }
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      const term = xtermRef.current;
      if (!term) return;

      if (msg.type === 'stdout') {
        term.write(msg.data);
        setOutputBuffer(prev => prev + msg.data);
      } else if (msg.type === 'stderr') {
        term.write('\x1b[31m' + msg.data + '\x1b[0m');
        setOutputBuffer(prev => prev + msg.data);
      } else if (msg.type === 'status') {
        setStatus(msg.status);
      } else if (msg.type === 'exit') {
        const color = msg.code === 0 ? '\x1b[32m' : '\x1b[31m';
        term.write(`\r\n${color}--- Program exited with code: ${msg.code} ---\x1b[0m\r\n`);
        setConnState('DISCONNECTED');
        setStatus(msg.code === 0 ? 'COMPLETED' : 'FAILED');
      }
    };

    ws.onclose = () => {
      setConnState('DISCONNECTED');
      if (status === 'RUNNING' || status === 'WAITING_FOR_INPUT' || status === 'PENDING') {
        setStatus('TERMINATED');
      }
    };

    ws.onerror = () => {
      setConnState('DISCONNECTED');
    };
  };

  useEffect(() => {
    // Initialize xterm
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'Fira Code', 'JetBrains Mono', monospace",
      theme: {
        background: '#09090b', // bg-dark-950
        foreground: '#e4e4e7', // text-gray-200
        cursor: '#a855f7', // brand-purple
        black: '#09090b',
        red: '#f43f5e',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#fafafa'
      },
      convertEol: true
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Send input to websocket
    const dataDisposable = term.onData((data) => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: 'stdin',
          data: data
        }));
      }
    });

    // Handle resize
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    };
    window.addEventListener('resize', handleResize);

    // Initial socket connection
    connectWebSocket();

    return () => {
      dataDisposable.dispose();
      window.removeEventListener('resize', handleResize);
      term.dispose();
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [sessionId]);

  // Handle key shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'c') {
        if (connState === 'CONNECTED') {
          e.preventDefault();
          handleStop();
        }
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        handleClear();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sessionId, connState]);

  const handleStop = async () => {
    if (!sessionId) return;
    try {
      await stopSession(sessionId);
      if (xtermRef.current) {
        xtermRef.current.write('\r\n\x1b[33m--- Termination signal sent ---\x1b[0m\r\n');
      }
      if (onStop) onStop();
    } catch (err) {
      console.error(err);
    }
  };

  const handleClear = () => {
    if (xtermRef.current) {
      xtermRef.current.clear();
      xtermRef.current.write('\x1b[H\x1b[2J');
    }
    setOutputBuffer('');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(outputBuffer);
  };

  const handleDownload = () => {
    const element = document.createElement('a');
    const file = new Blob([outputBuffer], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `terminal_output_${sessionId.substring(0, 6)}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const getStatusBadge = () => {
    const style = STATUS_STYLES[status] || "bg-gray-500/10 text-gray-400 border border-gray-500/20";
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${style}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  const getConnBadge = () => {
    if (connState === 'CONNECTED') {
      return (
        <span className="flex items-center gap-1 text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full font-medium">
          <Wifi className="w-3.5 h-3.5" />
          Connected
        </span>
      );
    }
    if (connState === 'RECONNECTING') {
      return (
        <span className="flex items-center gap-1 text-xs bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2.5 py-1 rounded-full font-medium animate-pulse">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          Reconnecting
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-xs bg-rose-500/10 border border-rose-500/20 text-rose-400 px-2.5 py-1 rounded-full font-medium">
        <WifiOff className="w-3.5 h-3.5" />
        Disconnected
      </span>
    );
  };

  const STATUS_STYLES = {
    PENDING: "bg-gray-500/10 text-gray-400 border border-gray-500/20",
    RUNNING: "bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse",
    WAITING_FOR_INPUT: "bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse",
    COMPLETED: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    FAILED: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
    TIMEOUT: "bg-red-500/10 text-red-400 border border-red-500/20",
    TERMINATED: "bg-gray-500/10 text-gray-500 border border-gray-500/20"
  };

  return (
    <div className="flex flex-col h-full bg-dark-900 border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
      {/* Terminal Title / Control Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-b border-white/5 bg-dark-950/40">
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold tracking-wide text-gray-300">Terminal</span>
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            {getConnBadge()}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onRun}
            disabled={isRunningParent}
            title="Run Code (Ctrl+Enter)"
            className="p-1.5 hover:bg-dark-800 rounded-lg text-emerald-400 hover:text-emerald-300 disabled:opacity-40 transition"
          >
            <Play className="w-4 h-4 fill-emerald-400/20" />
          </button>
          <button
            onClick={handleStop}
            disabled={connState !== 'CONNECTED'}
            title="Stop Execution (Ctrl+C)"
            className="p-1.5 hover:bg-dark-800 rounded-lg text-rose-400 hover:text-rose-300 disabled:opacity-40 transition"
          >
            <Square className="w-4 h-4 fill-rose-400/20" />
          </button>
          <button
            onClick={handleClear}
            title="Clear Console (Ctrl+L)"
            className="p-1.5 hover:bg-dark-800 rounded-lg text-gray-400 hover:text-white transition"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleCopy}
            disabled={!outputBuffer}
            title="Copy Output"
            className="p-1.5 hover:bg-dark-800 rounded-lg text-gray-400 hover:text-white disabled:opacity-40 transition"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={connectWebSocket}
            title="Reconnect Terminal"
            className="p-1.5 hover:bg-dark-800 rounded-lg text-gray-400 hover:text-white transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleDownload}
            disabled={!outputBuffer}
            title="Download Terminal Logs"
            className="p-1.5 hover:bg-dark-800 rounded-lg text-gray-400 hover:text-white disabled:opacity-40 transition"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Terminal View Container */}
      <div className="flex-1 min-h-0 bg-dark-950 p-4 relative">
        <div ref={terminalRef} className="w-full h-full" />
      </div>
    </div>
  );
}

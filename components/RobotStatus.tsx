
import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';

interface RobotStatusProps {
  logs: LogEntry[];
  currentTask: string;
  isProcessing: boolean;
  stats: {
    collected: number;
    actions: number;
  };
}

const RobotStatus: React.FC<RobotStatusProps> = ({ logs, currentTask, isProcessing, stats }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[600px]">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold text-gray-700">Terminal de Automação</h3>
          {isProcessing && <div className="text-xs text-purple-600 font-bold animate-pulse">PROCESSANDO...</div>}
        </div>
        
        <div ref={scrollRef} className="flex-1 bg-slate-900 p-4 font-mono text-sm overflow-y-auto">
          {logs.length === 0 ? (
            <div className="text-slate-500 italic">Aguardando início do robô...</div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="mb-1 leading-relaxed">
                <span className="text-slate-500">[{log.timestamp}]</span>{' '}
                <span className={
                  log.type === 'error' ? 'text-red-400' :
                  log.type === 'success' ? 'text-green-400' :
                  log.type === 'warning' ? 'text-yellow-400' :
                  'text-blue-300'
                }>
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Métricas Atuais</h4>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Perfis Coletados</span>
                <span className="font-bold text-purple-600">{stats.collected}</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="bg-purple-500 h-full transition-all duration-500" style={{ width: `${Math.min(stats.collected, 100)}%` }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Ações Realizadas</span>
                <span className="font-bold text-pink-600">{stats.actions}</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="bg-pink-500 h-full transition-all duration-500" style={{ width: `${Math.min(stats.actions, 100)}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Status do Robô</h4>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <div className={`w-3 h-3 rounded-full ${isProcessing ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
            <span className="text-sm font-medium text-gray-700">
              {isProcessing ? 'Operando' : 'Em espera'}
            </span>
          </div>
          {isProcessing && (
            <div className="mt-4">
              <span className="text-xs text-gray-500 block mb-1">Tarefa Atual:</span>
              <p className="text-sm text-gray-800 font-medium truncate">{currentTask}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RobotStatus;

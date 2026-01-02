
import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  userEmail: string;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, onLogout, userEmail }) => {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'accounts', label: 'Contas Sociais', icon: '🔑' },
    { id: 'collection', label: 'Coleta Estratégica', icon: '🔎' },
    { id: 'actions', label: 'Ações & Automação', icon: '🚀' },
    { id: 'ideas', label: 'Ideias por IA', icon: '🧠' },
    { id: 'logs', label: 'Logs Globais', icon: '📝' },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 font-sans">
      {/* Sidebar */}
      <nav className="w-full md:w-64 bg-slate-900 text-white flex flex-col shadow-2xl">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-lg">
            🌌
          </div>
          <div className="overflow-hidden">
            <h1 className="font-bold text-lg tracking-tight truncate">SocialBot Pro</h1>
            <p className="text-[10px] text-slate-400 truncate uppercase tracking-widest">{userEmail}</p>
          </div>
        </div>

        <div className="flex-1 py-4 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-4 px-6 py-3.5 text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-slate-800 text-indigo-400 border-r-4 border-indigo-500'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <span className="text-xl opacity-80">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4 mt-auto border-t border-slate-800">
          <button
            onClick={onLogout}
            className="w-full py-2.5 px-4 rounded-xl text-sm bg-slate-800 hover:bg-red-900/40 text-slate-400 hover:text-red-400 transition-all border border-transparent hover:border-red-900/50"
          >
            Logout do Sistema
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <header className="h-16 bg-white border-b border-gray-200 px-8 flex items-center justify-between sticky top-0 z-20 backdrop-blur-md bg-white/80">
          <div className="flex items-center gap-3">
             <h2 className="text-xl font-bold text-slate-800 tracking-tight">
               {tabs.find(t => t.id === activeTab)?.label}
             </h2>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-4 text-xs font-semibold">
               <span className="text-slate-400 uppercase tracking-widest">Multi-Engine Active</span>
               <div className="flex -space-x-2">
                 {['📸', '🎬', '🎵', '📺'].map((emoji, i) => (
                   <div key={i} className="w-7 h-7 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center shadow-sm">
                     {emoji}
                   </div>
                 ))}
               </div>
            </div>
            <span className="flex items-center gap-2 text-[10px] font-bold px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100 uppercase tracking-widest">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></span>
              Gemini Integrated
            </span>
          </div>
        </header>
        <div className="p-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;


import React, { useState, useEffect, useCallback } from 'react';
import Layout from './components/Layout';
import RobotStatus from './components/RobotStatus';
import { db } from './services/database';
import { analyzeSentiment, generateEngagementText, generatePostIdea } from './services/geminiService';
import { 
  LogEntry, 
  SystemUser, 
  ActionType,
  Platform,
  SocialAccount,
  PostIdea
} from './types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const PLATFORMS: Platform[] = ['instagram', 'tiktok', 'kwai', 'youtube'];

const App: React.FC = () => {
  const [sysUser, setSysUser] = useState<SystemUser>({ id: '', email: '', isAuthenticated: false });
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentTask, setCurrentTask] = useState('');
  const [activePlatform, setActivePlatform] = useState<Platform>('instagram');
  
  // Content Generation States
  const [ideas, setIdeas] = useState<PostIdea[]>([]);
  const [visualMode, setVisualMode] = useState<'ai_generated' | 'web_search'>('web_search');
  const [contentFormat, setContentFormat] = useState<'image' | 'video'>('image');
  const [videoDuration, setVideoDuration] = useState(30);

  // Automation States
  const [automationConfig, setAutomationConfig] = useState({
    actionType: 'follow' as ActionType,
    targetCount: 10,
    postsPerProfile: 2,
    useAI: true,
    manualText: '',
    aiPrompt: 'Elogie o conteúdo de forma natural e humana.',
    unfollowDays: 4,
    unfollowCount: 20
  });

  const [stats, setStats] = useState({ collected: 0, actions: 0, accounts: 0 });
  const [sysAuthForm, setSysAuthForm] = useState({ email: '', password: '' });
  const [newAccountForm, setNewAccountForm] = useState({ username: '', password: '', platform: 'instagram' as Platform });
  const [collectionConfig, setCollectionConfig] = useState({ nicho: 'Marketing Digital', targets: '', posts: 3, count: 10 });

  useEffect(() => {
    refreshStats();
  }, [activePlatform]);

  const refreshStats = () => {
    setStats({
      collected: db.getProfiles().length,
      actions: db.getActions().length,
      accounts: db.getAccounts().length
    });
  };

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info', platform?: Platform) => {
    setLogs(prev => [{
      timestamp: new Date().toLocaleTimeString(),
      message,
      type,
      platform
    }, ...prev].slice(0, 100));
  }, []);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoginMode) {
      const user = db.loginSystemUser(sysAuthForm.email, sysAuthForm.password);
      if (user) {
        setSysUser({ id: user.id, email: user.email, isAuthenticated: true });
        addLog(`Sessão iniciada: ${user.email}`, 'success');
      } else {
        alert("Credenciais inválidas ou usuário não encontrado.");
      }
    } else {
      const success = db.registerSystemUser(sysAuthForm);
      if (success) {
        alert("Conta criada com sucesso! Agora você pode acessar.");
        setIsLoginMode(true);
      } else {
        alert("Este e-mail já está cadastrado.");
      }
    }
  };

  const addSocialAccount = (e: React.FormEvent) => {
    e.preventDefault();
    const acc = db.addAccount({ 
      username: newAccountForm.username, 
      platform: newAccountForm.platform, 
      status: 'ativa' 
    });
    addLog(`Conta @${acc.username} (${acc.platform}) vinculada`, 'success');
    setNewAccountForm({ username: '', password: '', platform: 'instagram' });
    refreshStats();
  };

  const runBulkEngagement = async () => {
    const accounts = db.getAccounts();
    const targetAccount = accounts.find(a => a.platform === activePlatform && a.status === 'ativa');
    if (!targetAccount) {
      addLog(`Erro: Conecte uma conta de ${activePlatform.toUpperCase()} primeiro.`, 'error');
      return;
    }
    const profiles = db.getProfiles(activePlatform).slice(0, automationConfig.targetCount);
    if (profiles.length === 0) {
      addLog("Erro: Nenhum perfil coletado disponível.", "warning");
      return;
    }
    setIsProcessing(true);
    addLog(`Iniciando Ciclo de Engajamento via @${targetAccount.username}...`, 'info', activePlatform);
    try {
      for (const profile of profiles) {
        setCurrentTask(`Interagindo com @${profile.perfil_usuario}`);
        let content = automationConfig.manualText;
        if (automationConfig.useAI && (automationConfig.actionType === 'comentar' || automationConfig.actionType === 'direct')) {
          content = await generateEngagementText(automationConfig.aiPrompt, activePlatform, automationConfig.actionType === 'comentar' ? 'comment' : 'direct');
        }
        await new Promise(r => setTimeout(r, 1500));
        db.addAction({ perfil_usuario: profile.perfil_usuario, plataforma: activePlatform, tipo_acao: automationConfig.actionType, conteudo: content || undefined });
        addLog(`Ação [${automationConfig.actionType.toUpperCase()}] em @${profile.perfil_usuario}`, 'success', activePlatform);
        refreshStats();
      }
      addLog("Ciclo concluído!", "success");
    } finally {
      setIsProcessing(false);
      setCurrentTask('');
    }
  };

  const generateContentBatch = async () => {
    setIsProcessing(true);
    addLog(`Produzindo ${contentFormat.toUpperCase()} para ${activePlatform}...`);
    try {
      const idea = await generatePostIdea(collectionConfig.nicho, activePlatform, visualMode, contentFormat, videoDuration);
      setIdeas(prev => [idea, ...prev]);
      addLog("Material gerado com sucesso!", "success");
    } catch (e) {
      addLog("Erro na API Gemini.", "error");
    }
    setIsProcessing(false);
  };

  const handleAutoPost = async (idea: PostIdea) => {
    const accounts = db.getAccounts();
    const targetAccount = accounts.find(a => a.platform === idea.platform && a.status === 'ativa');
    if (!targetAccount) return;
    setIsProcessing(true);
    addLog(`Postando automaticamente em @${targetAccount.username}...`, 'info', idea.platform);
    try {
      await new Promise(r => setTimeout(r, 2000));
      db.addAction({ perfil_usuario: targetAccount.username, plataforma: idea.platform, tipo_acao: 'curtir', conteudo: `Postagem: ${idea.title}` });
      addLog(`Publicado em @${targetAccount.username}!`, 'success', idea.platform);
      refreshStats();
    } finally {
      setIsProcessing(false);
    }
  };

  if (!sysUser.isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-white rounded-[40px] shadow-2xl p-12 space-y-8 animate-in zoom-in duration-500">
          <div className="text-center">
             <div className="w-24 h-24 bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 rounded-3xl mx-auto flex items-center justify-center text-5xl shadow-2xl mb-8 text-white rotate-3">
               🧬
             </div>
             <h1 className="text-4xl font-black text-slate-900 tracking-tighter">SocialBot Pro</h1>
             <p className="text-slate-400 mt-2 font-bold uppercase tracking-widest text-[10px]">Central de Comando IA</p>
          </div>
          
          <form onSubmit={handleAuth} className="space-y-6">
             <div className="space-y-4">
               <input type="email" required className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all font-medium" placeholder="E-mail profissional" value={sysAuthForm.email} onChange={e => setSysAuthForm({...sysAuthForm, email: e.target.value})} />
               <input type="password" required className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all font-medium" placeholder="Sua senha secreta" value={sysAuthForm.password} onChange={e => setSysAuthForm({...sysAuthForm, password: e.target.value})} />
             </div>
             
             <button className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition-all shadow-xl active:scale-95">
               {isLoginMode ? 'Acessar Central' : 'Criar Minha Conta'}
             </button>
          </form>

          <div className="pt-6 border-t border-slate-100 text-center">
             <button 
              onClick={() => setIsLoginMode(!isLoginMode)}
              className="text-xs font-black text-indigo-600 uppercase tracking-widest hover:underline"
             >
               {isLoginMode ? 'Não tem conta? Cadastre-se' : 'Já sou membro? Fazer Login'}
             </button>
          </div>
        </div>
      </div>
    );
  }

  const renderDashboard = () => {
    const allProfiles = db.getProfiles();
    const platformDist = PLATFORMS.map(p => ({ name: p, value: allProfiles.filter(pr => pr.plataforma === p).length }));
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border-b-4 border-indigo-500">
             <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Contas Gestão</span>
             <h3 className="text-3xl font-black text-slate-900">{stats.accounts}</h3>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border-b-4 border-purple-500">
             <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Leads Coletados</span>
             <h3 className="text-3xl font-black text-slate-900">{stats.collected}</h3>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border-b-4 border-emerald-500">
             <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Ações Automatizadas</span>
             <h3 className="text-3xl font-black text-slate-900">{stats.actions}</h3>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border-b-4 border-rose-500">
             <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Motor Ativo</span>
             <h3 className="text-3xl font-black text-slate-900">GEMINI 3</h3>
          </div>
        </div>
        <div className="bg-white p-8 rounded-3xl shadow-sm h-80">
           <ResponsiveContainer width="100%" height="100%">
              <BarChart data={platformDist}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                 <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} className="capitalize" />
                 <YAxis axisLine={false} tickLine={false} fontSize={12} />
                 <Tooltip cursor={{fill: '#f8fafc'}} />
                 <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                   {platformDist.map((entry, index) => <Cell key={`cell-${index}`} fill={['#e1306c', '#000000', '#ff8c00', '#ff0000'][index]} />)}
                 </Bar>
              </BarChart>
           </ResponsiveContainer>
        </div>
      </div>
    );
  };

  const renderActions = () => {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-100 space-y-8">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-2xl">🚀</div>
            <h3 className="font-black text-2xl text-slate-900">Engajamento em Massa</h3>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Plataforma</label>
              <select className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-black text-xs" value={activePlatform} onChange={e => setActivePlatform(e.target.value as Platform)}>
                {PLATFORMS.map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Ação</label>
              <select className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-sm" value={automationConfig.actionType} onChange={e => setAutomationConfig({...automationConfig, actionType: e.target.value as ActionType})}>
                <option value="follow">Seguir</option>
                <option value="curtir">Curtir</option>
                <option value="comentar">Comentar</option>
                <option value="direct">Direct</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Quantidade</label>
              <input type="number" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" value={automationConfig.targetCount} onChange={e => setAutomationConfig({...automationConfig, targetCount: parseInt(e.target.value)})}/>
            </div>
          </div>
          <button onClick={runBulkEngagement} disabled={isProcessing} className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black uppercase tracking-[0.2em] text-xs shadow-xl hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50">
            {isProcessing ? 'Executando...' : 'Iniciar Automação'}
          </button>
        </div>
        <div className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-100 space-y-8 flex flex-col justify-center items-center text-center opacity-50">
           <span className="text-5xl">🧹</span>
           <h3 className="font-black text-xl">Módulo de Limpeza</h3>
           <p className="text-xs text-slate-400 font-medium px-10 italic">O robô remove automaticamente seguidores inativos ou perfis que não retornaram o follow após o prazo estipulado.</p>
           <button disabled className="px-8 py-3 bg-slate-100 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-not-allowed">Em Manutenção</button>
        </div>
      </div>
    );
  };

  const renderIdeas = () => {
    const accounts = db.getAccounts();
    return (
      <div className="space-y-8 max-w-5xl">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-indigo-50">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
              <h3 className="font-black text-2xl text-slate-900">Estúdio Visual Estratégico</h3>
              <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                  <button onClick={() => setVisualMode('web_search')} className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${visualMode === 'web_search' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>WEB SEARCH</button>
                  <button onClick={() => setVisualMode('ai_generated')} className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${visualMode === 'ai_generated' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>AI GENERATOR</button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block tracking-widest">Nicho</label>
                <input className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none" value={collectionConfig.nicho} onChange={e => setCollectionConfig({...collectionConfig, nicho: e.target.value})}/>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block tracking-widest">Plataforma</label>
                <select className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none" value={activePlatform} onChange={e => setActivePlatform(e.target.value as Platform)}>
                  {PLATFORMS.map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block tracking-widest">Formato</label>
                <div className="flex gap-2">
                  <button onClick={() => setContentFormat('image')} className={`flex-1 py-3 text-[10px] font-black rounded-xl border transition-all ${contentFormat === 'image' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500'}`}>IMAGEM</button>
                  <button onClick={() => setContentFormat('video')} className={`flex-1 py-3 text-[10px] font-black rounded-xl border transition-all ${contentFormat === 'video' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500'}`}>VÍDEO</button>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block tracking-widest">Segundos</label>
                <input type="number" disabled={contentFormat === 'image'} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none disabled:opacity-30" value={videoDuration} onChange={e => setVideoDuration(parseInt(e.target.value))}/>
              </div>
            </div>
            <button onClick={generateContentBatch} disabled={isProcessing} className="w-full mt-8 bg-indigo-600 text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 disabled:bg-slate-300 transition-all active:scale-[0.98]">
              {isProcessing ? 'PRODUZINDO MATERIAL...' : 'PRODUZIR AGORA'}
            </button>
        </div>
        <div className="grid grid-cols-1 gap-10 pb-20">
            {ideas.map((idea) => {
              const hasAccount = accounts.some(a => a.platform === idea.platform && a.status === 'ativa');
              return (
                <div key={idea.id} className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden animate-in slide-in-from-bottom-6 duration-500">
                  <div className="grid grid-cols-1 lg:grid-cols-5">
                      <div className="lg:col-span-2 relative">
                        {idea.imageUrl ? (
                            <div className="relative h-full aspect-[9/16] lg:aspect-auto">
                              <img src={idea.imageUrl} alt="Visual" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-8 text-center">
                                  <span className="text-white font-black text-3xl uppercase tracking-tighter drop-shadow-2xl leading-none transform -rotate-2">{idea.overlayText}</span>
                              </div>
                            </div>
                        ) : (
                            <div className="h-full min-h-[400px] bg-slate-50 flex items-center justify-center text-slate-400 font-black text-xs">PROCESSANDO...</div>
                        )}
                      </div>
                      <div className="lg:col-span-3 p-10 flex flex-col">
                        <div className="flex justify-between items-start mb-10">
                            <div>
                              <h4 className="text-3xl font-black text-slate-900 mb-1">{idea.title}</h4>
                              <p className="text-xs text-indigo-500 font-black uppercase tracking-[0.2em]">{idea.platform}</p>
                            </div>
                            <button onClick={() => handleAutoPost(idea)} disabled={isProcessing || !hasAccount} className={`px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] transition-all shadow-xl active:scale-90 ${!hasAccount ? 'bg-slate-100 text-slate-300 cursor-not-allowed border border-slate-200' : 'bg-slate-900 text-white shadow-slate-200'}`}>POSTAR</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1">
                            <div className="space-y-6">
                              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                <h5 className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest">Roteiro / Script</h5>
                                <p className="text-sm text-slate-700 italic leading-relaxed font-medium">"{idea.narratorScript || idea.script}"</p>
                              </div>
                            </div>
                            <div className="space-y-6">
                               <div className="bg-emerald-50/50 p-6 rounded-3xl border border-emerald-100">
                                  <h5 className="text-[10px] font-black text-emerald-600 uppercase mb-3 tracking-widest">Legenda</h5>
                                  <p className="text-sm text-slate-700 font-medium">{idea.caption}</p>
                                  <div className="mt-4 flex flex-wrap gap-2">{idea.hashtags.map(h => <span className="text-[10px] text-emerald-600 font-black" key={h}>#{h}</span>)}</div>
                               </div>
                               <div className="mt-auto pt-6 border-t border-slate-100">
                                  <p className="text-[10px] font-black text-slate-400 uppercase mb-1">CTA:</p>
                                  <p className="text-sm font-black text-slate-900">{idea.cta}</p>
                               </div>
                            </div>
                        </div>
                      </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    );
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} userEmail={sysUser.email} onLogout={() => setSysUser({ id: '', email: '', isAuthenticated: false })}>
      {activeTab === 'dashboard' && renderDashboard()}
      {activeTab === 'accounts' && (
         <div className="max-w-2xl mx-auto space-y-8">
            <div className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-100">
              <h3 className="font-black text-2xl mb-8">Gestão de Identidades</h3>
              <div className="space-y-4">
                 {db.getAccounts().map(acc => (
                    <div key={acc.id} className="group flex justify-between items-center p-5 bg-slate-50 border border-transparent hover:border-slate-100 rounded-3xl transition-all">
                       <div className="flex items-center gap-5">
                          <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-3xl shadow-sm">
                            {acc.platform === 'instagram' ? '📸' : acc.platform === 'tiktok' ? '🎬' : acc.platform === 'kwai' ? '🎵' : '📺'}
                          </div>
                          <div>
                             <p className="font-black text-slate-900">@{acc.username}</p>
                             <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{acc.platform}</p>
                          </div>
                       </div>
                       <button onClick={() => { db.deleteAccount(acc.id); refreshStats(); }} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">🗑️</button>
                    </div>
                 ))}
                 <form onSubmit={addSocialAccount} className="pt-8 mt-4 border-t border-slate-100">
                    <div className="grid grid-cols-2 gap-4">
                       <input className="col-span-2 p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-medium" placeholder="Usuário / Username" value={newAccountForm.username} onChange={e => setNewAccountForm({...newAccountForm, username: e.target.value})} />
                       <select className="col-span-2 p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-black text-xs" value={newAccountForm.platform} onChange={e => setNewAccountForm({...newAccountForm, platform: e.target.value as Platform})}>
                          {PLATFORMS.map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}
                       </select>
                    </div>
                    <button className="w-full mt-6 bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg active:scale-95">Adicionar Identidade</button>
                 </form>
              </div>
            </div>
         </div>
      )}
      {activeTab === 'ideas' && renderIdeas()}
      {activeTab === 'actions' && renderActions()}
      {activeTab === 'logs' && <RobotStatus logs={logs} currentTask={currentTask} isProcessing={isProcessing} stats={stats} />}
      {activeTab === 'collection' && (
        <div className="max-w-3xl mx-auto bg-white p-10 rounded-[40px] shadow-sm border border-slate-100">
          <h3 className="font-black text-2xl mb-8">Mineração de Leads</h3>
          <div className="space-y-6">
            <textarea className="w-full p-5 bg-slate-50 border border-slate-200 rounded-3xl outline-none min-h-[150px]" placeholder="@perfil_alvo_01\n@perfil_alvo_02" value={collectionConfig.targets} onChange={e => setCollectionConfig({...collectionConfig, targets: e.target.value})} />
            <button className="w-full py-5 bg-indigo-600 text-white rounded-3xl font-black uppercase tracking-widest shadow-xl shadow-indigo-100 active:scale-95">🚀 Iniciar Mineração</button>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default App;

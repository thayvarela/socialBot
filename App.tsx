
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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

const PLATFORMS: Platform[] = ['instagram', 'tiktok', 'kwai', 'youtube'];

const App: React.FC = () => {
  const [sysUser, setSysUser] = useState<SystemUser>({ id: '', email: '', isAuthenticated: false });
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

  // Automation & Engagement States
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
  const [sysLoginForm, setSysLoginForm] = useState({ email: '', password: '' });
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

  const handleSystemLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (sysLoginForm.email && sysLoginForm.password) {
      setSysUser({ id: '1', email: sysLoginForm.email, isAuthenticated: true });
      addLog(`Sistema iniciado para ${sysLoginForm.email}`, 'success');
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
      addLog("Erro: Nenhum perfil coletado disponível para esta plataforma.", "warning");
      return;
    }

    setIsProcessing(true);
    addLog(`Iniciando Ciclo de Engajamento (${automationConfig.actionType}) via @${targetAccount.username}...`, 'info', activePlatform);

    try {
      for (const profile of profiles) {
        setCurrentTask(`Interagindo com @${profile.perfil_usuario}`);
        
        let content = automationConfig.manualText;
        if (automationConfig.useAI && (automationConfig.actionType === 'comentar' || automationConfig.actionType === 'direct')) {
          addLog(`Solicitando IA para gerar texto criativo...`);
          content = await generateEngagementText(automationConfig.aiPrompt, activePlatform, automationConfig.actionType === 'comentar' ? 'comment' : 'direct');
        }

        await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
        
        db.addAction({
          perfil_usuario: profile.perfil_usuario,
          plataforma: activePlatform,
          tipo_acao: automationConfig.actionType,
          conteudo: content || undefined
        });

        addLog(`Ação [${automationConfig.actionType.toUpperCase()}] realizada em @${profile.perfil_usuario}`, 'success', activePlatform);
        refreshStats();
      }
      addLog("Ciclo de engajamento concluído com sucesso!", "success");
    } catch (e) {
      addLog("Erro durante automação. Pausando robô.", "error");
    } finally {
      setIsProcessing(false);
      setCurrentTask('');
    }
  };

  const runUnfollowProcess = async () => {
    const accounts = db.getAccounts();
    const targetAccount = accounts.find(a => a.platform === activePlatform && a.status === 'ativa');
    
    if (!targetAccount) {
      addLog("Erro: Conta ativa necessária para Unfollow.", "error");
      return;
    }

    setIsProcessing(true);
    addLog(`Iniciando limpeza de seguidores em @${targetAccount.username}...`, 'info', activePlatform);
    
    try {
      const actions = db.getActions().filter(a => a.tipo_acao === 'follow' && a.plataforma === activePlatform);
      // Simulação: Filtra por tempo (aqui simplificado para demonstração)
      const toUnfollow = actions.slice(0, automationConfig.unfollowCount);

      if (toUnfollow.length === 0) {
        addLog("Nenhum perfil elegível para unfollow no momento.", "info");
      } else {
        for (const action of toUnfollow) {
          setCurrentTask(`Deixando de seguir @${action.perfil_usuario}`);
          await new Promise(r => setTimeout(r, 1500));
          
          db.addAction({
            perfil_usuario: action.perfil_usuario,
            plataforma: activePlatform,
            tipo_acao: 'unfollow'
          });
          
          addLog(`Unfollow realizado: @${action.perfil_usuario}`, 'warning', activePlatform);
          refreshStats();
        }
      }
    } finally {
      setIsProcessing(false);
      setCurrentTask('');
    }
  };

  const generateContentBatch = async () => {
    setIsProcessing(true);
    addLog(`Iniciando produção de ${contentFormat.toUpperCase()} para ${activePlatform}...`);
    try {
      const idea = await generatePostIdea(
        collectionConfig.nicho, 
        activePlatform, 
        visualMode,
        contentFormat,
        videoDuration
      );
      setIdeas(prev => [idea, ...prev]);
      addLog("Produção finalizada com sucesso!", "success");
    } catch (e) {
      addLog("Falha na geração. Erro na API Gemini.", "error");
    }
    setIsProcessing(false);
  };

  const handleAutoPost = async (idea: PostIdea) => {
    const accounts = db.getAccounts();
    const targetAccount = accounts.find(a => a.platform === idea.platform && a.status === 'ativa');

    if (!targetAccount) {
      addLog(`Erro: Nenhuma conta ativa de ${idea.platform.toUpperCase()} para postagem.`, 'error');
      return;
    }

    setIsProcessing(true);
    setCurrentTask(`Postando em @${targetAccount.username}`);
    addLog(`Iniciando postagem em @${targetAccount.username}...`, 'info', idea.platform);

    try {
      await new Promise(r => setTimeout(r, 2000));
      db.addAction({
        perfil_usuario: targetAccount.username,
        plataforma: idea.platform,
        tipo_acao: 'curtir',
        conteudo: `Post: ${idea.title}`
      });
      addLog(`Conteúdo publicado com sucesso em @${targetAccount.username}!`, 'success', idea.platform);
      refreshStats();
    } catch (e) {
      addLog(`Erro crítico durante postagem em ${idea.platform}.`, 'error');
    } finally {
      setIsProcessing(false);
      setCurrentTask('');
    }
  };

  if (!sysUser.isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-10 space-y-8 animate-in zoom-in duration-300">
          <div className="text-center">
             <div className="w-20 h-20 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-3xl mx-auto flex items-center justify-center text-4xl shadow-2xl mb-6 text-white">
               🧬
             </div>
             <h1 className="text-3xl font-black text-slate-900 tracking-tight">SocialBot Pro</h1>
             <p className="text-slate-500 mt-2 font-medium">Controle Multi-Plataforma & IA</p>
          </div>
          <form onSubmit={handleSystemLogin} className="space-y-6">
             <div className="space-y-4">
               <input type="email" required className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none" placeholder="E-mail" value={sysLoginForm.email} onChange={e => setSysLoginForm({...sysLoginForm, email: e.target.value})} />
               <input type="password" required className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none" placeholder="Senha" value={sysLoginForm.password} onChange={e => setSysLoginForm({...sysLoginForm, password: e.target.value})} />
             </div>
             <button className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-xl">Acessar Central</button>
          </form>
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
             <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Motor IA</span>
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
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Plataforma Alvo</label>
              <select className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-black text-xs" value={activePlatform} onChange={e => setActivePlatform(e.target.value as Platform)}>
                {PLATFORMS.map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Tipo de Ação</label>
              <select className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-sm" value={automationConfig.actionType} onChange={e => setAutomationConfig({...automationConfig, actionType: e.target.value as ActionType})}>
                <option value="follow">Seguir (Follow)</option>
                <option value="curtir">Curtir Postagens</option>
                <option value="comentar">Comentar</option>
                <option value="direct">Enviar Direct</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Qtde Perfis</label>
              <input type="number" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" value={automationConfig.targetCount} onChange={e => setAutomationConfig({...automationConfig, targetCount: parseInt(e.target.value)})}/>
            </div>
          </div>

          {(automationConfig.actionType === 'comentar' || automationConfig.actionType === 'direct') && (
            <div className="space-y-4 animate-in slide-in-from-top-4">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Conteúdo da Mensagem</label>
                <button onClick={() => setAutomationConfig({...automationConfig, useAI: !automationConfig.useAI})} className={`text-[10px] font-black px-3 py-1 rounded-full transition-all ${automationConfig.useAI ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                  {automationConfig.useAI ? 'MODO IA ATIVO' : 'MODO MANUAL'}
                </button>
              </div>
              
              {automationConfig.useAI ? (
                <textarea className="w-full p-5 bg-slate-50 border border-slate-200 rounded-3xl outline-none min-h-[120px] text-sm" placeholder="Prompt para o Gemini gerar o comentário..." value={automationConfig.aiPrompt} onChange={e => setAutomationConfig({...automationConfig, aiPrompt: e.target.value})}/>
              ) : (
                <textarea className="w-full p-5 bg-slate-50 border border-slate-200 rounded-3xl outline-none min-h-[120px] text-sm" placeholder="Escreva sua mensagem manual aqui..." value={automationConfig.manualText} onChange={e => setAutomationConfig({...automationConfig, manualText: e.target.value})}/>
              )}
            </div>
          )}

          <button onClick={runBulkEngagement} disabled={isProcessing} className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black uppercase tracking-[0.2em] text-xs shadow-xl hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50">
            {isProcessing ? 'Executando Automação...' : 'Iniciar Robô de Engajamento'}
          </button>
        </div>

        <div className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-100 space-y-8">
           <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center text-2xl">🧹</div>
            <h3 className="font-black text-2xl text-slate-900">Limpeza (Unfollow)</h3>
          </div>

          <div className="bg-rose-50 p-6 rounded-3xl border border-rose-100">
             <p className="text-xs text-rose-600 font-bold leading-relaxed">
               O robô irá identificar perfis que você seguiu através do sistema e deixará de seguí-los progressivamente para manter o ratio do seu perfil saudável.
             </p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Dias após Follow</label>
              <input type="number" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" value={automationConfig.unfollowDays} onChange={e => setAutomationConfig({...automationConfig, unfollowDays: parseInt(e.target.value)})}/>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Qtde Unfollow</label>
              <input type="number" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" value={automationConfig.unfollowCount} onChange={e => setAutomationConfig({...automationConfig, unfollowCount: parseInt(e.target.value)})}/>
            </div>
          </div>

          <button onClick={runUnfollowProcess} disabled={isProcessing} className="w-full py-5 bg-white text-rose-600 border-2 border-rose-600 rounded-3xl font-black uppercase tracking-[0.2em] text-xs shadow-lg hover:bg-rose-50 transition-all active:scale-95 disabled:opacity-50">
            {isProcessing ? 'Limpando Perfil...' : 'Executar Deixar de Seguir'}
          </button>

          <div className="pt-8 border-t border-slate-100">
             <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Estatísticas de Filtro</h4>
             <div className="flex justify-between text-sm font-bold">
                <span className="text-slate-500">Seguidos pelo Robô</span>
                <span className="text-slate-900">{db.getActions().filter(a => a.tipo_acao === 'follow' && a.plataforma === activePlatform).length}</span>
             </div>
          </div>
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
                  <button onClick={() => setVisualMode('web_search')} className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${visualMode === 'web_search' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>
                    WEB SEARCH
                  </button>
                  <button onClick={() => setVisualMode('ai_generated')} className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${visualMode === 'ai_generated' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>
                    AI GENERATOR
                  </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="md:col-span-1">
                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Nicho de Atuação</label>
                <input className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white outline-none" value={collectionConfig.nicho} onChange={e => setCollectionConfig({...collectionConfig, nicho: e.target.value})}/>
              </div>
              <div className="md:col-span-1">
                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Plataforma</label>
                <select className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white outline-none" value={activePlatform} onChange={e => setActivePlatform(e.target.value as Platform)}>
                  {PLATFORMS.map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}
                </select>
              </div>
              <div className="md:col-span-1">
                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Formato do Post</label>
                <div className="flex gap-2">
                  <button onClick={() => setContentFormat('image')} className={`flex-1 py-3 text-[10px] font-black rounded-xl border transition-all ${contentFormat === 'image' ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white text-slate-500 border-slate-200'}`}>IMAGEM</button>
                  <button onClick={() => setContentFormat('video')} className={`flex-1 py-3 text-[10px] font-black rounded-xl border transition-all ${contentFormat === 'video' ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white text-slate-500 border-slate-200'}`}>VÍDEO</button>
                </div>
              </div>
              <div className="md:col-span-1">
                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block opacity-50">Duração (Seg) {contentFormat === 'image' && '(N/A)'}</label>
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
              const isVideo = !!idea.videoDuration || (idea.storyboard && idea.storyboard.length > 0);

              return (
                <div key={idea.id} className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden animate-in slide-in-from-bottom-6 duration-500">
                  <div className="grid grid-cols-1 lg:grid-cols-5">
                      {/* Preview Visual */}
                      <div className="lg:col-span-2 relative">
                        {idea.imageUrl ? (
                            <div className="relative h-full aspect-[9/16] lg:aspect-auto">
                              <img src={idea.imageUrl} alt="Visual" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-8 text-center">
                                  <span className="text-white font-black text-3xl uppercase tracking-tighter drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)] leading-none transform -rotate-2">
                                    {idea.overlayText}
                                  </span>
                              </div>
                              <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center">
                                <span className="bg-white/90 text-slate-900 px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest backdrop-blur-md">
                                    {isVideo ? '🎥 VÍDEO' : '🖼️ IMAGEM'}
                                </span>
                                <span className="bg-indigo-600 text-white px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                                    {idea.visualMode === 'ai_generated' ? 'PREMIUM' : 'ECONOMY'}
                                </span>
                              </div>
                            </div>
                        ) : (
                            <div className="h-full min-h-[500px] bg-slate-50 flex items-center justify-center text-slate-400 font-black text-xs">
                              PROCESSANDO ATIVOS...
                            </div>
                        )}
                      </div>

                      {/* Conteúdo Estratégico */}
                      <div className="lg:col-span-3 p-10 flex flex-col">
                        <div className="flex justify-between items-start mb-10">
                            <div>
                              <h4 className="text-3xl font-black text-slate-900 mb-1">{idea.title}</h4>
                              <p className="text-xs text-indigo-500 font-black uppercase tracking-[0.2em]">{idea.platform}</p>
                            </div>
                            <button 
                              onClick={() => handleAutoPost(idea)}
                              disabled={isProcessing || !hasAccount}
                              className={`px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] transition-all shadow-xl active:scale-90 ${
                                !hasAccount 
                                ? 'bg-slate-100 text-slate-300 cursor-not-allowed border border-slate-200' 
                                : 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-200'
                              }`}
                            >
                              {isProcessing ? 'AGUARDE...' : 'POSTAR'}
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1">
                            <div className="space-y-6">
                              {idea.narratorScript ? (
                                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                    <h5 className="text-[10px] font-black text-slate-400 uppercase mb-3 flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                                        Script de Narração
                                    </h5>
                                    <p className="text-sm text-slate-700 italic leading-relaxed font-medium">"{idea.narratorScript}"</p>
                                  </div>
                              ) : (
                                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                    <h5 className="text-[10px] font-black text-slate-400 uppercase mb-3 flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                                        Conceito Visual
                                    </h5>
                                    <p className="text-sm text-slate-700 font-medium">{idea.script}</p>
                                  </div>
                              )}
                              
                              <div className="bg-emerald-50/50 p-6 rounded-3xl border border-emerald-100">
                                  <h5 className="text-[10px] font-black text-emerald-600 uppercase mb-3">Legenda Optimizada</h5>
                                  <p className="text-sm text-slate-700 leading-relaxed font-medium">{idea.caption}</p>
                                  <div className="mt-4 flex flex-wrap gap-2">
                                    {idea.hashtags.map(h => <span className="text-[10px] text-emerald-600 font-black px-2 py-1 bg-white rounded-lg border border-emerald-100" key={h}>#{h}</span>)}
                                  </div>
                              </div>
                            </div>

                            <div className="space-y-6">
                              <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Storyboard de Cenas</h5>
                              {idea.storyboard && idea.storyboard.length > 0 ? (
                                  <div className="space-y-3">
                                    {idea.storyboard.map((s, idx) => (
                                        <div key={idx} className="group flex gap-4 items-center bg-white p-3 rounded-2xl border border-slate-100 hover:shadow-md transition-all">
                                          <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0">
                                            <img src={s.webUri} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                                            <span className="absolute bottom-0 left-0 w-full bg-black/60 text-[8px] text-white font-bold text-center py-0.5">{s.time}</span>
                                          </div>
                                          <div className="flex-1 overflow-hidden">
                                              <p className="text-[11px] font-black text-slate-900 truncate uppercase">{s.description}</p>
                                              <a href={s.webUri} target="_blank" rel="noreferrer" className="text-[9px] text-indigo-500 font-black hover:underline">VISUALIZAR REF</a>
                                          </div>
                                        </div>
                                    ))}
                                  </div>
                              ) : (
                                  <div className="p-10 bg-slate-50 rounded-[32px] border border-dashed border-slate-200 text-center flex flex-col items-center justify-center">
                                    <span className="text-2xl mb-2">📸</span>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Ativos Estáticos</p>
                                  </div>
                              )}
                              <div className="mt-auto pt-6 border-t border-slate-100">
                                  <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Call to Action (CTA)</p>
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
                    <div key={acc.id} className="group flex justify-between items-center p-5 bg-slate-50 hover:bg-white border border-transparent hover:border-slate-100 rounded-3xl transition-all">
                       <div className="flex items-center gap-5">
                          <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-3xl shadow-sm group-hover:shadow-md transition-all">
                            {acc.platform === 'instagram' ? '📸' : acc.platform === 'tiktok' ? '🎬' : acc.platform === 'kwai' ? '🎵' : '📺'}
                          </div>
                          <div>
                             <p className="font-black text-slate-900">@{acc.username}</p>
                             <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{acc.platform}</p>
                          </div>
                       </div>
                       <div className="flex items-center gap-3">
                         <span className="text-[10px] font-black bg-emerald-100 text-emerald-600 px-3 py-1 rounded-full uppercase">Ativa</span>
                         <button onClick={() => { db.deleteAccount(acc.id); refreshStats(); }} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">🗑️</button>
                       </div>
                    </div>
                 ))}
                 
                 <form onSubmit={addSocialAccount} className="pt-8 mt-4 border-t border-slate-100">
                    <div className="grid grid-cols-2 gap-4">
                       <input className="col-span-2 p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-medium" placeholder="Usuário / Username" value={newAccountForm.username} onChange={e => setNewAccountForm({...newAccountForm, username: e.target.value})} />
                       <select className="col-span-2 p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-black text-xs" value={newAccountForm.platform} onChange={e => setNewAccountForm({...newAccountForm, platform: e.target.value as Platform})}>
                          {PLATFORMS.map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}
                       </select>
                    </div>
                    <button className="w-full mt-6 bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg active:scale-95">Adicionar Identidade</button>
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
            <div>
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Perfis Referência (Um por linha)</label>
              <textarea 
                className="w-full p-5 bg-slate-50 border border-slate-200 rounded-3xl outline-none min-h-[150px] font-medium" 
                placeholder="@perfil_01\n@perfil_02"
                value={collectionConfig.targets}
                onChange={e => setCollectionConfig({...collectionConfig, targets: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Posts p/ Perfil</label>
                <input type="number" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none" value={collectionConfig.posts} onChange={e => setCollectionConfig({...collectionConfig, posts: parseInt(e.target.value)})} />
              </div>
              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Leads p/ Post</label>
                <input type="number" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none" value={collectionConfig.count} onChange={e => setCollectionConfig({...collectionConfig, count: parseInt(e.target.value)})} />
              </div>
            </div>
            <button disabled={isProcessing} className="w-full py-5 bg-indigo-600 text-white rounded-3xl font-black uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95">
              🚀 Iniciar Robô de Mineração
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default App;

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import { LayoutDashboard, Users, Clock, Settings as SettingsIcon, LogOut, ArrowRight, Activity, DollarSign, Briefcase, FileText, Info, PlayCircle, BarChart3, Upload } from 'lucide-react';
import readXlsxFile from 'read-excel-file';

// Mantemos apenas o login no LocalStorage para o usuário permanecer logado na máquina
const getStorage = (key, defaultVal) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultVal;
  } catch (e) {
    return defaultVal;
  }
};
const setStorage = (key, val) => localStorage.setItem(key, JSON.stringify(val));

export default function App() {
  const [user, setUser] = useState(getStorage('current_user', null));
  const [view, setView] = useState('dashboard'); // timesheet, dashboard, clients, settings
  
  const [clients, setClients] = useState([]);
  const [config, setConfig] = useState({ id: 1, hourly_cost: 50 });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => setStorage('current_user', user), [user]);

  const fetchAllData = async () => {
    setLoading(true);
    const { data: clientsData } = await supabase.from('clients').select('*');
    const { data: configData } = await supabase.from('config').select('*').single();
    const { data: logsData } = await supabase.from('logs').select('*').order('created_at', { ascending: false });
    
    if (clientsData) setClients(clientsData);
    if (configData) setConfig(configData);
    if (logsData) setLogs(logsData);
    setLoading(false);
  };

  useEffect(() => {
    if (user) fetchAllData();
  }, [user]);

  if (!user) return <Login onLogin={(u) => { setUser(u); setView('dashboard'); }} />;

  return (
    <div className="app-layout">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <Activity size={24} color="var(--primary)" />
          <span>Controle</span> Agora
        </div>
        
        <nav className="sidebar-nav">
          <button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}>
            <LayoutDashboard size={20} /> Dashboard
          </button>
          <button className={view === 'timesheet' ? 'active' : ''} onClick={() => setView('timesheet')}>
            <Clock size={20} /> Timer (Timesheet)
          </button>
          {user.role === 'admin' && (
            <>
              <button className={view === 'clients' ? 'active' : ''} onClick={() => setView('clients')}>
                <Users size={20} /> Clientes
              </button>
              <button className={view === 'settings' ? 'active' : ''} onClick={() => setView('settings')}>
                <SettingsIcon size={20} /> Escritório
              </button>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="avatar">{user.name.charAt(0).toUpperCase()}</div>
          <div className="flex-col" style={{ gap: '0.1rem' }}>
            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)' }}>{user.name}</span>
            <span className="text-sm">{user.role}</span>
          </div>
        </div>
      </aside>

      {/* MAIN AREA */}
      <div className="main-area">
        {/* TOPBAR */}
        <header className="topbar">
          <div className="mobile-logo">
            <Activity size={20} color="var(--primary)" />
            <span>Controle</span> Agora
          </div>
          <div className="user-dropdown" onClick={() => { if(window.confirm('Deseja realmente sair?')) setUser(null); }}>
            <span style={{ fontWeight: 500, fontSize: '0.95rem' }}>{user.name.split(' ')[0]}</span>
            <div className="avatar" style={{width: '28px', height: '28px', fontSize: '0.8rem'}}>{user.name.charAt(0).toUpperCase()}</div>
          </div>
        </header>

        {/* CONTENT */}
        <main className="content-area">
          {loading ? (
            <div style={{ textAlign: 'center', marginTop: '5rem', color: 'var(--text-muted)' }}>
              Sincronizando dados com servidor...
            </div>
          ) : (
            <>
              <div style={{ display: view === 'dashboard' ? 'block' : 'none' }}>
                <Dashboard user={user} clients={clients} logs={logs} config={config} setView={setView} />
              </div>
              
              <div style={{ display: view === 'timesheet' ? 'block' : 'none' }}>
                <Timesheet user={user} clients={clients} logs={logs} onAddLog={async (log) => {
                  const { data, error } = await supabase.from('logs').insert([log]).select();
                  if (data) setLogs([data[0], ...logs]);
                  if (error) alert("Erro ao salvar log: " + error.message);
                }} />
              </div>

              <div style={{ display: view === 'clients' ? 'block' : 'none' }}>
                <Clients clients={clients} onAddClient={async (c) => {
                  const { data, error } = await supabase.from('clients').insert([c]).select();
                  if (data && data.length > 0) {
                    setClients(prev => [...prev, data[0]]);
                  }
                  if (error) { 
                    alert("Erro no Banco. Verifique se criou as novas colunas TMF, TMC, TMP e CPF/CNPJ no Supabase!\n\nDetalhe: " + error.message);
                    throw error; 
                  }
                }} onDeleteClient={async (id) => {
                  await supabase.from('clients').delete().eq('id', id);
                  setClients(prev => prev.filter(c => c.id !== id));
                }} onDeleteAllClients={async () => {
                  if(window.confirm("ATENÇÃO: Deseja realmente excluir TODOS os clientes da carteira? Esta ação é irreversível!")) {
                    const { error } = await supabase.from('clients').delete().neq('id', 0);
                    if (error) alert("Erro ao excluir: " + error.message + ". O banco pode estar impedindo exclusão devido a logs vinculados.");
                    else setClients([]);
                  }
                }} />
              </div>

              <div style={{ display: view === 'settings' ? 'block' : 'none' }}>
                <Settings config={config} onSaveConfig={async (cost) => {
                  const { data, error } = await supabase.from('config').upsert({ id: config?.id || 1, hourly_cost: cost }).select();
                  if(data && data.length > 0) setConfig(data[0]);
                  if(error) alert("Erro ao salvar config: " + error.message);
                }} />
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

// --- TELAS ---

function Login({ onLogin }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('admin');

  const handleLogin = (e) => {
    e.preventDefault();
    if (name.trim()) onLogin({ id: Date.now(), name, role });
  };

  return (
    <div className="login-container">
      <div className="card login-box">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <Activity size={40} color="var(--primary)" style={{ marginBottom: '1rem' }} />
          <h2>Acesso ao Painel</h2>
          <p>Controle Agora Web</p>
        </div>
        <form onSubmit={handleLogin} className="flex-col">
          <label style={{ fontSize: '0.9rem', marginBottom: '0.25rem', fontWeight: 500 }}>Nome de Usuário</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Leandro" required />
          
          <label style={{ fontSize: '0.9rem', marginBottom: '0.25rem', fontWeight: 500 }}>Tipo de Acesso</label>
          <select value={role} onChange={e => setRole(e.target.value)}>
            <option value="admin">Administrador / Gestor</option>
            <option value="colaborador">Colaborador (Apenas Timer)</option>
          </select>
          
          <button type="submit" className="btn-primary" style={{ marginTop: '1rem' }}>Entrar na Plataforma</button>
        </form>
      </div>
    </div>
  );
}

function Dashboard({ user, clients, logs, config, setView }) {
  const data = clients.map(client => {
    const totalSeconds = logs.filter(l => l.client_id === client.id).reduce((acc, l) => acc + l.duration_seconds, 0);
    const totalHoursSpent = totalSeconds / 3600;
    const realCost = totalHoursSpent * (config.hourly_cost || 0);
    const profit = parseFloat(client.monthly_fee) - realCost;
    
    return { ...client, totalHoursSpent, realCost, profit };
  });

  const totalRevenue = data.reduce((acc, c) => acc + parseFloat(c.monthly_fee), 0);
  const totalCost = data.reduce((acc, c) => acc + c.realCost, 0);
  const globalProfit = totalRevenue - totalCost;

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Olá, {user.name.split(' ')[0]}! 👋</h1>
        <p className="page-subtitle">Escritório: Controle Agora</p>
      </div>

      <div className="grid grid-4" style={{ marginBottom: '2rem' }}>
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Clientes Ativos</span>
            <Users size={20} className="kpi-icon" />
          </div>
          <div className="kpi-value">{clients.length}</div>
        </div>
        
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Média Mensalidade</span>
            <DollarSign size={20} className="kpi-icon" />
          </div>
          <div className="kpi-value">R$ {clients.length ? (totalRevenue / clients.length).toFixed(2) : '0.00'}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Faturamento Total</span>
            <Activity size={20} className="kpi-icon" />
          </div>
          <div className="kpi-value">R$ {totalRevenue.toFixed(2)}</div>
        </div>
        
        <div className="kpi-card kpi-profit">
          <div className="kpi-header">
            <span className="kpi-title">Lucro Operacional Estimado</span>
            <Briefcase size={20} className="kpi-icon" />
          </div>
          <div className="kpi-value">R$ {globalProfit.toFixed(2)}</div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="flex justify-between items-center" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>Apontamentos Recentes</h3>
            <button className="outline" onClick={() => setView('timesheet')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', border: 'none' }}>
              Ver Todos <ArrowRight size={16} />
            </button>
          </div>
          <div className="flex-col" style={{ gap: '1rem' }}>
            {logs.slice(0, 4).map(log => {
              const clientInfo = clients.find(c => c.id === log.client_id);
              return (
                <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{clientInfo?.name || 'Cliente'}</div>
                    <div className="text-muted" style={{ fontSize: '0.85rem' }}>{log.log_date}, {log.start_time} - {log.user_name}</div>
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: 600, color: 'var(--primary)' }}>
                    {Math.floor(log.duration_seconds / 60)} min
                  </div>
                </div>
              );
            })}
            {logs.length === 0 && <div className="text-muted">Nenhum apontamento recente.</div>}
          </div>
        </div>

        <div>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Configuração Rápida</h3>
          <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>Acesse rapidamente os painéis do escritório</p>
          
          <div className="quick-config-item" onClick={() => setView('clients')}>
            <div className="qc-left">
              <div className="qc-icon"><Users size={20} /></div>
              <div>
                <div className="qc-title">Gerenciar Clientes</div>
                <div className="qc-desc">Adicione ou remova clientes e planos</div>
              </div>
            </div>
            <ArrowRight size={18} color="var(--text-muted)" />
          </div>

          <div className="quick-config-item" onClick={() => setView('settings')}>
            <div className="qc-left">
              <div className="qc-icon"><DollarSign size={20} /></div>
              <div>
                <div className="qc-title">Custos / Tabelas de Preços</div>
                <div className="qc-desc">Configure o custo-hora do escritório</div>
              </div>
            </div>
            <ArrowRight size={18} color="var(--text-muted)" />
          </div>

          <div className="quick-config-item" onClick={() => setView('timesheet')}>
            <div className="qc-left">
              <div className="qc-icon"><Clock size={20} /></div>
              <div>
                <div className="qc-title">Realizar Apontamento</div>
                <div className="qc-desc">Comece a contar horas de trabalho agora</div>
              </div>
            </div>
            <ArrowRight size={18} color="var(--text-muted)" />
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1.5rem', border: '1px solid var(--primary)' }}>
        <div className="flex items-center" style={{ gap: '0.75rem', marginBottom: '1.5rem' }}>
           <Info size={24} color="var(--primary)" />
           <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Como utilizar o BPO Profit Tracker?</h3>
        </div>
        <div className="grid grid-3">
          <div className="tutorial-step">
            <h4><SettingsIcon size={16} /> 1. Configurar Custos e Clientes</h4>
            <p>Acesse a aba <strong>Escritório</strong> para definir o custo-hora da sua empresa. Em seguida, vá em <strong>Clientes</strong> e adicione sua carteira, informando a mensalidade cobrada e as horas contratadas.</p>
          </div>
          <div className="tutorial-step">
            <h4><PlayCircle size={16} /> 2. Aponte o Tempo Trabalhado</h4>
            <p>Peça para sua equipe acessar o <strong>Timer</strong>. Basta escolher o cliente e iniciar o cronômetro enquanto trabalham. Todos os dados serão salvos em nuvem automaticamente.</p>
          </div>
          <div className="tutorial-step">
            <h4><BarChart3 size={16} /> 3. Análise pelo Dashboard</h4>
            <p>Para cada segundo registrado, o sistema cruzará os dados, mostrando quem dá lucro ou prejuízo, a margem de cada cliente e a sua eficiência operacional atualizada em tempo real.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Timesheet({ user, clients, logs, onAddLog }) {
  const [selectedClient, setSelectedClient] = useState('');
  const [timerState, setTimerState] = useState('stopped');
  const [seconds, setSeconds] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => () => clearInterval(intervalRef.current), []);

  const formatTime = (totalSeconds) => {
    const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const toggleTimer = () => {
    if (!selectedClient) return alert("Selecione um cliente primeiro.");

    if (timerState === 'stopped') {
      setTimerState('running');
      setStartTime(new Date());
      intervalRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } else {
      clearInterval(intervalRef.current);
      setTimerState('stopped');
      onAddLog({
        client_id: parseInt(selectedClient), 
        user_name: user.name,
        log_date: startTime.toLocaleDateString('pt-BR'), 
        duration_seconds: seconds,
        start_time: startTime.toLocaleTimeString('pt-BR'), 
        end_time: new Date().toLocaleTimeString('pt-BR')
      });
      setSeconds(0);
    }
  };

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title"><Clock size={28} color="var(--primary)" /> Timer (Timesheet)</h1>
        <p className="page-subtitle">Aponte as horas trabalhadas nos clientes</p>
      </div>
      
      <div className="card flex-col items-center" style={{ maxWidth: '600px', margin: '0 auto 2rem auto', textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>Controle de Tempo</h2>
        <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)} disabled={timerState === 'running'} style={{ maxWidth: '400px' }}>
          <option value="">-- Indique o Cliente --</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="timer-display">{formatTime(seconds)}</div>
        <button className={timerState === 'running' ? 'danger' : 'success'} onClick={toggleTimer} style={{ width: 'auto', padding: '1rem 3rem' }}>
          {timerState === 'running' ? 'Finalizar Atendimento' : 'Iniciar Timer'}
        </button>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <h3>Meus Últimos Registros</h3>
        <table>
          <thead><tr><th>Data</th><th>Cliente</th><th>Início</th><th>Fim</th><th>Duração</th></tr></thead>
          <tbody>
            {logs.filter(l => l.user_name === user.name).slice(0, 8).map(log => {
              const client = clients.find(c => c.id === log.client_id);
              return (
                <tr key={log.id}>
                  <td>{log.log_date}</td>
                  <td>{client ? client.name : 'Excluído'}</td>
                  <td>{log.start_time}</td><td>{log.end_time}</td>
                  <td style={{ fontWeight: 600 }}>{formatTime(log.duration_seconds)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Clients({ clients, onAddClient, onDeleteClient, onDeleteAllClients }) {
  const [name, setName] = useState('');
  const [fee, setFee] = useState('');
  const [hours, setHours] = useState('');
  const [document, setDocument] = useState('');
  const [plan, setPlan] = useState('');
  const [tmf, setTmf] = useState('');
  const [tmc, setTmc] = useState('');
  const [tmp, setTmp] = useState('');
  const [uploading, setUploading] = useState(false);

  const safeNumber = (val) => {
    // Se já for número (ex: valores direto do Excel), retorna direto
    if (typeof val === 'number') {
      // CNPJs são números grandes; se for um número com mais de 10 dígitos, provavelmente é documento
      if (val > 9999999999) return 0;
      return val;
    }
    if (!val) return 0;
    const s = String(val).trim();
    
    // Suporte para Tempo em Excel (HH:MM)
    if (/^\d{1,3}:\d{2}(:\d{2})?$/.test(s)) {
      const parts = s.split(':').map(Number);
      return (isNaN(parts[0]) ? 0 : parts[0]) + (isNaN(parts[1]) ? 0 : parts[1] / 60);
    }

    // Remove símbolos de moeda e espaços, aceita decimais
    const normalized = s
      .replace(/R\$|\s/g, '')
      .replace(',', '.')
      .replace(/[^\d.]/g, '');
    
    const p = parseFloat(normalized);
    // Segurança: rejeita valores absurdamente grandes (CNPJ disfarçado)
    if (isNaN(p) || p > 9999999) return 0;
    return p;
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    const calculatedTtc = safeNumber(tmf) + safeNumber(tmc) + safeNumber(tmp);
    if(name && fee) {
      try {
        await onAddClient({ 
          name, 
          monthly_fee: safeNumber(fee), 
          contracted_hours: calculatedTtc,
          document: document || null,
          plan: plan || null,
          tmf: safeNumber(tmf),
          tmc: safeNumber(tmc),
          tmp: safeNumber(tmp)
        });
        setName(''); setFee(''); setDocument(''); setPlan(''); setTmf(''); setTmc(''); setTmp('');
      } catch(e) {}
    }
  };

  const handleExcelUpload = async (e) => {
    const file = e.target.files[0];
    if(!file) return;
    setUploading(true);
    try {
      const rows = await readXlsxFile(file);
      if(rows.length < 2) throw new Error("A planilha precisa ter pelo menos uma linha de cabeçalho e uma de dados.");

      // PASSO 1: Mostrar os cabeçalhos detectados para debug
      const rawHeaders = rows[0];
      const headerRow = rawHeaders.map(h => String(h || '').toLowerCase().trim());
      
      // PASSO 2: Mapeamento EXATO de colunas (case-insensitive, sem match parcial por padrão)
      const findCol = (...terms) => {
        for (const term of terms) {
          const idx = headerRow.findIndex(h => h === term.toLowerCase().trim());
          if (idx !== -1) return idx;
        }
        return -1;
      };

      const iName = findCol('nome', 'cliente', 'empresa', 'razao social', 'razão social', 'nome da empresa', 'nome empresa');
      const iDoc  = findCol('cpf/cnpj', 'cnpj', 'cpf', 'documento', 'doc');
      const iPlan = findCol('plano', 'pacote', 'servico', 'serviço', 'categoria', 'tipo');
      const iFee  = findCol('mensalidade', 'valor', 'honorario', 'honorário', 'faturamento', 'valor mensal');
      const iTmf  = findCol('tmf', 'tempo médio fiscal', 'tempo medio fiscal', 'fiscal');
      const iTmc  = findCol('tmc', 'tempo médio contábil', 'tempo medio contabil', 'contábil', 'contabil');
      const iTmp  = findCol('tmp', 'tempo médio pessoal', 'tempo medio pessoal', 'pessoal', 'dp');
      const iTTC  = findCol('ttc', 'tempo total contratado', 'total contratado', 'franquia', 'tempo vendido');

      if(iName === -1) {
        alert(`Não encontrei a coluna de 'Nome/Cliente'.\n\nColunas detectadas na sua planilha:\n${rawHeaders.map((h,i) => `  Col ${i+1}: "${h}"`).join('\n')}\n\nUse um dos cabeçalhos: Nome, Cliente, Empresa, Razao Social`);
        setUploading(false);
        return;
      }

      // DEBUG: mostra o mapeamento encontrado para o usuário confirmar
      const mapReport = [
        `Nome: col ${iName+1} = "${rawHeaders[iName]}"`,
        iDoc  >= 0 ? `Documento: col ${iDoc+1}  = "${rawHeaders[iDoc]}"` : `Documento: NÃO ENCONTRADO`,
        iPlan >= 0 ? `Plano: col ${iPlan+1}     = "${rawHeaders[iPlan]}"` : `Plano: NÃO ENCONTRADO`,
        iFee  >= 0 ? `Mensalidade: col ${iFee+1} = "${rawHeaders[iFee]}"` : `Mensalidade: NÃO ENCONTRADO`,
        iTmf  >= 0 ? `TMF: col ${iTmf+1}        = "${rawHeaders[iTmf]}"` : `TMF: NÃO ENCONTRADO (ficará 0)`,
        iTmc  >= 0 ? `TMC: col ${iTmc+1}        = "${rawHeaders[iTmc]}"` : `TMC: NÃO ENCONTRADO (ficará 0)`,
        iTmp  >= 0 ? `TMP: col ${iTmp+1}        = "${rawHeaders[iTmp]}"` : `TMP: NÃO ENCONTRADO (ficará 0)`,
        iTTC  >= 0 ? `TTC: col ${iTTC+1}        = "${rawHeaders[iTTC]}"` : `TTC: NÃO ENCONTRADO (ficará 0)`,
      ].join('\n');
      
      const confirm = window.confirm(`Mapeamento de colunas detectado:\n\n${mapReport}\n\nDeseja prosseguir com a importação?`);
      if (!confirm) { setUploading(false); return; }

      const dataRows = rows.slice(1);
      let successCount = 0;

      for(let row of dataRows) {
        const cName = row[iName];
        if(!cName) continue;

        const cFee  = iFee >= 0  ? row[iFee]  : 0;
        const cDoc  = iDoc >= 0  ? row[iDoc]  : null;
        const cPlan = iPlan >= 0 ? row[iPlan] : null;
        const cTmf  = iTmf >= 0  ? row[iTmf]  : 0;
        const cTmc  = iTmc >= 0  ? row[iTmc]  : 0;
        const cTmp  = iTmp >= 0  ? row[iTmp]  : 0;
        const cTtc  = iTTC >= 0  ? row[iTTC]  : 0;

        const valTmf = safeNumber(cTmf);
        const valTmc = safeNumber(cTmc);
        const valTmp = safeNumber(cTmp);
        // TTC = soma dos médios; se não houver médios, usa coluna TTC diretamente
        const valTtc = (valTmf + valTmc + valTmp) > 0
          ? (valTmf + valTmc + valTmp)
          : safeNumber(cTtc);

        try {
          await onAddClient({
            name: String(cName),
            monthly_fee: safeNumber(cFee),
            contracted_hours: valTtc,
            document: cDoc ? String(cDoc) : null,
            plan: cPlan ? String(cPlan) : null,
            tmf: valTmf,
            tmc: valTmc,
            tmp: valTmp
          });
          successCount++;
        } catch(err) {
          console.error('Erro ao importar linha:', cName, err);
          break;
        }
      }

      if(successCount > 0) alert(`✅ ${successCount} clientes importados com sucesso!`);
    } catch(err) {
      alert("Erro ao decodificar Planilha Excel. Garanta que o arquivo possui extensão .xlsx\n" + err.message);
    }
    setUploading(false);
    e.target.value = ''; 
  };

  return (
    <div className="container">
      <div className="page-header flex justify-between items-center" style={{ flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title"><Users size={28} color="var(--primary)" /> Gerenciar Clientes</h1>
          <p className="page-subtitle">Adicione manualmente, ou importe via Excel (XLSX)</p>
        </div>
        <div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'var(--success)', color: '#fff', padding: '0.75rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
            {uploading ? 'Importando...' : <><Upload size={20} /> Importar Excel</>}
            <input type="file" accept=".xlsx" onChange={handleExcelUpload} style={{ display: 'none' }} disabled={uploading} />
          </label>
        </div>
      </div>

      <div className="card">
        <h3>Adicionar Manualmente</h3>
        <form onSubmit={handleAdd} className="grid grid-3" style={{ marginTop: '1rem', alignItems: 'end' }}>
          <div><label style={{display:'block', marginBottom:'0.5rem', fontSize:'0.85rem', fontWeight:500}}>Nome da Empresa *</label><input placeholder="Ex: Acme Corp" required value={name} onChange={e => setName(e.target.value)} style={{marginBottom: 0}} /></div>
          <div><label style={{display:'block', marginBottom:'0.5rem', fontSize:'0.85rem', fontWeight:500}}>CPF/CNPJ</label><input placeholder="Documento Fiscal" value={document} onChange={e => setDocument(e.target.value)} style={{marginBottom: 0}} /></div>
          <div><label style={{display:'block', marginBottom:'0.5rem', fontSize:'0.85rem', fontWeight:500}}>Plano / Serviço</label><input placeholder="Ex: Premium" value={plan} onChange={e => setPlan(e.target.value)} style={{marginBottom: 0}} /></div>
          <div><label style={{display:'block', marginBottom:'0.5rem', fontSize:'0.85rem', fontWeight:500}}>Mensalidade (R$) *</label><input type="number" step="0.01" required value={fee} onChange={e => setFee(e.target.value)} style={{marginBottom: 0}} /></div>
          
          <div>
            <label style={{display:'block', marginBottom:'0.5rem', fontSize:'0.85rem', fontWeight:600, color: 'var(--primary)'}}>TTC (Calculado Automaticamente)</label>
            <input type="text" readOnly disabled value={(safeNumber(tmf) + safeNumber(tmc) + safeNumber(tmp)) + " h"} style={{marginBottom: 0, background: '#f3f4f6', fontWeight: 700}} />
          </div>

          <div><label style={{display:'block', marginBottom:'0.5rem', fontSize:'0.85rem', fontWeight:500}}>TMF (Tempo Médio Fiscal)</label><input type="number" step="0.01" value={tmf} placeholder="Horas" onChange={e => setTmf(e.target.value)} style={{marginBottom: 0}} /></div>
          <div><label style={{display:'block', marginBottom:'0.5rem', fontSize:'0.85rem', fontWeight:500}}>TMC (Tempo Médio Contábil)</label><input type="number" step="0.01" value={tmc} placeholder="Horas" onChange={e => setTmc(e.target.value)} style={{marginBottom: 0}} /></div>
          <div><label style={{display:'block', marginBottom:'0.5rem', fontSize:'0.85rem', fontWeight:500}}>TMP (Tempo Médio Pessoal)</label><input type="number" step="0.01" value={tmp} placeholder="Horas" onChange={e => setTmp(e.target.value)} style={{marginBottom: 0}} /></div>
          <div style={{ gridColumn: '1 / -1' }}><button type="submit" className="btn-primary">Cadastrar na Carteira</button></div>
        </form>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>Carteira de Clientes ({clients.length})</h3>
          {clients.length > 0 && (
            <button className="danger" onClick={onDeleteAllClients} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
              Excluir Todos os {clients.length} Clientes
            </button>
          )}
        </div>
        <table>
          <thead><tr><th>Cliente</th><th>Documento</th><th>Plano</th><th>Mensalidade</th><th>TTC</th><th>TMF</th><th>TMC</th><th>TMP</th><th>Ação</th></tr></thead>
          <tbody>
            {clients.map(c => (
              <tr key={c.id}>
                <td style={{ fontWeight: 500 }}>{c.name}</td>
                <td>{c.document || '-'}</td>
                <td>{c.plan || '-'}</td>
                <td>R$ {parseFloat(c.monthly_fee).toFixed(2)}</td>
                <td>{c.contracted_hours} h</td>
                <td>{c.tmf || 0} h</td>
                <td>{c.tmc || 0} h</td>
                <td>{c.tmp || 0} h</td>
                <td><button className="danger" onClick={() => onDeleteClient(c.id)}>Excluir</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Settings({ config, onSaveConfig }) {
  const [cost, setCost] = useState(config?.hourly_cost || '');

  const handleSave = (e) => {
    e.preventDefault();
    onSaveConfig(parseFloat(cost));
    alert("Custo Base salvo com sucesso!");
  };

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title"><SettingsIcon size={28} color="var(--primary)" /> Configurações Gerais</h1>
        <p className="page-subtitle">Ajuste de métricas globais e custos operacionais</p>
      </div>

      <div className="card" style={{ maxWidth: '600px' }}>
        <h3>Custo do Escritório</h3>
        <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '2rem' }}>O "Custo Hora" serve para converter as horas contadas do timer em reais (R$) para o cálculo de rentabilidade.</p>
        <form onSubmit={handleSave}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Custo-Hora Global (R$)</label>
          <input type="number" step="0.01" value={cost} onChange={e => setCost(e.target.value)} placeholder="0.00" />
          <button type="submit" className="btn-primary">Salvar Custo</button>
        </form>
      </div>
    </div>
  );
}

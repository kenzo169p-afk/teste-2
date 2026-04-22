import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';

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
  const [view, setView] = useState('timesheet'); 
  
  const [clients, setClients] = useState([]);
  const [config, setConfig] = useState({ id: 1, hourly_cost: 50 });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => setStorage('current_user', user), [user]);

  // Carregar dados iniciais do Supabase
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

  if (!user) return <Login onLogin={setUser} />;

  return (
    <div className="container">
      <header className="flex justify-between items-center" style={{ marginBottom: '2rem', marginTop: '1rem' }}>
        <div>
          <h1 style={{ color: 'var(--primary)' }}>BPO Supabase Tracker</h1>
          <p>Olá, {user.name} ({user.role})</p>
        </div>
      </header>

      <nav>
        <button className={view === 'timesheet' ? 'active' : ''} onClick={() => setView('timesheet')}>Timer Colaborador</button>
        {user.role === 'admin' && (
          <>
            <button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}>Dashboard</button>
            <button className={view === 'clients' ? 'active' : ''} onClick={() => setView('clients')}>Carteira</button>
            <button className={view === 'settings' ? 'active' : ''} onClick={() => setView('settings')}>Custo do Escritório</button>
          </>
        )}
        <button className="logout-btn" onClick={() => setUser(null)}>Sair da Plataforma</button>
      </nav>

      {loading && <div style={{textAlign: 'center', margin: '2rem 0', color: 'var(--primary)'}}>Sincronizando banco de dados...</div>}

      <main>
        {view === 'timesheet' && !loading && (
          <Timesheet user={user} clients={clients} logs={logs} 
            onAddLog={async (log) => {
              // Salvar no Supabase
              const { data, error } = await supabase.from('logs').insert([log]).select();
              if (data) setLogs([data[0], ...logs]);
              if (error) alert("Erro ao salvar log: " + error.message);
            }} 
          />
        )}
        {view === 'dashboard' && !loading && <Dashboard clients={clients} logs={logs} config={config} />}
        {view === 'clients' && !loading && (
          <Clients clients={clients} 
            onAddClient={async (newClient) => {
              const { data, error } = await supabase.from('clients').insert([newClient]).select();
              if (data) setClients([...clients, data[0]]);
              if (error) alert("Erro ao cadastrar cliente: " + error.message);
            }}
            onDeleteClient={async (id) => {
              await supabase.from('clients').delete().eq('id', id);
              setClients(clients.filter(c => c.id !== id));
            }}
          />
        )}
        {view === 'settings' && !loading && (
          <Settings config={config} 
            onSaveConfig={async (newCost) => {
              // Se tiver ID atualiza, senao insere (ou usa update genérico na config de ID 1)
              const { data, error } = await supabase
                .from('config')
                .update({ hourly_cost: newCost })
                .eq('id', config.id || 1)
                .select();
              
              if(data && data.length > 0) {
                setConfig(data[0]);
                alert("Custo Base atualizado no Supabase!");
              } else {
                alert("Erro ao buscar configuração ID 1. Garanta que rodou os Scripts SQL!");
              }
            }} 
          />
        )}
      </main>
    </div>
  );
}

// --- TELAS ---

function Login({ onLogin }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('colaborador');

  const handleLogin = (e) => {
    e.preventDefault();
    if(name.trim()) onLogin({ id: Date.now(), name, role });
  };

  return (
    <div className="login-container">
      <div className="card login-box">
        <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>Acesso à Plataforma</h2>
        <form onSubmit={handleLogin} className="flex-col">
          <div>
            <label>Nome do Usuário</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Digite seu nome..." />
          </div>
          <div>
            <label>Tipo de Acesso</label>
            <select value={role} onChange={e => setRole(e.target.value)}>
              <option value="colaborador">Colaborador (Visualiza só o Timer)</option>
              <option value="admin">Gestor (Acesso a relatórios e custos)</option>
            </select>
          </div>
          <button type="submit" style={{ marginTop: '1rem' }}>Entrar</button>
        </form>
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
    if (!selectedClient) return alert("Selecione um cliente para começar!");

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
    <div>
      <div className="card flex-col items-center">
        <h2>Timer Inteligente</h2>
        <p>Aponte suas horas. Selecione o cliente e inicie a contagem.</p>
        
        <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)} disabled={timerState === 'running'} style={{ maxWidth: '400px', marginTop: '1rem' }}>
          <option value="">-- Indique o Cliente que irá atender --</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <div className="timer-display">{formatTime(seconds)}</div>

        <button className={timerState === 'running' ? 'danger' : 'success'} onClick={toggleTimer} style={{ fontSize: '1.2rem', padding: '1rem 3rem' }}>
          {timerState === 'running' ? 'Encerrar Atendimento' : 'Iniciar Timer de Trabalho'}
        </button>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <h3>Seu Histórico de Registros</h3>
        <table>
          <thead><tr><th>Data</th><th>Cliente</th><th>Início</th><th>Fim</th><th>Duração</th></tr></thead>
          <tbody>
            {logs.filter(l => l.user_name === user.name).slice(0, 10).map(log => {
              const client = clients.find(c => c.id === log.client_id);
              return (
                <tr key={log.id}>
                  <td>{log.log_date}</td>
                  <td>{client ? client.name : 'Excluído'}</td>
                  <td>{log.start_time}</td><td>{log.end_time}</td>
                  <td>{formatTime(log.duration_seconds)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Clients({ clients, onAddClient, onDeleteClient }) {
  const [name, setName] = useState('');
  const [fee, setFee] = useState('');
  const [hours, setHours] = useState('');

  const handleAdd = (e) => {
    e.preventDefault();
    if(name && fee && hours) {
      onAddClient({ name, monthly_fee: parseFloat(fee), contracted_hours: parseFloat(hours) });
      setName(''); setFee(''); setHours('');
    }
  };

  return (
    <div>
      <div className="card">
        <h3>Cadastrar Novo Cliente</h3>
        <form onSubmit={handleAdd} className="grid grid-3" style={{ marginTop: '1rem' }}>
          <div><label>Nome da Empresa / Cliente</label><input placeholder="Ex: Acme Corp" value={name} onChange={e => setName(e.target.value)} /></div>
          <div><label>Plano Vendido (Mensalidade R$)</label><input type="number" step="0.01" value={fee} onChange={e => setFee(e.target.value)} /></div>
          <div><label>Tempo Vendido (Horas/mês)</label><input type="number" step="1" value={hours} onChange={e => setHours(e.target.value)} /></div>
          <div style={{ gridColumn: '1 / -1' }}><button type="submit">Cadastrar na Carteira</button></div>
        </form>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <h3>Carteira do Escritório</h3>
        <table>
          <thead><tr><th>Cliente</th><th>Mensalidade</th><th>Tempo Contratado</th><th>Ação</th></tr></thead>
          <tbody>
            {clients.map(c => (
              <tr key={c.id}>
                <td>{c.name}</td><td>R$ {parseFloat(c.monthly_fee).toFixed(2)}</td><td>{c.contracted_hours} horas</td>
                <td><button className="danger" onClick={() => onDeleteClient(c.id)}>X</button></td>
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
  };

  return (
    <div className="card">
      <h2>Métricas Base do Escritório</h2>
      <p>O "Custo Hora" serve para converter as horas contadas do timer em reais (R$) e confrontar com a mensalidade do cliente.</p>
      <form onSubmit={handleSave} style={{ maxWidth: '400px', marginTop: '2rem' }}>
        <label>Custo-Hora Global (R$)</label>
        <input type="number" step="0.01" value={cost} onChange={e => setCost(e.target.value)} />
        <button type="submit">Salvar Cadastro de Custo</button>
      </form>
    </div>
  );
}

function Dashboard({ clients, logs, config }) {
  const data = clients.map(client => {
    const totalSeconds = logs.filter(l => l.client_id === client.id).reduce((acc, l) => acc + l.duration_seconds, 0);
    const totalHoursSpent = totalSeconds / 3600;
    const realCost = totalHoursSpent * (config.hourly_cost || 0);
    const profit = parseFloat(client.monthly_fee) - realCost;
    const efficiency = client.contracted_hours > 0 ? (totalHoursSpent / client.contracted_hours) * 100 : 0;
    const status = efficiency > 100 ? "Prejuízo / Estouro" : (efficiency > 80 ? "Atenção Tática" : "Dentro da Margem");

    return { ...client, totalHoursSpent, realCost, profit, isProfitable: profit >= 0, efficiency, status };
  });

  const totalRevenue = data.reduce((acc, c) => acc + parseFloat(c.monthly_fee), 0);
  const totalCost = data.reduce((acc, c) => acc + c.realCost, 0);
  const globalProfit = totalRevenue - totalCost;

  return (
    <div>
      <div className="grid grid-3" style={{ marginBottom: '2rem' }}>
        <div className="stat-box"><div>Total do Plano Vendido (Faturamento)</div><div className="stat-value">R$ {totalRevenue.toFixed(2)}</div></div>
        <div className="stat-box"><div>Custo Gerado (Timer x R$/h)</div><div className="stat-value">R$ {totalCost.toFixed(2)}</div></div>
        <div className={`stat-box ${globalProfit >= 0 ? 'profit' : 'loss'}`}>
          <div>Rentabilidade Real</div><div className="stat-value">R$ {globalProfit.toFixed(2)}</div>
        </div>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <h3>Visão de Eficiência Operacional e Lucro por Cliente</h3>
        <table>
          <thead>
            <tr><th>Cliente</th><th>Plano Negociado</th><th>Custo Operacional</th><th>Margem Final</th><th>Time Sheet / Vendido</th><th>Status</th></tr>
          </thead>
          <tbody>
            {data.map(c => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>R$ {parseFloat(c.monthly_fee).toFixed(2)}</td>
                <td>R$ {c.realCost.toFixed(2)}</td>
                <td style={{ color: c.isProfitable ? 'var(--success)' : 'var(--danger)', fontWeight: 'bold' }}>R$ {c.profit.toFixed(2)}</td>
                <td>{c.totalHoursSpent.toFixed(2)}h / {c.contracted_hours}h</td>
                <td style={{ color: c.status.includes('Prejuízo') ? 'var(--danger)' : (c.status.includes('Atenção') ? 'orange' : 'var(--success)') }}>
                  {c.status} ({c.efficiency.toFixed(0)}%)
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

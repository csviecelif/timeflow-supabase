import React, { useState, useEffect, useRef } from 'react';
import { Clock, Play, Square, CheckCircle, Circle, Plus, Edit3, Trash2, Filter, BarChart3, Target, List, Grid, Calendar, Timer, TrendingUp } from 'lucide-react';
// NOVO: Importa a conexão com o Supabase
import { supabase } from './supabaseClient.js';

const TimeFlow = () => {
  // ==================================================================
  // ESTADOS E HOOKS
  // ==================================================================

  // Estados principais
  const [currentPage, setCurrentPage] = useState('pomodoro');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Estados do Timer
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerMode] = useState('foco');

  // MODIFICADO: Estados agora são controlados pelo React, sem o hook customizado
  const [sessions, setSessions] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [goals, setGoals] = useState([]);

  // Estados de UI para Tarefas e Metas
  const [taskView, setTaskView] = useState('lista');
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [taskFilter, setTaskFilter] = useState('todas');
  const [showGoalForm, setShowGoalForm] = useState(false);

  // MODIFICADO: Estado para as configurações, com persistência no localStorage
  const [settings, setSettings] = useState(() => {
    const savedSettings = localStorage.getItem('timeflow_settings');
    return savedSettings ? JSON.parse(savedSettings) : {
      tempo_foco_padrão: 25,
      tempo_pausa_padrão: 5,
      meta_diaria_minutos: 240
    };
  });

  const timerRef = useRef(null);

  // NOVO: Hook para salvar as configurações no localStorage sempre que elas mudarem
  useEffect(() => {
    localStorage.setItem('timeflow_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const { data: tasksData, error: tasksError } = await supabase.from('tasks').select('*').order('data_criacao', { ascending: false });
        if (tasksError) throw tasksError;
        setTasks(tasksData || []);

        const { data: sessionsData, error: sessionsError } = await supabase.from('sessions').select('*').order('data_criacao', { ascending: false });
        if (sessionsError) throw sessionsError;
        setSessions(sessionsData || []);

        const { data: goalsData, error: goalsError } = await supabase.from('goals').select('*').order('data_criacao', { ascending: false });
        if (goalsError) throw goalsError;
        setGoals(goalsData || []);
      } catch (error) {
        console.error("Erro ao carregar dados do Supabase:", error);
      }
    };

    fetchInitialData();
  }, []);


  // Efeito do Timer (sem alterações)
  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => {
        setTimerSeconds(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isTimerRunning]);

  // ==================================================================
  // FUNÇÕES DE LÓGICA
  // ==================================================================

  // Funções do Timer (formatTime e startTimer sem alterações)
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startTimer = () => {
    setIsTimerRunning(true);
  };

  // MODIFICADO: stopTimer agora salva no Supabase
  const stopTimer = async () => {
    setIsTimerRunning(false);
    if (timerSeconds >= 60) {
      const newSession = {
        duracao: Math.floor(timerSeconds / 60),
        tipo: 'foco',
        completada: true,
      };
      const { data, error } = await supabase.from('sessions').insert([newSession]).select();
      if (error) {
        console.error('Erro ao salvar sessão:', error);
      } else if (data) {
        setSessions(prev => [data[0], ...prev]);
        playNotificationSound();
      }
    }
    setTimerSeconds(0);
  };

  // Função de notificação (sem alterações)
  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.log('Notification sound not available');
    }
  };

  // MODIFICADO: Funções de Tarefas agora são 'async' e usam Supabase
  const addTask = async (taskData) => {
    const { data, error } = await supabase.from('tasks').insert([taskData]).select();
    if (error) {
      console.error('Erro ao adicionar tarefa:', error);
    } else if (data) {
      setTasks(prev => [data[0], ...prev]);
      setShowTaskForm(false);
    }
  };

  const updateTask = async (taskId, updates) => {
    const { data, error } = await supabase.from('tasks').update(updates).eq('id', taskId).select();
    if (error) {
      console.error('Erro ao atualizar tarefa:', error);
    } else if (data) {
      setTasks(prev => prev.map(task => (task.id === taskId ? data[0] : task)));
    }
  };

  const deleteTask = async (taskId) => {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) {
      console.error('Erro ao deletar tarefa:', error);
    } else {
      setTasks(prev => prev.filter(task => task.id !== taskId));
    }
  };

  const toggleTaskComplete = (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
        const newStatus = task.status === 'concluida' ? 'pendente' : 'concluida';
        const updates = {
            status: newStatus,
            data_conclusao: newStatus === 'concluida' ? new Date().toISOString() : null
        };
        updateTask(taskId, updates);
    }
  };

  // MODIFICADO: Função de Metas agora é 'async' e usa Supabase
  const addGoal = async (goalData) => {
    const { data, error } = await supabase.from('goals').insert([goalData]).select();
     if (error) {
        console.error('Erro ao adicionar meta:', error);
     } else if (data) {
        setGoals(prev => [data[0], ...prev]);
     }
  };

  // Funções de cálculo de estatísticas (sem alterações)
  const getTodayStats = () => {
    const today = new Date().toDateString();
    const todaySessions = sessions.filter(session => new Date(session.created_at).toDateString() === today && session.tipo === 'foco');
    const totalMinutes = todaySessions.reduce((sum, session) => sum + session.duracao, 0);
    const progressPercent = Math.min((totalMinutes / settings.meta_diaria_minutos) * 100, 100);
    return { totalMinutes, sessionsCount: todaySessions.length, progressPercent };
  };

  const getFilteredTasks = () => {
    if (taskFilter === 'todas') return tasks;
    return tasks.filter(task => task.status === taskFilter);
  };

  // ==================================================================
  // RENDERIZAÇÃO DOS COMPONENTES (JSX)
  // ==================================================================

  const Sidebar = () => {
    const todayStats = getTodayStats();
    return (
      <div className={`bg-gray-800 h-screen flex flex-col transition-all duration-300 ${sidebarCollapsed ? 'w-16' : 'w-64'}`}>
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
              <Clock className="w-6 h-6 text-white" />
            </div>
            {!sidebarCollapsed && (
              <div>
                <h1 className="text-white font-bold text-lg">TimeFlow</h1>
                <p className="text-gray-400 text-sm">Gestão de Tempo Inteligente</p>
              </div>
            )}
          </div>
        </div>
        <div className="flex-1 p-4">
          <div className="space-y-2">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-3">
              {!sidebarCollapsed && 'Ferramentas'}
            </p>
            {[
              { id: 'pomodoro', icon: Timer, label: '🍅 Pomodoro' },
              { id: 'tasks', icon: CheckCircle, label: '✅ Tarefas' },
              { id: 'goals', icon: Target, label: '🎯 Metas' },
              { id: 'insights', icon: BarChart3, label: '📊 Insights' }
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                  currentPage === item.id ? 'bg-purple-500 text-white' : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="p-4 border-t border-gray-700">
          {!sidebarCollapsed && (
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">Status Hoje</p>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <span className="text-gray-300 text-sm">
                  Foco: {(todayStats.totalMinutes / 60).toFixed(1)}h / {settings.meta_diaria_minutos / 60}h
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const PomodoroPage = () => {
    const todayStats = getTodayStats();
    return (
      <div className="space-y-8">
        <div className="bg-gray-800 rounded-xl p-8 text-center">
          <div className={`text-6xl font-mono font-bold text-white mb-8 ${isTimerRunning ? 'animate-pulse' : ''}`}>
            {formatTime(timerSeconds)}
          </div>
          <div className="flex justify-center space-x-4">
            {!isTimerRunning ? (
              <button
                onClick={startTimer}
                className="bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-lg flex items-center space-x-2 transition-colors text-lg font-semibold"
              >
                <Play className="w-6 h-6" />
                <span>Iniciar</span>
              </button>
            ) : (
              <button
                onClick={stopTimer}
                className="bg-red-500 hover:bg-red-600 text-white px-8 py-4 rounded-lg flex items-center space-x-2 transition-colors text-lg font-semibold"
              >
                <Square className="w-6 h-6" />
                <span>Parar</span>
              </button>
            )}
          </div>
        </div>
        <div className="bg-gray-800 rounded-xl p-6">
          <h3 className="text-white text-lg font-semibold mb-4">Meta de Foco Diário</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-300">
                {todayStats.totalMinutes} de {settings.meta_diaria_minutos} minutos completados
              </span>
              <span className="text-purple-400 font-semibold">
                {todayStats.progressPercent.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-3">
              <div
                className="bg-purple-500 h-3 rounded-full transition-all duration-300"
                style={{ width: `${todayStats.progressPercent}%` }}
              ></div>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-xl p-6">
          <h3 className="text-white text-lg font-semibold mb-4">Últimas Sessões de Foco</h3>
          <div className="space-y-3">
            {sessions.slice(0, 5).map(session => (
              <div key={session.id} className="flex justify-between items-center p-3 bg-gray-700 rounded-lg">
                <div>
                  <span className={`inline-block w-3 h-3 rounded-full mr-3 bg-green-500`}></span>
                  <span className="text-white">Foco</span>
                </div>
                <div className="text-right">
                  <div className="text-white font-semibold">{session.duracao} min</div>
                  <div className="text-gray-400 text-sm">
                    {new Date(session.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
            {sessions.length === 0 && (
              <p className="text-gray-400 text-center py-4">Nenhuma sessão registrada ainda</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const TaskForm = ({ task, onSave, onCancel }) => {
    const [formData, setFormData] = useState({
      titulo: task?.titulo || '',
      descricao: task?.descricao || '',
      prioridade: task?.prioridade || 'media',
      urgencia: task?.urgencia || false
    });

    const handleSubmit = (e) => {
      e.preventDefault();
      if (formData.titulo.trim()) {
        onSave(formData);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md">
          <h3 className="text-white text-lg font-semibold mb-4">
            {task ? 'Editar Tarefa' : 'Nova Tarefa'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">Título</label>
              <input
                type="text"
                value={formData.titulo}
                onChange={(e) => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
                className="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                placeholder="Digite o título da tarefa..."
                required
              />
            </div>
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">Descrição</label>
              <textarea
                value={formData.descricao}
                onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                className="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                rows="3"
                placeholder="Descrição opcional..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Prioridade</label>
                <select
                  value={formData.prioridade}
                  onChange={(e) => setFormData(prev => ({ ...prev, prioridade: e.target.value }))}
                  className="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                >
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Urgente</label>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, urgencia: !prev.urgencia }))}
                  className={`w-full p-3 rounded-lg border transition-colors ${
                    formData.urgencia ? 'bg-red-500 text-white border-red-500' : 'bg-gray-700 text-gray-300 border-gray-600 hover:border-red-500'
                  }`}
                >
                  {formData.urgencia ? 'Sim' : 'Não'}
                </button>
              </div>
            </div>
            <div className="flex space-x-3 pt-4">
              <button
                type="submit"
                className="flex-1 bg-purple-500 hover:bg-purple-600 text-white py-3 rounded-lg transition-colors"
              >
                {task ? 'Atualizar' : 'Criar'}
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-lg transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const TasksPage = () => {
    const filteredTasks = getFilteredTasks();
    const EisenhowerMatrix = () => {
      const getQuadrantTasks = (urgent, important) => {
        return tasks.filter(task => {
          const isUrgent = task.urgencia;
          const isImportant = task.prioridade === 'alta';
          return isUrgent === urgent && isImportant === important;
        });
      };
      const quadrants = [
        { title: 'Urgente + Importante', tasks: getQuadrantTasks(true, true), color: 'bg-red-900' },
        { title: 'Importante + Não Urgente', tasks: getQuadrantTasks(false, true), color: 'bg-purple-900' },
        { title: 'Urgente + Não Importante', tasks: getQuadrantTasks(true, false), color: 'bg-yellow-900' },
        { title: 'Não Urgente + Não Importante', tasks: getQuadrantTasks(false, false), color: 'bg-gray-700' }
      ];
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quadrants.map((quadrant, index) => (
            <div key={index} className={`${quadrant.color} rounded-xl p-4`}>
              <h4 className="text-white font-semibold mb-3">{quadrant.title}</h4>
              <div className="space-y-2">
                {quadrant.tasks.map(task => (
                  <div key={task.id} className="bg-black bg-opacity-20 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-white text-sm">{task.titulo}</span>
                      <button
                        onClick={() => toggleTaskComplete(task.id)}
                        className={`w-5 h-5 rounded border-2 transition-colors ${
                          task.status === 'concluida' ? 'bg-green-500 border-green-500' : 'border-gray-400 hover:border-green-500'
                        }`}
                      >
                        {task.status === 'concluida' && (
                          <CheckCircle className="w-3 h-3 text-white m-auto" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
                {quadrant.tasks.length === 0 && (
                  <p className="text-gray-400 text-sm">Nenhuma tarefa</p>
                )}
              </div>
            </div>
          ))}
        </div>
      );
    };

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">Gestão de Tarefas</h2>
          <button
            onClick={() => setShowTaskForm(true)}
            className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Tarefa</span>
          </button>
        </div>
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex space-x-2">
              {[
                { id: 'lista', icon: List, label: 'Lista' },
                { id: 'matriz', icon: Grid, label: 'Matriz' },
                { id: 'cronograma', icon: Calendar, label: 'Cronograma' }
              ].map(view => (
                <button
                  key={view.id}
                  onClick={() => setTaskView(view.id)}
                  className={`px-3 py-2 rounded-lg flex items-center space-x-2 transition-colors ${
                    taskView === view.id ? 'bg-purple-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <view.icon className="w-4 h-4" />
                  <span>{view.label}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center space-x-3">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={taskFilter}
                onChange={(e) => setTaskFilter(e.target.value)}
                className="bg-gray-700 text-white rounded-lg px-3 py-2 border border-gray-600 focus:border-purple-500 focus:outline-none"
              >
                <option value="todas">Todas</option>
                <option value="pendente">Pendentes</option>
                <option value="concluida">Concluídas</option>
              </select>
            </div>
          </div>
        </div>
        {taskView === 'lista' && (
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-xl p-6">
              <h3 className="text-white text-lg font-semibold mb-4">Tarefas Ativas</h3>
              <div className="space-y-3">
                {filteredTasks.filter(task => task.status !== 'concluida').map(task => (
                  <div key={task.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => toggleTaskComplete(task.id)}
                        className="w-5 h-5 rounded border-2 border-gray-400 hover:border-green-500 transition-colors"
                      ></button>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-white font-medium">{task.titulo}</span>
                          <span className={`px-2 py-1 rounded text-xs ${
                            task.prioridade === 'alta' ? 'bg-red-500 text-white' :
                            task.prioridade === 'media' ? 'bg-yellow-500 text-black' :
                            'bg-green-500 text-white'
                          }`}>{task.prioridade}</span>
                          {task.urgencia && (
                            <span className="px-2 py-1 bg-orange-500 text-white rounded text-xs">Urgente</span>
                          )}
                        </div>
                        {task.descricao && (
                          <p className="text-gray-400 text-sm mt-1">{task.descricao}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => { setEditingTask(task); setShowTaskForm(true); }}
                        className="p-2 text-gray-400 hover:text-purple-400 transition-colors"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {filteredTasks.filter(task => task.status !== 'concluida').length === 0 && (
                  <p className="text-gray-400 text-center py-4">Nenhuma tarefa ativa</p>
                )}
              </div>
            </div>
            <div className="bg-gray-800 rounded-xl p-6">
              <h3 className="text-white text-lg font-semibold mb-4">Tarefas Concluídas</h3>
              <div className="space-y-3">
                {filteredTasks.filter(task => task.status === 'concluida').map(task => (
                  <div key={task.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg opacity-60">
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <div>
                        <span className="text-white line-through">{task.titulo}</span>
                        {task.data_conclusao &&
                          <p className="text-gray-500 text-sm">
                            Concluída em {new Date(task.data_conclusao).toLocaleDateString('pt-BR')}
                          </p>
                        }
                      </div>
                    </div>
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {filteredTasks.filter(task => task.status === 'concluida').length === 0 && (
                  <p className="text-gray-400 text-center py-4">Nenhuma tarefa concluída</p>
                )}
              </div>
            </div>
          </div>
        )}
        {taskView === 'matriz' && <EisenhowerMatrix />}
        {taskView === 'cronograma' && (
          <div className="bg-gray-800 rounded-xl p-6">
            <h3 className="text-white text-lg font-semibold mb-4">Cronograma</h3>
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400">Visualização de cronograma em desenvolvimento</p>
            </div>
          </div>
        )}
        {showTaskForm && (
          <TaskForm
            task={editingTask}
            onSave={(taskData) => {
              if (editingTask) {
                updateTask(editingTask.id, taskData);
                setEditingTask(null);
              } else {
                addTask(taskData);
              }
              setShowTaskForm(false);
            }}
            onCancel={() => { setShowTaskForm(false); setEditingTask(null); }}
          />
        )}
      </div>
    );
  };

  const GoalsPage = () => {
    const [newGoal, setNewGoal] = useState({
        titulo: '',
        descricao: '',
        tipo: 'semanal',
        meta_minutos: 240
    });

    // MODIFICADO: Função que lida com o submit do formulário de metas
    const handleGoalSubmit = (e) => {
        e.preventDefault();
        if (newGoal.titulo.trim()) {
            addGoal({
                ...newGoal,
                status: 'ativa',
            });
            setNewGoal({ titulo: '', descricao: '', tipo: 'semanal', meta_minutos: 240 });
            setShowGoalForm(false);
        }
    };

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">Metas e Objetivos</h2>
          <button
            onClick={() => setShowGoalForm(!showGoalForm)}
            className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Meta</span>
          </button>
        </div>
        {showGoalForm && (
          <div className="bg-gray-800 rounded-xl p-6">
            <h3 className="text-white text-lg font-semibold mb-4">Nova Meta</h3>
            <form onSubmit={handleGoalSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">Título</label>
                  <input
                    type="text"
                    value={newGoal.titulo}
                    onChange={(e) => setNewGoal(prev => ({ ...prev, titulo: e.target.value }))}
                    className="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                    placeholder="Ex: Focar 4 horas por dia"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">Tipo</label>
                  <select
                    value={newGoal.tipo}
                    onChange={(e) => setNewGoal(prev => ({ ...prev, tipo: e.target.value }))}
                    className="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                  >
                    <option value="diaria">Diária</option>
                    <option value="semanal">Semanal</option>
                    <option value="mensal">Mensal</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Descrição</label>
                <textarea
                  value={newGoal.descricao}
                  onChange={(e) => setNewGoal(prev => ({ ...prev, descricao: e.target.value }))}
                  className="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                  rows="3"
                  placeholder="Descreva sua meta..."
                />
              </div>
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Meta (minutos)</label>
                <input
                  type="number"
                  value={newGoal.meta_minutos}
                  onChange={(e) => setNewGoal(prev => ({ ...prev, meta_minutos: parseInt(e.target.value) }))}
                  className="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                  min="1"
                />
              </div>
              <div className="flex space-x-3">
                <button type="submit" className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-3 rounded-lg transition-colors">
                  Criar Meta
                </button>
                <button type="button" onClick={() => setShowGoalForm(false)} className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg transition-colors">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {goals.map(goal => (
            <div key={goal.id} className="bg-gray-800 rounded-xl p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-white font-semibold text-lg">{goal.titulo}</h3>
                  <p className="text-gray-400 text-sm capitalize">{goal.tipo}</p>
                </div>
                <span className="bg-purple-500 text-white px-2 py-1 rounded text-sm">{goal.status}</span>
              </div>
              {goal.descricao && (
                <p className="text-gray-300 mb-4">{goal.descricao}</p>
              )}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Progresso</span>
                  <span className="text-purple-400">{goal.meta_minutos} min</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div className="bg-purple-500 h-2 rounded-full w-1/3"></div>
                </div>
              </div>
            </div>
          ))}
          {goals.length === 0 && (
            <div className="col-span-full bg-gray-800 rounded-xl p-12 text-center">
              <Target className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400">Nenhuma meta definida ainda</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const InsightsPage = () => {
    const todayStats = getTodayStats();

    const getWeeklyStats = () => {
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0 (Sun) - 6 (Sat)
      const firstDayOfWeek = new Date(today.setDate(today.getDate() - dayOfWeek));
      firstDayOfWeek.setHours(0, 0, 0, 0);

      const weekSessions = sessions.filter(session => {
        const sessionDate = new Date(session.created_at);
        return sessionDate >= firstDayOfWeek && session.tipo === 'foco';
      });
      return weekSessions.reduce((sum, session) => sum + session.duracao, 0);
    };

    const tasksStats = {
      todayCompleted: tasks.filter(task =>
        task.status === 'concluida' && new Date(task.data_conclusao).toDateString() === new Date().toDateString()
      ).length,
      totalPending: tasks.filter(task => task.status === 'pendente').length
    };

    const weeklyMinutes = getWeeklyStats();

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-white">Insights e Relatórios</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Foco Hoje</p>
                <p className="text-2xl font-bold text-white">{(todayStats.totalMinutes / 60).toFixed(1)}h</p>
              </div>
              <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center">
                <Timer className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
          <div className="bg-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Foco Semanal</p>
                <p className="text-2xl font-bold text-white">{(weeklyMinutes / 60).toFixed(1)}h</p>
              </div>
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
          <div className="bg-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Tarefas Hoje</p>
                <p className="text-2xl font-bold text-white">{tasksStats.todayCompleted}</p>
              </div>
              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
          <div className="bg-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Pendentes</p>
                <p className="text-2xl font-bold text-white">{tasksStats.totalPending}</p>
              </div>
              <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center">
                <Circle className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-xl p-6">
          <h3 className="text-white text-lg font-semibold mb-4">Progresso Semanal</h3>
          <div className="space-y-4">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, index) => {
              const dayDate = new Date();
              dayDate.setDate(dayDate.getDate() - dayDate.getDay() + index);
              const dayDateStr = dayDate.toDateString();
              const dayMinutes = sessions
                .filter(session => new Date(session.created_at).toDateString() === dayDateStr && session.tipo === 'foco')
                .reduce((sum, session) => sum + session.duracao, 0);
              const progress = Math.min((dayMinutes / settings.meta_diaria_minutos) * 100, 100);
              return (
                <div key={day} className="flex items-center space-x-4">
                  <span className="text-gray-300 w-8 text-sm">{day}</span>
                  <div className="flex-1 bg-gray-700 rounded-full h-3">
                    <div
                      className="bg-purple-500 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <span className="text-gray-300 text-sm w-16">
                    {(dayMinutes / 60).toFixed(1)}h
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-gray-900 text-white overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-gray-800 border-b border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="md:hidden p-2 text-gray-400 hover:text-white transition-colors"
            >
              <Grid className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-gray-400">
                  {new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-6">
          {currentPage === 'pomodoro' && <PomodoroPage />}
          {currentPage === 'tasks' && <TasksPage />}
          {currentPage === 'goals' && <GoalsPage />}
          {currentPage === 'insights' && <InsightsPage />}
        </div>
      </div>
    </div>
  );
};

export default TimeFlow;

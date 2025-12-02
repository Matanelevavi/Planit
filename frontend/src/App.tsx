import { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  PlusCircle, Target, Calendar, DollarSign, TrendingUp, Wallet, 
  Edit2, Check, X 
} from 'lucide-react';

// Import the logo
import logo from './assets/logo.png';

// 1. Type Definition matching Backend Schema
interface Goal {
  id: number;
  title: string;
  target_amount: number;
  current_amount: number;
  target_date: string;
  suggestion_monthly_deposit: number;
}

function App() {
  // --- State Management ---
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [newTitle, setNewTitle] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newDate, setNewDate] = useState("");

  // Inline Editing State
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  // --- Lifecycle Methods ---
  useEffect(() => {
    fetchGoals();
  }, []);

  // --- API Handlers ---

  const fetchGoals = async () => {
    try {
      const response = await axios.get('http://127.0.0.1:8000/goals/');
      setGoals(response.data);
    } catch (error) {
      console.error("Error fetching goals:", error);
    }
  };

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const payload = {
        title: newTitle,
        target_amount: parseFloat(newAmount),
        current_amount: 0, 
        target_date: newDate
      };

      await axios.post('http://127.0.0.1:8000/goals/', payload);
      
      setNewTitle("");
      setNewAmount("");
      setNewDate("");
      fetchGoals();
      
    } catch (error) {
      console.error("Error creating goal:", error);
      alert("Failed to create goal. Please check connection.");
    } finally {
      setLoading(false);
    }
  };

  // --- Editing Logic ---

  const startEditing = (goal: Goal) => {
    setEditingId(goal.id);
    setEditValue(goal.current_amount.toString());
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditValue("");
  };

  const saveBalance = async (id: number) => {
    try {
      const payload = {
        current_amount: parseFloat(editValue)
      };

      await axios.put(`http://127.0.0.1:8000/goals/${id}`, payload);
      
      setEditingId(null);
      fetchGoals(); 

    } catch (error) {
      console.error("Failed to update balance:", error);
      alert("Failed to update balance");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      
      {/* Navbar */}
      <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img 
              src={logo} 
              alt="Planit Logo" 
              className="h-10 w-10 rounded-full object-cover border-2 border-indigo-500 shadow-lg shadow-indigo-500/20"
            />
            <span className="text-xl font-bold tracking-tight">Planit</span>
          </div>
          <div className="text-sm text-slate-400">v0.1.0 Beta</div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-12 space-y-12">
        
        {/* Header Section */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Your Financial Goals
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Define your targets. Track your progress. Let our AI optimize your path to financial freedom.
          </p>
        </div>

        {/* Create Goal Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl">
          <div className="flex items-center space-x-3 mb-6">
            <PlusCircle className="text-indigo-400" />
            <h2 className="text-xl font-semibold">Add New Goal</h2>
          </div>
          
          <form onSubmit={handleCreateGoal} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            
            <div className="space-y-2 col-span-2">
              <label className="text-xs uppercase tracking-wider font-semibold text-slate-500">Goal Title</label>
              <div className="relative">
                <Target className="absolute left-3 top-3 text-slate-500" size={18} />
                <input 
                  type="text" 
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder:text-slate-600"
                  placeholder="e.g. Dream Apartment"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider font-semibold text-slate-500">Target Amount</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-3 text-slate-500" size={18} />
                <input 
                  type="number" 
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-600"
                  placeholder="100,000"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider font-semibold text-slate-500">Target Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 text-slate-500" size={18} />
                <input 
                  type="date" 
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-300" 
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  style={{ colorScheme: 'dark' }} 
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed md:col-span-4 mt-4"
            >
              {loading ? 'Creating Plan...' : 'Create Goal Plan'}
            </button>
          </form>
        </div>

        {/* Goals Grid Display */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {goals.map((goal) => (
            <div key={goal.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-indigo-500/50 transition-colors group relative overflow-hidden">
              
              {/* Card Top Section */}
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-slate-800 rounded-lg group-hover:bg-indigo-500/20 group-hover:text-indigo-400 transition-colors">
                  <Wallet size={24} />
                </div>
                
                <div className="text-right">
                  <p className="text-2xl font-bold text-white">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(goal.target_amount)}
                  </p>
                  <p className="text-xs text-slate-500">Target Goal</p>
                </div>
              </div>
              
              <h3 className="text-xl font-semibold mb-1">{goal.title}</h3>
              <p className="text-slate-400 text-sm mb-6 flex items-center gap-2">
                <Calendar size={14} />
                Target: {goal.target_date}
              </p>

              {/* Progress Bar & Balance Update Section */}
              <div className="space-y-3">
                <div className="flex justify-between text-xs font-medium items-end">
                  <span className="text-indigo-400">
                    {Math.round((goal.current_amount / goal.target_amount) * 100) || 0}% Achieved
                  </span>
                  
                  {/* Inline Editing Logic */}
                  {editingId === goal.id ? (
                    <div className="flex items-center gap-2">
                       <input 
                        type="number" 
                        autoFocus
                        className="bg-slate-950 border border-indigo-500 rounded px-2 py-1 w-24 text-right text-white outline-none"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                       />
                       <button onClick={() => saveBalance(goal.id)} className="p-1 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30">
                         <Check size={14} />
                       </button>
                       <button onClick={cancelEditing} className="p-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30">
                         <X size={14} />
                       </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 group/edit cursor-pointer" onClick={() => startEditing(goal)}>
                      <span className="text-slate-300">
                        {/* Fixed: Changed 'ntl' to 'Intl'
                           Fixed: Changed 'compact: short' to 'notation: compact' for valid TS 
                        */}
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'ILS', notation: 'compact', compactDisplay: 'short' }).format(goal.current_amount)} 
                        <span className="text-slate-500 mx-1">/</span> 
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'ILS', notation: 'compact', compactDisplay: 'short' }).format(goal.target_amount)}
                      </span>
                      <Edit2 size={12} className="text-slate-600 group-hover/edit:text-indigo-400 transition-colors" />
                    </div>
                  )}
                </div>

                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-500 w-0 transition-all duration-500"
                    style={{ width: `${Math.round((goal.current_amount / goal.target_amount) * 100) || 0}%` }}
                  ></div>
                </div>
              </div>

              {/* AI Recommendation Badge */}
              <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
                <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">AI Insight</div>
                <div className="flex items-center gap-2 text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full border border-emerald-400/20 shadow-[0_0_10px_rgba(52,211,153,0.1)]">
                  <TrendingUp size={16} />
                  <span className="font-bold">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(goal.suggestion_monthly_deposit)}
                    <span className="text-xs font-normal text-emerald-400/70 ml-1">/ mo</span>
                  </span>
                </div>
              </div>

            </div>
          ))}

          {goals.length === 0 && (
            <div className="col-span-full text-center py-12 text-slate-500 border-2 border-dashed border-slate-800 rounded-2xl">
              <p>No goals defined yet. Start by adding your first financial target above.</p>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}

export default App;
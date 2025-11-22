import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  Trophy, 
  DollarSign, 
  ArrowUpCircle, 
  XCircle, 
  CheckCircle2,
  RefreshCw,
  Plus,
  Trash2,
  EyeOff,
  Eye, 
  Table2,
  ArrowRightLeft,
  RotateCcw, // Undo icon
  Coins // Rebuy icon
} from 'lucide-react';

const TeenPattiManager = () => {
  // --- State Management ---
  const [gameStage, setGameStage] = useState('setup'); // setup, playing, winner, summary
  const [players, setPlayers] = useState([]);
  const [pot, setPot] = useState(0);
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [currentStake, setCurrentStake] = useState(10); // "Seen" stake
  const [settings, setSettings] = useState({
    initialBalance: 1000,
    bootAmount: 10
  });
  const [dealerIndex, setDealerIndex] = useState(0);
  const [logs, setLogs] = useState([]);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [roundHistory, setRoundHistory] = useState([]); 
  
  // History Stack for Undo
  const [historyStack, setHistoryStack] = useState([]);

  const logsEndRef = useRef(null);

  // Scroll logs to bottom
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, gameStage]);

  // --- Actions ---

  const saveToHistory = () => {
    const currentState = {
      gameStage,
      players: JSON.parse(JSON.stringify(players)), // Deep copy
      pot,
      currentTurnIndex,
      currentStake,
      dealerIndex,
      logs: [...logs],
      roundHistory: JSON.parse(JSON.stringify(roundHistory))
    };
    setHistoryStack(prev => [...prev, currentState]);
  };

  const handleUndo = () => {
    if (historyStack.length === 0) return;
    
    const previousState = historyStack[historyStack.length - 1];
    const newStack = historyStack.slice(0, -1);

    setGameStage(previousState.gameStage);
    setPlayers(previousState.players);
    setPot(previousState.pot);
    setCurrentTurnIndex(previousState.currentTurnIndex);
    setCurrentStake(previousState.currentStake);
    setDealerIndex(previousState.dealerIndex);
    setLogs(previousState.logs);
    setRoundHistory(previousState.roundHistory);
    
    setHistoryStack(newStack);
    // Add undo log without saving to history again
    setLogs(prev => [...prev, { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), text: "Action Undone" }]);
  };

  const handleRebuy = (playerId) => {
    saveToHistory();
    setPlayers(players.map(p => {
      if (p.id === playerId) {
        return { ...p, balance: p.balance + 1000 };
      }
      return p;
    }));
    addLog(`Rebuy: Added ₹1000 to chips`);
  };

  const handleSettingChange = (key, value) => {
    if (value === '') {
      setSettings({ ...settings, [key]: '' });
    } else {
      setSettings({ ...settings, [key]: parseInt(value) });
    }
  };

  const addLog = (message) => {
    setLogs(prev => [...prev, { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), text: message }]);
  };

  const addPlayer = (e) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;
    const startBalance = settings.initialBalance === '' ? 0 : settings.initialBalance;
    
    setPlayers([...players, {
      id: Date.now(),
      name: newPlayerName.trim(),
      balance: parseInt(startBalance),
      isFolded: false,
      hasSeenCards: false, 
      totalBetInHand: 0
    }]);
    setNewPlayerName('');
  };

  const removePlayer = (id) => {
    setPlayers(players.filter(p => p.id !== id));
  };

  const startGame = () => {
    if (players.length < 2) {
      alert("Need at least 2 players!");
      return;
    }
    const startBalance = settings.initialBalance === '' ? 1000 : settings.initialBalance;
    setPlayers(players.map(p => ({ ...p, balance: parseInt(startBalance) })));
    setRoundHistory([]);
    setHistoryStack([]);
    addLog("New Game Started");
    startNewHand(true);
  };

  const startNewHand = (isFirstGame = false) => {
    saveToHistory();

    let nextDealerIndex = isFirstGame ? 0 : (dealerIndex + 1) % players.length;

    // Reset player states but KEEP visual order (do not sort or filter)
    let activePlayers = players.map(p => ({
      ...p,
      isFolded: false,
      hasSeenCards: false,
      totalBetInHand: 0
    }));

    let currentPot = 0;
    const boot = settings.bootAmount === '' ? 10 : settings.bootAmount;

    activePlayers = activePlayers.map(p => {
      // Allow negative balance, just deduct
      currentPot += boot; 
      return { 
          ...p, 
          balance: p.balance - boot,
          totalBetInHand: boot 
      };
    });

    addLog(`Boot collected: ${boot} per player.`);

    // Determine starter (Next person after dealer)
    let firstTurnIndex = (nextDealerIndex + 1) % activePlayers.length;

    setDealerIndex(nextDealerIndex);
    setPlayers(activePlayers);
    setPot(currentPot);
    setCurrentStake(boot * 2);
    setCurrentTurnIndex(firstTurnIndex);
    setGameStage('playing');
  };

  const nextTurn = (updatedPlayers) => {
    let nextIndex = (currentTurnIndex + 1) % players.length;
    
    // Skip folded players
    while (updatedPlayers[nextIndex].isFolded) {
      nextIndex = (nextIndex + 1) % players.length;
    }

    setCurrentTurnIndex(nextIndex);
  };

  const handleAction = (action) => {
    saveToHistory();

    const currentPlayer = players[currentTurnIndex];
    let newPlayers = [...players];
    let playerToUpdate = newPlayers[currentTurnIndex];

    if (action === 'seeCards') {
        playerToUpdate.hasSeenCards = true;
        addLog(`${currentPlayer.name} has SEEN their cards.`);
        setPlayers(newPlayers);
        return; 
    }

    if (action === 'pack') {
      playerToUpdate.isFolded = true;
      addLog(`${currentPlayer.name} Packed.`);
      
      setPlayers(newPlayers);

      const remainingPlayers = newPlayers.filter(p => !p.isFolded);
      if (remainingPlayers.length === 1) {
        handleWin(remainingPlayers[0].id);
        return;
      }
      
      nextTurn(newPlayers);
      return;
    }

    let betAmount = 0;

    if (action === 'blind') {
        betAmount = currentStake / 2;
        addLog(`${currentPlayer.name} Blind (${betAmount})`);
    } else if (action === 'blindRaise') {
        betAmount = currentStake; 
        setCurrentStake(currentStake * 2);
        addLog(`${currentPlayer.name} BLIND RAISED to ${currentStake * 2}!`);
    } else if (action === 'chaal') {
      betAmount = currentStake;
      playerToUpdate.hasSeenCards = true;
      addLog(`${currentPlayer.name} Chaal (${betAmount})`);
    } else if (action === 'raise') {
      betAmount = currentStake * 2;
      setCurrentStake(betAmount);
      playerToUpdate.hasSeenCards = true; 
      addLog(`${currentPlayer.name} RAISED to ${betAmount}!`);
    }

    playerToUpdate.balance -= betAmount;
    playerToUpdate.totalBetInHand += betAmount;
    
    setPot(prev => prev + betAmount);
    setPlayers(newPlayers);
    nextTurn(newPlayers);
  };

  const triggerShow = () => {
    saveToHistory();
    setGameStage('winner');
  };

  const handleWin = (winnerId) => {
    saveToHistory();
    const winner = players.find(p => p.id === winnerId);
    addLog(`${winner.name} won the pot of ${pot}!`);
    
    const newHistoryEntry = {
        round: roundHistory.length + 1,
        winnerName: winner.name,
        totalPot: pot,
        contributions: players.map(p => ({
            name: p.name,
            amount: p.totalBetInHand,
            isWinner: p.id === winnerId
        }))
    };
    setRoundHistory([...roundHistory, newHistoryEntry]);

    const updatedPlayers = players.map(p => {
      if (p.id === winnerId) {
        return { ...p, balance: p.balance + pot };
      }
      return p;
    });

    setPlayers(updatedPlayers);
    setPot(0);
    setGameStage('summary');
  };

  // --- Render Functions (Moved out of main component body to avoid focus loss) ---

  const renderSetupScreen = () => (
    <div className="space-y-6 p-4 animate-in fade-in zoom-in duration-300">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold text-emerald-400 tracking-wider drop-shadow-md">TEEN PATTI</h1>
        <p className="text-emerald-200/70 text-sm">Virtual Chip Manager</p>
      </div>

      <div className="bg-emerald-900/40 p-6 rounded-2xl border border-emerald-700/50 shadow-xl backdrop-blur-sm">
        <h2 className="text-lg font-semibold text-emerald-100 mb-4 flex items-center gap-2">
          <Users size={20} /> Players
        </h2>
        <form onSubmit={addPlayer} className="flex gap-2 mb-4">
          <input
            type="text"
            value={newPlayerName}
            onChange={(e) => setNewPlayerName(e.target.value)}
            placeholder="Enter Name"
            className="flex-1 bg-emerald-950/50 border border-emerald-700 rounded-lg px-4 py-3 text-emerald-100 placeholder-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button type="submit" className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold p-3 rounded-lg transition-colors">
            <Plus size={24} />
          </button>
        </form>

        <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
          {players.map(player => (
            <div key={player.id} className="flex justify-between items-center bg-emerald-950/30 p-3 rounded-lg border border-emerald-800/30">
              <span className="font-medium text-emerald-100">{player.name}</span>
              <button onClick={() => removePlayer(player.id)} className="text-red-400 hover:text-red-300 p-1">
                <Trash2 size={18} />
              </button>
            </div>
          ))}
          {players.length === 0 && <p className="text-center text-emerald-600 py-4 italic">No players added yet.</p>}
        </div>
      </div>

      <div className="bg-emerald-900/40 p-6 rounded-2xl border border-emerald-700/50 shadow-xl backdrop-blur-sm">
        <h2 className="text-lg font-semibold text-emerald-100 mb-4 flex items-center gap-2">
          <DollarSign size={20} /> Settings
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-emerald-400 mb-1">Initial Chips</label>
            <input
              type="number"
              value={settings.initialBalance}
              onChange={(e) => handleSettingChange('initialBalance', e.target.value)}
              className="w-full bg-emerald-950/50 border border-emerald-700 rounded-lg px-3 py-2 text-emerald-100 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-emerald-400 mb-1">Boot Amount</label>
            <input
              type="number"
              value={settings.bootAmount}
              onChange={(e) => handleSettingChange('bootAmount', e.target.value)}
              className="w-full bg-emerald-950/50 border border-emerald-700 rounded-lg px-3 py-2 text-emerald-100 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      <button 
        onClick={startGame}
        disabled={players.length < 2}
        className="w-full bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-amber-950 font-black text-lg py-4 rounded-xl shadow-lg shadow-amber-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95"
      >
        START GAME
      </button>
    </div>
  );

  const renderGameScreen = () => {
    const currentPlayer = players[currentTurnIndex];
    
    return (
      <div className="flex flex-col h-full animate-in fade-in duration-500">
        {/* Top Bar: Pot & Undo */}
        <div className="bg-emerald-950/80 p-3 shadow-lg border-b border-emerald-800 flex justify-between items-center sticky top-0 z-10 backdrop-blur-md">
          <div className="flex items-center gap-2">
             <button 
                onClick={handleUndo} 
                disabled={historyStack.length === 0}
                className="bg-slate-800 text-slate-300 p-2 rounded-full disabled:opacity-30 active:scale-95 transition-transform"
             >
                <RotateCcw size={18} />
             </button>
             <div className="bg-amber-500 text-amber-950 font-bold text-xs px-2 py-1 rounded">BOOT: {settings.bootAmount}</div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-emerald-400 text-xs font-bold tracking-widest">TOTAL POT</span>
            <span className="text-3xl font-black text-white drop-shadow-glow">₹{pot}</span>
          </div>
        </div>

        {/* Playing Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
           {/* Current Stake */}
           <div className="text-center my-2">
              <div className="inline-block bg-black/30 backdrop-blur px-4 py-1 rounded-full border border-emerald-500/30">
                <span className="text-emerald-300 text-sm">Seen Stake: </span>
                <span className="text-emerald-100 font-bold text-lg">₹{currentStake}</span>
              </div>
           </div>

           {/* Players Grid */}
           <div className="grid grid-cols-2 gap-3 pb-24">
             {players.map((p, idx) => {
               const isCurrentTurn = idx === currentTurnIndex && !p.isFolded;
               const isDealer = idx === dealerIndex;
               
               return (
                 <div 
                    key={p.id} 
                    className={`
                      relative p-3 rounded-xl border transition-all duration-300
                      ${p.isFolded ? 'bg-slate-900/50 border-slate-800 opacity-60 grayscale' : 
                        isCurrentTurn ? 'bg-gradient-to-br from-emerald-800 to-emerald-900 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)] scale-105 z-10' : 
                        'bg-emerald-900/40 border-emerald-800'}
                    `}
                 >
                    {isDealer && (
                      <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-[10px] w-6 h-6 flex items-center justify-center rounded-full border-2 border-emerald-900 font-bold shadow-sm z-20">D</div>
                    )}
                    
                    <div className="flex justify-between items-start mb-1">
                      <span className={`font-bold truncate w-20 ${isCurrentTurn ? 'text-amber-300' : 'text-emerald-100'}`}>
                        {p.name}
                      </span>
                      {p.isFolded ? (
                         <span className="text-[10px] text-red-400 font-bold uppercase">Pack</span>
                      ) : (
                         p.hasSeenCards && <Eye size={16} className="text-amber-400" />
                      )}
                    </div>
                    
                    <div className="flex justify-between items-end">
                        <div className="flex items-center gap-1 text-emerald-200/80 text-sm">
                            ₹{p.balance}
                            <button 
                                onClick={() => handleRebuy(p.id)}
                                className="text-emerald-500 hover:text-emerald-300"
                            >
                                <Plus size={14} className="bg-emerald-900/50 rounded-full border border-emerald-600" />
                            </button>
                        </div>
                        <div className="text-[10px] text-amber-400/90 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-900/50">
                            Inv: ₹{p.totalBetInHand}
                        </div>
                    </div>
                    
                    {isCurrentTurn && !p.isFolded && (
                      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-amber-500 text-amber-950 text-[10px] font-bold px-2 py-0.5 rounded-full animate-bounce z-20">
                        THINKING
                      </div>
                    )}
                 </div>
               )
             })}
           </div>
        </div>

        {/* Controls - Fixed Bottom */}
        <div className="bg-emerald-950 border-t border-emerald-800 p-4 pb-8 shadow-2xl">
           <div className="flex justify-between items-center mb-3">
              <h2 className="text-xl font-bold text-white">{currentPlayer.name}'s Turn</h2>
              
              {!currentPlayer.hasSeenCards && (
                 <button 
                    onClick={() => handleAction('seeCards')}
                    className="bg-emerald-800 hover:bg-emerald-700 text-emerald-100 text-sm px-4 py-2 rounded-full border border-emerald-600 flex items-center gap-2 shadow-lg active:scale-95"
                 >
                    <Eye size={16} /> Mark Seen
                 </button>
              )}
              {currentPlayer.hasSeenCards && <span className="text-xs text-amber-400 font-bold uppercase tracking-wider bg-amber-900/30 px-2 py-1 rounded">SEEN</span>}
           </div>

           <div className="grid grid-cols-2 gap-2">
              {/* BLIND BUTTON */}
              <button 
                onClick={() => handleAction('blind')}
                disabled={currentPlayer.hasSeenCards} 
                className={`flex flex-col items-center justify-center border py-3 rounded-xl active:scale-95 transition-transform
                   ${currentPlayer.hasSeenCards 
                     ? 'bg-slate-800/50 border-slate-700 text-slate-500 cursor-not-allowed' 
                     : 'bg-purple-900/50 hover:bg-purple-800 border-purple-600 text-purple-100'
                   }`}
              >
                <EyeOff className="mb-1" size={18} />
                <div className="flex flex-col leading-none">
                  <span className="font-bold text-xs">BLIND</span>
                  <span className="text-[10px] opacity-80">₹{currentStake / 2}</span>
                </div>
              </button>

              {/* BLIND RAISE BUTTON */}
              <button 
                onClick={() => handleAction('blindRaise')}
                disabled={currentPlayer.hasSeenCards} 
                className={`flex flex-col items-center justify-center border py-3 rounded-xl active:scale-95 transition-transform
                   ${currentPlayer.hasSeenCards 
                     ? 'bg-slate-800/50 border-slate-700 text-slate-500 cursor-not-allowed' 
                     : 'bg-purple-800/80 hover:bg-purple-700 border-purple-500 text-white shadow-[0_0_10px_rgba(168,85,247,0.2)]'
                   }`}
              >
                <ArrowUpCircle className="mb-1" size={18} />
                <div className="flex flex-col leading-none">
                  <span className="font-bold text-xs">BLIND RAISE</span>
                  <span className="text-[10px] opacity-80">to ₹{currentStake}</span>
                </div>
              </button>

              {/* CHAAL BUTTON */}
              <button 
                onClick={() => handleAction('chaal')}
                disabled={!currentPlayer.hasSeenCards}
                className={`flex flex-col items-center justify-center border py-3 rounded-xl active:scale-95 transition-transform
                    ${!currentPlayer.hasSeenCards 
                      ? 'bg-slate-800/50 border-slate-700 text-slate-500 cursor-not-allowed' 
                      : 'bg-blue-900/50 hover:bg-blue-800 border border-blue-600 text-blue-100'
                    }`}
              >
                <CheckCircle2 className="mb-1" size={18} />
                <div className="flex flex-col leading-none">
                  <span className="font-bold text-xs">CHAAL</span>
                  <span className="text-[10px] opacity-80">₹{currentStake}</span>
                </div>
              </button>

              {/* RAISE BUTTON */}
              <button 
                onClick={() => handleAction('raise')}
                disabled={!currentPlayer.hasSeenCards}
                className={`flex flex-col items-center justify-center border py-3 rounded-xl active:scale-95 transition-transform
                    ${!currentPlayer.hasSeenCards 
                      ? 'bg-slate-800/50 border-slate-700 text-slate-500 cursor-not-allowed' 
                      : 'bg-amber-600/80 hover:bg-amber-600 border border-amber-500 text-white shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                    }`}
              >
                <ArrowUpCircle className="mb-1" size={18} />
                <div className="flex flex-col leading-none">
                  <span className="font-bold text-xs">RAISE</span>
                  <span className="text-[10px] opacity-80">to ₹{currentStake * 2}</span>
                </div>
              </button>
           </div>

           {/* PACK BUTTON (Full Width) */}
           <button 
                onClick={() => handleAction('pack')}
                className="w-full mt-2 flex items-center justify-center gap-2 bg-red-900/50 hover:bg-red-800 border border-red-700 text-red-100 py-4 rounded-xl active:scale-95 transition-transform shadow-lg"
            >
                <XCircle size={20} />
                <span className="font-bold text-lg">PACK</span>
            </button>
           
           <button 
             onClick={triggerShow}
             className="w-full mt-3 bg-emerald-800 hover:bg-emerald-700 border border-emerald-500 text-emerald-100 py-4 rounded-xl text-md font-bold tracking-wider uppercase active:scale-95 transition-transform shadow-lg"
           >
             Cards Show / End Hand
           </button>
        </div>
      </div>
    );
  };

  const renderWinnerScreen = () => (
    <div className="flex flex-col h-full p-6 animate-in zoom-in duration-300 justify-center">
      <div className="text-center mb-8">
        <Trophy className="w-20 h-20 text-amber-400 mx-auto mb-4 drop-shadow-lg animate-pulse" />
        <h2 className="text-3xl font-bold text-white mb-2">Who Won?</h2>
        <p className="text-emerald-300">Select the player with the best hand</p>
        <div className="mt-4 text-4xl font-black text-emerald-400">Pot: ₹{pot}</div>
      </div>

      <div className="grid gap-3 overflow-y-auto max-h-[50vh]">
        {players.filter(p => !p.isFolded).map(p => (
          <button
            key={p.id}
            onClick={() => handleWin(p.id)}
            className="bg-gradient-to-r from-emerald-800 to-emerald-900 hover:from-emerald-700 hover:to-emerald-800 border border-emerald-600 p-4 rounded-xl flex justify-between items-center group transition-all"
          >
            <span className="text-xl font-bold text-white group-hover:text-amber-300">{p.name}</span>
            <div className="bg-emerald-950 rounded-full p-1">
               <CheckCircle2 className="text-emerald-500 w-6 h-6" />
            </div>
          </button>
        ))}
      </div>
      
      <button 
        onClick={() => {
            saveToHistory();
            setGameStage('playing');
        }}
        className="mt-8 w-full py-3 text-emerald-400 hover:text-white hover:underline"
      >
        Cancel / Back to Game
      </button>
    </div>
  );

  const SummaryScreen = () => {
    const [viewMode, setViewMode] = useState('history'); // 'history' or 'settlement'

    const calculateSettlements = () => {
        const initial = parseInt(settings.initialBalance || 0);
        let debtors = [];
        let creditors = [];
    
        // Calculate based on initial balance (roughly)
        // Note: Rebuys complicate "Settlement" logic slightly because rebuys add money from thin air.
        // For pure settlement, we assume total money in system = initial * N + rebuys.
        // The net win/loss is Balance - (Initial + Rebuys).
        // Since we don't track per-player rebuys in a separate field yet, this is a simple "Cash Out" view based on current balance vs initial.
        // If someone rebought, they technically 'paid' for those chips.
        
        players.forEach(p => {
            const net = p.balance - initial;
            if (net < 0) debtors.push({ name: p.name, amount: Math.abs(net) });
            if (net > 0) creditors.push({ name: p.name, amount: net });
        });
    
        debtors.sort((a, b) => b.amount - a.amount);
        creditors.sort((a, b) => b.amount - a.amount);
    
        let transactions = [];
        let d = 0;
        let c = 0;
    
        while (d < debtors.length && c < creditors.length) {
            let debtor = debtors[d];
            let creditor = creditors[c];
            let amount = Math.min(debtor.amount, creditor.amount);
    
            if (amount > 0) {
                transactions.push({ from: debtor.name, to: creditor.name, amount });
            }
    
            debtor.amount -= amount;
            creditor.amount -= amount;
    
            if (Math.abs(debtor.amount) < 0.01) d++;
            if (Math.abs(creditor.amount) < 0.01) c++;
        }
        return transactions;
    };

    const settlements = calculateSettlements();

    return (
      <div className="flex flex-col h-full p-4 animate-in slide-in-from-bottom duration-500">
        <div className="text-center py-4">
          <h2 className="text-2xl font-bold text-white mb-1">Round Complete</h2>
        </div>

        {/* Current Balances List - Sorted copy */}
        <div className="bg-emerald-900/20 rounded-xl border border-emerald-800 overflow-hidden flex flex-col mb-4 h-36 shrink-0">
           <div className="p-2 bg-emerald-950/50 font-semibold text-emerald-200 text-xs uppercase tracking-wider grid grid-cols-2">
              <span>Player Balance</span>
              <span className="text-right">Total</span>
           </div>
           <div className="overflow-y-auto p-2 space-y-1 flex-1">
             {[...players].sort((a, b) => b.balance - a.balance).map(p => (
               <div key={p.id} className="grid grid-cols-2 p-2 rounded bg-emerald-900/40 border border-emerald-800/50 items-center">
                 <div className="flex items-center gap-2">
                    <span className="font-bold text-emerald-100">{p.name}</span>
                    <button onClick={() => handleRebuy(p.id)} className="text-emerald-500">
                        <Plus size={12} className="bg-emerald-800 rounded-full" />
                    </button>
                 </div>
                 <span className={`text-right font-mono font-bold ${p.balance < 0 ? 'text-red-400' : 'text-amber-400'}`}>
                   ₹{p.balance}
                 </span>
               </div>
             ))}
           </div>
        </div>

        {/* Toggle Tabs */}
        <div className="flex gap-2 mb-2">
            <button 
                onClick={() => setViewMode('history')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${viewMode === 'history' ? 'bg-emerald-600 text-white' : 'bg-emerald-900/50 text-emerald-400 hover:bg-emerald-800'}`}
            >
                <Table2 size={14} /> History
            </button>
            <button 
                onClick={() => setViewMode('settlement')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${viewMode === 'settlement' ? 'bg-amber-600 text-white' : 'bg-emerald-900/50 text-emerald-400 hover:bg-emerald-800'}`}
            >
                <ArrowRightLeft size={14} /> Settlements
            </button>
        </div>

        {/* Dynamic Content Area */}
        <div className="flex-1 flex flex-col min-h-0 bg-black/20 rounded-xl border border-emerald-800/50 overflow-hidden">
            
            {viewMode === 'history' ? (
                <div className="overflow-y-auto p-2 space-y-3">
                    {roundHistory.length === 0 && <div className="text-center text-emerald-500/50 mt-10">No history yet</div>}
                    {[...roundHistory].reverse().map((round) => (
                        <div key={round.round} className="bg-emerald-900/30 rounded-lg p-3 border border-emerald-800/30">
                            <div className="flex justify-between items-center mb-2 border-b border-emerald-800/50 pb-2">
                                <span className="text-xs text-emerald-500 font-bold">ROUND {round.round}</span>
                                <span className="text-amber-300 font-bold text-sm">{round.winnerName} Won ₹{round.totalPot}</span>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] text-emerald-400/70 uppercase">Pot Composition:</p>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                    {round.contributions.filter(c => c.amount > 0).map((contrib, i) => (
                                        <div key={i} className="flex justify-between text-xs">
                                            <span className={`${contrib.isWinner ? 'text-amber-400 font-bold' : 'text-emerald-200'}`}>
                                                {contrib.name} {contrib.isWinner && '(Self)'}
                                            </span>
                                            <span className="text-emerald-400/60">₹{contrib.amount}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="border-t border-emerald-800/30 mt-1 pt-1 flex justify-between text-xs font-bold opacity-80">
                                    <span className="text-emerald-500">Total</span>
                                    <span className="text-emerald-300">₹{round.totalPot}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="overflow-y-auto p-3 space-y-3">
                    <div className="text-center mb-2">
                        <p className="text-amber-200 text-xs">Settlement Plan if game ends now</p>
                    </div>
                    
                    {settlements.length === 0 ? (
                         <div className="text-center text-emerald-500/50 mt-10 flex flex-col items-center">
                            <CheckCircle2 className="mb-2" />
                            Everyone is even!
                         </div>
                    ) : (
                        settlements.map((tx, i) => (
                            <div key={i} className="bg-amber-900/20 border border-amber-700/30 p-3 rounded-lg flex items-center justify-between">
                                <div className="flex flex-col">
                                    <span className="text-red-300 font-bold">{tx.from}</span>
                                    <span className="text-[10px] text-red-200/50 uppercase">PAYS</span>
                                </div>
                                
                                <div className="flex flex-col items-center px-2">
                                    <ArrowRightLeft className="text-amber-500 w-4 h-4 mb-1" />
                                    <span className="text-amber-400 font-black text-lg">₹{Math.round(tx.amount)}</span>
                                </div>

                                <div className="flex flex-col items-end">
                                    <span className="text-emerald-300 font-bold">{tx.to}</span>
                                    <span className="text-[10px] text-emerald-200/50 uppercase">RECEIVES</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>

        <div className="mt-4 grid gap-3">
          <button 
            onClick={() => startNewHand()}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <RefreshCw size={20} />
            Start Next Hand
          </button>
          
          <div className="grid grid-cols-2 gap-3">
              <button 
                  onClick={() => {
                      saveToHistory();
                      setGameStage('setup');
                  }}
                  className="w-full bg-emerald-900 text-emerald-300 font-semibold py-2 rounded-lg border border-emerald-700 text-sm"
              >
                  End Game
              </button>
              <div className="flex items-center justify-center text-emerald-500 text-xs bg-black/20 rounded-lg border border-emerald-900">
                  Next Dealer: {players[(dealerIndex + 1) % players.length]?.name || '...'}
              </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-[#0a2615] min-h-screen font-sans text-slate-200 selection:bg-emerald-500/30 flex justify-center">
      <div className="w-full max-w-md bg-gradient-to-b from-[#0F3826] to-[#05180d] shadow-2xl min-h-screen flex flex-col relative overflow-hidden border-x border-emerald-900">
        
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5 pointer-events-none" 
             style={{backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.3) 1px, transparent 0)', backgroundSize: '24px 24px'}}>
        </div>

        {/* Content */}
        <div className="relative z-10 flex-1 flex flex-col h-full">
          {gameStage === 'setup' && renderSetupScreen()}
          {gameStage === 'playing' && renderGameScreen()}
          {gameStage === 'winner' && renderWinnerScreen()}
          {gameStage === 'summary' && <SummaryScreen />}
        </div>

        {/* Log Viewer (Small overlay at bottom if playing) */}
        {gameStage === 'playing' && (
            <div className="bg-black/40 backdrop-blur-sm p-2 h-20 overflow-y-auto text-[10px] text-emerald-300/70 font-mono border-t border-emerald-900/50 pointer-events-none">
                {logs.map((log, i) => (
                    <div key={i}><span className="text-emerald-500">[{log.time}]</span> {log.text}</div>
                ))}
                <div ref={logsEndRef} />
            </div>
        )}

      </div>
    </div>
  );
};

export default TeenPattiManager;


import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Mood, Message, AdibState, ChatSession, GroundingSource } from './types';
import { MOOD_COLORS } from './constants';
import { generateAdibResponse } from './services/gemini';
import MarkdownRenderer from './components/MarkdownRenderer';

const STORAGE_KEY = 'ai_adib_sessions';
const THEME_KEY = 'ai_adib_theme';
const STARS_KEY = 'ai_adib_stars';

const App: React.FC = () => {
  const [state, setState] = useState<AdibState>({
    chats: [],
    activeChatId: null,
    isLoading: false,
    wisdomOfTheDay: null,
    currentTask: null,
    stars: 0
  });
  const [inputValue, setInputValue] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMood, setFilterMood] = useState<Mood | 'all'>('all');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ data: string, mimeType: string } | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [selectionMenu, setSelectionMenu] = useState<{ x: number, y: number, text: string } | null>(null);
  const [isInputGlowing, setIsInputGlowing] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number, longitude: number } | null>(null);
  const [showStarEffect, setShowStarEffect] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        (err) => console.warn("Location error:", err)
      );
    }

    const savedTheme = localStorage.getItem(THEME_KEY) as 'light' | 'dark';
    if (savedTheme) setTheme(savedTheme);

    const savedStars = localStorage.getItem(STARS_KEY);
    if (savedStars) setState(prev => ({ ...prev, stars: parseInt(savedStars) || 0 }));

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed: ChatSession[] = JSON.parse(saved);
        const revived = parsed.map(chat => ({
          ...chat,
          updatedAt: new Date(chat.updatedAt),
          messages: chat.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) }))
        }));
        setState(prev => ({ ...prev, chats: revived }));
      } catch (e) {
        console.error("Failed to parse saved chats", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.chats));
  }, [state.chats]);

  useEffect(() => {
    localStorage.setItem(STARS_KEY, state.stars.toString());
  }, [state.stars]);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  // Optimized filtering logic for history
  const filteredChats = useMemo(() => {
    return state.chats.filter(chat => {
      const matchesSearch = chat.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        chat.messages.some(m => m.content.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesMood = filterMood === 'all' || chat.mood === filterMood;
      return matchesSearch && matchesMood;
    });
  }, [state.chats, searchTerm, filterMood]);

  const activeChat = useMemo(() => 
    state.chats.find(c => c.id === state.activeChatId) || null
  , [state.chats, state.activeChatId]);

  useEffect(() => {
    scrollToBottom();
  }, [activeChat?.messages, state.isLoading]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const startNewChat = () => {
    setState(prev => ({ ...prev, activeChatId: null, wisdomOfTheDay: null, currentTask: null }));
    setIsSidebarOpen(false);
    setSelectedImage(null);
  };

  const clearAllChats = () => {
    if (state.chats.length === 0) return;
    if (window.confirm("Barcha suhbatlar tarixini butunlay o'chirib tashlamoqchimisiz?")) {
      setState(prev => ({ ...prev, chats: [], activeChatId: null, wisdomOfTheDay: null, currentTask: null }));
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const deleteChat = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setState(prev => {
      const filtered = prev.chats.filter(c => c.id !== id);
      return {
        ...prev,
        chats: filtered,
        activeChatId: prev.activeChatId === id ? null : prev.activeChatId
      };
    });
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleMoodSelect = (mood: Mood) => {
    const welcomeMsg = `Hozir menda ${mood.toLowerCase()} holati. Ushbu kayfiyatga mos keladigan qanday adabiy durdona yoki maslahat bera olasiz?`;
    handleSendMessage(welcomeMsg, mood as any);
    setIsSidebarOpen(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        const data = base64.split(',')[1];
        setSelectedImage({ data, mimeType: file.type });
      };
      reader.readAsDataURL(file);
    }
  };

  const copyToInput = (text: string) => {
    setInputValue(text);
    setIsInputGlowing(true);
    setTimeout(() => setIsInputGlowing(false), 1000);
    if (textareaRef.current) textareaRef.current.focus();
    setSelectionMenu(null);
  };

  const appendToInput = (text: string) => {
    const newValue = inputValue ? `${inputValue}\n\n${text}` : text;
    setInputValue(newValue);
    setIsInputGlowing(true);
    setTimeout(() => setIsInputGlowing(false), 1000);
    if (textareaRef.current) textareaRef.current.focus();
    setSelectionMenu(null);
  };

  const handleTextSelection = (e: React.MouseEvent) => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelectionMenu({
        x: rect.left + window.scrollX + (rect.width / 2),
        y: rect.top + window.scrollY - 45,
        text: selection.toString().trim()
      });
    } else {
      setSelectionMenu(null);
    }
  };

  const handleSendMessage = async (textOverride?: string, moodOverride?: Mood) => {
    const content = textOverride || inputValue;
    if (!content.trim() && !selectedImage) return;
    if (state.isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      imageUrl: selectedImage ? `data:${selectedImage.mimeType};base64,${selectedImage.data}` : undefined,
      timestamp: new Date(),
    };

    let currentChatId = state.activeChatId;
    let currentChats = [...state.chats];

    if (!currentChatId) {
      currentChatId = Date.now().toString();
      const newChat: ChatSession = {
        id: currentChatId,
        title: content.slice(0, 40) + (content.length > 40 ? '...' : '') || "Yangi muloqot",
        messages: [userMsg],
        mood: moodOverride || null,
        updatedAt: new Date()
      };
      currentChats = [newChat, ...currentChats];
      setState(prev => ({ ...prev, chats: currentChats, activeChatId: currentChatId }));
    } else {
      currentChats = currentChats.map(chat => {
        if (chat.id === currentChatId) {
          return {
            ...chat,
            messages: [...chat.messages, userMsg],
            updatedAt: new Date(),
            mood: moodOverride || chat.mood
          };
        }
        return chat;
      });
      setState(prev => ({ ...prev, chats: currentChats }));
    }

    setState(prev => ({ ...prev, isLoading: true }));
    const sendingImage = selectedImage;
    setInputValue('');
    setSelectedImage(null);

    const history = (currentChats.find(c => c.id === currentChatId)?.messages || [])
      .map(m => ({ role: m.role, content: m.content }));
    
    const adibResult = await generateAdibResponse(
      content, 
      history, 
      moodOverride || activeChat?.mood || undefined,
      sendingImage || undefined,
      userLocation || undefined
    );

    const assistantMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: adibResult.text,
      imageUrl: adibResult.imageUrl,
      timestamp: new Date(),
      groundingSources: adibResult.groundingSources
    };

    if (adibResult.text.includes("YULDUZ+1")) {
      setShowStarEffect(true);
      setTimeout(() => setShowStarEffect(false), 2000);
    }

    setState(prev => {
      const updatedChats = prev.chats.map(chat => {
        if (chat.id === currentChatId) {
          return {
            ...chat,
            messages: [...chat.messages, assistantMsg],
            updatedAt: new Date()
          };
        }
        return chat;
      });

      let newStars = prev.stars;
      if (adibResult.text.includes("YULDUZ+1")) newStars += 1;

      let wisdom = prev.wisdomOfTheDay;
      let task = prev.currentTask;
      const lines = adibResult.text.split('\n');
      const wisdomLine = lines.find(l => l.includes('Hikmat:'));
      const taskLine = lines.find(l => l.includes('Topshiriq:'));
      if (wisdomLine) wisdom = wisdomLine.split(':')[1].trim();
      if (taskLine) task = taskLine.split(':')[1].trim();

      return {
        ...prev,
        chats: updatedChats,
        isLoading: false,
        wisdomOfTheDay: wisdom,
        currentTask: task,
        stars: newStars
      };
    });
  };

  const SidebarContent = () => (
    <>
      <div className={`p-6 border-b ${theme === 'light' ? 'border-[#2d5a4e]' : 'border-white/10'}`}>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-[#d4af37] rounded-2xl flex items-center justify-center text-[#1a3c34] shadow-lg transform -rotate-3">
            <i className="fa-solid fa-inkwell text-xl"></i>
          </div>
          <div>
            <h1 className={`text-xl font-bold serif-font tracking-tight ${theme === 'light' ? 'text-[#f3e9d5]' : 'text-white'}`}>AI-ADIB PRO</h1>
            <div className="flex items-center gap-2">
              <span className="text-[9px] uppercase tracking-widest text-[#d4af37] font-semibold">Mentor</span>
              <div className="flex items-center gap-1 bg-[#d4af37]/20 px-2 py-0.5 rounded-full">
                <i className="fa-solid fa-star text-[8px] text-[#d4af37]"></i>
                <span className="text-[10px] text-[#d4af37] font-bold">{state.stars}</span>
              </div>
            </div>
          </div>
        </div>
        
        <button onClick={startNewChat} className="w-full py-3 bg-[#d4af37] hover:bg-[#f3e9d5] text-[#1a3c34] rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg font-bold text-sm">
          <i className="fa-solid fa-plus"></i> Yangi suhbat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {state.chats.length > 0 && (
          <section>
            <div className="flex justify-between items-center mb-4 px-2">
              <h2 className={`text-[10px] uppercase tracking-widest ${theme === 'light' ? 'text-[#8a9e9a]' : 'text-gray-400'} font-bold flex items-center gap-2`}>
                <i className="fa-solid fa-clock-rotate-left text-xs"></i> Tarix
              </h2>
              <button 
                onClick={clearAllChats}
                className="text-[9px] uppercase font-bold text-red-400/70 hover:text-red-400 transition-colors flex items-center gap-1"
                title="Barcha tarixni tozalash"
              >
                <i className="fa-solid fa-trash-sweep"></i> Tozalash
              </button>
            </div>

            {/* Search and Filter Inputs */}
            <div className="px-2 space-y-2 mb-4">
              <div className={`relative flex items-center rounded-lg border ${theme === 'light' ? 'bg-[#1a3c34] border-[#2d5a4e]' : 'bg-white/5 border-white/10'}`}>
                <i className="fa-solid fa-magnifying-glass absolute left-3 text-[10px] text-[#8a9e9a]"></i>
                <input 
                  type="text" 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                  placeholder="Izlash (asar, muallif...)" 
                  className="w-full bg-transparent pl-8 pr-3 py-2 text-xs outline-none text-[#f3e9d5] placeholder-[#8a9e9a]"
                />
              </div>
              <div className="flex gap-2">
                <select 
                  value={filterMood} 
                  onChange={(e) => setFilterMood(e.target.value as any)}
                  className={`flex-1 text-[10px] uppercase font-bold tracking-widest rounded-lg px-2 py-1.5 outline-none transition-all ${theme === 'light' ? 'bg-[#1a3c34] text-[#d4af37] border border-[#2d5a4e]' : 'bg-white/5 text-[#d4af37] border border-white/10'}`}
                >
                  <option value="all">Barcha kayfiyatlar</option>
                  {Object.values(Mood).map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                {(searchTerm || filterMood !== 'all') && (
                  <button 
                    onClick={() => { setSearchTerm(''); setFilterMood('all'); }}
                    className={`px-2 rounded-lg border transition-all ${theme === 'light' ? 'border-[#2d5a4e] text-red-400 hover:bg-red-950/20' : 'border-white/10 text-red-400 hover:bg-red-950/20'}`}
                    title="Filtrlarni tozalash"
                  >
                    <i className="fa-solid fa-xmark text-xs"></i>
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-1">
              {filteredChats.length > 0 ? (
                filteredChats.map(chat => (
                  <div 
                    key={chat.id} 
                    onClick={() => { setState(prev => ({ ...prev, activeChatId: chat.id })); setIsSidebarOpen(false); }} 
                    className={`group relative flex flex-col p-3 rounded-xl cursor-pointer transition-all border ${state.activeChatId === chat.id ? theme === 'light' ? 'bg-[#2d5a4e] border-[#d4af37]/40 text-white shadow-md' : 'bg-white/10 border-[#d4af37]/60 text-white shadow-md' : theme === 'light' ? 'hover:bg-[#1e463d] border-transparent text-[#b0c4bf]' : 'hover:bg-white/5 border-transparent text-gray-400'}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {chat.mood && (
                        <div className="w-1.5 h-1.5 rounded-full bg-[#d4af37]"></div>
                      )}
                      <p className="text-sm font-medium truncate pr-6">{chat.title}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] uppercase tracking-tighter opacity-50">{chat.updatedAt.toLocaleDateString()}</span>
                      {chat.mood && <span className="text-[8px] font-bold text-[#d4af37] opacity-80">{chat.mood}</span>}
                    </div>
                    <button 
                      onClick={(e) => deleteChat(e, chat.id)}
                      className="absolute right-2 top-3 p-2 text-[#8a9e9a] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <i className="fa-solid fa-trash-can text-xs"></i>
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 px-4">
                  <i className="fa-solid fa-folder-open text-2xl text-[#8a9e9a] mb-2 opacity-20"></i>
                  <p className="text-[10px] text-[#8a9e9a] uppercase font-bold tracking-widest">Natija topilmadi</p>
                </div>
              )}
            </div>
          </section>
        )}

        <section>
          <h2 className={`text-[10px] uppercase tracking-widest ${theme === 'light' ? 'text-[#8a9e9a]' : 'text-gray-400'} font-bold mb-3 flex items-center gap-2 px-2`}>
            <i className="fa-solid fa-face-smile text-xs"></i> Kayfiyat bo'yicha boshlash
          </h2>
          <div className="grid grid-cols-1 gap-1">
            {Object.values(Mood).map(mood => (
              <button key={mood} onClick={() => handleMoodSelect(mood)} className={`text-left px-3 py-2 rounded-lg text-xs transition-all border ${activeChat?.mood === mood ? 'bg-[#d4af37]/20 border-[#d4af37]/40 text-[#d4af37]' : 'border-transparent text-gray-400 hover:bg-white/5'}`}>
                {mood}
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className={`p-4 border-t ${theme === 'light' ? 'border-[#2d5a4e]' : 'border-white/10'} flex flex-col gap-3`}>
        <div className="text-[9px] text-center text-[#8a9e9a] opacity-50 font-bold uppercase tracking-widest">
          AI-ADIB PRO v2.8
        </div>
      </div>
    </>
  );

  return (
    <div className={`flex flex-col lg:flex-row h-screen transition-colors duration-500 ${theme === 'light' ? 'bg-[#fcfaf7]' : 'bg-[#0a0a0a]'}`}>
      <input type="file" id="adib-image-input" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />

      {/* Star Earned Effect */}
      {showStarEffect && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none">
          <div className="animate-bounce-fast">
             <i className="fa-solid fa-star text-9xl text-[#d4af37] drop-shadow-[0_0_30px_#d4af37]"></i>
             <p className="text-3xl font-bold text-white text-center mt-4 drop-shadow-lg">YULDUZ+1!</p>
          </div>
        </div>
      )}

      {/* Selection Menu */}
      {selectionMenu && (
        <div className="fixed z-[100]" style={{ left: `${selectionMenu.x}px`, top: `${selectionMenu.y}px`, transform: 'translateX(-50%)' }}>
          <div className={`flex items-center gap-1 p-1 rounded-full shadow-2xl border backdrop-blur-md ${theme === 'light' ? 'bg-white/90 border-[#d4af37]' : 'bg-[#1a1a1a]/90 border-[#d4af37]/50'}`}>
            <button onClick={() => copyToInput(selectionMenu.text)} className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-[#d4af37] text-[#1a3c34] hover:bg-[#f3e9d5] transition-all">Tahrirlash</button>
            <button onClick={() => appendToInput(selectionMenu.text)} className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${theme === 'light' ? 'text-[#1a3c34]' : 'text-white'}`}>Qo'shish</button>
          </div>
        </div>
      )}

      <aside className={`hidden lg:flex w-85 ${theme === 'light' ? 'bg-[#1a3c34] border-[#2d5a4e]' : 'bg-[#121212] border-white/5'} text-[#e8dcc4] flex-col shadow-2xl overflow-hidden border-r`}>
        <SidebarContent />
      </aside>

      <div className={`fixed inset-0 z-50 lg:hidden transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)}></div>
        <aside className={`absolute left-0 top-0 bottom-0 w-80 ${theme === 'light' ? 'bg-[#1a3c34]' : 'bg-[#121212]'} text-[#e8dcc4] flex flex-col shadow-2xl transform transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <SidebarContent />
        </aside>
      </div>

      <main className="flex-1 flex flex-col relative overflow-hidden" onMouseUp={handleTextSelection}>
        <header className={`${theme === 'light' ? 'bg-[#1a3c34] border-[#2d5a4e]' : 'bg-[#121212] border-white/5'} text-[#f3e9d5] p-4 lg:p-5 flex justify-between items-center shadow-lg border-b z-40 transition-colors`}>
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden w-10 h-10 flex items-center justify-center text-[#d4af37]">
              <i className="fa-solid fa-bars-staggered text-xl"></i>
            </button>
            <h1 className="font-bold serif-font text-base lg:text-lg tracking-tight">AI-ADIB PRO</h1>
          </div>
          <div className="flex items-center gap-4">
             <button 
                onClick={startNewChat}
                className="hidden sm:flex items-center gap-2 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all"
             >
                <i className="fa-solid fa-plus text-[#d4af37]"></i>
                Yangi
             </button>
             <div className="hidden sm:flex items-center gap-2 bg-[#d4af37] text-[#1a3c34] px-3 py-1.5 rounded-full font-bold text-xs">
                <i className="fa-solid fa-medal animate-pulse"></i>
                <span>{state.stars} YULDUZ</span>
             </div>
             <button onClick={toggleTheme} className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/5 text-[#d4af37]">
                <i className={`fa-solid ${theme === 'light' ? 'fa-moon' : 'fa-sun'}`}></i>
             </button>
          </div>
        </header>

        <div className={`flex-1 overflow-y-auto p-4 md:p-10 space-y-8 transition-colors ${theme === 'light' ? 'bg-[#fcfaf7]' : 'bg-[#0f0f0f]'}`}>
          {(!activeChat || activeChat.messages.length === 0) ? (
            <div className="flex flex-col items-center justify-center h-full text-center max-w-4xl mx-auto py-8">
               <i className="fa-solid fa-book-atlas text-6xl text-[#d4af37] mb-6 opacity-50"></i>
               <h2 className={`text-4xl font-bold serif-font mb-4 ${theme === 'light' ? 'text-[#1a3c34]' : 'text-white'}`}>
                Adabiy <span className="text-[#d4af37]">Parallellar Olami</span>
              </h2>
              <p className="text-gray-500 max-w-xl mb-12 text-sm leading-relaxed">
                O'zbek va jahon adabiyoti durdonalarini solishtiring, kutilmagan o'xshashliklarni kashf eting va bilimdonlik yulduzlarini to'plang!
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full px-4 max-w-5xl mx-auto">
                {quickActions.map((action, idx) => (
                  <button key={idx} onClick={() => handleSendMessage(action.prompt)} className={`p-5 rounded-3xl border transition-all flex items-center gap-4 text-left ${theme === 'light' ? 'bg-white border-[#e8dcc4] hover:border-[#d4af37]' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}>
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center bg-[#d4af37]/10 ${action.color}`}>
                       <i className={`fa-solid ${action.icon} text-lg`}></i>
                    </div>
                    <div>
                       <p className={`font-bold text-xs ${theme === 'light' ? 'text-[#1a3c34]' : 'text-white'}`}>{action.label}</p>
                       <p className="text-[9px] text-gray-500">Tahlil qilish</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            activeChat.messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-3xl px-8 py-6 border relative group/msg ${
                  msg.role === 'user' 
                  ? theme === 'light' ? 'bg-[#1a3c34] text-white border-transparent' : 'bg-[#d4af37] text-[#1a3c34] border-transparent'
                  : theme === 'light' ? 'bg-white text-gray-800 border-[#e8dcc4]' : 'bg-[#1a1a1a] text-gray-200 border-white/5'
                } ${msg.content.includes('Duel') || msg.content.includes('parallel') ? 'ring-2 ring-[#d4af37]/30' : ''}`}>
                  {msg.imageUrl && <img src={msg.imageUrl} className="mb-4 rounded-xl max-h-96 w-full object-cover shadow-lg" />}
                  <MarkdownRenderer content={msg.content} />
                  
                  {msg.groundingSources && (
                    <div className="mt-4 flex flex-wrap gap-2">
                        {msg.groundingSources.map((source, si) => (
                          <a key={si} href={source.uri} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-1 rounded-full bg-current/10 text-[9px] font-bold">
                             <i className="fa-solid fa-link text-[8px]"></i> {source.title.slice(0, 20)}...
                          </a>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          {state.isLoading && <div className="p-4 text-center text-[#d4af37] animate-pulse font-bold text-xs tracking-widest uppercase">Mentor qalam tebratmoqda...</div>}
          <div ref={chatEndRef} />
        </div>

        <div className={`p-6 border-t ${theme === 'light' ? 'bg-white border-[#e8dcc4]' : 'bg-[#121212] border-white/5'}`}>
          <div className="max-w-4xl mx-auto flex items-end gap-4">
            <button onClick={() => fileInputRef.current?.click()} className={`h-16 w-16 rounded-3xl flex items-center justify-center transition-all ${theme === 'light' ? 'bg-[#fcfaf7] border border-[#e8dcc4] text-[#1a3c34]' : 'bg-white/5 text-gray-400'}`}>
              <i className="fa-solid fa-camera-retro text-2xl"></i>
            </button>
            <div className={`flex-1 relative rounded-3xl border transition-all ${theme === 'light' ? 'bg-[#fcfaf7] border-[#e8dcc4] focus-within:border-[#d4af37]' : 'bg-white/5 border-white/10 focus-within:border-[#d4af37]/50'} ${isInputGlowing ? 'ring-4 ring-[#d4af37]/30' : ''}`}>
              <textarea ref={textareaRef} value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())} placeholder="Suhbatni boshlang..." className="w-full bg-transparent px-8 py-5 outline-none resize-none min-h-[64px] max-h-40" rows={1} />
            </div>
            <button onClick={() => handleSendMessage()} disabled={!inputValue.trim() && !selectedImage} className={`h-16 w-16 rounded-3xl flex items-center justify-center transition-all ${!inputValue.trim() && !selectedImage ? 'bg-gray-200 text-gray-400' : 'bg-[#1a3c34] text-[#d4af37] shadow-xl hover:scale-105 active:scale-95'}`}>
              <i className="fa-solid fa-paper-plane text-xl"></i>
            </button>
          </div>
        </div>
      </main>

      <style>{`
        @keyframes bounce-fast {
          0%, 100% { transform: translateY(-25%) scale(0.8); opacity: 0; }
          50% { transform: translateY(0) scale(1.1); opacity: 1; }
        }
        .animate-bounce-fast {
          animation: bounce-fast 2s cubic-bezier(0.68, -0.55, 0.27, 1.55) infinite;
        }
      `}</style>
    </div>
  );
};

const quickActions = [
  { label: "Bilimdonlar Dueli", icon: "fa-swords", prompt: "Duel boshla! Men tayyorman.", color: "text-amber-500" },
  { label: "Adabiy Parallellar", icon: "fa-layer-group", prompt: "O'zbek va jahon adabiyoti o'rtasidagi kutilmagan parallellar haqida biror misol keltiring.", color: "text-rose-500" },
  { label: "Atamalar (Sodda tilda)", icon: "fa-comments-question", prompt: "Sinekdoxa va Metonimiya nimaligini eng oddiy xalqona tilda tushuntirib ber.", color: "text-orange-500" },
  { label: "Adabiy yangiliklar", icon: "fa-newspaper", prompt: "Bugungi adabiyot yangiliklari haqida ma'lumot bering (Google Search).", color: "text-blue-500" },
  { label: "Kutubxonalar", icon: "fa-map-location-dot", prompt: "Menga yaqin kutubxonalarni ko'rsat (Google Maps).", color: "text-emerald-500" },
  { label: "G'azal vizuali", icon: "fa-palette", prompt: "Menga biror g'azalning vizual tasvirini chizib bering.", color: "text-purple-500" }
];

export default App;

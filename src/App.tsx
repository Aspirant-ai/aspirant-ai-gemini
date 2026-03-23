import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import CryptoJS from 'crypto-js';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { 
  MessageSquare, 
  Plus, 
  Send, 
  User, 
  Bot, 
  BookOpen, 
  Trash2, 
  Menu, 
  X,
  Lightbulb,
  GraduationCap,
  PenTool,
  Brain,
  Settings,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Copy,
  Check,
  Edit2,
  RefreshCw,
  Zap
} from 'lucide-react';

type Message = {
  id: string;
  role: 'user' | 'model';
  content: string;
  image?: string; // Base64 image data (legacy)
  file?: {
    dataUrl: string;
    name: string;
    type: string;
  };
};

type ChatSession = {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
};

const SYSTEM_INSTRUCTION = `You are Aspirant AI, an expert, highly intelligent, and supportive study companion. 
Your primary goal is to help students clear their academic doubts, explain complex concepts simply with real-world examples, and provide practice questions when appropriate. 
Always be encouraging, clear, and educational. Structure your responses beautifully using markdown (headings, bullet points, bold text).`;

const ENCRYPTION_KEY = 'aspirant_ai_secure_key_2026';

const encryptKey = (key: string) => {
  if (!key) return '';
  return CryptoJS.AES.encrypt(key, ENCRYPTION_KEY).toString();
};

const decryptKey = (encryptedKey: string) => {
  if (!encryptedKey) return '';
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedKey, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (e) {
    return '';
  }
};

export default function App() {
  const [chats, setChats] = useState<ChatSession[]>(() => {
    const savedChats = localStorage.getItem('aspirant_ai_chats');
    if (savedChats) {
      try {
        return JSON.parse(savedChats);
      } catch (e) {
        console.error("Failed to parse chats", e);
      }
    }
    return [];
  });
  
  const [currentChatId, setCurrentChatId] = useState<string | null>(() => {
    const savedChats = localStorage.getItem('aspirant_ai_chats');
    if (savedChats) {
      try {
        const parsed = JSON.parse(savedChats);
        if (parsed.length > 0) {
          return parsed[0].id;
        }
      } catch (e) {
        // Ignore
      }
    }
    return null;
  });
  
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState(() => {
    const saved = localStorage.getItem('aspirant_ai_api_key');
    return saved ? decryptKey(saved) : '';
  });
  const [provider, setProvider] = useState(() => localStorage.getItem('aspirant_ai_provider') || 'gemini');
  const [modelName, setModelName] = useState(() => localStorage.getItem('aspirant_ai_model') || 'gemini-3.1-pro-preview');

  // File Upload State
  const [selectedFile, setSelectedFile] = useState<{dataUrl: string, name: string, type: string} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Message Actions State
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editInput, setEditInput] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Save chats to local storage whenever they change
  useEffect(() => {
    localStorage.setItem('aspirant_ai_chats', JSON.stringify(chats));
  }, [chats]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chats, currentChatId, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const currentChat = chats.find(c => c.id === currentChatId);

  const createNewChat = () => {
    const newChat: ChatSession = {
      id: Date.now().toString(),
      title: 'New Study Session',
      messages: [],
      updatedAt: Date.now(),
    };
    setChats(prev => [newChat, ...prev]);
    setCurrentChatId(newChat.id);
    setIsSidebarOpen(false);
  };

  const deleteChat = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setChats(prev => prev.filter(c => c.id !== id));
    if (currentChatId === id) {
      setCurrentChatId(chats.length > 1 ? chats.find(c => c.id !== id)?.id || null : null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    const isWord = file.type === 'application/msword' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    if (isWord) {
      alert('Word document analysis is Coming Soon! Please upload an image or PDF for now.');
      return;
    }

    if (!isImage && !isPdf) {
      alert('Unsupported file type. Please upload an image or PDF.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedFile({
        dataUrl: reader.result as string,
        name: file.name,
        type: file.type
      });
    };
    reader.readAsDataURL(file);
  };

  const removeFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const startEdit = (msg: Message) => {
    setEditingMessageId(msg.id);
    setEditInput(msg.content);
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditInput('');
  };

  const generateResponseForChat = async (chatId: string, currentMessages: Message[]) => {
    setIsLoading(true);
    try {
      const currentApiKey = apiKey || (provider === 'gemini' ? process.env.GEMINI_API_KEY : '');
      if (!currentApiKey) throw new Error(`API Key is missing for ${provider}. Please set it in settings.`);
      
      const historyMessages = currentMessages.slice(0, -1);
      const lastMessage = currentMessages[currentMessages.length - 1];

      const modelMessageId = (Date.now() + 1).toString();
      let fullResponse = '';

      setChats(prev => prev.map(c => 
        c.id === chatId 
          ? { ...c, messages: [...c.messages, { id: modelMessageId, role: 'model', content: '' }] } 
          : c
      ));

      const updateChat = (chunkText: string) => {
        fullResponse += chunkText;
        setChats(prev => prev.map(c => 
          c.id === chatId 
            ? { 
                ...c, 
                messages: c.messages.map(m => m.id === modelMessageId ? { ...m, content: fullResponse } : m),
                updatedAt: Date.now()
              } 
            : c
        ));
      };

      if (provider === 'gemini') {
        const aiClient = new GoogleGenAI({ apiKey: currentApiKey });

        const history = historyMessages.map(m => {
          const parts: any[] = [];
          if (m.content) parts.push({ text: m.content });
          if (m.image) {
            const base64Data = m.image.split(',')[1];
            const mimeType = m.image.split(';')[0].split(':')[1];
            parts.push({ inlineData: { data: base64Data, mimeType: mimeType } });
          }
          if (m.file) {
            const base64Data = m.file.dataUrl.split(',')[1];
            parts.push({ inlineData: { data: base64Data, mimeType: m.file.type } });
          }
          return { role: m.role === 'user' ? 'user' : 'model', parts: parts };
        });

        const messageParts: any[] = [];
        if (lastMessage.content) messageParts.push({ text: lastMessage.content });
        if (lastMessage.image) {
          const base64Data = lastMessage.image.split(',')[1];
          const mimeType = lastMessage.image.split(';')[0].split(':')[1];
          messageParts.push({ inlineData: { data: base64Data, mimeType: mimeType } });
        }
        if (lastMessage.file) {
          const base64Data = lastMessage.file.dataUrl.split(',')[1];
          messageParts.push({ inlineData: { data: base64Data, mimeType: lastMessage.file.type } });
        }

        const allContents = [...history, { role: 'user', parts: messageParts }];
        
        const responseStream = await aiClient.models.generateContentStream({
          model: modelName || "gemini-3.1-pro-preview",
          contents: allContents,
          config: { systemInstruction: SYSTEM_INSTRUCTION }
        });

        for await (const chunk of responseStream) {
          updateChat(chunk.text || '');
        }
      } else if (provider === 'openai' || provider === 'copilot' || provider === 'qwen') {
        let baseURL = undefined;
        let defaultModel = 'gpt-4o';
        
        if (provider === 'copilot') {
          baseURL = 'https://models.inference.ai.azure.com';
          defaultModel = 'gpt-4o';
        } else if (provider === 'qwen') {
          baseURL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
          defaultModel = 'qwen-max';
        }

        const openai = new OpenAI({ 
          apiKey: currentApiKey, 
          baseURL,
          dangerouslyAllowBrowser: true 
        });

        const messages: any[] = [
          { role: 'system', content: SYSTEM_INSTRUCTION },
          ...historyMessages.map(m => {
            const content: any[] = [];
            if (m.content) content.push({ type: 'text', text: m.content });
            if (m.image) content.push({ type: 'image_url', image_url: { url: m.image } });
            if (m.file && m.file.type.startsWith('image/')) content.push({ type: 'image_url', image_url: { url: m.file.dataUrl } });
            return { role: m.role === 'user' ? 'user' : 'assistant', content };
          })
        ];

        const lastContent: any[] = [];
        if (lastMessage.content) lastContent.push({ type: 'text', text: lastMessage.content });
        if (lastMessage.image) lastContent.push({ type: 'image_url', image_url: { url: lastMessage.image } });
        if (lastMessage.file && lastMessage.file.type.startsWith('image/')) lastContent.push({ type: 'image_url', image_url: { url: lastMessage.file.dataUrl } });
        
        messages.push({ role: 'user', content: lastContent });

        const stream = await openai.chat.completions.create({
          model: modelName || defaultModel,
          messages,
          stream: true,
        });

        for await (const chunk of stream) {
          updateChat(chunk.choices[0]?.delta?.content || '');
        }
      } else if (provider === 'claude') {
        const anthropic = new Anthropic({
          apiKey: currentApiKey,
          dangerouslyAllowBrowser: true,
        });

        const messages: any[] = [
          ...historyMessages.map(m => {
            const content: any[] = [];
            if (m.content) content.push({ type: 'text', text: m.content });
            if (m.image) {
              const base64Data = m.image.split(',')[1];
              const mimeType = m.image.split(';')[0].split(':')[1];
              content.push({ type: 'image', source: { type: 'base64', media_type: mimeType as any, data: base64Data } });
            }
            if (m.file && m.file.type.startsWith('image/')) {
              const base64Data = m.file.dataUrl.split(',')[1];
              content.push({ type: 'image', source: { type: 'base64', media_type: m.file.type as any, data: base64Data } });
            }
            return { role: m.role === 'user' ? 'user' : 'assistant', content };
          })
        ];

        const lastContent: any[] = [];
        if (lastMessage.content) lastContent.push({ type: 'text', text: lastMessage.content });
        if (lastMessage.image) {
          const base64Data = lastMessage.image.split(',')[1];
          const mimeType = lastMessage.image.split(';')[0].split(':')[1];
          lastContent.push({ type: 'image', source: { type: 'base64', media_type: mimeType as any, data: base64Data } });
        }
        if (lastMessage.file && lastMessage.file.type.startsWith('image/')) {
          const base64Data = lastMessage.file.dataUrl.split(',')[1];
          lastContent.push({ type: 'image', source: { type: 'base64', media_type: lastMessage.file.type as any, data: base64Data } });
        }
        messages.push({ role: 'user', content: lastContent });

        const stream = await anthropic.messages.create({
          model: modelName || 'claude-3-5-sonnet-20240620',
          max_tokens: 4096,
          system: SYSTEM_INSTRUCTION,
          messages,
          stream: true,
        });

        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            updateChat(chunk.delta.text);
          }
        }
      }
    } catch (error: any) {
      console.error("Chat error:", error);
      let errorMessage = '**Error:** Sorry, I encountered an issue while processing your request. Please try again.';
      
      if (error.message?.includes('429') || error.message?.toLowerCase().includes('quota')) {
        errorMessage = '**Quota Exceeded:** The API limit has been reached. Please try again later or set your own API key in the settings.';
      } else if (error.message?.includes('API Key') || error.message?.includes('key not valid')) {
        errorMessage = '**Invalid API Key:** Please check your API key in the settings.';
      } else if (error.message) {
        errorMessage = `**Error:** ${error.message}`;
      }

      setChats(prev => prev.map(c => 
        c.id === chatId 
          ? { 
              ...c, 
              messages: [...c.messages, { id: Date.now().toString(), role: 'model', content: errorMessage }] 
            } 
          : c
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const saveEdit = async (msgId: string) => {
    if (!editInput.trim()) return;
    
    const activeChat = chats.find(c => c.id === currentChatId);
    if (!activeChat) return;

    const msgIndex = activeChat.messages.findIndex(m => m.id === msgId);
    if (msgIndex === -1) return;

    const updatedMessages = [...activeChat.messages];
    updatedMessages[msgIndex].content = editInput;
    
    // Truncate history to this message
    const truncatedMessages = updatedMessages.slice(0, msgIndex + 1);

    setChats(prev => prev.map(c => 
      c.id === currentChatId 
        ? { ...c, messages: truncatedMessages, updatedAt: Date.now() } 
        : c
    ));

    setEditingMessageId(null);
    setEditInput('');
    
    await generateResponseForChat(currentChatId!, truncatedMessages);
  };

  const handleRegenerate = async () => {
    const activeChat = chats.find(c => c.id === currentChatId);
    if (!activeChat || activeChat.messages.length === 0) return;

    let lastUserIndex = activeChat.messages.length - 1;
    while (lastUserIndex >= 0 && activeChat.messages[lastUserIndex].role !== 'user') {
      lastUserIndex--;
    }

    if (lastUserIndex === -1) return;

    const truncatedMessages = activeChat.messages.slice(0, lastUserIndex + 1);

    setChats(prev => prev.map(c => 
      c.id === currentChatId 
        ? { ...c, messages: truncatedMessages, updatedAt: Date.now() } 
        : c
    ));

    await generateResponseForChat(currentChatId!, truncatedMessages);
  };

  const handleSend = async (text: string = input) => {
    if ((!text.trim() && !selectedFile) || isLoading) return;

    if (provider !== 'gemini' && provider !== 'openai' && provider !== 'claude' && provider !== 'copilot' && provider !== 'qwen') {
      alert(`${provider.charAt(0).toUpperCase() + provider.slice(1)} support is Coming Soon! Please use Google Gemini for now.`);
      return;
    }

    let activeChatId = currentChatId;
    let activeChat = chats.find(c => c.id === activeChatId);

    // Create a new chat if none exists
    if (!activeChat) {
      const newChat: ChatSession = {
        id: Date.now().toString(),
        title: text.slice(0, 30) + (text.length > 30 ? '...' : 'New Chat'),
        messages: [],
        updatedAt: Date.now(),
      };
      setChats(prev => [newChat, ...prev]);
      activeChatId = newChat.id;
      activeChat = newChat;
      setCurrentChatId(newChat.id);
    } else if (activeChat.messages.length === 0) {
      // Update title of empty chat
      setChats(prev => prev.map(c => 
        c.id === activeChatId 
          ? { ...c, title: text.slice(0, 30) + (text.length > 30 ? '...' : '') || 'New Chat' } 
          : c
      ));
    }

    const userMessage: Message = { 
      id: Date.now().toString(), 
      role: 'user', 
      content: text,
      file: selectedFile || undefined
    };
    
    const updatedMessages = [...(activeChat?.messages || []), userMessage];

    // Add user message to state immediately
    setChats(prev => prev.map(c => 
      c.id === activeChatId 
        ? { ...c, messages: updatedMessages, updatedAt: Date.now() } 
        : c
    ));
    setInput('');
    removeFile();
    
    await generateResponseForChat(activeChatId!, updatedMessages);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestedPrompts = [
    { icon: <Lightbulb className="w-5 h-5 text-yellow-500" />, text: "Explain Quantum Entanglement simply" },
    { icon: <PenTool className="w-5 h-5 text-blue-500" />, text: "Give me 3 practice questions for Calculus" },
    { icon: <GraduationCap className="w-5 h-5 text-green-500" />, text: "How do I structure an essay on the French Revolution?" },
    { icon: <BookOpen className="w-5 h-5 text-purple-500" />, text: "Summarize the process of Photosynthesis" },
  ];

  const quickActions = [
    { label: "Explain", prompt: "Please explain the previous response in simple terms. If I have added specific text below, explain that instead:\n\n" },
    { label: "Summarize", prompt: "Please summarize the previous response. If I have added specific text below, summarize that instead:\n\n" },
    { label: "Give Example", prompt: "Can you give a real-world example based on the previous response? If I have added specific text below, give an example for that instead:\n\n" },
    { label: "Expand", prompt: "Please elaborate and provide more details on the previous response. If I have added specific text below, expand on that instead:\n\n" }
  ];

  const handleQuickAction = (prompt: string) => {
    setInput(prev => prev ? `${prompt}${prev}` : prompt);
    textareaRef.current?.focus();
  };

  return (
    <div className="flex h-screen bg-white text-gray-800 font-sans overflow-hidden">
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed md:static inset-y-0 left-0 z-50 w-72 bg-gray-900 text-gray-300 flex flex-col transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-bold text-xl">
            <BookOpen className="w-6 h-6 text-blue-500" />
            Aspirant AI
          </div>
          <button className="md:hidden text-gray-400 hover:text-white" onClick={() => setIsSidebarOpen(false)}>
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="px-3 pb-4">
          <button 
            onClick={createNewChat}
            className="w-full flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-3 rounded-lg transition border border-gray-700"
          >
            <Plus className="w-5 h-5" />
            New Study Session
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 space-y-1 custom-scrollbar">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-2 mt-2">
            Recent Sessions
          </div>
          {chats.length === 0 ? (
            <div className="text-sm text-gray-500 px-2 italic">No previous sessions</div>
          ) : (
            chats.sort((a, b) => b.updatedAt - a.updatedAt).map(chat => (
              <div 
                key={chat.id}
                onClick={() => { setCurrentChatId(chat.id); setIsSidebarOpen(false); }}
                className={`group flex items-center justify-between px-3 py-3 rounded-lg cursor-pointer transition ${
                  currentChatId === chat.id ? 'bg-gray-800 text-white' : 'hover:bg-gray-800/50'
                }`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <MessageSquare className="w-4 h-4 shrink-0 text-gray-400" />
                  <span className="truncate text-sm">{chat.title}</span>
                </div>
                <button 
                  onClick={(e) => deleteChat(e, chat.id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
        
        <div className="p-4 border-t border-gray-800 flex flex-col gap-2">
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition px-2 py-2 rounded-lg hover:bg-gray-800"
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
          <div className="text-xs text-gray-500 text-center mt-2">
            Aspirant AI - Study Companion
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full relative w-full">
        {/* Header (Mobile) */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-gray-200 bg-white z-10">
          <button onClick={() => setIsSidebarOpen(true)} className="text-gray-600 hover:text-gray-900">
            <Menu className="w-6 h-6" />
          </button>
          <div className="font-semibold text-gray-800">Aspirant AI</div>
          <div className="w-6"></div> {/* Spacer for centering */}
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
          <div className="max-w-3xl mx-auto w-full">
            {!currentChat || currentChat.messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
                  <Brain className="w-10 h-10 text-blue-600" />
                </div>
                <h2 className="text-3xl font-bold text-gray-800 mb-3">How can I help you study today?</h2>
                <p className="text-gray-500 mb-10 max-w-md">
                  I'm your personal AI tutor. Ask me to explain concepts, solve problems, or generate practice questions.
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
                  {suggestedPrompts.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(prompt.text)}
                      className="flex flex-col items-start p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition text-left group"
                    >
                      <div className="mb-2 p-2 bg-gray-50 rounded-lg group-hover:bg-blue-50 transition">
                        {prompt.icon}
                      </div>
                      <span className="text-sm font-medium text-gray-700">{prompt.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6 pb-20">
                {currentChat.messages.map((msg, index) => (
                  <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'model' && (
                      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0 mt-1">
                        <Bot className="w-5 h-5 text-white" />
                      </div>
                    )}
                    
                    <div className={`max-w-[85%] md:max-w-[75%] flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`rounded-2xl px-5 py-4 w-full ${
                        msg.role === 'user' 
                          ? 'bg-gray-100 text-gray-800 rounded-tr-sm' 
                          : 'bg-white border border-gray-200 shadow-sm rounded-tl-sm prose prose-blue max-w-none'
                      }`}>
                        {editingMessageId === msg.id ? (
                          <div className="flex flex-col gap-2 w-full">
                            <textarea 
                              value={editInput} 
                              onChange={e => setEditInput(e.target.value)}
                              className="w-full p-2 border border-gray-300 rounded-lg resize-y min-h-[100px] text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            <div className="flex justify-end gap-2 mt-2">
                              <button onClick={cancelEdit} className="px-3 py-1.5 text-sm rounded-lg bg-gray-200 hover:bg-gray-300 transition">Cancel</button>
                              <button onClick={() => saveEdit(msg.id)} className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition">Save & Send</button>
                            </div>
                          </div>
                        ) : (
                          msg.role === 'user' ? (
                            <div className="flex flex-col gap-3">
                              {msg.image && (
                                <img src={msg.image} alt="Uploaded content" className="max-w-full rounded-lg max-h-64 object-contain" referrerPolicy="no-referrer" />
                              )}
                              {msg.file && (
                                msg.file.type.startsWith('image/') ? (
                                  <img src={msg.file.dataUrl} alt="Uploaded content" className="max-w-full rounded-lg max-h-64 object-contain" referrerPolicy="no-referrer" />
                                ) : (
                                  <div className="flex items-center gap-3 bg-white/50 p-3 rounded-lg border border-gray-200">
                                    <div className="bg-red-100 p-2 rounded-lg text-red-500">
                                      <FileText className="w-6 h-6" />
                                    </div>
                                    <span className="text-sm font-medium text-gray-700">{msg.file.name}</span>
                                  </div>
                                )
                              )}
                              <div className="whitespace-pre-wrap">{msg.content}</div>
                            </div>
                          ) : (
                            msg.content ? (
                              <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{msg.content}</Markdown>
                            ) : (
                              <div className="flex items-center gap-1 h-6">
                                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                              </div>
                            )
                          )
                        )}
                      </div>
                      
                      {/* Action Buttons */}
                      {!editingMessageId && (
                        <div className={`flex items-center gap-2 px-2 mt-1 text-gray-400 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                          <button onClick={() => handleCopy(msg.content, msg.id)} className="hover:text-gray-700 transition p-1" title="Copy text">
                            {copiedId === msg.id ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                          </button>
                          {msg.role === 'user' && (
                            <button onClick={() => startEdit(msg)} className="hover:text-gray-700 transition p-1" title="Edit message">
                              <Edit2 size={14} />
                            </button>
                          )}
                          {msg.role === 'model' && index === currentChat.messages.length - 1 && (
                            <button onClick={handleRegenerate} className="hover:text-gray-700 transition p-1" title="Regenerate response">
                              <RefreshCw size={14} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {msg.role === 'user' && (
                      <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center shrink-0 mt-1">
                        <User className="w-5 h-5 text-white" />
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="bg-white border-t border-gray-100 p-4 md:p-6">
          <div className="max-w-3xl mx-auto">
            {/* Quick Actions */}
            <div className="flex gap-2 mb-3 overflow-x-auto custom-scrollbar pb-1">
              {quickActions.map(action => (
                <button 
                  key={action.label} 
                  onClick={() => handleQuickAction(action.prompt)} 
                  className="flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs rounded-full transition border border-gray-200"
                >
                  <Zap size={12} className="text-yellow-500" />
                  {action.label}
                </button>
              ))}
            </div>

            {selectedFile && (
              <div className="mb-3 relative inline-flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg p-2 pr-8">
                {selectedFile.type.startsWith('image/') ? (
                  <img src={selectedFile.dataUrl} alt="Preview" className="h-12 w-12 object-cover rounded-md border border-gray-200" referrerPolicy="no-referrer" />
                ) : (
                  <div className="h-12 w-12 bg-red-100 text-red-500 rounded-md flex items-center justify-center">
                    <FileText className="w-6 h-6" />
                  </div>
                )}
                <span className="text-sm text-gray-700 truncate max-w-[150px]">{selectedFile.name}</span>
                <button 
                  onClick={removeFile}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-sm"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            <div className="relative flex items-end gap-2 bg-gray-50 border border-gray-300 rounded-2xl p-2 shadow-sm focus-within:ring-2 focus-within:ring-blue-500/50 focus-within:border-blue-500 transition-all">
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*,.pdf,.doc,.docx"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0 p-3 rounded-xl text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition mb-1 ml-1"
                title="Attach file"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a doubt, request an explanation, or generate questions..."
                className="w-full max-h-[200px] bg-transparent border-none focus:ring-0 resize-none py-3 px-2 text-gray-800 placeholder-gray-500"
                rows={1}
                disabled={isLoading}
              />
              <button
                onClick={() => handleSend()}
                disabled={(!input.trim() && !selectedFile) || isLoading}
                className="shrink-0 p-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition mb-1 mr-1"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="text-center mt-3 text-xs text-gray-400">
            Aspirant AI can make mistakes. Verify important academic information.
          </div>
        </div>

      </div>
      
      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Settings className="w-5 h-5" /> Settings
              </h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-gray-500 hover:text-gray-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">AI Provider</label>
                <select 
                  value={provider}
                  onChange={(e) => {
                    setProvider(e.target.value);
                    localStorage.setItem('aspirant_ai_provider', e.target.value);
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="gemini">Google Gemini</option>
                  <option value="openai">OpenAI</option>
                  <option value="claude">Anthropic Claude</option>
                  <option value="copilot">GitHub Copilot</option>
                  <option value="qwen">Qwen</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Model Name</label>
                <input 
                  type="text" 
                  value={modelName}
                  onChange={(e) => {
                    setModelName(e.target.value);
                    localStorage.setItem('aspirant_ai_model', e.target.value);
                  }}
                  placeholder="e.g., gemini-3.1-pro-preview"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  disabled={false}
                />
                <p className="text-xs text-gray-500 mt-1">Specify the exact model version you want to use.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Custom API Key</label>
                <input 
                  type="password" 
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    localStorage.setItem('aspirant_ai_api_key', encryptKey(e.target.value));
                  }}
                  placeholder="Enter your API key (optional)"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">Your key is encrypted locally (AES) in your browser and never sent to our servers.</p>
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-medium transition"
              >
                Save & Close
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Global styles for custom scrollbar */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #374151;
          border-radius: 20px;
        }
      `}} />
    </div>
  );
}

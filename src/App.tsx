import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MapPin,
  Mail,
  Github,
  Linkedin,
  Twitter,
  Clock,
  Send,
  Check,
  Edit3,
  ExternalLink,
  Sparkles,
  Inbox,
  Trash2,
  Calendar,
  Code
} from 'lucide-react';
import { Profile, Message } from './types';
import ProfileEditModal from './components/ProfileEditModal';
import { SpeedInsights } from '@vercel/speed-insights/react';

// Default initial state for a highly professional profile
const DEFAULT_PROFILE: Profile = {
  name: 'Mateo Silva',
  role: 'Product Designer & Frontend Engineer',
  location: 'São Paulo, Brasil',
  bio: 'Crio interfaces limpas, funcionais e focadas na experiência de quem usa. Apaixonado por tipografia, minimalismo e desenvolvimento frontend de alta performance com React e Tailwind CSS.',
  email: 'mateo.silva@exemplo.com',
  github: 'https://github.com',
  linkedin: 'https://linkedin.com',
  twitter: 'https://twitter.com',
  skills: ['UI/UX Design', 'React', 'TypeScript', 'Tailwind CSS', 'Motion', 'Prototipagem']
};

export default function App() {
  // State initialization
  const [profile, setProfile] = useState<Profile>(() => {
    const saved = localStorage.getItem('user_profile_website');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return DEFAULT_PROFILE;
      }
    }
    return DEFAULT_PROFILE;
  });

  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('user_profile_messages');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Form states
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formStatus, setFormStatus] = useState<'idle' | 'sending' | 'success'>('idle');

  // Tab state for the admin/inbox showcase (locally visible)
  const [activeTab, setActiveTab] = useState<'info' | 'inbox'>('info');

  // Real-time clock update
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync profile to localStorage
  const handleSaveProfile = (updatedProfile: Profile) => {
    setProfile(updatedProfile);
    localStorage.setItem('user_profile_website', JSON.stringify(updatedProfile));
  };

  // Submit direct message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim() || !formContent.trim()) return;

    setFormStatus('sending');

    setTimeout(() => {
      const newMessage: Message = {
        id: crypto.randomUUID(),
        senderName: formName,
        senderEmail: formEmail,
        content: formContent,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + ' - ' + new Date().toLocaleDateString('pt-BR')
      };

      const updatedMessages = [newMessage, ...messages];
      setMessages(updatedMessages);
      localStorage.setItem('user_profile_messages', JSON.stringify(updatedMessages));

      // Clear form & transition status
      setFormName('');
      setFormEmail('');
      setFormContent('');
      setFormStatus('success');

      // Go back to idle after a few seconds
      setTimeout(() => {
        setFormStatus('idle');
      }, 4000);
    }, 1200);
  };

  // Delete local message
  const handleDeleteMessage = (id: string) => {
    const updated = messages.filter(m => m.id !== id);
    setMessages(updated);
    localStorage.setItem('user_profile_messages', JSON.stringify(updated));
  };

  // Format initials for avatar
  const getInitials = (fullName: string) => {
    const parts = fullName.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return fullName.substring(0, 2).toUpperCase();
  };

  return (
    <div id="app-root" className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-indigo-100 selection:text-indigo-900">
      <SpeedInsights />
      
      {/* Top Header Panel */}
      <header id="main-header" className="border-b border-slate-200 bg-white/70 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
              <div className="w-4 h-4 border-2 border-white rounded-full"></div>
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-800 font-display">Portfólio Ativo</span>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Realtime clock display */}
            <div id="live-clock-container" className="hidden sm:flex items-center gap-2 text-xs font-mono text-slate-500">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>
                {currentTime.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
              <span className="text-slate-300">|</span>
              <span className="font-semibold text-slate-700">
                {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>

            {/* Quick Actions */}
            <button
              id="header-edit-btn"
              onClick={() => setIsEditOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-all shadow-md cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Personalizar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main id="main-content" className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 md:py-12 space-y-8">
        
        {/* Welcome Pitch */}
        <motion.div
          id="welcome-card"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center sm:text-left space-y-3 pb-2"
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-[10px] font-bold text-indigo-700 uppercase tracking-wider">
            <Sparkles className="w-3 h-3 text-indigo-600" /> Disponível para novos projetos
          </div>
          <h1 className="font-display text-3xl md:text-5xl font-extrabold text-slate-900 leading-tight tracking-tight">
            Seja bem-vindo ao meu <span className="text-indigo-600">Espaço</span> Digital.
          </h1>
          <p className="text-slate-600 text-sm md:text-base max-w-2xl font-light leading-relaxed">
            Este é um website totalmente interativo. Sinta-se à vontade para clicar em <strong className="font-medium text-indigo-600">"Personalizar"</strong> no menu superior para editar as informações do perfil em tempo real!
          </p>
        </motion.div>

        {/* Primary Interactive Module: Bento Grid Inspired Layout */}
        <div id="profile-grid" className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          
          {/* Card Esquerdo: Biografia & Redes */}
          <motion.div
            id="left-card-group"
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="md:col-span-2 space-y-6"
          >
            {/* Main Profile Info Panel */}
            <div id="main-profile-card" className="bg-white border border-slate-200 rounded-[24px] p-6 md:p-8 shadow-xl shadow-slate-100/70 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-radial from-indigo-100/30 to-transparent pointer-events-none rounded-bl-full" />
              
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                {/* Simulated Stylized Avatar */}
                <div id="avatar-container" className="relative group">
                  <div className="w-20 h-20 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-display text-2xl font-bold shadow-md relative z-10 select-none transition-transform group-hover:scale-[1.03] duration-300">
                    {getInitials(profile.name)}
                  </div>
                  <div className="absolute -inset-1 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-300 opacity-20 blur-md group-hover:opacity-30 transition-opacity" />
                  <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white z-20" />
                </div>

                <div className="flex-1 text-center sm:text-left space-y-2">
                  <div className="space-y-1">
                    <h2 id="profile-display-name" className="font-display text-2xl font-bold text-slate-900 tracking-tight">
                      {profile.name}
                    </h2>
                    <p id="profile-display-role" className="text-slate-600 font-medium text-sm md:text-base">
                      {profile.role}
                    </p>
                  </div>

                  <div className="flex flex-wrap justify-center sm:justify-start items-center gap-3 text-xs text-slate-500 pt-1">
                    <span id="profile-display-location" className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {profile.location || 'Sem localização'}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span id="profile-display-email" className="flex items-center gap-1 hover:text-indigo-600 transition-colors">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <a href={`mailto:${profile.email}`}>{profile.email}</a>
                    </span>
                  </div>
                </div>
              </div>

              {/* Bio block */}
              <div id="profile-display-bio" className="mt-6 pt-6 border-t border-slate-100 text-slate-600 text-sm md:text-base leading-relaxed font-light">
                {profile.bio}
              </div>

              {/* Skills section */}
              <div id="skills-section" className="mt-6 space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Code className="w-3.5 h-3.5 text-indigo-500" /> Habilidades Técnicas
                </h3>
                <div id="skills-chips-container" className="flex flex-wrap gap-2">
                  {profile.skills.map((skill, index) => (
                    <span
                      key={index}
                      className="px-2.5 py-1 bg-indigo-50/50 border border-indigo-100 text-xs text-indigo-700 font-semibold rounded-md shadow-2sm"
                    >
                      {skill}
                    </span>
                  ))}
                  {profile.skills.length === 0 && (
                    <span className="text-xs text-slate-400 italic">Nenhuma habilidade cadastrada</span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Links Showcase */}
            <div id="social-links-panel" className="bg-white border border-slate-200 rounded-[24px] p-6 shadow-xl shadow-slate-100/50">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Meus Canais & Redes</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Github */}
                <a
                  id="link-github"
                  href={profile.github || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/10 transition-all group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-slate-100 rounded-lg text-slate-700 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <Github className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-medium text-slate-700 group-hover:text-slate-950 transition-colors">GitHub</span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 transition-colors" />
                </a>

                {/* Linkedin */}
                <a
                  id="link-linkedin"
                  href={profile.linkedin || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/10 transition-all group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-slate-100 rounded-lg text-slate-700 group-hover:bg-[#0077b5] group-hover:text-white transition-colors">
                      <Linkedin className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-medium text-slate-700 group-hover:text-slate-950 transition-colors">LinkedIn</span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 transition-colors" />
                </a>

                {/* Twitter */}
                <a
                  id="link-twitter"
                  href={profile.twitter || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/10 transition-all group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-slate-100 rounded-lg text-slate-700 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <Twitter className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-medium text-slate-700 group-hover:text-slate-950 transition-colors">Twitter / X</span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 transition-colors" />
                </a>
              </div>
            </div>
          </motion.div>

          {/* Card Direito: Abas Interativas (Formulário ou Inbox Local) */}
          <motion.div
            id="right-card-group"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="space-y-6"
          >
            {/* Interactive Selector Tabs */}
            <div id="interactive-tabs-container" className="bg-white border border-slate-200 rounded-2xl p-1 shadow-sm flex">
              <button
                id="tab-info"
                onClick={() => setActiveTab('info')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                  activeTab === 'info'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                    : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-50'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>Contato</span>
              </button>
              <button
                id="tab-inbox"
                onClick={() => setActiveTab('inbox')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer relative ${
                  activeTab === 'inbox'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                    : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-50'
                }`}
              >
                <Inbox className="w-3.5 h-3.5" />
                <span>Inbox</span>
                {messages.length > 0 && (
                  <span className="absolute -top-1 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-white">
                    {messages.length}
                  </span>
                )}
              </button>
            </div>

            {/* Content for Tabs */}
            <AnimatePresence mode="wait">
              {activeTab === 'info' ? (
                <motion.div
                  key="contact-tab"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.2 }}
                  id="tab-contact-content"
                  className="bg-white border border-slate-200 rounded-[24px] p-6 shadow-xl shadow-slate-100/70 space-y-4"
                >
                  <div className="space-y-1">
                    <h3 className="font-display font-bold text-lg text-slate-900">Mande uma mensagem</h3>
                    <p className="text-xs text-slate-500">Envie uma mensagem e veja ela aparecer na aba de Inbox ao lado!</p>
                  </div>

                  <form id="contact-form" onSubmit={handleSendMessage} className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Seu Nome</label>
                      <input
                        id="form-input-name"
                        type="text"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        required
                        placeholder="Ex: Ana Maria"
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Seu E-mail</label>
                      <input
                        id="form-input-email"
                        type="email"
                        value={formEmail}
                        onChange={(e) => setFormEmail(e.target.value)}
                        required
                        placeholder="Ex: ana@email.com"
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Mensagem</label>
                      <textarea
                        id="form-input-content"
                        value={formContent}
                        onChange={(e) => setFormContent(e.target.value)}
                        required
                        rows={3}
                        placeholder="Diga olá ou faça uma proposta profissional..."
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white resize-none"
                      />
                    </div>

                    <button
                      id="form-submit-btn"
                      type="submit"
                      disabled={formStatus !== 'idle'}
                      className={`w-full py-2.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer ${
                        formStatus === 'success'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-100'
                      }`}
                    >
                      {formStatus === 'idle' && (
                        <>
                          <Send className="w-3.5 h-3.5" /> Enviar Mensagem
                        </>
                      )}
                      {formStatus === 'sending' && (
                        <div className="flex items-center gap-1.5">
                          <span className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                          <span>Enviando...</span>
                        </div>
                      )}
                      {formStatus === 'success' && (
                        <>
                          <Check className="w-3.5 h-3.5" /> Mensagem Enviada!
                        </>
                      )}
                    </button>
                  </form>
                </motion.div>
              ) : (
                <motion.div
                  key="inbox-tab"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.2 }}
                  id="tab-inbox-content"
                  className="bg-white border border-slate-200 rounded-[24px] p-6 shadow-xl shadow-slate-100/70 space-y-4"
                >
                  <div className="space-y-1">
                    <h3 className="font-display font-bold text-lg text-slate-900 flex items-center gap-1.5">
                      <Inbox className="w-5 h-5 text-indigo-600" /> Caixa de Entrada Local
                    </h3>
                    <p className="text-xs text-slate-500">As mensagens que você envia pelo formulário de contato são salvas aqui no seu navegador.</p>
                  </div>

                  <div id="messages-list" className="space-y-3.5 max-h-[320px] overflow-y-auto pr-1">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className="p-3 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors relative group space-y-1.5"
                      >
                        <button
                          id={`delete-msg-${msg.id}`}
                          onClick={() => handleDeleteMessage(msg.id)}
                          className="absolute top-2 right-2 p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        <div className="space-y-0.5">
                          <h4 className="text-xs font-semibold text-slate-800 pr-5 truncate">{msg.senderName}</h4>
                          <p className="text-[10px] text-slate-500 font-mono">{msg.senderEmail}</p>
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed break-words whitespace-pre-wrap font-light">
                          {msg.content}
                        </p>

                        <div className="flex items-center gap-1 text-[9px] text-slate-400 font-mono">
                          <Calendar className="w-3 h-3 text-slate-300" />
                          <span>{msg.timestamp}</span>
                        </div>
                      </div>
                    ))}

                    {messages.length === 0 && (
                      <div className="py-12 text-center space-y-2">
                        <Inbox className="w-8 h-8 text-slate-300 mx-auto" />
                        <p className="text-xs text-slate-500 italic">Nenhuma mensagem recebida ainda.</p>
                        <button
                          id="empty-inbox-prompt"
                          onClick={() => setActiveTab('info')}
                          className="text-xs text-indigo-600 font-semibold hover:underline"
                        >
                          Envie uma de teste agora!
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

        </div>
      </main>

      {/* Elegant minimalist footer */}
      <footer id="main-footer" className="bg-slate-900 text-slate-400 py-10 mt-16 border-t border-slate-800">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-4">
          <p className="text-xs text-slate-500 font-light">
            © {currentTime.getFullYear()} • Criado com React, Tailwind CSS e Framer Motion. Design de Classe Mundial.
          </p>
          <div className="flex justify-center gap-4 text-xs font-bold uppercase tracking-wider text-slate-400">
            <a href="#" className="hover:text-white transition-colors">Website Simples</a>
            <span className="text-slate-700">|</span>
            <a href="#" className="hover:text-white transition-colors">Portfólio Interativo</a>
            <span className="text-slate-700">|</span>
            <span className="hover:text-white cursor-pointer" onClick={() => setIsEditOpen(true)}>Personalizar</span>
          </div>
        </div>
      </footer>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {isEditOpen && (
          <ProfileEditModal
            isOpen={isEditOpen}
            onClose={() => setIsEditOpen(false)}
            profile={profile}
            onSave={handleSaveProfile}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

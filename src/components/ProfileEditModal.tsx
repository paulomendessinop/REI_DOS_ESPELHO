import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Save, Plus, Trash2, Sparkles } from 'lucide-react';
import { Profile } from '../types';

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile;
  onSave: (updatedProfile: Profile) => void;
}

export default function ProfileEditModal({ isOpen, onClose, profile, onSave }: ProfileEditModalProps) {
  const [edited, setEdited] = useState<Profile>({ ...profile });
  const [newSkill, setNewSkill] = useState('');

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEdited(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddSkill = () => {
    if (newSkill.trim() && !edited.skills.includes(newSkill.trim())) {
      setEdited(prev => ({
        ...prev,
        skills: [...prev.skills, newSkill.trim()]
      }));
      setNewSkill('');
    }
  };

  const handleRemoveSkill = (indexToRemove: number) => {
    setEdited(prev => ({
      ...prev,
      skills: prev.skills.filter((_, i) => i !== indexToRemove)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(edited);
    onClose();
  };

  return (
    <div id="edit-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div
        id="edit-modal-container"
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden text-slate-900"
      >
        {/* Header */}
        <div id="modal-header" className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            <h3 className="font-display text-lg font-semibold text-slate-800">Editar Perfil</h3>
          </div>
          <button
            id="close-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form id="edit-profile-form" onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Nome */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Nome Completo</label>
              <input
                id="input-name"
                type="text"
                name="name"
                value={edited.name}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white text-sm"
              />
            </div>

            {/* Profissão */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Cargo / Profissão</label>
              <input
                id="input-role"
                type="text"
                name="role"
                value={edited.role}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Localização */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Localização</label>
              <input
                id="input-location"
                type="text"
                name="location"
                value={edited.location}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white text-sm"
              />
            </div>

            {/* Email */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">E-mail de Contato</label>
              <input
                id="input-email"
                type="email"
                name="email"
                value={edited.email}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white text-sm"
              />
            </div>
          </div>

          {/* Bio */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Biografia</label>
            <textarea
              id="input-bio"
              name="bio"
              value={edited.bio}
              onChange={handleChange}
              rows={3}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white resize-none text-sm"
            />
          </div>

          {/* Social Links */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Redes Sociais & Links</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">GitHub (URL)</label>
                <input
                  id="input-github"
                  type="url"
                  name="github"
                  value={edited.github}
                  onChange={handleChange}
                  placeholder="https://github.com/..."
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">LinkedIn (URL)</label>
                <input
                  id="input-linkedin"
                  type="url"
                  name="linkedin"
                  value={edited.linkedin}
                  onChange={handleChange}
                  placeholder="https://linkedin.com/in/..."
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Twitter/X (URL)</label>
                <input
                  id="input-twitter"
                  type="url"
                  name="twitter"
                  value={edited.twitter}
                  onChange={handleChange}
                  placeholder="https://twitter.com/..."
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white text-xs"
                />
              </div>
            </div>
          </div>

          {/* Habilidades */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Habilidades (Skills)</label>
            <div className="flex gap-2">
              <input
                id="input-new-skill"
                type="text"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                placeholder="Ex: Figma, Tailwind, Next.js..."
                className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white text-sm"
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())}
              />
              <button
                id="add-skill-btn"
                type="button"
                onClick={handleAddSkill}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Adicionar
              </button>
            </div>

            {/* List of skills */}
            <div id="skills-list" className="flex flex-wrap gap-2 pt-2">
              {edited.skills.map((skill, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full text-xs font-medium text-indigo-800"
                >
                  <span>{skill}</span>
                  <button
                    id={`remove-skill-${index}`}
                    type="button"
                    onClick={() => handleRemoveSkill(index)}
                    className="p-0.5 rounded-full text-indigo-500 hover:text-red-600 hover:bg-slate-200 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {edited.skills.length === 0 && (
                <p className="text-xs text-slate-500 italic pt-1">Nenhuma habilidade adicionada ainda.</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div id="modal-actions" className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              id="cancel-edit-btn"
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              id="save-edit-btn"
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 shadow-lg shadow-indigo-100 cursor-pointer"
            >
              <Save className="w-4 h-4" /> Salvar Perfil
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

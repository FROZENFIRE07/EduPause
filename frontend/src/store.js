import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAppStore = create(
  persist(
    (set, get) => ({
      // Theme
      theme: 'dark',
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),

      // Onboarding
      onboardingComplete: false,
      setOnboardingComplete: (val) => set({ onboardingComplete: val }),

      // User preferences
      userName: 'Learner',
      setUserName: (name) => set({ userName: name }),
      learningStyle: null,
      setLearningStyle: (style) => set({ learningStyle: style }),
      interests: [],
      setInterests: (topics) => set({ interests: topics }),
      dailyGoal: 30, // minutes
      setDailyGoal: (goal) => set({ dailyGoal: goal }),
      userRole: null, // 'student' or 'tutor'
      setUserRole: (role) => set({ userRole: role }),

      // Achievements
      achievements: [
        { id: 'first_video', title: 'First Steps', desc: 'Watch your first video', icon: '🎬', unlocked: false },
        { id: 'first_quiz', title: 'Quiz Whiz', desc: 'Pass your first quiz', icon: '✅', unlocked: false },
        { id: 'mastery_1', title: 'Concept Master', desc: 'Master your first concept', icon: '🏆', unlocked: false },
        { id: 'videos_10', title: 'Binge Learner', desc: 'Watch 10 videos', icon: '📺', unlocked: false },
        { id: 'speed_demon', title: 'Speed Demon', desc: 'Watch at 2x speed', icon: '⚡', unlocked: false },
        { id: 'night_owl', title: 'Night Owl', desc: 'Study after midnight', icon: '🦉', unlocked: false },
      ],
      unlockAchievement: (id) =>
        set((s) => ({
          achievements: s.achievements.map((a) =>
            a.id === id ? { ...a, unlocked: true } : a
          ),
        })),

      // Notes
      notes: {},
      setNote: (videoId, text) =>
        set((s) => ({ notes: { ...s.notes, [videoId]: text } })),

      // Theater mode
      theaterMode: false,
      toggleTheaterMode: () => set((s) => ({ theaterMode: !s.theaterMode })),

      // Current playlist for learning session
      currentPlaylist: [],
      setCurrentPlaylist: (videos) => set({ currentPlaylist: videos }),

      // Saved playlists — persist permanently across sessions
      // Each: { id, title, url, videos: [{videoId, title}], importedAt }
      savedPlaylists: [],
      addSavedPlaylist: (playlist) =>
        set((s) => {
          // Deduplicate by URL
          const exists = s.savedPlaylists.find(p => p.url === playlist.url);
          if (exists) {
            // Update existing with fresh videos
            return {
              savedPlaylists: s.savedPlaylists.map(p =>
                p.url === playlist.url ? { ...p, videos: playlist.videos, title: playlist.title } : p
              ),
            };
          }
          return {
            savedPlaylists: [...s.savedPlaylists, {
              id: playlist.id || `pl-${Date.now()}`,
              title: playlist.title || `Playlist ${s.savedPlaylists.length + 1}`,
              url: playlist.url || '',
              videos: playlist.videos || [],
              importedAt: new Date().toISOString(),
            }],
          };
        }),
      removeSavedPlaylist: (id) =>
        set((s) => ({
          savedPlaylists: s.savedPlaylists.filter(p => p.id !== id),
          // Clear current if it was the removed one
          currentPlaylist: s.currentPlaylist === s.savedPlaylists.find(p => p.id === id)?.videos
            ? [] : s.currentPlaylist,
        })),
      loadPlaylist: (id) =>
        set((s) => {
          const pl = s.savedPlaylists.find(p => p.id === id);
          return pl ? { currentPlaylist: pl.videos } : {};
        }),

      // Auth
      authUser: null,   // { name, email }
      authToken: null,
      setAuth: (user, token) => set({ authUser: user, authToken: token }),
      logout: () => {
        set({ authUser: null, authToken: null });
      },
    }),
    {
      name: 'edupause-storage',
    }
  )
);

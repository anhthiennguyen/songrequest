import React, { useState, useEffect } from 'react';
import { Disc3, Share2, Plus, ThumbsUp, Users, LogOut, Clock, ArrowLeft, Trash2, Globe, Edit2, Check, X } from 'lucide-react';
import { supabase } from './lib/supabase';
import Login from './components/Login';



export default function DJSessionApp() {

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('home');

  const [sessions, setSessions] = useState({});
  const [userSessions, setUserSessions] = useState([]);
  const [otherSessions, setOtherSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingOtherSessions, setLoadingOtherSessions] = useState(false);

  const [currentSessionId, setCurrentSessionId] = useState('');

  const [newSessionName, setNewSessionName] = useState('');
  const [newSongName, setNewSongName] = useState('');
  const [newArtistName, setNewArtistName] = useState('');
  const [editingSessionName, setEditingSessionName] = useState(false);
  const [editingSessionNameValue, setEditingSessionNameValue] = useState('');



  useEffect(() => {

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Store original URL when user is not authenticated
  useEffect(() => {
    if (!user && !loading) {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get('session');
      if (sessionId) {
        // Store the original URL to redirect back after login
        sessionStorage.setItem('redirectAfterLogin', window.location.search);
      }
    }
  }, [user, loading]);

  // Load user's sessions
  useEffect(() => {
    if (!user) return;

    const loadUserSessions = async () => {
      setLoadingSessions(true);
      try {
        const { data, error } = await supabase
          .from('sessions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setUserSessions(data || []);
      } catch (error) {
        console.error('Error loading sessions:', error);
      } finally {
        setLoadingSessions(false);
      }
    };

    loadUserSessions();
  }, [user]);

  // Load sessions user has visited (but didn't create)
  useEffect(() => {
    if (!user) return;

    const loadOtherSessions = async () => {
      setLoadingOtherSessions(true);
      try {
        // Get visited sessions from localStorage
        const visitedKey = `visited_sessions_${user.id}`;
        const visitedSessionIds = JSON.parse(localStorage.getItem(visitedKey) || '[]');

        // Get session IDs where user has added songs
        const { data: songsData, error: songsError } = await supabase
          .from('songs')
          .select('session_id')
          .eq('created_by', user.id)
          .not('session_id', 'is', null)
          .not('created_by', 'is', null);

        if (songsError) throw songsError;

        // Get session IDs where user has voted
        const { data: votesData, error: votesError } = await supabase
          .from('votes')
          .select('song_id')
          .eq('user_id', user.id);

        if (votesError) throw votesError;

        // Get song IDs from votes, then get their session IDs
        const songIds = votesData && votesData.length > 0 ? votesData.map(v => v.song_id) : [];
        let votedSessionIds = [];
        if (songIds.length > 0) {
          const { data: votedSongsData, error: votedSongsError } = await supabase
            .from('songs')
            .select('session_id')
            .in('id', songIds)
            .not('session_id', 'is', null);

          if (votedSongsError) throw votedSongsError;
          votedSessionIds = (votedSongsData || []).map(s => s.session_id);
        }

        // Combine visited sessions, sessions where user added songs, and sessions where user voted
        const songsSessionIds = (songsData || []).filter(s => s && s.session_id).map(s => s.session_id);
        const allSessionIds = [...visitedSessionIds, ...songsSessionIds, ...votedSessionIds].filter(id => id);
        
        // Get unique session IDs
        const allUniqueSessionIds = [...new Set(allSessionIds)];
        
        // Get user's own session IDs to exclude
        const { data: ownSessions } = await supabase
          .from('sessions')
          .select('session_id')
          .eq('user_id', user.id);

        const ownSessionIds = (ownSessions || []).map(s => s.session_id);

        // Filter out sessions user owns
        const otherSessionIds = allUniqueSessionIds.filter(
          id => !ownSessionIds.includes(id)
        );

        if (otherSessionIds.length === 0) {
          setOtherSessions([]);
          setLoadingOtherSessions(false);
          return;
        }

        // Get session details for these IDs
        const { data: sessionsData, error: sessionsError } = await supabase
          .from('sessions')
          .select('*')
          .in('session_id', otherSessionIds)
          .order('created_at', { ascending: false });

        if (sessionsError) throw sessionsError;

        // Load song counts for each session
        const sessionsWithCounts = await Promise.all(
          (sessionsData || []).map(async (session) => {
            const { count } = await supabase
              .from('songs')
              .select('*', { count: 'exact', head: true })
              .eq('session_id', session.session_id);

            return {
              ...session,
              songCount: count || 0
            };
          })
        );

        setOtherSessions(sessionsWithCounts);
      } catch (error) {
        console.error('Error loading other sessions:', error);
        setOtherSessions([]);
      } finally {
        setLoadingOtherSessions(false);
      }
    };

    loadOtherSessions();
  }, [user]);

  // Reload other sessions when returning to home view
  useEffect(() => {
    if (!user || view !== 'home') return;

    const loadOtherSessions = async () => {
      try {
        // Get visited sessions from localStorage
        const visitedKey = `visited_sessions_${user.id}`;
        const visitedSessionIds = JSON.parse(localStorage.getItem(visitedKey) || '[]');

        // Get session IDs where user has added songs
        const { data: songsData, error: songsError } = await supabase
          .from('songs')
          .select('session_id')
          .eq('created_by', user.id)
          .not('session_id', 'is', null)
          .not('created_by', 'is', null);

        if (songsError) throw songsError;

        // Get session IDs where user has voted
        const { data: votesData, error: votesError } = await supabase
          .from('votes')
          .select('song_id')
          .eq('user_id', user.id);

        if (votesError) throw votesError;

        // Get song IDs from votes, then get their session IDs
        const songIds = votesData && votesData.length > 0 ? votesData.map(v => v.song_id) : [];
        let votedSessionIds = [];
        if (songIds.length > 0) {
          const { data: votedSongsData, error: votedSongsError } = await supabase
            .from('songs')
            .select('session_id')
            .in('id', songIds)
            .not('session_id', 'is', null);

          if (votedSongsError) throw votedSongsError;
          votedSessionIds = (votedSongsData || []).map(s => s.session_id);
        }

        // Combine visited sessions, sessions where user added songs, and sessions where user voted
        const songsSessionIds = (songsData || []).filter(s => s && s.session_id).map(s => s.session_id);
        const allSessionIds = [...visitedSessionIds, ...songsSessionIds, ...votedSessionIds].filter(id => id);
        
        // Get unique session IDs
        const allUniqueSessionIds = [...new Set(allSessionIds)];

        // Get user's own session IDs to exclude
        const { data: ownSessions } = await supabase
          .from('sessions')
          .select('session_id')
          .eq('user_id', user.id);

        const ownSessionIds = (ownSessions || []).map(s => s.session_id);

        // Filter out sessions user owns
        const otherSessionIds = allUniqueSessionIds.filter(
          id => !ownSessionIds.includes(id)
        );

        if (otherSessionIds.length === 0) {
          setOtherSessions([]);
          return;
        }

        // Get session details for these IDs
        const { data: sessionsData, error: sessionsError } = await supabase
          .from('sessions')
          .select('*')
          .in('session_id', otherSessionIds)
          .order('created_at', { ascending: false });

        if (sessionsError) throw sessionsError;

        // Load song counts for each session
        const sessionsWithCounts = await Promise.all(
          (sessionsData || []).map(async (session) => {
            const { count } = await supabase
              .from('songs')
              .select('*', { count: 'exact', head: true })
              .eq('session_id', session.session_id);

            return {
              ...session,
              songCount: count || 0
            };
          })
        );

        setOtherSessions(sessionsWithCounts);
      } catch (error) {
        console.error('Error loading other sessions:', error);
      }
    };

    loadOtherSessions();
  }, [view, user]);

  // Handle URL session parameter and load session data
  useEffect(() => {
    if (!user) return;

    // Check if there's a stored redirect URL from before login
    const storedRedirect = sessionStorage.getItem('redirectAfterLogin');
    if (storedRedirect) {
      sessionStorage.removeItem('redirectAfterLogin');
      // Restore the URL with the query parameters
      window.history.replaceState({}, '', window.location.pathname + storedRedirect);
    }

    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session');

    if (sessionId) {
      setCurrentSessionId(sessionId);
      setView('session');
      loadSessionData(sessionId);
    }
  }, [user]);

  // Load session data (songs and votes) from Supabase
  const loadSessionData = async (sessionId) => {
    if (sessions[sessionId]?.ownerId) return; // Already loaded with owner info

    // Track visited session in localStorage
    if (user) {
      try {
        const visitedKey = `visited_sessions_${user.id}`;
        const visitedSessions = JSON.parse(localStorage.getItem(visitedKey) || '[]');
        if (!visitedSessions.includes(sessionId)) {
          visitedSessions.push(sessionId);
          localStorage.setItem(visitedKey, JSON.stringify(visitedSessions));
        }
      } catch (e) {
        console.error('Error saving visited session:', e);
      }
    }

    try {
      // Load session info to get owner and name
      const { data: sessionInfo, error: sessionError } = await supabase
        .from('sessions')
        .select('user_id, name')
        .eq('session_id', sessionId)
        .single();

      if (sessionError) throw sessionError;

      // Load songs
      const { data: songsData, error: songsError } = await supabase
        .from('songs')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (songsError) throw songsError;

      // Load votes for all songs
      const songIds = songsData.map(s => s.id);
      const { data: votesData, error: votesError } = await supabase
        .from('votes')
        .select('*')
        .in('song_id', songIds);

      if (votesError) throw votesError;

      // Combine songs with vote counts
      const songsWithVotes = songsData.map(song => {
        const songVotes = votesData.filter(v => v.song_id === song.id);
        return {
          id: song.id,
          name: song.name,
          artist: song.artist,
          votes: songVotes.length,
          voters: songVotes.map(v => v.user_id),
          created_by: song.created_by
        };
      }).sort((a, b) => b.votes - a.votes);

      setSessions(prev => ({
        ...prev,
        [sessionId]: { 
          songs: songsWithVotes,
          ownerId: sessionInfo.user_id,
          name: sessionInfo.name
        }
      }));

      // Set up real-time subscription for this session
      setupRealtimeSubscription(sessionId);
    } catch (error) {
      console.error('Error loading session data:', error);
      // Fallback to empty session
      setSessions(prev => ({
        ...prev,
        [sessionId]: { songs: [], ownerId: null, name: null }
      }));
    }
  };

  // Set up real-time subscriptions for songs and votes
  const setupRealtimeSubscription = (sessionId) => {
    // Subscribe to song changes
    const songsChannel = supabase
      .channel(`songs:${sessionId}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'songs', filter: `session_id=eq.${sessionId}` },
        async () => {
          // Reload songs when they change
          const { data: songsData } = await supabase
            .from('songs')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true });

          if (songsData) {
            const songIds = songsData.map(s => s.id);
            const { data: votesData } = await supabase
              .from('votes')
              .select('*')
              .in('song_id', songIds);

            const songsWithVotes = songsData.map(song => {
              const songVotes = (votesData || []).filter(v => v.song_id === song.id);
              return {
                id: song.id,
                name: song.name,
                artist: song.artist,
                votes: songVotes.length,
                voters: songVotes.map(v => v.user_id),
                created_by: song.created_by
              };
            }).sort((a, b) => b.votes - a.votes);

            setSessions(prev => ({
              ...prev,
              [sessionId]: { 
                ...prev[sessionId],
                songs: songsWithVotes 
              }
            }));
          }
        }
      )
      .subscribe();

    // Subscribe to vote changes
    const votesChannel = supabase
      .channel(`votes:${sessionId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'votes' },
        async () => {
          // Reload votes when they change
          const { data: songsData } = await supabase
            .from('songs')
            .select('*')
            .eq('session_id', sessionId);

          if (songsData) {
            const songIds = songsData.map(s => s.id);
            const { data: votesData } = await supabase
              .from('votes')
              .select('*')
              .in('song_id', songIds);

            const songsWithVotes = songsData.map(song => {
              const songVotes = (votesData || []).filter(v => v.song_id === song.id);
              return {
                id: song.id,
                name: song.name,
                artist: song.artist,
                votes: songVotes.length,
                voters: songVotes.map(v => v.user_id),
                created_by: song.created_by
              };
            }).sort((a, b) => b.votes - a.votes);

            setSessions(prev => ({
              ...prev,
              [sessionId]: { 
                ...prev[sessionId],
                songs: songsWithVotes 
              }
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(songsChannel);
      supabase.removeChannel(votesChannel);
    };
  };



  const createSession = async () => {
    if (!user) return;

    const sessionId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const sessionName = newSessionName.trim() || `Session ${sessionId}`;

    try {
      // Save session to Supabase
      const { error } = await supabase
        .from('sessions')
        .insert({
          user_id: user.id,
          session_id: sessionId,
          name: sessionName
        });

      if (error) throw error;

      // Update local state
      setSessions(prev => ({
        ...prev,
        [sessionId]: { songs: [], ownerId: user.id, name: sessionName }
      }));

      setCurrentSessionId(sessionId);
      setNewSessionName('');
      setView('session');

      // Reload user sessions
      const { data } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (data) setUserSessions(data);
      
      // Trigger reload of other sessions (in case user adds song to this new session)
      // The useEffect will handle reloading

      // Set up real-time subscription
      setupRealtimeSubscription(sessionId);
    } catch (error) {
      console.error('Error creating session:', error);
      alert('Failed to create session. Please try again.');
    }
  };



  const updateSessionName = async (sessionId, newName) => {
    if (!user) return;

    const session = sessions[sessionId];
    if (!session || session.ownerId !== user.id) {
      alert('You can only edit your own sessions.');
      return;
    }

    try {
      const { error } = await supabase
        .from('sessions')
        .update({ name: newName.trim() || null })
        .eq('session_id', sessionId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Update local state
      setSessions(prev => ({
        ...prev,
        [sessionId]: {
          ...prev[sessionId],
          name: newName.trim() || null
        }
      }));

      // Update userSessions
      setUserSessions(prev => prev.map(s => 
        s.session_id === sessionId 
          ? { ...s, name: newName.trim() || null }
          : s
      ));

      // Update otherSessions if it's in there
      setOtherSessions(prev => prev.map(s => 
        s.session_id === sessionId 
          ? { ...s, name: newName.trim() || null }
          : s
      ));

      setEditingSessionName(false);
    } catch (error) {
      console.error('Error updating session name:', error);
      alert('Failed to update session name. Please try again.');
    }
  };

  const startEditingSessionName = () => {
    setEditingSessionNameValue(currentSession?.name || '');
    setEditingSessionName(true);
  };

  const cancelEditingSessionName = () => {
    setEditingSessionName(false);
    setEditingSessionNameValue('');
  };

  const saveSessionName = () => {
    updateSessionName(currentSessionId, editingSessionNameValue);
  };

  const getSessionLink = () => {

    return `${window.location.origin}${window.location.pathname}?session=${currentSessionId}`;

  };



  const copyLink = () => {

    navigator.clipboard.writeText(getSessionLink());

    alert('Link copied to clipboard!');

  };



  const addSong = async () => {
    if (!newSongName.trim() || !currentSessionId) return;

    const sessionData = sessions[currentSessionId];
    const totalRequests = sessionData?.songs?.length || 0;

    // If there are more than 10 songs in this session, require the user to have
    // upvoted at least 5 songs in this session before they can request any songs.
    if (totalRequests > 10 && user?.id) {
      const userVotesInSession = (sessionData.songs || []).reduce((count, song) => {
        return count + (song.voters.includes(user.id) ? 1 : 0);
      }, 0);

      if (userVotesInSession < 5) {
        alert('There are already more than 10 songs requested in this session. You must upvote at least 5 songs in this session before requesting another song.');
        return;
      }
    }

    try {
      // Save song to Supabase
      const { data, error } = await supabase
        .from('songs')
        .insert({
          session_id: currentSessionId,
          name: newSongName.trim(),
          artist: newArtistName.trim() || null,
          created_by: user?.id || null
        })
        .select()
        .single();

      if (error) throw error;

      // Update local state (real-time will also update this, but this provides instant feedback)
      setSessions(prev => ({
        ...prev,
        [currentSessionId]: {
          songs: [
            ...(prev[currentSessionId]?.songs || []),
            {
              id: data.id,
              name: data.name,
              artist: data.artist,
              votes: 0,
              voters: [],
              created_by: data.created_by
            }
          ]
        }
      }));

      setNewSongName('');
      setNewArtistName('');
    } catch (error) {
      console.error('Error adding song:', error);
      alert('Failed to add song. Please try again.');
    }
  };



  const upvoteSong = async (songId) => {
    if (!user || !currentSessionId) return;

    const currentSession = sessions[currentSessionId];
    const song = currentSession?.songs.find(s => s.id === songId);
    
    if (!song) return;

    // Prevent users from upvoting their own songs
    if (song.created_by === user.id) {
      alert('You cannot upvote your own song request.');
      return;
    }

    const hasVoted = song.voters.includes(user.id);

    try {
      if (hasVoted) {
        // Remove vote from Supabase
        const { error } = await supabase
          .from('votes')
          .delete()
          .eq('song_id', songId)
          .eq('user_id', user.id);

        if (error) throw error;

        // Update local state (real-time will also update this)
        setSessions(prev => {
          const session = prev[currentSessionId];
          const updatedSongs = session.songs.map(s => {
            if (s.id === songId) {
              return {
                ...s,
                votes: s.votes - 1,
                voters: s.voters.filter(v => v !== user.id)
              };
            }
            return s;
          });

          return {
            ...prev,
            [currentSessionId]: {
              ...session,
              songs: updatedSongs.sort((a, b) => b.votes - a.votes)
            }
          };
        });
      } else {
        // Save vote to Supabase
        const { error } = await supabase
          .from('votes')
          .insert({
            song_id: songId,
            user_id: user.id
          });

        if (error) {
          // If it's a duplicate vote error, that's okay
          if (error.code !== '23505') throw error;
        }

        // Update local state (real-time will also update this)
        setSessions(prev => {
          const session = prev[currentSessionId];
          const updatedSongs = session.songs.map(s => {
            if (s.id === songId) {
              return {
                ...s,
                votes: s.votes + 1,
                voters: [...s.voters, user.id]
              };
            }
            return s;
          });

          return {
            ...prev,
            [currentSessionId]: {
              ...session,
              songs: updatedSongs.sort((a, b) => b.votes - a.votes)
            }
          };
        });
      }
    } catch (error) {
      console.error('Error toggling vote:', error);
      alert('Failed to update vote. Please try again.');
    }
  };

  const deleteSession = async (sessionId) => {
    if (!user) return;

    const session = sessions[sessionId];
    if (!session || session.ownerId !== user.id) {
      alert('You can only delete your own sessions.');
      return;
    }

    if (!confirm('Are you sure you want to delete this session? This will delete all songs and votes in this session.')) {
      return;
    }

    try {
      // First verify the session exists and belongs to the user
      const sessionInList = userSessions.find(s => s.session_id === sessionId);
      if (!sessionInList) {
        console.error('Session not found in userSessions:', sessionId);
        alert('Session not found.');
        return;
      }

      console.log('Found session to delete:', sessionInList);
      
      // Try deleting by session_id only (it's unique, RLS will check user_id automatically)
      const response = await supabase
        .from('sessions')
        .delete()
        .eq('session_id', sessionId);

      console.log('Delete response:', response);

      if (response.error) {
        console.error('Supabase delete error:', response.error);
        throw response.error;
      }

      // Verify the session was actually deleted by checking if it still exists
      // Wait a moment for the delete to propagate
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const { data: verifyData, error: verifyError } = await supabase
        .from('sessions')
        .select('id')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .single();

      // If we get data back, the session still exists (delete failed)
      if (verifyData) {
        console.error('Session still exists after delete! VerifyData:', verifyData);
        console.error('This indicates an RLS policy issue. The DELETE policy may not be set up correctly.');
        alert('Failed to delete session. The session still exists. Please check your Supabase RLS DELETE policy for the sessions table.');
        return;
      }

      // If we get an error (like "not found"), that's good - the session was deleted
      console.log('Session successfully deleted (verified by absence).');

      // Remove from local state
      setSessions(prev => {
        const newSessions = { ...prev };
        delete newSessions[sessionId];
        return newSessions;
      });

      // Remove from userSessions
      setUserSessions(prev => prev.filter(s => s.session_id !== sessionId));

      // If we're currently viewing this session, go home
      if (currentSessionId === sessionId) {
        goHome();
      }
    } catch (error) {
      console.error('Error deleting session:', error);
      alert(`Failed to delete session: ${error.message || 'Unknown error'}`);
    }
  };

  const deleteSong = async (songId) => {
    if (!user || !currentSessionId) return;

    const currentSession = sessions[currentSessionId];
    if (!currentSession || currentSession.ownerId !== user.id) {
      alert('Only the session owner can delete songs.');
      return;
    }

    if (!confirm('Are you sure you want to delete this song?')) {
      return;
    }

    try {
      const response = await supabase
        .from('songs')
        .delete()
        .eq('id', songId);

      if (response.error) throw response.error;

      // Update local state (real-time will also update this, but this provides instant feedback)
      setSessions(prev => {
        const session = prev[currentSessionId];
        return {
          ...prev,
          [currentSessionId]: {
            ...session,
            songs: session.songs.filter(s => s.id !== songId)
          }
        };
      });
    } catch (error) {
      console.error('Error deleting song:', error);
      alert('Failed to delete song. Please try again.');
    }
  };



  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setView('home');
    setSessions({});
    setCurrentSessionId('');
    setUserSessions([]);
    setOtherSessions([]);
  };

  const openSession = (sessionId) => {
    setCurrentSessionId(sessionId);
    setView('session');
    setEditingSessionName(false);
    setEditingSessionNameValue('');
    window.history.pushState({}, '', `?session=${sessionId}`);
    loadSessionData(sessionId);
  };

  const goHome = () => {
    setView('home');
    setCurrentSessionId('');
    setEditingSessionName(false);
    setEditingSessionNameValue('');
    window.history.pushState({}, '', window.location.pathname);
  };

  const currentSession = sessions[currentSessionId];

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!user) {
    return <Login onLogin={setUser} />;
  }

  if (view === 'home') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-950 via-indigo-950 to-blue-950 p-3 sm:p-4 pb-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-6 sm:mb-8">
            <div className="mb-4 sm:mb-8 flex justify-center">
              <Disc3 className="w-16 h-16 sm:w-24 sm:h-24 text-white" />
            </div>
            <h1 className="text-3xl sm:text-5xl font-bold text-white mb-2 sm:mb-4">Song Request</h1>
            <p className="text-gray-300 text-base sm:text-xl mb-6 sm:mb-8 px-2">Create a session and let your crowd choose the vibe</p>
          </div>

          <div className="flex flex-col items-center gap-4 sm:gap-6 mb-6 sm:mb-8">
            <div className="w-full max-w-md px-2">
              <input
                type="text"
                value={newSessionName}
                onChange={(e) => setNewSessionName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && createSession()}
                placeholder="Session Name (optional)"
                className="w-full px-4 py-3 sm:py-3 rounded-lg bg-white bg-opacity-20 text-white placeholder-purple-200 border border-purple-300 border-opacity-30 focus:outline-none focus:ring-2 focus:ring-purple-400 mb-3 text-base"
              />
              <button
                onClick={createSession}
                className="w-full bg-purple-500 hover:bg-purple-600 active:bg-purple-700 text-white font-bold py-3 sm:py-4 px-6 sm:px-8 rounded-full text-base sm:text-lg transition-all transform active:scale-95 shadow-lg touch-manipulation"
              >
                Create DJ Session
              </button>
            </div>

            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-white active:text-white text-sm flex items-center gap-2 transition-colors touch-manipulation py-2"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>

          {/* Your Sessions Section */}
          <div className="bg-white bg-opacity-10 backdrop-blur-lg rounded-2xl p-6 shadow-2xl mb-6">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <Clock className="w-6 h-6" />
              Your Sessions
            </h2>

            {loadingSessions ? (
              <p className="text-purple-200 text-center py-8">Loading sessions...</p>
            ) : userSessions.length === 0 ? (
              <p className="text-purple-200 text-center py-8">You haven't created any sessions yet. Create one to get started!</p>
            ) : (
              <div className="space-y-3">
                {userSessions.map((session) => {
                  const sessionData = sessions[session.session_id];
                  const songCount = sessionData?.songs?.length || 0;
                  
                  return (
                    <div
                      key={session.id}
                      className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-4 hover:bg-opacity-20 transition-all cursor-pointer"
                      onClick={() => openSession(session.session_id)}
                    >
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="bg-purple-500 bg-opacity-30 rounded-lg p-3 flex-shrink-0">
                            <Disc3 className="w-6 h-6 text-purple-300" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-white font-semibold text-lg truncate">
                              {session.name || `Session ${session.session_id}`}
                            </h3>
                            <p className="text-purple-300 text-xs">
                              ID: {session.session_id}
                            </p>
                            <p className="text-purple-200 text-sm flex items-center gap-2 mt-1">
                              <Users className="w-4 h-4 flex-shrink-0" />
                              {songCount} {songCount === 1 ? 'request' : 'requests'}
                            </p>
                            <p className="text-purple-300 text-xs mt-1">
                              Created {new Date(session.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSession(session.session_id);
                            }}
                            className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-3 sm:px-4 rounded-lg transition-all flex items-center gap-1 sm:gap-2"
                            title="Delete session"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="hidden sm:inline">Delete</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openSession(session.session_id);
                            }}
                            className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-3 sm:px-4 rounded-lg transition-all"
                          >
                            Open
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Other Sessions Section */}
          <div className="bg-white bg-opacity-10 backdrop-blur-lg rounded-2xl p-6 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <Globe className="w-6 h-6" />
              Other Sessions
            </h2>

            {loadingOtherSessions ? (
              <p className="text-purple-200 text-center py-8">Loading sessions...</p>
            ) : otherSessions.length === 0 ? (
              <p className="text-purple-200 text-center py-8">You haven't participated in any other sessions yet.</p>
            ) : (
              <div className="space-y-3">
                {otherSessions.map((session) => {
                  const sessionData = sessions[session.session_id];
                  const songCount = sessionData?.songs?.length || session.songCount || 0;
                  
                  return (
                    <div
                      key={session.id}
                      className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-4 hover:bg-opacity-20 transition-all cursor-pointer"
                      onClick={() => openSession(session.session_id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="bg-blue-500 bg-opacity-30 rounded-lg p-3">
                            <Globe className="w-6 h-6 text-blue-300" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-white font-semibold text-lg">
                              {session.name || `Session ${session.session_id}`}
                            </h3>
                            <p className="text-purple-300 text-xs">
                              ID: {session.session_id}
                            </p>
                            <p className="text-purple-200 text-sm flex items-center gap-2 mt-1">
                              <Users className="w-4 h-4" />
                              {songCount} {songCount === 1 ? 'request' : 'requests'}
                            </p>
                            <p className="text-purple-300 text-xs mt-1">
                              Created {new Date(session.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openSession(session.session_id);
                            }}
                            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-all"
                          >
                            Open
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }



  return (

    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-indigo-950 to-blue-950 p-4">

      <div className="max-w-3xl mx-auto">

        <div className="bg-white bg-opacity-10 backdrop-blur-lg rounded-2xl p-6 mb-6 shadow-2xl">

          <div className="flex items-center justify-between mb-4">

            <div className="flex items-center gap-3">

              <button
                onClick={goHome}
                className="bg-white bg-opacity-10 hover:bg-opacity-20 text-white p-2 rounded-lg transition-all"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <Disc3 className="w-8 h-8 text-purple-300" />

              <div className="flex-1">
                {editingSessionName && currentSession?.ownerId === user?.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editingSessionNameValue}
                      onChange={(e) => setEditingSessionNameValue(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') saveSessionName();
                        if (e.key === 'Escape') cancelEditingSessionName();
                      }}
                      autoFocus
                      className="text-2xl font-bold text-white bg-white bg-opacity-20 px-3 py-1 rounded-lg border border-purple-300 border-opacity-30 focus:outline-none focus:ring-2 focus:ring-purple-400 flex-1"
                      placeholder="Session name"
                    />
                    <button
                      onClick={saveSessionName}
                      className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-lg transition-all"
                      title="Save"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={cancelEditingSessionName}
                      className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg transition-all"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold text-white">
                      {currentSession?.name || `Session ${currentSessionId}`}
                    </h2>
                    {currentSession?.ownerId === user?.id && (
                      <button
                        onClick={startEditingSessionName}
                        className="bg-white bg-opacity-10 hover:bg-opacity-20 text-white p-1 rounded transition-all"
                        title="Edit session name"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}

                <p className="text-purple-300 text-xs">
                  ID: {currentSessionId}
                </p>

                <p className="text-purple-200 text-sm flex items-center gap-1 mt-1">

                  <Users className="w-4 h-4" />

                  {currentSession?.songs.length || 0} requests

                </p>

              </div>

            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button

                onClick={copyLink}

                className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-all"

              >

                <Share2 className="w-4 h-4" />

                Share Link

              </button>

              <button

                onClick={handleLogout}

                className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-all"

              >

                <LogOut className="w-4 h-4" />

                Sign Out

              </button>

            </div>

          </div>

        </div>



        <div className="bg-white bg-opacity-10 backdrop-blur-lg rounded-2xl p-6 mb-6 shadow-2xl">

          <h3 className="text-xl font-bold text-white mb-4">Request a Song</h3>

          <div className="flex flex-col gap-3">
            <p className="text-purple-200 text-sm">
              Note: Once there are more than 10 songs requested in this session, you must upvote at least 5 songs in this session before you can request another song.
            </p>
            <div className="flex gap-2">
              <input

                type="text"

                value={newSongName}

                onChange={(e) => setNewSongName(e.target.value)}

                onKeyPress={(e) => e.key === 'Enter' && addSong()}

                placeholder="Song Name"

                className="flex-1 px-4 py-3 rounded-lg bg-white bg-opacity-20 text-white placeholder-purple-200 border border-purple-300 border-opacity-30 focus:outline-none focus:ring-2 focus:ring-purple-400"

              />
            </div>
            <div className="flex gap-2">
              <input

                type="text"

                value={newArtistName}

                onChange={(e) => setNewArtistName(e.target.value)}

                onKeyPress={(e) => e.key === 'Enter' && addSong()}

                placeholder="Artist Name"

                className="flex-1 px-4 py-3 rounded-lg bg-white bg-opacity-20 text-white placeholder-purple-200 border border-purple-300 border-opacity-30 focus:outline-none focus:ring-2 focus:ring-purple-400"

              />

              <button

                onClick={addSong}

                className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-6 rounded-lg flex items-center gap-2 transition-all"

              >

                <Plus className="w-5 h-5" />

                Add

              </button>

            </div>

          </div>

        </div>


        <p className="text-center text-purple-100 text-sm mb-4">
          Upvote the songs you want to hear the most so they rise to the top.
        </p>

        <div className="bg-white bg-opacity-10 backdrop-blur-lg rounded-2xl p-6 shadow-2xl">

          <h3 className="text-xl font-bold text-white mb-4">Song Requests</h3>

          {!currentSession?.songs || currentSession.songs.length === 0 ? (

            <p className="text-purple-200 text-center py-8">No songs requested yet. Be the first!</p>

          ) : (

            <div className="space-y-3">

              {currentSession.songs.map((song, index) => (

                <div

                  key={song.id}

                  className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-4 flex items-center justify-between hover:bg-opacity-20 transition-all"

                >

                  <div className="flex items-center gap-4 flex-1">

                    <div className="text-purple-300 font-bold text-lg w-8">#{index + 1}</div>

                    <div className="flex-1">

                      <p className="text-white font-semibold">{song.name}</p>
                      {song.artist && (
                        <p className="text-purple-200 text-sm">{song.artist}</p>
                      )}

                    </div>

                  </div>

                  <div className="flex items-center gap-2">
                    {currentSession?.ownerId === user?.id && (
                      <button
                        onClick={() => deleteSong(song.id)}
                        className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-3 rounded-lg transition-all flex items-center gap-1"
                        title="Delete song"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <button

                      onClick={() => upvoteSong(song.id)}

                      className={`font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-all ${
                        song.voters.includes(user?.id)
                          ? 'bg-green-500 hover:bg-green-600 transform hover:scale-105'
                          : 'bg-purple-500 hover:bg-purple-600 transform hover:scale-105'
                      } text-white`}

                      title={song.voters.includes(user?.id) ? 'Click to remove your vote' : 'Click to vote'}

                    >

                      <ThumbsUp className="w-5 h-5" />

                      <span>{song.votes}</span>

                    </button>
                  </div>

                </div>

              ))}

            </div>

          )}

        </div>

      </div>

    </div>

  );

}


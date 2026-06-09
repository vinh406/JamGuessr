import { useCallback, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { useAuth } from "../useAuth";
import { useGameSocket } from "../useGameSocket";
import { useLibraryImport } from "../useLibraryImport";
import type {
  OutgoingMessage,
  ChatMessage,
  UserJoinedMessage,
  UserLeftMessage,
  UsersUpdatedMessage,
  AnswerMessage,
  UnifiedRoomStateMessage,
  VoteUpdateMessage,
  ErrorMessage,
  Playlist,
  ChatBoxMessage,
  UnifiedRoomState,
  RoundEndedMessage,
  RoundStartedMessage,
  SettingsUpdatedMessage,
  PlaylistUpdatedMessage,
  GameStartedMessage,
  AnswerResultMessage,
  LeaderboardUpdateMessage,
} from "../../../shared/types";
import { RoomAction, RoomState } from "../../../shared/types/room";

// Adjust timer-related fields in messages based on the offset between server and client time
function adjustMessageTimes(message: OutgoingMessage, offset: number): OutgoingMessage {
  switch (message.type) {
    case "unified_room_state": {
      const msg = message as UnifiedRoomStateMessage;
      const adjustedState: UnifiedRoomState = {
        ...msg.state,
        game: {
          ...msg.state.game,
          roundEndTime: msg.state.game.roundEndTime - offset,
          voteEndsAt: msg.state.game.voteEndsAt ? msg.state.game.voteEndsAt - offset : null,
        },
      };
      return { ...msg, state: adjustedState };
    }
    case "round_started": {
      const msg = message as RoundStartedMessage;
      return {
        ...msg,
        startTime: msg.startTime - offset,
        endTime: msg.endTime - offset,
      };
    }
    case "round_ended": {
      const msg = message as RoundEndedMessage;
      return {
        ...msg,
        voteEndsAt: msg.voteEndsAt ? msg.voteEndsAt - offset : undefined,
        nextRoundAt: msg.nextRoundAt ? msg.nextRoundAt - offset : undefined,
      };
    }
    case "vote_update": {
      const msg = message as VoteUpdateMessage;
      return {
        ...msg,
        voteEndsAt: msg.voteEndsAt - offset,
      };
    }
    default:
      return message;
  }
}

interface UseRoomActionsParams {
  state: RoomState;
  dispatch: React.Dispatch<RoomAction>;
}

export function useRoomActions({ state, dispatch }: UseRoomActionsParams) {
  const navigate = useNavigate();
  const { roomName } = useParams<{ roomName: string }>();
  const effectiveRoomName = roomName || "general";
  const { user, isAuthenticated, isLoading } = useAuth();

  const fetchedPlaylistsRef = useRef(false);

  // Initialize auth state
  useEffect(() => {
    if (isLoading) return;

    if (isAuthenticated && user) {
      dispatch({
        type: "SET_USER",
        user: { username: user.name?.trim() || "", userId: user.id || "" },
      });
      dispatch({ type: "SET_SHOW_USERNAME_PROMPT", show: false });
    } else {
      const storedUsername = sessionStorage.getItem("chat-username");
      const storedUserId = sessionStorage.getItem("chat-userId");
      if (storedUsername) {
        const userId = storedUserId || `guest-${Math.random().toString(36).substr(2, 9)}`;
        if (!storedUserId) sessionStorage.setItem("chat-userId", userId);
        dispatch({ type: "SET_USER", user: { username: storedUsername, userId } });
        dispatch({ type: "SET_SHOW_USERNAME_PROMPT", show: false });
      }
    }
  }, [isLoading, isAuthenticated, user, dispatch]);

  const onMessage = useCallback(
    (serverMessage: OutgoingMessage) => {
      const currentUserId = state.ui.currentUser?.userId || "";

      // Compute offset between server time and client time at message receipt
      const serverTimestamp = serverMessage.timestamp;
      const clientNow = Date.now();
      const offset = serverTimestamp - clientNow;

      // Adjust timer values in the message to compensate for clock differences
      const message = adjustMessageTimes(serverMessage, offset);

      const handleUserUpdate = (msg: OutgoingMessage) => {
        dispatch({
          type: "UPDATE_PLAYERS",
          users: (msg as UserJoinedMessage | UserLeftMessage | UsersUpdatedMessage).users || [],
          currentUserId,
        });
        if (msg.type === "user_joined" || msg.type === "user_left") {
          dispatch({ type: "CHAT_MESSAGE", message: msg as unknown as ChatBoxMessage });
        }
      };

      const handlers: Record<string, (msg: OutgoingMessage) => void> = {
        unified_room_state(msg) {
          dispatch({
            type: "SYNC_UNIFIED_STATE",
            state: (msg as UnifiedRoomStateMessage).state,
            currentUserId,
          });
        },
        user_joined: handleUserUpdate,
        user_left: handleUserUpdate,
        users_updated: handleUserUpdate,
        settings_updated(msg) {
          const m = msg as SettingsUpdatedMessage;
          if (m.settings) dispatch({ type: "SETTINGS_UPDATED", settings: m.settings });
        },
        playlist_updated(msg) {
          const m = msg as PlaylistUpdatedMessage;
          if (m.playlist) dispatch({ type: "PLAYLIST_UPDATED", playlist: m.playlist });
        },
        game_started(msg) {
          const m = msg as GameStartedMessage;
          dispatch({
            type: "GAME_STARTED",
            totalRounds: m.totalRounds,
            timePerRound: m.timePerRound,
            audioTime: m.audioTime,
          });
        },
        round_started(msg) {
          const m = msg as RoundStartedMessage;
          dispatch({
            type: "ROUND_STARTED",
            round: m.round,
            totalRounds: m.totalRounds,
            song: { previewUrl: m.song.previewUrl, albumImageUrl: m.song.albumImageUrl },
            choices: m.choices,
            startTime: m.startTime,
            endTime: m.endTime,
            duration: m.duration,
          });
        },
        round_ended(msg) {
          const m = msg as RoundEndedMessage;
          dispatch({
            type: "ROUND_ENDED",
            round: m.round,
            correctAnswer: m.correctAnswer,
            scores: m.scores,
            nextRoundAt: m.nextRoundAt,
            isFinal: m.isFinal,
            voteEndsAt: m.voteEndsAt,
          });
        },
        vote_update(msg) {
          const m = msg as VoteUpdateMessage;
          dispatch({ type: "VOTE_UPDATE", votes: m.votes, voteEndsAt: m.voteEndsAt });
        },
        answer_result(msg) {
          const m = msg as AnswerResultMessage;
          dispatch({
            type: "ANSWER_RESULT",
            isCorrect: m.isCorrect,
            points: m.points,
            streak: m.streak,
          });
        },
        leaderboard_update(msg) {
          dispatch({
            type: "LEADERBOARD_UPDATE",
            leaderboard: (msg as LeaderboardUpdateMessage).leaderboard,
          });
        },
        message(msg) {
          dispatch({ type: "CHAT_MESSAGE", message: msg as ChatMessage });
        },
        error(msg) {
          dispatch({ type: "CHAT_MESSAGE", message: msg as ErrorMessage });
          console.error("Server error:", (msg as ErrorMessage).content);
        },
      };

      handlers[message.type]?.(message);
    },
    [state.ui.currentUser?.userId, dispatch],
  );

  const { isConnected, send } = useGameSocket({
    username: state.ui.currentUser?.username || "",
    room: effectiveRoomName,
    userId: state.ui.currentUser?.userId || "",
    userImage: user?.image || undefined,
    onMessage,
  });

  useEffect(() => {
    dispatch({ type: "SET_CONNECTED", connected: isConnected });
  }, [isConnected, dispatch]);

  const { startImport, state: importState } = useLibraryImport();

  useEffect(() => {
    dispatch({
      type: "SET_LIBRARY_IMPORTING",
      importing: importState === "connecting" || importState === "streaming",
    });
  }, [importState, dispatch]);

  const handleJoinRoom = useCallback(
    (username: string) => {
      sessionStorage.setItem("chat-username", username);
      let userId = sessionStorage.getItem("chat-userId");
      if (!userId) {
        userId = `guest-${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem("chat-userId", userId);
      }
      dispatch({ type: "SET_USER", user: { username, userId } });
      dispatch({ type: "SET_SHOW_USERNAME_PROMPT", show: false });

      if (roomName !== username) {
        navigate(`/room/${encodeURIComponent(roomName || "general")}`);
      }
    },
    [navigate, roomName, dispatch],
  );

  const handleLeaveRoom = useCallback(() => {
    sessionStorage.removeItem("chat-username");
    dispatch({ type: "SET_USER", user: null });
    navigate("/");
  }, [navigate, dispatch]);

  const handleToggleReady = useCallback(() => {
    dispatch({ type: "TOGGLE_READY" });
    send({ type: "ready" });
  }, [dispatch, send]);

  const handleStartGame = useCallback(() => {
    send({ type: "start_game" });
  }, [send]);

  const handleSettingsUpdate = useCallback(
    (settings: { rounds: number; timePerRound: number; audioTime: number }) => {
      send({
        type: "update_settings",
        payload: {
          rounds: settings.rounds,
          timePerRound: settings.timePerRound * 1000,
          audioTime: settings.audioTime * 1000,
        },
      });
    },
    [send],
  );

  const handleSelectPlaylist = useCallback(
    async (playlist: Playlist) => {
      // Check if playlist is already in user's library
      dispatch({ type: "SET_PLAYLISTS_LOADING", loading: true });
      try {
        const res = await fetch(`/api/library/playlist/${playlist.id}`);
        const data = await res.json();
        if (data.inLibrary) {
          // Already in library — proceed normally
          dispatch({ type: "PLAYLIST_UPDATED", playlist });
          send({ type: "update_playlist", payload: { playlist } });
          dispatch({ type: "SET_SHOW_PLAYLIST_MODAL", show: false });
          dispatch({ type: "SET_PLAYLISTS_LOADING", loading: false });
          return;
        }
        // Not in library — ask user
        dispatch({ type: "SET_SHOW_PLAYLIST_MODAL", show: false });
        dispatch({ type: "SET_PENDING_LIBRARY_IMPORT", playlist });
      } catch {
        // On error, just proceed normally
        dispatch({ type: "PLAYLIST_UPDATED", playlist });
        send({ type: "update_playlist", payload: { playlist } });
        dispatch({ type: "SET_SHOW_PLAYLIST_MODAL", show: false });
      }
      dispatch({ type: "SET_PLAYLISTS_LOADING", loading: false });
    },
    [dispatch, send],
  );

  const handleConfirmLibraryImport = useCallback(() => {
    const pending = state.ui.pendingLibraryImport;
    if (!pending?.playlist) return;

    const playlist = pending.playlist;
    dispatch({ type: "PLAYLIST_UPDATED", playlist });
    send({ type: "update_playlist", payload: { playlist } });
    dispatch({ type: "SET_PENDING_LIBRARY_IMPORT", playlist: null });

    const link = `https://open.spotify.com/playlist/${playlist.id}`;
    startImport(link);
  }, [state.ui.pendingLibraryImport, dispatch, send, startImport]);

  const handleSkipLibraryImport = useCallback(() => {
    const playlist = state.ui.pendingLibraryImport?.playlist;
    if (!playlist) return;
    dispatch({ type: "PLAYLIST_UPDATED", playlist });
    send({ type: "update_playlist", payload: { playlist } });
    dispatch({ type: "SET_PENDING_LIBRARY_IMPORT", playlist: null });
  }, [state.ui.pendingLibraryImport, dispatch, send]);

  const handleAnswer = useCallback(
    (choiceIndex: number) => {
      if (state.game.hasAnswered) return;
      dispatch({ type: "LOCAL_ANSWER", choiceIndex });
      send({
        type: "answer",
        choiceIndex,
      } as AnswerMessage);
    },
    [state.game.hasAnswered, dispatch, send],
  );

  const handleSendMessage = useCallback(
    (content: string) => {
      send({
        type: "message",
        content,
      } as ChatMessage);
    },
    [send],
  );

  const handleVote = useCallback(
    (vote: boolean) => {
      send({
        type: "vote_play_again",
        vote,
      });
    },
    [send],
  );

  const handleOpenPlaylistModal = useCallback(() => {
    if (state.ui.availablePlaylists.length === 0 && !fetchedPlaylistsRef.current) {
      fetchedPlaylistsRef.current = true;
      dispatch({ type: "SET_PLAYLISTS_LOADING", loading: true });
      fetch("/api/library/items")
        .then((res) => res.json())
        .then((data) => {
          const playlists: Playlist[] = (data.items ?? [])
            .filter((item: { type: string }) => item.type === "playlist")
            .map(
              (item: {
                id: string;
                spotifyId?: string;
                name: string;
                trackCount: number;
                imageUrl?: string;
              }) => ({
                id: item.spotifyId ?? item.id,
                name: item.name,
                trackCount: item.trackCount,
                imageUrl: item.imageUrl,
              }),
            );
          dispatch({ type: "SET_AVAILABLE_PLAYLISTS", playlists });
          dispatch({ type: "SET_PLAYLISTS_LOADING", loading: false });
        })
        .catch((err) => {
          console.error("Failed to fetch library items:", err);
          dispatch({ type: "SET_PLAYLISTS_LOADING", loading: false });
        });
    }
    dispatch({ type: "SET_SHOW_PLAYLIST_MODAL", show: true });
  }, [state.ui.availablePlaylists.length, dispatch]);

  const handleSpotifyLinkSubmit = useCallback(async () => {
    if (!state.ui.spotifyLink.trim()) return;

    try {
      const response = await fetch("/api/playlists/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link: state.ui.spotifyLink }),
      });

      const data = await response.json();
      if (response.ok && data.playlist) {
        handleSelectPlaylist(data.playlist);
      }
    } catch (error) {
      console.error("Error importing playlist:", error);
    }

    dispatch({ type: "SET_SPOTIFY_LINK", link: "" });
    dispatch({ type: "SET_SHOW_PLAYLIST_MODAL", show: false });
  }, [state.ui.spotifyLink, handleSelectPlaylist, dispatch]);

  const handleCreateBlend = useCallback(() => {
    const blendPlaylist: Playlist = {
      id: "blend",
      name: "Room Blend",
      trackCount: 0,
    };
    send({ type: "update_playlist", payload: { playlist: blendPlaylist } });
    dispatch({ type: "PLAYLIST_UPDATED", playlist: blendPlaylist });
    dispatch({ type: "SET_SHOW_PLAYLIST_MODAL", show: false });
  }, [dispatch, send]);

  return {
    handleJoinRoom,
    handleLeaveRoom,
    handleToggleReady,
    handleStartGame,
    handleSelectPlaylist,
    handleSpotifyLinkSubmit,
    handleCreateBlend,
    handleSettingsUpdate,
    handleAnswer,
    handleVote,
    handleSendMessage,
    handleOpenPlaylistModal,
    handleConfirmLibraryImport,
    handleSkipLibraryImport,
    setShowSettingsModal: (show: boolean) => dispatch({ type: "SET_SHOW_SETTINGS_MODAL", show }),
    setShowPlaylistModal: (show: boolean) => dispatch({ type: "SET_SHOW_PLAYLIST_MODAL", show }),
    setSpotifyLink: (link: string) => dispatch({ type: "SET_SPOTIFY_LINK", link }),
    resetToLobby: () => dispatch({ type: "RESET_TO_LOBBY" }),
  };
}

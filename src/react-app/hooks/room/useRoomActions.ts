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
        const userId = storedUserId || `user-${Math.random().toString(36).substr(2, 9)}`;
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

      // Dispatch the (possibly adjusted) message
      switch (message.type) {
        case "unified_room_state":
          dispatch({
            type: "SYNC_UNIFIED_STATE",
            state: (message as UnifiedRoomStateMessage).state,
            currentUserId,
          });
          break;

        case "user_joined":
        case "user_left":
        case "users_updated":
          dispatch({
            type: "UPDATE_PLAYERS",
            users:
              (message as UserJoinedMessage | UserLeftMessage | UsersUpdatedMessage).users || [],
            currentUserId,
          });
          if (message.type === "user_joined" || message.type === "user_left") {
            dispatch({ type: "CHAT_MESSAGE", message: message as unknown as ChatBoxMessage });
          }
          break;

        case "settings_updated":
          if (message.settings) dispatch({ type: "SETTINGS_UPDATED", settings: message.settings });
          break;

        case "playlist_updated":
          if (message.playlist) dispatch({ type: "PLAYLIST_UPDATED", playlist: message.playlist });
          break;

        case "game_started":
          dispatch({
            type: "GAME_STARTED",
            totalRounds: message.totalRounds,
            timePerRound: message.timePerRound,
            audioTime: message.audioTime,
          });
          break;

        case "round_started":
          dispatch({
            type: "ROUND_STARTED",
            round: message.round,
            totalRounds: message.totalRounds,
            song: {
              previewUrl: message.song.previewUrl,
              albumImageUrl: message.song.albumImageUrl,
            },
            choices: message.choices,
            startTime: message.startTime,
            endTime: message.endTime,
            duration: message.duration,
          });
          break;

        case "round_ended":
          dispatch({
            type: "ROUND_ENDED",
            round: message.round,
            correctAnswer: message.correctAnswer,
            scores: message.scores,
            nextRoundAt: message.nextRoundAt,
            isFinal: message.isFinal,
            voteEndsAt: message.voteEndsAt,
          });
          break;

        case "vote_update":
          dispatch({
            type: "VOTE_UPDATE",
            votes: (message as VoteUpdateMessage).votes,
            voteEndsAt: (message as VoteUpdateMessage).voteEndsAt,
          });
          break;

        case "answer_result":
          dispatch({
            type: "ANSWER_RESULT",
            isCorrect: message.isCorrect,
            points: message.points,
            streak: message.streak,
          });
          break;

        case "leaderboard_update":
          dispatch({ type: "LEADERBOARD_UPDATE", leaderboard: message.leaderboard });
          break;

        case "message":
          dispatch({ type: "CHAT_MESSAGE", message: message as ChatMessage });
          break;

        case "error":
          dispatch({ type: "CHAT_MESSAGE", message: message as ErrorMessage });
          console.error("Server error:", message.content);
          break;
      }
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
        userId = `user-${Math.random().toString(36).substr(2, 9)}`;
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
      fetch("/api/playlists")
        .then((res) => res.json())
        .then((data) => {
          if (data.playlists)
            dispatch({ type: "SET_AVAILABLE_PLAYLISTS", playlists: data.playlists });
          dispatch({ type: "SET_PLAYLISTS_LOADING", loading: false });
        })
        .catch(() => dispatch({ type: "SET_PLAYLISTS_LOADING", loading: false }));
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

  const handleCreateBlend = () => console.log("Creating blend...");

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

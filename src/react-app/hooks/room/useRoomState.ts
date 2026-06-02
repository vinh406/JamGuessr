import { useReducer, useMemo } from "react";
import { useParams } from "react-router";
import { RoomState } from "../../../shared/types/room";
import { DEFAULT_ROOM_SETTINGS } from "../../../shared/constants";
import { useRoomActions } from "./useRoomActions";
import { DEFAULT_GAME_STATE, roomReducer } from "./useRoomReducer";

const initialState: RoomState = {
  metadata: {
    roomName: "",
    players: [],
    selectedPlaylist: null,
    gameSettings: {
      rounds: DEFAULT_ROOM_SETTINGS.rounds,
      timePerRound: DEFAULT_ROOM_SETTINGS.timePerRound / 1000,
      audioTime: DEFAULT_ROOM_SETTINGS.audioTime / 1000,
    },
    isHost: false,
    isReady: false,
  },
  game: DEFAULT_GAME_STATE,
  ui: {
    currentUser: null,
    showUsernamePrompt: true,
    showSettingsModal: false,
    showPlaylistModal: false,
    spotifyLink: "",
    availablePlaylists: [],
    playlistsLoading: true,
    pendingLibraryImport: null,
    libraryImporting: false,
    isStartingGame: false,
    chatMessages: [],
    isConnected: false,
  },
};

export function useRoomState() {
  const { roomName } = useParams<{ roomName: string }>();
  const effectiveRoomName = roomName || "general";

  const [state, dispatch] = useReducer(roomReducer, {
    ...initialState,
    metadata: { ...initialState.metadata, roomName: effectiveRoomName },
  });

  const actions = useRoomActions({ state, dispatch });

  const { allNonHostPlayersReady, currentWarning } = useMemo(() => {
    const nonHostPlayers = state.metadata.players.filter((p) => !p.isHost);
    const hasNonHostPlayers = nonHostPlayers.length > 0;
    const allReady = !hasNonHostPlayers || nonHostPlayers.every((p) => p.isReady);

    let warning: string | null = null;
    if (!state.metadata.selectedPlaylist) {
      warning = "Please select a playlist to start";
    } else if (!allReady) {
      warning = "Waiting for all players to be ready";
    }

    return { allNonHostPlayersReady: allReady, currentWarning: warning };
  }, [state.metadata.players, state.metadata.selectedPlaylist]);

  const canStartGame =
    state.metadata.isHost &&
    state.metadata.players.length >= 1 &&
    state.metadata.selectedPlaylist &&
    allNonHostPlayersReady;

  return {
    state: {
      ...state,
      canStartGame,
      currentWarning,
    },
    actions,
  };
}

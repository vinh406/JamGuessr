import { useState, useEffect, useRef } from "react";
import { useParams, useBlocker } from "react-router";
import { useRoomState } from "../hooks/room/useRoomState";
import { ChatBox } from "../components/room/ChatBox";
import { RoomLobby } from "../components/room/RoomLobby";
import { SettingsModal } from "../components/room/SettingsModal";
import { PlaylistModal } from "../components/room/PlaylistModal";
import { UsernamePrompt } from "../components/room/UsernamePrompt";
import { GameView } from "../components/game/GameView";
import { RoundEndView } from "../components/game/RoundEndView";
import { useAuth } from "../hooks/useAuth";
import LoadingSpinner from "../components/common/LoadingSpinner";
import FullScreenLoader from "../components/common/FullScreenLoader";
import ConfirmDialog from "../components/common/ConfirmDialog";
import { Button } from "../components/ui";
import { ChatBubble } from "../components/ui/icons";
import Header from "../components/Header";

export default function RoomPage() {
  const { isLoading: authLoading } = useAuth();
  const { roomName } = useParams<{ roomName: string }>();
  const effectiveRoomName = roomName || "general";
  const [chatOpen, setChatOpen] = useState(true);

  const { state, actions } = useRoomState();

  const {
    currentUser,
    showUsernamePrompt,
    showSettingsModal,
    showPlaylistModal,
    spotifyLink,
    isStartingGame,
    availablePlaylists,
    playlistsLoading,
    isConnected,
    chatMessages,
  } = state.ui;

  const { players, selectedPlaylist, isReady, gameSettings, isHost } = state.metadata;

  const {
    gamePhase,
    currentRound,
    totalRounds,
    currentSong,
    choices,
    roundEndTime,
    roundDuration,
    myScore,
    myStreak,
    hasAnswered,
    selectedChoice,
    lastAnswerCorrect,
    lastAnswerPoints,
    endStateData,
    votes,
    voteEndsAt,
  } = state.game;

  const { canStartGame, currentWarning } = state;

  const {
    handleJoinRoom,
    handleLeaveRoom,
    handleConfirmLeave,
    handleToggleReady,
    handleStartGame,
    handleSelectPlaylist,
    handleSpotifyLinkSubmit,
    handleCreateBlend,
    handleSettingsUpdate,
    handleAnswer,
    handleVote,
    handleSendMessage,
    setShowSettingsModal,
    setShowPlaylistModal,
    handleOpenPlaylistModal,
    setSpotifyLink,
    handleConfirmLibraryImport,
    handleSkipLibraryImport,
  } = actions;

  const { pendingLibraryImport, libraryImporting, playlistImportError } = state.ui;

  const isGameActive = gamePhase === "playing" || gamePhase === "roundEnd";
  const shouldConfirmLeave = gamePhase !== "lobby" || players.length > 1;

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      currentLocation.pathname !== nextLocation.pathname && shouldConfirmLeave,
  );

  const blockedRef = useRef(false);

  useEffect(() => {
    if (blocker.state !== "blocked" || blockedRef.current) return;
    blockedRef.current = true;

    const confirmed = window.confirm("Are you sure you want to leave?");

    blockedRef.current = false;

    if (confirmed) {
      handleConfirmLeave();
      blocker.proceed();
    } else {
      blocker.reset();
    }
  }, [blocker, blocker.state, handleConfirmLeave]);

  useEffect(() => {
    if (!shouldConfirmLeave) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [shouldConfirmLeave]);

  if (authLoading) {
    return <FullScreenLoader showIcon={false} spinnerSize="xl" className="h-screen p-4" />;
  }

  if (showUsernamePrompt || !currentUser) {
    return (
      <UsernamePrompt
        roomName={effectiveRoomName}
        onSubmit={handleJoinRoom}
        onBack={() => window.history.back()}
      />
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <Header>
        <Button
          size="sm"
          onClick={() => setChatOpen(!chatOpen)}
          className={`relative ${
            chatOpen
              ? "bg-green-500/20 border-green-500/30 text-green-400"
              : "bg-gray-800/50 border-gray-700/50 text-gray-400 hover:text-white hover:bg-gray-700/50"
          }`}
          aria-label={chatOpen ? "Close chat" : "Open chat"}
        >
          <ChatBubble className="w-5 h-5" />
          {!chatOpen && (
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          )}
        </Button>

        <Button variant="secondary" size="sm" onClick={handleLeaveRoom}>
          Leave
        </Button>
      </Header>

      {/* Main Content */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative">
        {/* Game/Lobby Area */}
        <main className="flex-1 min-w-0 overflow-hidden">
          {isGameActive ? (
            <div className="h-full">
              {gamePhase === "playing" && currentSong ? (
                <GameView
                  round={currentRound}
                  totalRounds={totalRounds}
                  song={currentSong}
                  choices={choices}
                  endTime={roundEndTime}
                  duration={roundDuration}
                  audioTime={gameSettings.audioTime * 1000}
                  hasAnswered={hasAnswered}
                  selectedChoice={selectedChoice}
                  lastAnswerCorrect={lastAnswerCorrect}
                  lastAnswerPoints={lastAnswerPoints}
                  myScore={myScore}
                  myStreak={myStreak}
                  onAnswer={handleAnswer}
                />
              ) : gamePhase === "roundEnd" && endStateData ? (
                <RoundEndView
                  round={currentRound}
                  totalRounds={totalRounds}
                  correctAnswer={endStateData.correctAnswer!}
                  scores={endStateData.scores}
                  myUserId={currentUser.userId}
                  onPlayAgain={handleVote}
                  votes={votes}
                  voteEndsAt={voteEndsAt}
                  nextRoundAt={endStateData.nextRoundAt}
                />
              ) : isStartingGame ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <LoadingSpinner size="xl" className="text-green-500 mx-auto" />
                    <p className="mt-4 text-gray-400">Game starting...</p>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="h-full overflow-y-auto p-3 sm:p-4 lg:p-6">
              <div className="max-w-3xl mx-auto">
                <RoomLobby
                  roomName={effectiveRoomName}
                  players={players}
                  selectedPlaylist={selectedPlaylist}
                  gameSettings={gameSettings}
                  isHost={isHost ?? false}
                  isReady={isReady}
                  canStartGame={canStartGame ?? false}
                  isStartingGame={isStartingGame}
                  currentWarning={currentWarning}
                  currentUser={currentUser}
                  onToggleReady={handleToggleReady}
                  onStartGame={handleStartGame}
                  onOpenSettings={() => setShowSettingsModal(true)}
                  onOpenPlaylist={handleOpenPlaylistModal}
                  isImporting={libraryImporting}
                />
              </div>
            </div>
          )}
        </main>

        {/* Chat Sidebar */}
        <aside
          className={`shrink-0 border-l border-gray-700/50 bg-gray-900/50 backdrop-blur-xl transition-all duration-300 ease-in-out overflow-hidden ${
            chatOpen
              ? "absolute inset-y-0 right-0 w-72 z-20 lg:relative sm:w-80 translate-x-0"
              : "absolute inset-y-0 right-0 w-72 z-20 lg:w-0 translate-x-full lg:translate-x-0"
          }`}
        >
          <div className="w-72 sm:w-80 h-full">
            <ChatBox
              messages={chatMessages}
              onSendMessage={handleSendMessage}
              userId={currentUser.userId}
              isConnected={isConnected}
              usersCount={players.length}
            />
          </div>
        </aside>
      </div>

      {/* Modals */}
      {showSettingsModal && (
        <SettingsModal
          rounds={gameSettings.rounds}
          timePerRound={gameSettings.timePerRound}
          audioTime={gameSettings.audioTime}
          isHost={isHost ?? false}
          onSave={(settings) => {
            handleSettingsUpdate(settings);
            setShowSettingsModal(false);
          }}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {showPlaylistModal && (
        <PlaylistModal
          selectedPlaylist={selectedPlaylist}
          availablePlaylists={availablePlaylists}
          isLoading={playlistsLoading}
          error={playlistImportError}
          spotifyLink={spotifyLink}
          isImporting={libraryImporting}
          onSpotifyLinkChange={setSpotifyLink}
          onSelectPlaylist={handleSelectPlaylist}
          onSubmitSpotifyLink={handleSpotifyLinkSubmit}
          onCreateBlend={handleCreateBlend}
          onClose={() => setShowPlaylistModal(false)}
        />
      )}

      {pendingLibraryImport && !libraryImporting && (
        <ConfirmDialog
          title="Add to Library?"
          message={`This playlist isn't in your music library yet. Do you want to add it? If you skip, only the first ~50 tracks will be used.`}
          confirmLabel="Add to Library"
          cancelLabel="Skip"
          onConfirm={handleConfirmLibraryImport}
          onCancel={handleSkipLibraryImport}
        />
      )}
    </div>
  );
}

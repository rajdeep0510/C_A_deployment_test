import { useState, useEffect, useCallback } from 'react';
import { Chess, Move } from 'chess.js';

export type GameMode = 'survival' | 'blitz' | 'ladder';

export type PuzzleData = {
  puzzle_id: string;
  fen: string;
  moves: string; // space separated UCI moves
  rating: number;
};

export function usePuzzleGameMode(mode: GameMode, initialElo: number) {
  const [puzzles, setPuzzles] = useState<PuzzleData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const [game, setGame] = useState(new Chess());
  const [isPlayerTurn, setIsPlayerTurn] = useState(false);
  const [puzzleMoves, setPuzzleMoves] = useState<string[]>([]);
  const [moveIndex, setMoveIndex] = useState(0);

  const [lives, setLives] = useState(3);
  const [streak, setStreak] = useState(0);
  const [levelsCleared, setLevelsCleared] = useState(0);

  const [score, setScore] = useState(0);
  const [highestRating, setHighestRating] = useState(initialElo);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [blitzTimeLimit, setBlitzTimeLimit] = useState(30);
  const [isGameOver, setIsGameOver] = useState(false);

  useEffect(() => {
    if (isGameOver || timeLeft === null || timeLeft <= 0) return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev !== null && prev <= 1) {
          setIsGameOver(true);
          return 0;
        }
        return prev !== null ? prev - 1 : null;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [timeLeft, isGameOver]);

  const loadPuzzle = useCallback((puzzle: PuzzleData) => {
    const newGame = new Chess(puzzle.fen);
    const moves = puzzle.moves.split(' ');
    
    if (moves.length > 0) {
      newGame.move({
        from: moves[0].substring(0, 2),
        to: moves[0].substring(2, 4),
        promotion: moves[0].length > 4 ? moves[0][4] : undefined
      });
    }
    
    setGame(newGame);
    setPuzzleMoves(moves);
    setMoveIndex(1);
    setIsPlayerTurn(true);

    if (mode === 'blitz') {
      setTimeLeft(blitzTimeLimit);
    }
  }, [mode, blitzTimeLimit]);

  const handleSuccess = useCallback(() => {
    setScore(s => s + 1);
    
    if (mode === 'survival') {
      const newStreak = streak + 1;
      if (newStreak === 3) {
        setLevelsCleared(l => l + 1);
        setStreak(0);
      } else {
        setStreak(newStreak);
      }
    } else if (mode === 'ladder') {
      const currentRating = puzzles[currentIndex].rating;
      if (currentRating > highestRating) setHighestRating(currentRating);
    }
    
    setTimeout(() => {
      const nextIndex = currentIndex + 1;
      if (nextIndex >= puzzles.length) {
        setIsGameOver(true);
      } else {
        setCurrentIndex(nextIndex);
        loadPuzzle(puzzles[nextIndex]);
      }
    }, 1000);
  }, [mode, streak, puzzles, currentIndex, highestRating, loadPuzzle]);

  const handleFailure = useCallback(() => {
    if (mode === 'survival') {
      const newLives = lives - 1;
      setLives(newLives);
      setStreak(0);
      if (newLives <= 0) {
        setIsGameOver(true);
      } else {
        setTimeout(() => {
          const nextIndex = currentIndex + 1;
          if (nextIndex < puzzles.length) {
             setCurrentIndex(nextIndex);
             loadPuzzle(puzzles[nextIndex]);
          } else {
             setIsGameOver(true);
          }
        }, 1000);
      }
    } else {
      setIsGameOver(true);
    }
  }, [mode, lives, currentIndex, puzzles, loadPuzzle]);

  const makeMove = useCallback((sourceSquare: string, targetSquare: string, promotion?: string) => {
    if (isGameOver || !isPlayerTurn) return false;

    let legalMove: Move | null = null;
    try {
       const testGame = new Chess(game.fen());
       legalMove = testGame.move({ from: sourceSquare, to: targetSquare, promotion: promotion || 'q' });
    } catch {
       return false;
    }
    if (!legalMove) return false;

    const attemptUci = legalMove.from + legalMove.to + (legalMove.promotion || '');
    const correctUci = puzzleMoves[moveIndex];

    if (attemptUci === correctUci) {
      const newGame = new Chess(game.fen());
      newGame.move(legalMove);
      setGame(newGame);

      const nextIndex = moveIndex + 1;
      if (nextIndex >= puzzleMoves.length) {
        setIsPlayerTurn(false);
        handleSuccess();
      } else {
        setIsPlayerTurn(false);
        setMoveIndex(nextIndex);
        
        setTimeout(() => {
           const oppUci = puzzleMoves[nextIndex];
           const oppGame = new Chess(newGame.fen());
           oppGame.move({
             from: oppUci.substring(0, 2),
             to: oppUci.substring(2, 4),
             promotion: oppUci.length > 4 ? oppUci[4] : undefined
           });
           setGame(oppGame);
           
           const nextNextIndex = nextIndex + 1;
           if (nextNextIndex >= puzzleMoves.length) {
              handleSuccess(); 
           } else {
              setMoveIndex(nextNextIndex);
              setIsPlayerTurn(true);
           }
        }, 500);
      }
      return true;
    } else {
      handleFailure();
      return false;
    }
  }, [game, isGameOver, isPlayerTurn, puzzleMoves, moveIndex, handleSuccess, handleFailure]);

  const startGame = useCallback((loadedPuzzles: PuzzleData[], timeLimitOverride?: number) => {
    setPuzzles(loadedPuzzles);
    setCurrentIndex(0);
    setScore(0);
    setIsGameOver(false);

    if (mode === 'survival') {
      setLives(3);
      setStreak(0);
      setLevelsCleared(0);
      setTimeLeft(null);
    } else if (mode === 'blitz') {
      if (timeLimitOverride) setBlitzTimeLimit(timeLimitOverride);
      setTimeLeft(timeLimitOverride || blitzTimeLimit);
    } else if (mode === 'ladder') {
      setHighestRating(initialElo);
      setTimeLeft(300); // 5 minutes global timer
    }

    if (loadedPuzzles.length > 0) {
      loadPuzzle(loadedPuzzles[0]);
    }
  }, [mode, initialElo, blitzTimeLimit, loadPuzzle]);

  return { fen: game.fen(), isPlayerTurn, makeMove, startGame, isGameOver, timeLeft, score, lives, streak, levelsCleared, highestRating };
}

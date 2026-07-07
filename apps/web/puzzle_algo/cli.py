import csv
import random
import time
import sys

try:
    import chess
except ImportError:
    print("Please install the 'chess' library by running: pip install chess")
    sys.exit(1)

# Path to the dataset inside the workspace
CSV_PATH = "lichess_db_puzzle.csv/lichess_db_puzzle.csv"

def load_puzzles(elo, mode="survival"):
    min_rating = elo - 200
    max_rating = elo + 200
    if mode == "ladder":
        min_rating = elo - 200
        max_rating = elo + 1000

    puzzles = []
    print(f"Loading puzzles from database... (this may take a moment)")
    try:
        with open(CSV_PATH, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    rating = int(row["Rating"])
                except ValueError:
                    continue
                
                if min_rating <= rating <= max_rating:
                    puzzles.append(row)
                    # We limit the number of puzzles loaded into memory.
                    # Ladder mode needs a wider pool to progressively increase difficulty.
                    limit = 3000 if mode == "ladder" else 1000
                    if len(puzzles) >= limit:
                        break
    except FileNotFoundError:
        print(f"Error: Could not find {CSV_PATH}")
        print("Please ensure the CSV is extracted and placed at 'lichess_db_puzzle.csv/lichess_db_puzzle.csv'")
        sys.exit(1)

    return puzzles

def play_puzzle(puzzle, is_global_timer=False, time_limit=None, start_time=None):
    """
    Handles a single puzzle interaction.
    If is_global_timer=True, time_limit acts as the max total duration.
    If is_global_timer=False, time_limit acts as the per-puzzle duration.
    """
    board = chess.Board(puzzle["FEN"])
    moves = puzzle["Moves"].split()
    
    # The first move in Lichess puzzle dataset is the opponent's move
    # that creates the puzzle position
    opponent_move = chess.Move.from_uci(moves[0])
    board.push(opponent_move)
    
    print("\n" + "="*40)
    print(f"Puzzle ID: {puzzle['PuzzleId']} | Rating: {puzzle['Rating']}")
    
    user_turn = True
    # Start iterating from the second move (the player's first move to solve the puzzle)
    for i in range(1, len(moves)):
        if user_turn:
            print("\n" + board.unicode(empty_square="."))
            
            correct_move = chess.Move.from_uci(moves[i])
            
            while True:
                # Timer Check BEFORE input
                if time_limit is not None and start_time is not None:
                    elapsed = time.time() - start_time
                    if elapsed >= time_limit:
                        print("\nTime's up!")
                        return False
                    print(f"Time remaining: {time_limit - elapsed:.1f}s")
                
                user_input = input("Enter your move (UCI, e.g., e2e4, or algebraic e4, 'q' to quit): ").strip()
                if user_input.lower() == 'q':
                    print("Quitting game...")
                    sys.exit(0)
                
                # Timer Check AFTER input
                if time_limit is not None and start_time is not None:
                    elapsed = time.time() - start_time
                    if elapsed >= time_limit:
                        print("\nTime's up!")
                        return False

                # Move Parsing
                try:
                    # Prefer standard algebraic notation (SAN) but allow UCI format
                    try:
                        move = board.parse_san(user_input)
                    except ValueError:
                        move = chess.Move.from_uci(user_input)
                except ValueError:
                    print("Invalid move format. Try again.")
                    continue
                
                if move not in board.legal_moves:
                    print("Illegal move. Try again.")
                    continue
                
                if move == correct_move:
                    print("Correct!")
                    board.push(move)
                    break
                else:
                    print(f"Incorrect move! The correct move was: {correct_move.uci()} / {board.san(correct_move)}")
                    return False
        else:
            # Opponent's reply (automatic)
            opponent_reply = chess.Move.from_uci(moves[i])
            print(f"\nOpponent plays: {board.san(opponent_reply)} ({opponent_reply.uci()})")
            board.push(opponent_reply)
            
        user_turn = not user_turn

    print("Puzzle solved!")
    return True

def survival_mode(elo):
    puzzles = load_puzzles(elo, mode="survival")
    random.shuffle(puzzles)
    
    lives = 3
    streak = 0
    levels_cleared = 0
    
    print("\n" + "*"*40)
    print("SURVIVAL MODE")
    print("You have 3 lives. 3 consecutive solves = 1 level cleared.")
    print("*"*40)
    
    for puzzle in puzzles:
        if lives <= 0:
            break
        print(f"\nLives: {'❤ '*lives} | Streak: {streak} | Levels Cleared: {levels_cleared}")
        
        success = play_puzzle(puzzle)
        if success:
            streak += 1
            if streak == 3:
                print("Level Cleared! You advanced to the next level.")
                levels_cleared += 1
                streak = 0
        else:
            lives -= 1
            streak = 0
            print("You lost a life!")
            
    print(f"\nGAME OVER! Final Score (Levels Cleared): {levels_cleared}")

def blitz_mode(elo):
    while True:
        time_limit_str = input("Choose blitz time limit per puzzle (10, 30, or 60 seconds): ")
        if time_limit_str in ["10", "30", "60"]:
            time_limit = int(time_limit_str)
            break
        print("Invalid choice.")
        
    puzzles = load_puzzles(elo, mode="blitz")
    random.shuffle(puzzles)
    
    score = 0
    
    print("\n" + "*"*40)
    print("BLITZ MODE")
    print(f"You have {time_limit} seconds per puzzle. Time resets each puzzle.")
    print("*"*40)
    
    for puzzle in puzzles:
        puzzle_start_time = time.time()
        success = play_puzzle(puzzle, is_global_timer=False, time_limit=time_limit, start_time=puzzle_start_time)
        if success:
            score += 1
        else:
            print("Game over! You failed or ran out of time.")
            break
            
    print(f"\nGAME OVER! Final Score (Puzzles Solved): {score}")

def ladder_mode(elo):
    puzzles = load_puzzles(elo, mode="ladder")
    # Sort puzzles by increasing rating
    puzzles = sorted(puzzles, key=lambda x: int(x['Rating']))
    
    max_time = 300 # 5 minutes global timer
    
    print("\n" + "*"*40)
    print("LADDER MODE")
    print("You have 5 minutes TOTAL. Difficulty increases as you climb!")
    print("*"*40)
    
    start_time = time.time()
    highest_rating = 0
    
    for puzzle in puzzles:
        elapsed = time.time() - start_time
        if elapsed >= max_time:
            print("\nTotal Time's up!")
            break
            
        success = play_puzzle(puzzle, is_global_timer=True, time_limit=max_time, start_time=start_time)
        if success:
            highest_rating = max(highest_rating, int(puzzle['Rating']))
        else:
            print("Failed the puzzle! Ladder ends.")
            break
            
    print(f"\nGAME OVER! Highest Rating Reached: {highest_rating}")

def main():
    print("Welcome to Chess Puzzle CLI!")
    while True:
        try:
            elo = int(input("Enter your approximate ELO rating: "))
            break
        except ValueError:
            print("Please enter a valid number.")
            
    print("\nSelect Game Mode:")
    print("1. Survival (3 Lives, Level progression)")
    print("2. Blitz (Timed Rush per puzzle)")
    print("3. Ladder (Progressive Difficulty, 5 min global timer)")
    
    while True:
        choice = input("Enter choice (1/2/3): ").strip()
        if choice == '1':
            survival_mode(elo)
            break
        elif choice == '2':
            blitz_mode(elo)
            break
        elif choice == '3':
            ladder_mode(elo)
            break
        else:
            print("Invalid choice.")

if __name__ == "__main__":
    main()

import asyncio
from worker_config import settings

# One semaphore for the entire process. Limits concurrent Stockfish engines to
# MAX_CONCURRENT_ENGINES so a burst of requests cannot exhaust RAM or CPU.
# Acquired in router._run_with_engine(); never touched by analyzer internals.
engine_semaphore = asyncio.Semaphore(settings.MAX_CONCURRENT_ENGINES)

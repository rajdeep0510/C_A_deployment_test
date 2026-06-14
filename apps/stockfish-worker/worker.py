import time
import json
import logging
from supabase import create_client, Client
from worker_config import settings
from worker_core.game_analyzer import GameAnalyzer
from worker_core.batch_analyzer import BatchAnalyzer

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Supabase client
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)

def process_job(job):
    job_id = job['id']
    username = job['username']
    filename = job['filename']
    
    logger.info(f"Processing job {job_id} for {username} - {filename}")
    
    try:
        # Update status to processing
        supabase.table("analysis_jobs").update({"status": "processing"}).eq("id", job_id).execute()
        
        # In a real worker, we would:
        # 1. Fetch the PGN text from Supabase Storage or a 'games' table
        # 2. Run the actual analysis core
        
        # analyzer = GameAnalyzer()
        # result = analyzer.analyze_pgn(pgn_text, username)
        
        # Placeholder for demonstration
        time.sleep(5) 
        result = {
            "message": "Analysis completed successfully",
            "filename": filename,
            "summary": "Mock analysis result"
        }
        
        # Update status to completed and save result
        supabase.table("analysis_jobs").update({
            "status": "completed", 
            "result": result,
            "updated_at": "now()"
        }).eq("id", job_id).execute()
        
        logger.info(f"Job {job_id} completed")
    except Exception as e:
        logger.error(f"Job {job_id} failed: {e}")
        try:
            supabase.table("analysis_jobs").update({
                "status": "failed",
                "updated_at": "now()"
            }).eq("id", job_id).execute()
        except:
            pass

def main():
    logger.info("Stockfish worker started. Polling for jobs in 'analysis_jobs' table...")
    while True:
        try:
            # Poll for pending jobs
            # Note: This assumes an 'analysis_jobs' table exists in Supabase public schema
            res = supabase.table("analysis_jobs").select("*").eq("status", "pending").order("created_at").limit(1).execute()
            if res.data:
                process_job(res.data[0])
            else:
                # No jobs, wait before polling again
                time.sleep(5)
        except Exception as e:
            logger.error(f"Worker loop error: {e}")
            time.sleep(10)

if __name__ == "__main__":
    main()

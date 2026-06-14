"""
Reporting sub-package.
Generates student reports, cohort analysis, and data visualizations.
"""
import logging

try:
    from worker_core.student_report import StudentReport, StudentReportGenerator
    from worker_core.progress_report import ProgressReport, ProgressReportGenerator
    from worker_core.cohort_report import CohortReport, CohortReportGenerator
    from worker_core.pdf_generator import PdfGenerator, PDFGenerator
    from worker_core.visualization import Visualization, Visualizer
except ImportError as e:
    logging.error(f"Error in Reports sub-package: {e}")
    StudentReport = StudentReportGenerator = None
    ProgressReport = ProgressReportGenerator = None
    CohortReport = CohortReportGenerator = None
    PdfGenerator = PDFGenerator = None
    Visualization = Visualizer = None

__all__ = [
    "StudentReport", 
    "StudentReportGenerator", 
    "ProgressReport", 
    "ProgressReportGenerator", 
    "CohortReport", 
    "CohortReportGenerator", 
    "PdfGenerator", 
    "PDFGenerator", 
    "Visualization", 
    "Visualizer"
]

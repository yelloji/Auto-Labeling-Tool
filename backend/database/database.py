"""
Database configuration and initialization
"""

import os
import hashlib
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from core.config import settings
from .base import Base
from logging_system.professional_logger import get_professional_logger

# Initialize professional logger
logger = get_professional_logger()

# Create database engine
logger.info("app.database", "Creating database engine", "database_engine_creation", {
    "database_url": settings.DATABASE_URL,
    "is_sqlite": "sqlite" in settings.DATABASE_URL
})

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}
)

logger.info("app.database", "Database engine created successfully", "database_engine_created", {
    "database_url": settings.DATABASE_URL
})

# Create session factory
logger.info("app.database", "Creating session factory", "session_factory_creation", {})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

logger.info("app.database", "Session factory created successfully", "session_factory_created", {})

async def init_db():
    """Initialize database tables"""
    logger.info("app.database", "Starting database initialization", "database_init_start", {})
    
    try:
        # Import all models here to ensure they are registered
        logger.info("app.database", "Importing database models", "models_import_start", {})
        
        from .models import (
            Project, Dataset, Image, Annotation,
            AutoLabelJob,
            Label, DatasetSplit, LabelAnalytics,
            Release, ImageTransformation, ImageVariant,
            AiModel, TrainingSession, DevModeSetting,
            ModelExperiment, RetrainingReference
        )
        from .operations import AiModelOperations
        
        logger.info("app.database", "Database models imported successfully", "models_import_complete", {
            "models_count": 13  # Total number of models imported
        })
        
        # Create all tables
        logger.info("app.database", "Creating database tables", "tables_creation_start", {})
        
        Base.metadata.create_all(bind=engine)
        
        logger.info("app.database", "Database tables created successfully", "tables_creation_complete", {})
        print("Database initialized successfully")
        # Legacy cleanup: drop removed tables if they exist
        try:
            with engine.begin() as conn:
                for tbl in [
                    "training_iterations",
                    "uncertain_samples",
                    "model_versions",
                    "model_usage"
                ]:
                    conn.execute(text(f"DROP TABLE IF EXISTS {tbl}"))
            logger.info("app.database", "Dropped legacy tables if present", "legacy_tables_drop", {
                "dropped": [
                    "training_iterations",
                    "uncertain_samples",
                    "model_versions",
                    "model_usage"
                ]
            })
        except Exception as drop_err:
            logger.warning("errors.system", f"Legacy table drop attempt failed: {drop_err}", "legacy_tables_drop_failed", {
                "error": str(drop_err)
            })

        try:
            with engine.begin() as conn:
                idx_list = conn.execute(text("PRAGMA index_list('ai_models')")).fetchall()
                for idx in idx_list:
                    idx_name = idx[1]
                    if idx_name == 'ix_ai_models_name':
                        conn.execute(text("DROP INDEX IF EXISTS ix_ai_models_name"))
                        logger.info("app.database", "Dropped global unique index ix_ai_models_name", "ai_models_drop_global_name_index")
        except Exception as idx_err:
            logger.warning("errors.system", f"Index drop attempt failed: {idx_err}", "ai_models_drop_global_name_index_failed", {"error": str(idx_err)})

        try:
            with engine.begin() as conn:
                conn.execute(text("UPDATE ai_models SET project_name='global' WHERE project_id IS NULL AND (project_name IS NULL OR project_name='')"))
                conn.execute(text("UPDATE ai_models SET project_name=(SELECT name FROM projects WHERE projects.id=ai_models.project_id) WHERE project_id IS NOT NULL AND (project_name IS NULL OR project_name='')"))
                logger.info("app.database", "Backfilled ai_models.project_name", "ai_models_project_name_backfill")
        except Exception as bf_err:
            logger.warning("errors.system", f"Project name backfill failed: {bf_err}", "ai_models_project_name_backfill_failed", {"error": str(bf_err)})

        
        
        # Training sessions schema migration/additions (safe, additive)
        try:
            with engine.begin() as conn:
                cols = conn.execute(text("PRAGMA table_info(training_sessions)")).fetchall()
                existing = {c[1] for c in cols}
                def add_col(sql):
                    conn.execute(text(sql))
                add_map = {
                    "training_uid": "ALTER TABLE training_sessions ADD COLUMN training_uid TEXT",
                    "project_id": "ALTER TABLE training_sessions ADD COLUMN project_id INTEGER",
                    "project_name": "ALTER TABLE training_sessions ADD COLUMN project_name TEXT",
                    "framework": "ALTER TABLE training_sessions ADD COLUMN framework VARCHAR(32)",
                    "task": "ALTER TABLE training_sessions ADD COLUMN task VARCHAR(32)",
                    "model_name": "ALTER TABLE training_sessions ADD COLUMN model_name TEXT",
                    "dataset_release_id": "ALTER TABLE training_sessions ADD COLUMN dataset_release_id TEXT",
                    "dataset_release_dir": "ALTER TABLE training_sessions ADD COLUMN dataset_release_dir TEXT",
                    "dataset_summary_json": "ALTER TABLE training_sessions ADD COLUMN dataset_summary_json TEXT",
                    "resolved_config_json": "ALTER TABLE training_sessions ADD COLUMN resolved_config_json TEXT",
                    "run_dir": "ALTER TABLE training_sessions ADD COLUMN run_dir TEXT",
                    "weights_dir": "ALTER TABLE training_sessions ADD COLUMN weights_dir TEXT",
                    "best_weights_path": "ALTER TABLE training_sessions ADD COLUMN best_weights_path TEXT",
                    "logs_dir": "ALTER TABLE training_sessions ADD COLUMN logs_dir TEXT",
                    "artifacts_dir": "ALTER TABLE training_sessions ADD COLUMN artifacts_dir TEXT",
                    "progress_pct": "ALTER TABLE training_sessions ADD COLUMN progress_pct INTEGER DEFAULT 0",
                    "best_epoch": "ALTER TABLE training_sessions ADD COLUMN best_epoch INTEGER",
                    "best_box_map50": "ALTER TABLE training_sessions ADD COLUMN best_box_map50 FLOAT DEFAULT 0.0",
                    "best_box_map95": "ALTER TABLE training_sessions ADD COLUMN best_box_map95 FLOAT DEFAULT 0.0",
                    "best_mask_map50": "ALTER TABLE training_sessions ADD COLUMN best_mask_map50 FLOAT",
                    "best_mask_map95": "ALTER TABLE training_sessions ADD COLUMN best_mask_map95 FLOAT",
                    "metrics_json": "ALTER TABLE training_sessions ADD COLUMN metrics_json TEXT",
                    "last_update_at": "ALTER TABLE training_sessions ADD COLUMN last_update_at DATETIME",
                    "error_msg": "ALTER TABLE training_sessions ADD COLUMN error_msg TEXT"
                }
                for col, sql_stmt in add_map.items():
                    if "training_sessions" in {t[0] for t in conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))}:
                        if col not in existing:
                            try:
                                add_col(sql_stmt)
                            except Exception as e:
                                logger.warning("errors.system", f"Could not add column {col} to training_sessions: {e}", "training_sessions_add_column_failed", {"error": str(e), "column": col})
                # Create indexes
                try:
                    conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_training_sessions_project_name ON training_sessions(project_id, name)"))
                except Exception:
                    pass
                try:
                    conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_training_sessions_uid ON training_sessions(training_uid)"))
                except Exception:
                    pass
                try:
                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_training_sessions_project_status ON training_sessions(project_id, status)"))
                except Exception:
                    pass
                # Backfill new quick metrics from legacy columns if present
                try:
                    conn.execute(text("UPDATE training_sessions SET best_box_map50 = COALESCE(best_box_map50, best_map50)"))
                except Exception:
                    pass
                try:
                    conn.execute(text("UPDATE training_sessions SET best_box_map95 = COALESCE(best_box_map95, best_map95)"))
                except Exception:
                    pass
        except Exception as ts_err:
            logger.warning("errors.system", f"Training sessions migration failed: {ts_err}", "training_sessions_migration_failed", {"error": str(ts_err)})

        # Model experiments schema verification & migration (additive)
        try:
            with engine.begin() as conn:
                if "model_experiments" in {t[0] for t in conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))}:
                    cols = conn.execute(text("PRAGMA table_info(model_experiments)")).fetchall()
                    existing = {c[1] for c in cols}
                    
                    # Add missing columns needed for draft persistence and denormalization
                    add_map = {
                        "name": "ALTER TABLE model_experiments ADD COLUMN name VARCHAR",
                        "weights_type": "ALTER TABLE model_experiments ADD COLUMN weights_type VARCHAR DEFAULT 'best'",
                        "project_name": "ALTER TABLE model_experiments ADD COLUMN project_name VARCHAR",
                        "training_name": "ALTER TABLE model_experiments ADD COLUMN training_name VARCHAR",
                        "process_pid": "ALTER TABLE model_experiments ADD COLUMN process_pid INTEGER",
                        "task": "ALTER TABLE model_experiments ADD COLUMN task VARCHAR",
                        "completed_at": "ALTER TABLE model_experiments ADD COLUMN completed_at DATETIME",
                        "duration_sec": "ALTER TABLE model_experiments ADD COLUMN duration_sec FLOAT",
                        "device": "ALTER TABLE model_experiments ADD COLUMN device VARCHAR DEFAULT '0'"
                    }
                    
                    for col, sql_stmt in add_map.items():
                        if col not in existing:
                            try:
                                conn.execute(text(sql_stmt))
                                logger.info("app.database", f"Added missing column {col} to model_experiments", "model_experiments_add_column")
                                # print(f"Migration: Added missing column '{col}' to model_experiments table.")
                            except Exception as e:
                                logger.warning("errors.system", f"Could not add column {col} to model_experiments: {e}", "model_experiments_add_column_failed", {"error": str(e), "column": col})

                    # Re-verify after potential migration
                    cols = conn.execute(text("PRAGMA table_info(model_experiments)")).fetchall()
                    existing = {c[1] for c in cols}
                    logger.info("app.database", "Verified model_experiments schema", "model_experiments_verification", {
                        "columns_found": list(existing),
                        "total_columns": len(existing)
                    })
                    # print(f"Verified model_experiments: {len(existing)} columns found.")
        except Exception as me_err:
            logger.warning("errors.system", f"Model experiments verification/migration failed: {me_err}", "model_experiments_verification_failed", {"error": str(me_err)})

        # Image transformations schema verification & migration (project-scoped pending drafts)
        try:
            with engine.begin() as conn:
                if "image_transformations" in {t[0] for t in conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))}:
                    cols = conn.execute(text("PRAGMA table_info(image_transformations)")).fetchall()
                    existing = {c[1] for c in cols}

                    if "project_id" not in existing:
                        conn.execute(text("ALTER TABLE image_transformations ADD COLUMN project_id INTEGER"))
                        logger.info("app.database", "Added column project_id to image_transformations", "image_transformations_add_project_id")

                    try:
                        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_transformations_project_id ON image_transformations(project_id)"))
                    except Exception:
                        pass

                    try:
                        conn.execute(text("""
                            UPDATE image_transformations
                            SET project_id = (
                                SELECT releases.project_id
                                FROM releases
                                WHERE releases.id = image_transformations.release_id
                            )
                            WHERE project_id IS NULL
                              AND release_id IS NOT NULL
                        """))
                    except Exception as backfill_err:
                        logger.warning("errors.system", f"Could not backfill image_transformations.project_id: {backfill_err}", "image_transformations_backfill_failed", {"error": str(backfill_err)})
        except Exception as it_err:
            logger.warning("errors.system", f"image_transformations migration failed: {it_err}", "image_transformations_migration_failed", {"error": str(it_err)})


        # Retraining references table (User Retraining Mode)
        try:
            with engine.begin() as conn:
                tables = {t[0] for t in conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))}
                if "retraining_references" not in tables:
                    conn.execute(text("""
                        CREATE TABLE retraining_references (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                            training_session_id INTEGER REFERENCES training_sessions(id) ON DELETE SET NULL,
                            release_id TEXT REFERENCES releases(id) ON DELETE SET NULL,
                            assignment_index INTEGER NOT NULL DEFAULT 1,
                            assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            notes TEXT
                        )
                    """))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_retraining_references_project ON retraining_references(project_id)"))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_retraining_references_project_assignment ON retraining_references(project_id, assignment_index)"))
                    logger.info("app.database", "Created retraining_references table", "retraining_references_created")
                else:
                    cols = conn.execute(text("PRAGMA table_info(retraining_references)")).fetchall()
                    col_names = {c[1] for c in cols}
                    create_sql = conn.execute(
                        text("SELECT sql FROM sqlite_master WHERE type='table' AND name='retraining_references'")
                    ).scalar() or ""
                    needs_rebuild = ("PROJECT_ID INTEGER NOT NULL UNIQUE" in create_sql.upper())

                    if needs_rebuild:
                        old_rows = conn.execute(text("""
                            SELECT id, project_id, training_session_id, release_id, assigned_at, notes
                            FROM retraining_references
                            ORDER BY project_id, COALESCE(assigned_at, ''), id
                        """)).mappings().all()

                        conn.execute(text("ALTER TABLE retraining_references RENAME TO retraining_references_old"))
                        conn.execute(text("""
                            CREATE TABLE retraining_references (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                                training_session_id INTEGER REFERENCES training_sessions(id) ON DELETE SET NULL,
                                release_id TEXT REFERENCES releases(id) ON DELETE SET NULL,
                                assignment_index INTEGER NOT NULL DEFAULT 1,
                                assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                notes TEXT
                            )
                        """))
                        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_retraining_references_project ON retraining_references(project_id)"))
                        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_retraining_references_project_assignment ON retraining_references(project_id, assignment_index)"))

                        project_counters = {}
                        for row in old_rows:
                            pid = row["project_id"]
                            project_counters[pid] = project_counters.get(pid, 0) + 1
                            conn.execute(text("""
                                INSERT INTO retraining_references
                                    (id, project_id, training_session_id, release_id, assignment_index, assigned_at, notes)
                                VALUES
                                    (:id, :project_id, :training_session_id, :release_id, :assignment_index, :assigned_at, :notes)
                            """), {
                                "id": row["id"],
                                "project_id": row["project_id"],
                                "training_session_id": row["training_session_id"],
                                "release_id": row["release_id"],
                                "assignment_index": project_counters[pid],
                                "assigned_at": row["assigned_at"],
                                "notes": row["notes"],
                            })

                        conn.execute(text("DROP TABLE retraining_references_old"))
                        logger.info("app.database", "Rebuilt retraining_references table for assignment history", "retraining_references_rebuilt")
                    else:
                        if "assignment_index" not in col_names:
                            conn.execute(text("ALTER TABLE retraining_references ADD COLUMN assignment_index INTEGER"))
                            rows = conn.execute(text("""
                                SELECT id, project_id
                                FROM retraining_references
                                ORDER BY project_id, COALESCE(assigned_at, ''), id
                            """)).mappings().all()
                            project_counters = {}
                            for row in rows:
                                pid = row["project_id"]
                                project_counters[pid] = project_counters.get(pid, 0) + 1
                                conn.execute(text("""
                                    UPDATE retraining_references
                                    SET assignment_index = :assignment_index
                                    WHERE id = :id
                                """), {
                                    "assignment_index": project_counters[pid],
                                    "id": row["id"],
                                })
                        # Older migrations left behind a unique project_id index, which blocks
                        # multiple retraining assignment history rows per project.
                        idx_rows = conn.execute(text("PRAGMA index_list('retraining_references')")).fetchall()
                        for idx in idx_rows:
                            idx_name = idx[1]
                            is_unique = bool(idx[2])
                            if idx_name == "ix_retraining_references_project_id" and is_unique:
                                conn.execute(text("DROP INDEX IF EXISTS ix_retraining_references_project_id"))
                        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_retraining_references_project ON retraining_references(project_id)"))
                        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_retraining_references_project_assignment ON retraining_references(project_id, assignment_index)"))
        except Exception as rr_err:
            logger.warning("errors.system", f"retraining_references migration failed: {rr_err}", "retraining_references_migration_failed", {"error": str(rr_err)})

        # Create directories if they don't exist
        logger.info("app.database", "Creating required directories", "directories_creation_start", {
            "database_path": settings.DATABASE_PATH,
            "projects_dir": settings.PROJECTS_DIR,
            "models_dir": settings.MODELS_DIR
        })
        
        os.makedirs(os.path.dirname(settings.DATABASE_PATH), exist_ok=True)
        os.makedirs(settings.PROJECTS_DIR, exist_ok=True)
        os.makedirs(settings.MODELS_DIR, exist_ok=True)
        
        logger.info("app.database", "Required directories created successfully", "directories_creation_complete", {
            "database_dir": os.path.dirname(settings.DATABASE_PATH),
            "projects_dir": settings.PROJECTS_DIR,
            "models_dir": settings.MODELS_DIR
        })
        # Sync ai_models from models/models_config.json so defaults and custom models are recorded
        try:
            db = SessionLocal()
            summary = AiModelOperations.sync_from_config(db)
            logger.info("app.database", "AiModel sync after init_db completed", "ai_model_sync_post_init", summary)
            try:
                from .models import DevModeSetting
                if db.query(DevModeSetting).count() == 0:
                    db.add(DevModeSetting(
                        password_hash=hashlib.sha256(b"0000").hexdigest(),
                        master_password_hash=hashlib.sha256(b"gevis").hexdigest()
                    ))
                    db.commit()
                    logger.info("app.security", "Seeded default dev password", "dev_password_seeded", {"default": True})
                else:
                    # Migration: add master_password_hash if missing
                    with engine.begin() as conn:
                        cols = conn.execute(text("PRAGMA table_info(dev_mode_settings)")).fetchall()
                        names = {c[1] for c in cols}
                        if "master_password_hash" not in names:
                            conn.execute(text("ALTER TABLE dev_mode_settings ADD COLUMN master_password_hash TEXT"))
                        # Ensure at least one row has master set
                    row = db.query(DevModeSetting).order_by(DevModeSetting.id.asc()).first()
                    if row:
                        changed = False
                        if not row.master_password_hash:
                            row.master_password_hash = hashlib.sha256(b"gevis").hexdigest()
                            changed = True
                        if not row.password_hash:
                            row.password_hash = hashlib.sha256(b"0000").hexdigest()
                            changed = True
                        if changed:
                            db.add(row)
                            db.commit()
            except Exception as seed_err:
                logger.warning("errors.system", f"DevModeSetting seed failed: {seed_err}", "dev_password_seed_failed", {"error": str(seed_err)})
        except Exception as sync_err:
            logger.error("errors.system", f"AiModel sync after init_db failed: {str(sync_err)}", "ai_model_sync_post_init_error", {
                "error": str(sync_err),
                "error_type": type(sync_err).__name__
            })
        finally:
            try:
                db.close()
            except Exception:
                pass
        
        logger.info("app.database", "Database initialization completed successfully", "database_init_complete", {})
        
    except Exception as e:
        logger.error("errors.system", f"Database initialization failed: {str(e)}", "database_init_error", {
            "error": str(e),
            "error_type": type(e).__name__
        })
        raise

def get_db():
    """Get database session"""
    logger.info("app.database", "Creating database session", "database_session_creation", {})
    
    db = SessionLocal()
    
    try:
        logger.info("app.database", "Database session created successfully", "database_session_created", {})
        yield db
    except Exception as e:
        logger.error("errors.system", f"Database session error: {str(e)}", "database_session_error", {
            "error": str(e),
            "error_type": type(e).__name__
        })
        raise
    finally:
        logger.info("app.database", "Closing database session", "database_session_close", {})
        db.close()
        logger.info("app.database", "Database session closed successfully", "database_session_closed", {})
        # Schema migration: add project_name to ai_models if missing
        try:
            with engine.begin() as conn:
                cols = conn.execute(text("PRAGMA table_info(ai_models)")).fetchall()
                col_names = {c[1] for c in cols}
                if "project_name" not in col_names:
                    conn.execute(text("ALTER TABLE ai_models ADD COLUMN project_name TEXT"))
                    logger.info("app.database", "Added column project_name to ai_models", "ai_models_add_project_name")
        except Exception as mig_err:
            logger.warning("errors.system", f"Schema migration for ai_models project_name failed: {mig_err}", "ai_models_add_project_name_failed", {"error": str(mig_err)})

        # Migration: add upload_source to datasets (tracks Retraining Mode uploads)
        try:
            with engine.begin() as conn:
                cols = conn.execute(text("PRAGMA table_info(datasets)")).fetchall()
                col_names = {c[1] for c in cols}
                if "upload_source" not in col_names:
                    conn.execute(text("ALTER TABLE datasets ADD COLUMN upload_source VARCHAR(50)"))
                    logger.info("app.database", "Added column upload_source to datasets", "datasets_add_upload_source")
        except Exception as mig_err:
            logger.warning("errors.system", f"Schema migration for datasets upload_source failed: {mig_err}", "datasets_add_upload_source_failed", {"error": str(mig_err)})

        # Migration: add release_source to releases (tracks Retraining Mode releases)
        try:
            with engine.begin() as conn:
                cols = conn.execute(text("PRAGMA table_info(releases)")).fetchall()
                col_names = {c[1] for c in cols}
                if "release_source" not in col_names:
                    conn.execute(text("ALTER TABLE releases ADD COLUMN release_source VARCHAR(50)"))
                    logger.info("app.database", "Added column release_source to releases", "releases_add_release_source")
        except Exception as mig_err:
            logger.warning("errors.system", f"Schema migration for releases release_source failed: {mig_err}", "releases_add_release_source_failed", {"error": str(mig_err)})

        # Migration: add tile_enabled to projects (tile project mode flag)
        try:
            with engine.begin() as conn:
                cols = conn.execute(text("PRAGMA table_info(projects)")).fetchall()
                col_names = {c[1] for c in cols}
                if "tile_enabled" not in col_names:
                    conn.execute(text("ALTER TABLE projects ADD COLUMN tile_enabled BOOLEAN DEFAULT 0"))
                    logger.info("app.database", "Added column tile_enabled to projects", "projects_add_tile_enabled")
        except Exception as mig_err:
            logger.warning("errors.system", f"Schema migration for projects tile_enabled failed: {mig_err}", "projects_add_tile_enabled_failed", {"error": str(mig_err)})
